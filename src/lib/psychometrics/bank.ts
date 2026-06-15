// VIFM Psychometrics — Tier 2 item bank (SME-reviewed) loader + readiness.
//
// Tier 1 runs from code (Mini-IPIP + AI), so the bank starts EMPTY. This module
// is the SME workflow that fills it: each scale accumulates reviewed items, the
// response log yields a Cronbach's α, and a norm group (psy_norms) supplies the
// percentile sample. instrumentTier() then gates whether a scale is still
// INDICATIVE (Tier 1) or fully CALIBRATED (Tier 2). The dashboard always lists
// every framework scale (even with zero bank rows) so the SME sees the target.
//
// Everything is tolerant of migrations 00065/00067 not being applied — a missing
// table simply reads as "0 items / no norms / indicative".

import { createServiceClient } from "@/lib/supabase/server";
import {
  COGNITIVE_SUBTESTS, BIG_FIVE,
  COGNITIVE_INSTRUMENT, PERSONALITY_INSTRUMENT,
} from "./framework";
import { cronbachAlpha, instrumentTier, type PsyTier } from "./calibration";

export type PsyKind = "cognitive" | "personality";
export type PsyItemStatus = "draft" | "in_review" | "approved" | "retired";
export type PsyItemKind = "mcq" | "likert";

/** Minimum approved items per scale before the bank can drive an administration. */
export const ASSEMBLE_MIN = 4;

// Framework scale list per instrument — the dashboard's spine (always shown).
type ScaleDef = { key: string; nameEn: string; nameAr: string };
const SCALE_DEFS: Record<PsyKind, ScaleDef[]> = {
  cognitive: COGNITIVE_SUBTESTS.map((s) => ({ key: s.key, nameEn: s.name_en, nameAr: s.name_ar })),
  personality: BIG_FIVE.map((t) => ({ key: t.key, nameEn: t.name_en, nameAr: t.name_ar })),
};
const ITEM_KIND: Record<PsyKind, PsyItemKind> = { cognitive: "mcq", personality: "likert" };
// Personality/OCEAN retired - the behavioural instrument is now Persona (the
// 38-competency self-assessment), so the bank console manages cognitive only.
const INSTRUMENTS: { kind: PsyKind; code: string; nameEn: string; nameAr: string }[] = [
  { kind: "cognitive", code: COGNITIVE_INSTRUMENT.code, nameEn: COGNITIVE_INSTRUMENT.name_en, nameAr: COGNITIVE_INSTRUMENT.name_ar },
];

export type BankItem = {
  id: string;
  scaleKey: string;
  kind: PsyItemKind;
  stem_en: string;
  stem_ar: string | null;
  options_en: string[] | null;
  options_ar: string[] | null;
  correct_index: number | null;
  reverse_keyed: boolean;
  difficulty: "easy" | "medium" | "hard" | null;
  status: PsyItemStatus;
  source: string;
};

export type ScaleReadiness = {
  instrumentKind: PsyKind;
  scaleKey: string;
  nameEn: string;
  nameAr: string;
  itemKind: PsyItemKind;
  counts: Record<PsyItemStatus, number>;
  approved: number;
  alpha: number | null; // Cronbach's α from the response log (null = too little data)
  alphaN: number;       // complete-case respondents in the α computation
  normN: number;        // norm-group size for this scale (psy_norms)
  tier: PsyTier;        // indicative | calibrated for THIS scale
  items: BankItem[];
};

export type InstrumentReadiness = {
  kind: PsyKind;
  code: string;
  nameEn: string;
  itemKind: PsyItemKind;
  scales: ScaleReadiness[];
  tier: PsyTier; // calibrated only when EVERY scale is calibrated
};

export type PsyBankView = {
  tablesReady: boolean;
  normsReady: boolean;
  instruments: InstrumentReadiness[];
};

const EMPTY_COUNTS = (): Record<PsyItemStatus, number> => ({ draft: 0, in_review: 0, approved: 0, retired: 0 });

type ItemRow = {
  id: string;
  scale_id: string;
  kind: string;
  stem_en: string;
  stem_ar: string | null;
  options_en: unknown;
  options_ar: unknown;
  correct_index: number | null;
  reverse_keyed: boolean | null;
  difficulty: string | null;
  status: string;
  source: string | null;
};
type RespRow = { result_id: string; item_ref: string | null; scale_key: string | null; response: number | null; correct: boolean | null };

const asStrArr = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : null);

/**
 * Cronbach's α for one scale from bank-item responses only (Tier-1 code items,
 * whose ids don't match bank rows, are excluded — α reflects the BANK). mcq is
 * scored 0/1 from `correct`; likert is reverse-keyed (6−x) per the item's flag.
 */
function alphaForScale(
  itemKind: PsyItemKind,
  bankMeta: Map<string, { reverse: boolean }>,
  rows: RespRow[]
): { alpha: number | null; n: number } {
  const byResult = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.item_ref || !bankMeta.has(r.item_ref)) continue;
    let score: number | null = null;
    if (itemKind === "mcq") score = r.correct === true ? 1 : r.correct === false ? 0 : null;
    else if (typeof r.response === "number") score = bankMeta.get(r.item_ref)!.reverse ? 6 - r.response : r.response;
    if (score === null) continue;
    let m = byResult.get(r.result_id);
    if (!m) { m = new Map(); byResult.set(r.result_id, m); }
    m.set(r.item_ref, score);
  }
  const respondents = Array.from(byResult.values());
  if (respondents.length < 3) return { alpha: null, n: respondents.length };

  // The stable item set = items answered by ≥60% of respondents; keep complete cases.
  const freq = new Map<string, number>();
  for (const m of respondents) for (const k of Array.from(m.keys())) freq.set(k, (freq.get(k) ?? 0) + 1);
  const threshold = respondents.length * 0.6;
  const core = Array.from(freq.entries()).filter(([, c]) => c >= threshold).map(([k]) => k).sort();
  if (core.length < 2) return { alpha: null, n: 0 };
  const matrix: number[][] = [];
  for (const m of respondents) {
    if (core.every((k) => m.has(k))) matrix.push(core.map((k) => m.get(k) as number));
  }
  if (matrix.length < 3) return { alpha: null, n: matrix.length };
  return { alpha: cronbachAlpha(matrix), n: matrix.length };
}

/** Load the full bank + per-scale readiness across both instruments. */
export async function loadPsyBank(): Promise<PsyBankView> {
  const svc = createServiceClient();
  let tablesReady = true;
  let normsReady = true;

  // instruments + scales → scaleId → {kind, scaleKey}
  const scaleById = new Map<string, { kind: PsyKind; scaleKey: string }>();
  const scaleIdByKey = new Map<string, string>(); // `${kind}:${scaleKey}` → scaleId
  try {
    const { data: instruments } = await svc.from("psy_instruments").select("id, kind, code");
    const { data: scales } = await svc.from("psy_scales").select("id, instrument_id, key");
    const kindByInstrumentId = new Map<string, PsyKind>();
    for (const i of (instruments ?? []) as { id: string; kind: string; code: string }[]) {
      if (i.kind === "cognitive" || i.kind === "personality") kindByInstrumentId.set(i.id, i.kind);
    }
    for (const s of (scales ?? []) as { id: string; instrument_id: string; key: string }[]) {
      const kind = kindByInstrumentId.get(s.instrument_id);
      if (!kind) continue;
      scaleById.set(s.id, { kind, scaleKey: s.key });
      scaleIdByKey.set(`${kind}:${s.key}`, s.id);
    }
  } catch {
    tablesReady = false;
  }

  // items
  const itemsByScaleId = new Map<string, BankItem[]>();
  const bankItemIds = new Map<string, { reverse: boolean }>();
  try {
    const { data: items } = await svc
      .from("psy_items")
      .select("id, scale_id, kind, stem_en, stem_ar, options_en, options_ar, correct_index, reverse_keyed, difficulty, status, source");
    for (const it of (items ?? []) as ItemRow[]) {
      const loc = scaleById.get(it.scale_id);
      if (!loc) continue;
      const bi: BankItem = {
        id: it.id,
        scaleKey: loc.scaleKey,
        kind: it.kind === "likert" ? "likert" : "mcq",
        stem_en: it.stem_en,
        stem_ar: it.stem_ar,
        options_en: asStrArr(it.options_en),
        options_ar: asStrArr(it.options_ar),
        correct_index: it.correct_index,
        reverse_keyed: !!it.reverse_keyed,
        difficulty: (["easy", "medium", "hard"] as const).includes(it.difficulty as never) ? (it.difficulty as BankItem["difficulty"]) : null,
        status: (["draft", "in_review", "approved", "retired"] as const).includes(it.status as never) ? (it.status as PsyItemStatus) : "draft",
        source: it.source ?? "seed",
      };
      const arr = itemsByScaleId.get(it.scale_id) ?? [];
      arr.push(bi);
      itemsByScaleId.set(it.scale_id, arr);
      bankItemIds.set(it.id, { reverse: bi.reverse_keyed });
    }
  } catch {
    tablesReady = false;
  }

  // response log (for α) — only rows referencing a known bank item matter
  const kindByScaleKey = new Map<string, PsyKind>(); // scaleKey → kind (no key collisions across instruments)
  for (const { kind, scaleKey } of Array.from(scaleById.values())) kindByScaleKey.set(scaleKey, kind);
  const respByScaleKind = new Map<string, RespRow[]>(); // `${kind}:${scaleKey}` → rows
  try {
    const { data: resp } = await svc
      .from("psy_item_responses")
      .select("result_id, item_ref, scale_key, response, correct")
      .limit(20000);
    for (const r of (resp ?? []) as RespRow[]) {
      if (!r.item_ref || !bankItemIds.has(r.item_ref) || !r.scale_key) continue;
      const kind = kindByScaleKey.get(r.scale_key);
      if (!kind) continue;
      const key = `${kind}:${r.scale_key}`;
      const arr = respByScaleKind.get(key) ?? [];
      arr.push(r);
      respByScaleKind.set(key, arr);
    }
  } catch {
    /* response log unavailable — α stays null */
  }

  // norms (per kind+scale)
  const normByKindScale = new Map<string, number>(); // `${kind}:${scaleKey}` → n
  try {
    const { data: norms } = await svc.from("psy_norms").select("kind, scale_key, n");
    for (const nm of (norms ?? []) as { kind: string; scale_key: string; n: number }[]) {
      normByKindScale.set(`${nm.kind}:${nm.scale_key}`, Number(nm.n));
    }
  } catch {
    normsReady = false;
  }

  const instruments: InstrumentReadiness[] = INSTRUMENTS.map((inst) => {
    const itemKind = ITEM_KIND[inst.kind];
    const scales: ScaleReadiness[] = SCALE_DEFS[inst.kind].map((def) => {
      const scaleId = scaleIdByKey.get(`${inst.kind}:${def.key}`);
      const items = (scaleId ? itemsByScaleId.get(scaleId) : undefined) ?? [];
      const counts = EMPTY_COUNTS();
      for (const it of items) counts[it.status] += 1;
      const approvedItems = items.filter((it) => it.status === "approved");
      const meta = new Map<string, { reverse: boolean }>();
      for (const it of approvedItems) meta.set(it.id, { reverse: it.reverse_keyed });
      const { alpha, n: alphaN } = alphaForScale(itemKind, meta, respByScaleKind.get(`${inst.kind}:${def.key}`) ?? []);
      const normN = normByKindScale.get(`${inst.kind}:${def.key}`) ?? 0;
      const tier = instrumentTier({ approvedPerScale: counts.approved, minAlpha: alpha ?? 0, normN });
      return {
        instrumentKind: inst.kind,
        scaleKey: def.key,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        itemKind,
        counts,
        approved: counts.approved,
        alpha,
        alphaN,
        normN,
        tier,
        items: items.sort((a, b) => a.status.localeCompare(b.status) || a.stem_en.localeCompare(b.stem_en)),
      };
    });
    const tier: PsyTier = scales.length > 0 && scales.every((s) => s.tier === "calibrated") ? "calibrated" : "indicative";
    return { kind: inst.kind, code: inst.code, nameEn: inst.nameEn, itemKind, scales, tier };
  });

  return { tablesReady, normsReady, instruments };
}

/**
 * Resolve (upsert) the psy_scales row id for a framework scale, creating the
 * parent psy_instruments row on first use. Lets the bank self-bootstrap its
 * structure the first time an admin drafts/adds an item — no structure-only
 * migration needed. Service-role; server-only.
 */
export async function resolveScaleId(kind: PsyKind, scaleKey: string): Promise<string | null> {
  const svc = createServiceClient();
  const inst = kind === "cognitive" ? COGNITIVE_INSTRUMENT : PERSONALITY_INSTRUMENT;

  let instrumentId: string | null = null;
  const { data: foundInst } = await svc.from("psy_instruments").select("id").eq("code", inst.code).maybeSingle();
  if (foundInst) instrumentId = (foundInst as { id: string }).id;
  else {
    const { data: created } = await svc
      .from("psy_instruments")
      .insert({ kind, code: inst.code, name_en: inst.name_en, name_ar: inst.name_ar })
      .select("id")
      .single();
    instrumentId = (created as { id: string } | null)?.id ?? null;
  }
  if (!instrumentId) return null;

  const def = SCALE_DEFS[kind].find((s) => s.key === scaleKey);
  if (!def) return null;
  const { data: foundScale } = await svc
    .from("psy_scales")
    .select("id")
    .eq("instrument_id", instrumentId)
    .eq("key", scaleKey)
    .maybeSingle();
  if (foundScale) return (foundScale as { id: string }).id;
  const { data: createdScale } = await svc
    .from("psy_scales")
    .insert({ instrument_id: instrumentId, key: scaleKey, name_en: def.nameEn, name_ar: def.nameAr })
    .select("id")
    .single();
  return (createdScale as { id: string } | null)?.id ?? null;
}

/**
 * Assemble a full keyed test from APPROVED bank items when every scale has
 * ≥ASSEMBLE_MIN — else return null so the caller falls back to Tier-1 (code/AI).
 * Item ids are the real psy_items uuids, so the response log is calibratable.
 */
export async function assembleFromBank(
  kind: PsyKind,
  lang: "en" | "ar"
): Promise<
  | { kind: "cognitive"; items: { id: string; scale: string; stem: string; options: string[]; correct: number; difficulty: "easy" | "medium" | "hard" }[]; ai_generated: boolean }
  | { kind: "personality"; items: { id: string; scale: "O" | "C" | "E" | "A" | "S"; text: string; reverse: boolean }[] }
  | null
> {
  try {
    const svc = createServiceClient();
    const inst = kind === "cognitive" ? COGNITIVE_INSTRUMENT : PERSONALITY_INSTRUMENT;
    const { data: instRow } = await svc.from("psy_instruments").select("id").eq("code", inst.code).maybeSingle();
    if (!instRow) return null;
    const { data: scaleRows } = await svc.from("psy_scales").select("id, key").eq("instrument_id", (instRow as { id: string }).id);
    const scales = (scaleRows ?? []) as { id: string; key: string }[];
    if (!scales.length) return null;
    const scaleIds = scales.map((s) => s.id);
    const keyById = new Map(scales.map((s) => [s.id, s.key] as const));

    const { data: itemRows } = await svc
      .from("psy_items")
      .select("id, scale_id, stem_en, stem_ar, options_en, options_ar, correct_index, reverse_keyed, difficulty, times_administered")
      .eq("status", "approved")
      .in("scale_id", scaleIds)
      .order("times_administered", { ascending: true });
    const items = (itemRows ?? []) as (ItemRow & { times_administered: number })[];

    // Group approved items by framework scale key; require ≥ASSEMBLE_MIN for ALL.
    const byKey = new Map<string, (ItemRow & { times_administered: number })[]>();
    for (const it of items) {
      const k = keyById.get(it.scale_id);
      if (!k) continue;
      const arr = byKey.get(k) ?? [];
      arr.push(it);
      byKey.set(k, arr);
    }
    const framework = SCALE_DEFS[kind].map((s) => s.key);
    if (!framework.every((k) => (byKey.get(k)?.length ?? 0) >= ASSEMBLE_MIN)) return null;

    const cap = kind === "cognitive" ? 5 : 8;
    if (kind === "cognitive") {
      const out: { id: string; scale: string; stem: string; options: string[]; correct: number; difficulty: "easy" | "medium" | "hard" }[] = [];
      for (const k of framework) {
        for (const it of (byKey.get(k) ?? []).slice(0, cap)) {
          const options = (lang === "ar" ? asStrArr(it.options_ar) : asStrArr(it.options_en)) ?? asStrArr(it.options_en) ?? [];
          if (options.length < 2 || it.correct_index == null) continue;
          out.push({
            id: it.id, scale: k,
            stem: (lang === "ar" ? it.stem_ar : it.stem_en) || it.stem_en,
            options, correct: it.correct_index,
            difficulty: (["easy", "medium", "hard"] as const).includes(it.difficulty as never) ? (it.difficulty as "easy" | "medium" | "hard") : "medium",
          });
        }
      }
      return out.length >= framework.length * ASSEMBLE_MIN ? { kind: "cognitive", items: out, ai_generated: false } : null;
    }

    const out: { id: string; scale: "O" | "C" | "E" | "A" | "S"; text: string; reverse: boolean }[] = [];
    for (const k of framework) {
      for (const it of (byKey.get(k) ?? []).slice(0, cap)) {
        out.push({ id: it.id, scale: k as "O" | "C" | "E" | "A" | "S", text: (lang === "ar" ? it.stem_ar : it.stem_en) || it.stem_en, reverse: !!it.reverse_keyed });
      }
    }
    return out.length >= framework.length * ASSEMBLE_MIN ? { kind: "personality", items: out } : null;
  } catch {
    return null;
  }
}
