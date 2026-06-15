/**
 * Certified FUNCTION item bank (Phase-3 strand #1).
 *
 * The defensibility substrate behind a function-titled 'technical_proficiency'
 * credential. A function certifies when every blueprint skill has enough
 * SME-APPROVED items (status='approved') — items keyed by SKILL with
 * domain_key NULL, so one approved pool for "Invoice Processing & 3-Way Match"
 * serves every function that lists that skill (standard or JD-derived).
 *
 *   • functionBankReadiness() — per-skill approved counts vs the coverage floor.
 *   • getFunctionCutScore()   — the documented passing standard for a function.
 *   • buildCertifiedFunctionTest() — assemble a key-bearing TechTest from
 *     approved per-skill items, or null when any skill is below the floor.
 *   • draftFunctionSkillItems() — AI-author candidate items for ONE skill.
 *
 * Certified items are classic 4-option single MCQ (the richer multi/scenario
 * types live only on the indicative path). Tolerant of migration 00059 / 00053
 * being absent (everything no-ops → indicative).
 */
import { createServiceClient } from "@/lib/supabase/server";
import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import {
  CERTIFIED_TEST_SIZE,
  ASSEMBLY_COLS,
  ASSEMBLY_COLS_LEGACY,
  bankRowUsable,
  bankRowToTechItem,
  mixedDraftPrompt,
  validateBankDraft,
  repairBankDraftsArabic,
  insertBankDrafts,
  MIXED_ITEM_WRITER_SYSTEM,
  type AssemblyRow,
  type BankDraft,
  type BankItem,
} from "./technical-item-bank";
import { calibrateItemFields } from "@/lib/scoring/tech-cat";
import type { TechItem, TechTest } from "@/lib/ai/technical-assessment";

const DEFAULT_PASS_PCT = 70;
const DEFAULT_MIN_PER_SKILL = 2;
const DEFAULT_DRAW_PER_SKILL = 4;
/** Min calibrated approved items before an adaptive (CAT) sitting is worthwhile. */
export const ADAPTIVE_MIN_POOL = 10;

export type FunctionCutScore = {
  passPct: number;
  minItemsPerSkill: number;
  method: string | null;
  rationale: string | null;
};

export type SkillReadiness = { skill: string; approved: number };
export type FunctionReadiness = {
  perSkill: SkillReadiness[];
  minItemsPerSkill: number;
  /** Every blueprint skill meets the floor → the function can certify. */
  certifiable: boolean;
  approvedTotal: number;
  /** Approved items with a calibrated Rasch difficulty (the CAT candidate pool). */
  calibratedTotal: number;
  /** Enough calibrated items to run an adaptive (CAT) sitting. */
  adaptiveReady: boolean;
};

/** One calibrated, key-bearing item for the adaptive (CAT) pool. */
export type AdaptivePoolItem = {
  id: string;
  skill: string;
  b: number; // Rasch difficulty (logit)
  question_en: string;
  question_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  difficulty: "easy" | "medium" | "hard";
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Approved-item count per skill, across the function-skill bank (domain_key NULL). */
export async function approvedCountBySkill(skills: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of skills) out[s] = 0;
  if (skills.length === 0) return out;
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("skill")
      .is("domain_key", null)
      .eq("status", "approved")
      .in("skill", skills);
    for (const r of (data as { skill: string }[] | null) ?? []) {
      if (r.skill in out) out[r.skill] += 1;
    }
  } catch {
    /* 00059 not applied — all zero */
  }
  return out;
}

/** The documented passing standard for a function (defaults when unset/absent). */
export async function getFunctionCutScore(functionId: string | null): Promise<FunctionCutScore> {
  const fallback: FunctionCutScore = {
    passPct: DEFAULT_PASS_PCT,
    minItemsPerSkill: DEFAULT_MIN_PER_SKILL,
    method: null,
    rationale: null,
  };
  if (!functionId) return fallback;
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("technical_function_cut_scores")
      .select("pass_pct, min_items_per_skill, method, rationale")
      .eq("function_id", functionId)
      .maybeSingle();
    if (!data) return fallback;
    return {
      passPct: Number(data.pass_pct ?? DEFAULT_PASS_PCT),
      minItemsPerSkill: Number(data.min_items_per_skill ?? DEFAULT_MIN_PER_SKILL),
      method: (data.method as string | null) ?? null,
      rationale: (data.rationale as string | null) ?? null,
    };
  } catch {
    return fallback;
  }
}

/** Count of APPROVED + CALIBRATED (irt_b set) items across the given skills. */
export async function calibratedApprovedCount(skills: string[]): Promise<number> {
  if (skills.length === 0) return 0;
  try {
    const sb = createServiceClient();
    const { count } = await sb
      .from("tech_assessment_items")
      .select("id", { count: "exact", head: true })
      .is("domain_key", null)
      .eq("status", "approved")
      .not("irt_b", "is", null)
      .in("skill", skills);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Per-skill readiness for a function's blueprint vs its coverage floor. */
export async function functionBankReadiness(skillsEn: string[], functionId: string | null): Promise<FunctionReadiness> {
  const cut = await getFunctionCutScore(functionId);
  const counts = await approvedCountBySkill(skillsEn);
  const perSkill = skillsEn.map((skill) => ({ skill, approved: counts[skill] ?? 0 }));
  const approvedTotal = perSkill.reduce((s, p) => s + p.approved, 0);
  const certifiable = skillsEn.length > 0 && perSkill.every((p) => p.approved >= cut.minItemsPerSkill);
  const calibratedTotal = await calibratedApprovedCount(skillsEn);
  return {
    perSkill,
    minItemsPerSkill: cut.minItemsPerSkill,
    certifiable,
    approvedTotal,
    calibratedTotal,
    adaptiveReady: calibratedTotal >= ADAPTIVE_MIN_POOL,
  };
}

/**
 * The calibrated, key-bearing pool for an adaptive (CAT) sitting: APPROVED items
 * across the function's skills that carry a Rasch difficulty (irt_b). Returns
 * null when fewer than ADAPTIVE_MIN_POOL — the caller then serves a fixed form.
 * Held server-side only (the answer key never reaches the browser).
 */
export async function adaptiveReadyRefs(
  functions: { ref: string; skillsEn: string[] }[]
): Promise<Set<string>> {
  const ready = new Set<string>();
  if (functions.length === 0) return ready;
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("skill")
      .is("domain_key", null)
      .eq("status", "approved")
      .not("irt_b", "is", null);
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as { skill: string }[]) counts[r.skill] = (counts[r.skill] ?? 0) + 1;
    for (const f of functions) {
      const total = f.skillsEn.reduce((s, sk) => s + (counts[sk] ?? 0), 0);
      if (total >= ADAPTIVE_MIN_POOL) ready.add(f.ref);
    }
  } catch {
    /* uncalibrated / not migrated — none ready */
  }
  return ready;
}

export async function buildAdaptivePool(input: {
  skillsEn: string[];
  functionId: string | null;
}): Promise<AdaptivePoolItem[] | null> {
  if (input.skillsEn.length === 0) return null;
  try {
    const sb = createServiceClient();
    // CAT is single-best-answer only (scenario needs its stem; multi isn't
    // dichotomous; true/false is 2-option) — fetch question_type to exclude them,
    // with a legacy fallback so the pool still builds pre-00082 (all single then).
    const full = await sb
      .from("tech_assessment_items")
      .select("id, skill, irt_b, question_en, question_ar, options_en, options_ar, correct_index, difficulty, question_type")
      .is("domain_key", null)
      .eq("status", "approved")
      .not("irt_b", "is", null)
      .in("skill", input.skillsEn);
    const data = full.error
      ? (await sb
          .from("tech_assessment_items")
          .select("id, skill, irt_b, question_en, question_ar, options_en, options_ar, correct_index, difficulty")
          .is("domain_key", null)
          .eq("status", "approved")
          .not("irt_b", "is", null)
          .in("skill", input.skillsEn)).data
      : full.data;
    const rows = (data ?? []) as Array<{
      id: string;
      skill: string;
      irt_b: number | null;
      question_en: string;
      question_ar: string | null;
      options_en: string[];
      options_ar: string[] | null;
      correct_index: number;
      difficulty: "easy" | "medium" | "hard";
      question_type?: string | null;
    }>;
    const usable = rows.filter(
      (r) =>
        (r.question_type ?? "single") === "single" &&
        r.irt_b != null &&
        Array.isArray(r.options_en) &&
        r.options_en.length === 4 &&
        r.correct_index >= 0 &&
        r.correct_index < 4
    );
    if (usable.length < ADAPTIVE_MIN_POOL) return null;
    return usable.map((r) => ({
      id: r.id,
      skill: r.skill,
      b: Number(r.irt_b),
      question_en: r.question_en,
      question_ar: r.question_ar,
      options_en: r.options_en,
      options_ar: Array.isArray(r.options_ar) ? r.options_ar : null,
      correct_index: r.correct_index,
      difficulty: r.difficulty,
    }));
  } catch {
    return null;
  }
}

/**
 * Calibrate the function-skill bank for the given skills: write each item's
 * Rasch difficulty (irt_b) — from its proportion-correct once it has enough
 * administrations, else the difficulty prior. Powers the CAT candidate set.
 * Tolerant of migration 00060 being absent (no-op).
 */
export async function calibrateFunctionBank(skillsEn: string[]): Promise<{ calibrated: number; error?: string }> {
  if (skillsEn.length === 0) return { calibrated: 0 };
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("tech_assessment_items")
      .select("id, difficulty, times_administered, times_correct")
      .is("domain_key", null)
      .in("skill", skillsEn);
    if (error) return { calibrated: 0, error: error.message };
    let calibrated = 0;
    for (const it of (data ?? []) as { id: string; difficulty: "easy" | "medium" | "hard"; times_administered: number; times_correct: number }[]) {
      const { irt_b, irt_se } = calibrateItemFields({
        difficulty: it.difficulty,
        timesAdministered: Number(it.times_administered ?? 0),
        timesCorrect: Number(it.times_correct ?? 0),
      });
      const upd = await sb
        .from("tech_assessment_items")
        .update({ irt_b, irt_se, calibrated_at: new Date().toISOString() })
        .eq("id", it.id);
      if (!upd.error) calibrated++;
    }
    return { calibrated };
  } catch {
    return { calibrated: 0, error: "table_absent" };
  }
}

/** All function-skill bank items (any status) for the given skills — the console. */
export async function listFunctionBankItems(skillsEn: string[]): Promise<BankItem[]> {
  if (skillsEn.length === 0) return [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("*")
      .is("domain_key", null)
      .in("skill", skillsEn)
      .order("created_at", { ascending: false });
    return ((data as BankItem[] | null) ?? []).map((r) => ({
      ...r,
      options_en: Array.isArray(r.options_en) ? r.options_en : [],
      options_ar: Array.isArray(r.options_ar) ? r.options_ar : null,
    }));
  } catch {
    return [];
  }
}

export type CertifiedAssembly = { test: TechTest; itemIds: string[] };

/**
 * Assemble a certified TechTest for a function from APPROVED per-skill items.
 * Draws up to `drawPerSkill` items for EACH blueprint skill; returns null when
 * any skill is below the function's per-skill floor (caller falls back to the
 * indicative AI path — no credential). Option positions re-randomised per sitting.
 */
export async function buildCertifiedFunctionTest(input: {
  functionKey: string;
  functionName: string;
  skillsEn: string[];
  functionId: string | null;
  drawPerSkill?: number;
  language?: "en" | "ar";
}): Promise<CertifiedAssembly | null> {
  const { functionKey, functionName, skillsEn, functionId } = input;
  const language = input.language === "ar" ? "ar" : "en";
  if (skillsEn.length === 0) return null;

  const cut = await getFunctionCutScore(functionId);
  const drawPerSkill = Math.max(cut.minItemsPerSkill, input.drawPerSkill ?? DEFAULT_DRAW_PER_SKILL);

  let rows: AssemblyRow[] = [];
  try {
    const sb = createServiceClient();
    const full = await sb
      .from("tech_assessment_items")
      .select(ASSEMBLY_COLS)
      .is("domain_key", null)
      .eq("status", "approved")
      .in("skill", skillsEn);
    if (full.error) {
      // migration 00082 not applied — certify single-answer MCQ from legacy cols.
      const legacy = await sb
        .from("tech_assessment_items")
        .select(ASSEMBLY_COLS_LEGACY)
        .is("domain_key", null)
        .eq("status", "approved")
        .in("skill", skillsEn);
      rows = (legacy.data as AssemblyRow[] | null) ?? [];
    } else {
      rows = (full.data as AssemblyRow[] | null) ?? [];
    }
  } catch {
    return null; // table/columns absent → can't certify
  }

  const usable = rows.filter(bankRowUsable);

  // Group by skill; every blueprint skill must clear the floor.
  const bySkill = new Map<string, AssemblyRow[]>();
  for (const s of skillsEn) bySkill.set(s, []);
  for (const r of usable) {
    if (bySkill.has(r.skill)) bySkill.get(r.skill)!.push(r);
  }
  for (const s of skillsEn) {
    if ((bySkill.get(s)?.length ?? 0) < cut.minItemsPerSkill) return null;
  }

  const picked: AssemblyRow[] = [];
  for (const s of skillsEn) {
    picked.push(...shuffle(bySkill.get(s) ?? []).slice(0, drawPerSkill));
  }
  if (picked.length < CERTIFIED_TEST_SIZE && picked.length < skillsEn.length * cut.minItemsPerSkill) {
    return null; // shouldn't happen given the floor check, but stay safe
  }

  const itemIds: string[] = [];
  const items: TechItem[] = shuffle(picked).map((r, i): TechItem => {
    itemIds.push(r.id);
    return { ...bankRowToTechItem(r, language), id: r.id || `c${i + 1}` };
  });

  return {
    test: { domain_key: functionKey, domain_name: functionName, items, ai_generated: false, certified: true },
    itemIds,
  };
}

/**
 * AI-author candidate items for ONE function skill (a MIX of single / multi /
 * scenario / true-false) and insert them as 'draft' (domain_key NULL) for SME
 * review. Bilingual with a rationale. 0 without ANTHROPIC_API_KEY (nothing leaks).
 */
export async function draftFunctionSkillItems(
  skill: string,
  count: number,
  context?: string
): Promise<{ inserted: number; error?: string }> {
  const client = getAIClient();
  if (!client) return { inserted: 0, error: "no_api_key" };
  const cleanSkill = skill.trim();
  if (!cleanSkill) return { inserted: 0, error: "no_skill" };
  const n = Math.max(1, Math.min(20, count));

  const user = mixedDraftPrompt({
    count: n,
    subjectLine: `SKILL: ${cleanSkill}${context ? ` (in the context of: ${context})` : ""}`,
    skills: [cleanSkill],
    spread: false,
  });

  let drafted: BankDraft[] = [];
  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4500,
      system: MIXED_ITEM_WRITER_SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { inserted: 0, error: "no_text" };
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) return { inserted: 0, error: "no_json" };
    const parsed = JSON.parse(match[0]) as { items?: Array<Record<string, unknown>> };
    const skillSet = new Set([cleanSkill]);
    drafted = (parsed.items ?? [])
      .map((r) => validateBankDraft(r, skillSet, cleanSkill))
      .filter((d): d is BankDraft => d !== null);
  } catch (e) {
    console.error("[tech-function-bank] draft failed:", e);
    return { inserted: 0, error: "ai_error" };
  }

  if (drafted.length === 0) return { inserted: 0, error: "no_items" };
  await repairBankDraftsArabic(drafted);
  return insertBankDrafts(drafted, null);
}
