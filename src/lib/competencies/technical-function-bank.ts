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
import { CERTIFIED_TEST_SIZE, translateItemsToArabic, type BankItem } from "./technical-item-bank";
import type { TechItem, TechTest } from "@/lib/ai/technical-assessment";

const DEFAULT_PASS_PCT = 70;
const DEFAULT_MIN_PER_SKILL = 2;
const DEFAULT_DRAW_PER_SKILL = 4;

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
};

function shuffledOrder(): number[] {
  const order = [0, 1, 2, 3];
  for (let j = order.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [order[j], order[k]] = [order[k], order[j]];
  }
  return order;
}
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

/** Per-skill readiness for a function's blueprint vs its coverage floor. */
export async function functionBankReadiness(skillsEn: string[], functionId: string | null): Promise<FunctionReadiness> {
  const cut = await getFunctionCutScore(functionId);
  const counts = await approvedCountBySkill(skillsEn);
  const perSkill = skillsEn.map((skill) => ({ skill, approved: counts[skill] ?? 0 }));
  const approvedTotal = perSkill.reduce((s, p) => s + p.approved, 0);
  const certifiable = skillsEn.length > 0 && perSkill.every((p) => p.approved >= cut.minItemsPerSkill);
  return { perSkill, minItemsPerSkill: cut.minItemsPerSkill, certifiable, approvedTotal };
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

  let rows: BankItem[] = [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("id, skill, question_en, question_ar, options_en, options_ar, correct_index, difficulty")
      .is("domain_key", null)
      .eq("status", "approved")
      .in("skill", skillsEn);
    rows = (data as BankItem[] | null) ?? [];
  } catch {
    return null; // table/columns absent → can't certify
  }

  const usable = rows.filter(
    (r) => Array.isArray(r.options_en) && r.options_en.length === 4 && r.correct_index >= 0 && r.correct_index < 4
  );

  // Group by skill; every blueprint skill must clear the floor.
  const bySkill = new Map<string, BankItem[]>();
  for (const s of skillsEn) bySkill.set(s, []);
  for (const r of usable) {
    if (bySkill.has(r.skill)) bySkill.get(r.skill)!.push(r);
  }
  for (const s of skillsEn) {
    if ((bySkill.get(s)?.length ?? 0) < cut.minItemsPerSkill) return null;
  }

  const picked: BankItem[] = [];
  for (const s of skillsEn) {
    picked.push(...shuffle(bySkill.get(s) ?? []).slice(0, drawPerSkill));
  }
  if (picked.length < CERTIFIED_TEST_SIZE && picked.length < skillsEn.length * cut.minItemsPerSkill) {
    return null; // shouldn't happen given the floor check, but stay safe
  }

  const itemIds: string[] = [];
  const items: TechItem[] = shuffle(picked).map((r, i): TechItem => {
    itemIds.push(r.id);
    const order = shuffledOrder();
    const useAr = language === "ar" && !!r.question_ar && Array.isArray(r.options_ar) && r.options_ar.length === 4;
    const baseQuestion = useAr ? (r.question_ar as string) : r.question_en;
    const baseOptions = useAr ? (r.options_ar as string[]) : r.options_en;
    return {
      id: r.id || `c${i + 1}`,
      skill: r.skill,
      type: "single",
      question: baseQuestion,
      options: order.map((idx) => baseOptions[idx]),
      correct_index: order.indexOf(r.correct_index),
      difficulty: r.difficulty,
    };
  });

  return {
    test: { domain_key: functionKey, domain_name: functionName, items, ai_generated: false, certified: true },
    itemIds,
  };
}

type DraftedItem = {
  question_en: string;
  question_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  difficulty: "easy" | "medium" | "hard";
  explanation_en: string | null;
};

/**
 * AI-author candidate items for ONE function skill and insert them as 'draft'
 * (domain_key NULL) for SME review. Bilingual with a rationale. Returns the
 * count inserted; 0 without ANTHROPIC_API_KEY (nothing un-reviewed leaks).
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

  const system =
    `You are a subject-matter assessment item writer for VIFM, a GCC finance & ` +
    `management training institute. You write fair, unambiguous 4-option multiple-` +
    `choice items that test genuine technical competence, each with exactly one ` +
    `defensible correct answer, three plausible distractors, and a short rationale ` +
    `for the key. You never write trick questions. You produce a faithful Gulf-` +
    `Arabic translation of every question and option.`;

  const user = [
    `Write exactly ${n} multiple-choice items assessing this single finance technical skill:`,
    `SKILL: ${cleanSkill}${context ? ` (in the context of: ${context})` : ""}`,
    ``,
    `Ramp difficulty across easy / medium / hard. Each item = a question + four`,
    `options (exactly one correct) + a one-sentence rationale for why the key is`,
    `correct. Provide a faithful Gulf-Arabic translation of the question and the`,
    `four options (same option order).`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [ {`,
    `  "question_en":"...", "question_ar":"...",`,
    `  "options_en":["a","b","c","d"], "options_ar":["أ","ب","ج","د"],`,
    `  "correct_index":0, "difficulty":"easy",`,
    `  "explanation_en":"..." } ] }`,
  ].join("\n");

  let drafted: DraftedItem[] = [];
  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { inserted: 0, error: "no_text" };
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) return { inserted: 0, error: "no_json" };
    const parsed = JSON.parse(match[0]) as { items?: Array<Record<string, unknown>> };

    drafted = (parsed.items ?? [])
      .filter((r) => {
        const opts = r.options_en;
        const ci = r.correct_index;
        return (
          typeof r.question_en === "string" &&
          Array.isArray(opts) &&
          opts.length === 4 &&
          typeof ci === "number" &&
          ci >= 0 &&
          ci < 4
        );
      })
      .map((r): DraftedItem => {
        const optsAr =
          Array.isArray(r.options_ar) && (r.options_ar as unknown[]).length === 4
            ? (r.options_ar as unknown[]).map((o) => String(o))
            : null;
        return {
          question_en: String(r.question_en),
          question_ar: typeof r.question_ar === "string" ? r.question_ar : null,
          options_en: (r.options_en as unknown[]).map((o) => String(o)),
          options_ar: optsAr,
          correct_index: r.correct_index as number,
          difficulty: r.difficulty === "hard" ? "hard" : r.difficulty === "medium" ? "medium" : "easy",
          explanation_en: typeof r.explanation_en === "string" ? r.explanation_en : null,
        };
      });
  } catch (e) {
    console.error("[tech-function-bank] draft failed:", e);
    return { inserted: 0, error: "ai_error" };
  }

  if (drafted.length === 0) return { inserted: 0, error: "no_items" };

  // Guarantee bilingual — repair any item missing valid Arabic.
  const repairIdx = drafted.map((d, i) => (!d.question_ar || !d.options_ar ? i : -1)).filter((i) => i >= 0);
  if (repairIdx.length > 0) {
    const trs = await translateItemsToArabic(
      repairIdx.map((i) => ({ question_en: drafted[i].question_en, options_en: drafted[i].options_en }))
    );
    repairIdx.forEach((idx, k) => {
      const tr = trs[k];
      if (tr) {
        drafted[idx].question_ar = tr.question_ar;
        drafted[idx].options_ar = tr.options_ar;
      }
    });
  }

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("tech_assessment_items").insert(
      drafted.map((d) => ({
        domain_key: null, // function-skill item — keyed by skill alone
        skill: cleanSkill,
        question_en: d.question_en,
        question_ar: d.question_ar,
        options_en: d.options_en,
        options_ar: d.options_ar,
        correct_index: d.correct_index,
        difficulty: d.difficulty,
        explanation_en: d.explanation_en,
        status: "draft",
        source: "ai_generated",
      }))
    );
    if (error) return { inserted: 0, error: error.message };
    return { inserted: drafted.length };
  } catch (e) {
    console.error("[tech-function-bank] insert failed:", e);
    return { inserted: 0, error: "insert_error" };
  }
}
