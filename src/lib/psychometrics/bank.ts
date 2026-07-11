// VIFM Psychometrics - Tier 2 item bank (SME-reviewed) loader + readiness.
//
// Tier 1 runs from code (AI + a static fallback deck), so the bank starts EMPTY.
// This module is the SME workflow that fills it: each scale accumulates reviewed
// items, the response log yields a Cronbach's α, and a norm group (psy_norms)
// supplies the percentile sample. instrumentTier() then gates whether a scale is
// still INDICATIVE (Tier 1) or fully CALIBRATED (Tier 2). The dashboard always
// lists every framework scale (even with zero bank rows) so the SME sees the
// target. Cognitive (Logica) is the only psychometric instrument - the Big-Five
// personality bank was retired (the behavioural instrument is now Persona).
//
// Everything is tolerant of migrations 00065/00067 not being applied - a missing
// table simply reads as "0 items / no norms / indicative".

import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import {
  COGNITIVE_SUBTESTS,
  COGNITIVE_INSTRUMENT,
  COGNITIVE_BLUEPRINT, facetKeysForSubtest,
  type CognitiveDifficulty,
} from "./framework";
import { cronbachAlpha, instrumentTier, type PsyTier } from "./calibration";

export type PsyKind = "cognitive";
export type PsyItemStatus = "draft" | "in_review" | "approved" | "retired" | "rejected";
export type PsyItemKind = "mcq" | "likert";

/** Minimum approved items per scale before the bank can drive an administration. */
export const ASSEMBLE_MIN = 4;

// Framework scale list per instrument - the dashboard's spine (always shown).
type ScaleDef = { key: string; nameEn: string; nameAr: string };
const SCALE_DEFS: Record<PsyKind, ScaleDef[]> = {
  cognitive: COGNITIVE_SUBTESTS.map((s) => ({ key: s.key, nameEn: s.name_en, nameAr: s.name_ar })),
};
const ITEM_KIND: Record<PsyKind, PsyItemKind> = { cognitive: "mcq" };
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
  facet: string | null;
  ar_reviewed: boolean;
  rationale: string | null;
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

const EMPTY_COUNTS = (): Record<PsyItemStatus, number> => ({ draft: 0, in_review: 0, approved: 0, retired: 0, rejected: 0 });
const PSY_STATUSES = ["draft", "in_review", "approved", "retired", "rejected"] as const;

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
  facet: string | null;
  ar_reviewed: boolean | null;
  rationale: string | null;
  status: string;
  source: string | null;
};
type RespRow = { result_id: string; item_ref: string | null; scale_key: string | null; response: number | null; correct: boolean | null };

const asStrArr = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : null);

/**
 * Cronbach's α for one scale from bank-item responses only (Tier-1 code items,
 * whose ids don't match bank rows, are excluded - α reflects the BANK). mcq is
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
      if (i.kind === "cognitive") kindByInstrumentId.set(i.id, i.kind);
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
      .select("id, scale_id, kind, stem_en, stem_ar, options_en, options_ar, correct_index, reverse_keyed, difficulty, facet, ar_reviewed, rationale, status, source");
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
        facet: it.facet ?? null,
        ar_reviewed: !!it.ar_reviewed,
        rationale: it.rationale ?? null,
        status: PSY_STATUSES.includes(it.status as never) ? (it.status as PsyItemStatus) : "draft",
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

  // response log (for α) - only rows referencing a known bank item matter
  const kindByScaleKey = new Map<string, PsyKind>(); // scaleKey → kind (no key collisions across instruments)
  for (const { kind, scaleKey } of Array.from(scaleById.values())) kindByScaleKey.set(scaleKey, kind);
  const respByScaleKind = new Map<string, RespRow[]>(); // `${kind}:${scaleKey}` → rows
  try {
    // Paginate the whole response log: a bare .limit(20000) is CLAMPED to the
    // 1000-row PostgREST cap, so the Cronbach's alpha (the Tier-2 reliability gate)
    // would be computed from an arbitrary ~1000-row slice once responses accumulate.
    const resp = await fetchAllPages<RespRow>((from, to) =>
      svc.from("psy_item_responses")
        .select("id, result_id, item_ref, scale_key, response, correct")
        .order("id")
        .range(from, to),
    );
    for (const r of resp) {
      if (!r.item_ref || !bankItemIds.has(r.item_ref) || !r.scale_key) continue;
      const kind = kindByScaleKey.get(r.scale_key);
      if (!kind) continue;
      const key = `${kind}:${r.scale_key}`;
      const arr = respByScaleKind.get(key) ?? [];
      arr.push(r);
      respByScaleKind.set(key, arr);
    }
  } catch {
    /* response log unavailable - α stays null */
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
 * structure the first time an admin drafts/adds an item - no structure-only
 * migration needed. Service-role; server-only.
 */
export async function resolveScaleId(kind: PsyKind, scaleKey: string): Promise<string | null> {
  const svc = createServiceClient();
  const inst = COGNITIVE_INSTRUMENT;

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

type ApprovedRow = ItemRow & { times_administered: number };
type AssembledCognitive = { id: string; scale: string; stem: string; options: string[]; correct: number; difficulty: "easy" | "medium" | "hard" };

/**
 * Assemble a keyed cognitive test from APPROVED bank items.
 *
 * Blueprint-aware: for each in-scope subtest it draws
 * COGNITIVE_BLUEPRINT.servedPerFacetByDifficulty items from EVERY (facet x
 * difficulty) cell, least-administered-first, preferring items NOT in
 * `opts.exclusionIds` (a retaker's previously-seen items). If ANY cell cannot be
 * filled - too few approved items, or in Arabic too few with a complete MSA
 * translation - the whole assembly FAILS SAFE with null, so the caller 503s
 * rather than serve a construct-incomplete or silently-English form. This is what
 * guarantees two sittings measure the same construct mix, and never a 3-item deck.
 *
 * Item ids are real psy_items uuids, so the response log is calibratable and the
 * runner bumps times_administered on the served ids (exposure rotation).
 */
export async function assembleFromBank(
  kind: PsyKind,
  lang: "en" | "ar",
  subtests?: string[],
  opts?: { exclusionIds?: Set<string> }
): Promise<{ kind: "cognitive"; items: AssembledCognitive[]; ai_generated: boolean } | null> {
  try {
    const svc = createServiceClient();
    const inst = COGNITIVE_INSTRUMENT;
    const { data: instRow } = await svc.from("psy_instruments").select("id").eq("code", inst.code).maybeSingle();
    if (!instRow) return null;
    const { data: scaleRows } = await svc.from("psy_scales").select("id, key").eq("instrument_id", (instRow as { id: string }).id);
    const scales = (scaleRows ?? []) as { id: string; key: string }[];
    if (!scales.length) return null;
    const scaleIds = scales.map((s) => s.id);

    const { data: itemRows } = await svc
      .from("psy_items")
      .select("id, scale_id, stem_en, stem_ar, options_en, options_ar, correct_index, reverse_keyed, difficulty, facet, times_administered")
      // Serve the FIXED authored bank (approved vetted + in_review provisional)
      // before falling back to the live-AI/static Tier-1 source - we already have
      // the questions. Logica is indicative regardless, so mixing is safe.
      .in("status", ["approved", "in_review"])
      .in("scale_id", scaleIds)
      .order("times_administered", { ascending: true });
    const items = (itemRows ?? []) as ApprovedRow[];

    {
      const bp = COGNITIVE_BLUEPRINT;
      const exclude = opts?.exclusionIds ?? new Set<string>();
      const difficulties: CognitiveDifficulty[] = ["easy", "medium", "hard"];

      // in-scope subtests (SD-4 subset honoured end-to-end)
      let framework = SCALE_DEFS.cognitive.map((s) => s.key);
      if (subtests && subtests.length > 0) framework = framework.filter((k) => subtests.includes(k));
      if (framework.length === 0) return null;

      // servable in the requested language: AR requires a COMPLETE MSA translation
      // (no silent English fallback - that would re-open the Arabic-parity defect).
      const servable = (it: ApprovedRow): boolean => {
        if (it.correct_index == null) return false;
        if (lang === "ar") {
          const oa = asStrArr(it.options_ar);
          return !!(it.stem_ar && it.stem_ar.trim()) && !!oa && oa.length >= 2 && it.correct_index < oa.length;
        }
        const oe = asStrArr(it.options_en);
        return !!oe && oe.length >= 2 && it.correct_index < oe.length;
      };

      // (facet:difficulty) -> servable items, already least-administered-first.
      const cells = new Map<string, ApprovedRow[]>();
      for (const it of items) {
        if (!it.facet || !it.difficulty || !servable(it)) continue;
        const ck = `${it.facet}:${it.difficulty}`;
        const arr = cells.get(ck) ?? [];
        arr.push(it);
        cells.set(ck, arr);
      }

      const out: AssembledCognitive[] = [];
      for (const subtest of framework) {
        const facets = facetKeysForSubtest(subtest);
        if (facets.length === 0) return null;
        for (const facet of facets) {
          for (const diff of difficulties) {
            const need = bp.servedPerFacetByDifficulty[diff];
            const pool = cells.get(`${facet}:${diff}`) ?? [];
            // Prefer unseen (exclusion soft): a retaker who has exhausted a cell
            // still gets served rather than 503'd - exclusion only reduces repeats.
            const ordered = [...pool.filter((it) => !exclude.has(it.id)), ...pool.filter((it) => exclude.has(it.id))];
            if (ordered.length < need) return null; // fail safe: cell can't fill
            for (const it of ordered.slice(0, need)) {
              const options = (lang === "ar" ? asStrArr(it.options_ar) : asStrArr(it.options_en)) ?? [];
              out.push({
                id: it.id,
                scale: subtest,
                stem: (lang === "ar" ? it.stem_ar : it.stem_en) || it.stem_en,
                options,
                correct: it.correct_index as number,
                difficulty: diff,
              });
            }
          }
        }
      }
      // Exact-count assertion: every subtest emitted its full fixed form.
      if (out.length !== framework.length * bp.servedPerSubtest) return null;
      return { kind: "cognitive", items: out, ai_generated: false };
    }
  } catch {
    return null;
  }
}
