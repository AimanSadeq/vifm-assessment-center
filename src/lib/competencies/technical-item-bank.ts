/**
 * Technical Assessment — SME-reviewed item bank (Tier 2, server-only).
 *
 * This is the defensibility substrate behind a 'technical_proficiency'
 * credential. A certified test is assembled ONLY from items an SME has
 * reviewed and APPROVED (status='approved') — never raw AI output. Items are
 * AI-drafted into the bank (status='draft') for human review; assembly,
 * grading, and the answer key all stay server-side (the 00052 sessions model).
 *
 *   • buildCertifiedTest()  — assemble a key-bearing TechTest from approved
 *     items, or return null when the bank is too thin to certify.
 *   • getCutScore()         — the documented passing standard for a domain.
 *   • approvedCountByDomain / bankReadiness — power the review console summary.
 *   • draftAiItemsToBank()  — AI authors candidate items for SME review.
 *
 * Tolerant: every path no-ops (returns empty / null) if migration 00053 isn't
 * applied yet, mirroring the rest of the credentials/academy stack.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import {
  techDomainByKey,
  TECH_DOMAINS,
  type TechDomainKey,
} from "@/lib/competencies/technical-framework";
import type { TechItem, TechTest } from "@/lib/ai/technical-assessment";

export type BankItemStatus = "draft" | "in_review" | "approved" | "rejected" | "retired";

export type BankItem = {
  id: string;
  domain_key: string;
  skill: string;
  question_en: string;
  question_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  difficulty: "easy" | "medium" | "hard";
  explanation_en: string | null;
  status: BankItemStatus;
  source: "ai_generated" | "human_authored";
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  times_administered: number;
  times_correct: number;
  created_at: string;
  updated_at: string;
};

export type CutScore = {
  domainKey: string;
  passPct: number;
  minItems: number;
  method: string | null;
  rationale: string | null;
};

export const CERTIFIED_TEST_SIZE = 10;
const DEFAULT_PASS_PCT = 70;
const DEFAULT_MIN_ITEMS = 8;

/** Fisher-Yates on [0,1,2,3] — re-randomises option positions per administration
 *  so a memorised "correct is option C" can't transfer between sittings. */
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

/** The documented passing standard for a domain (defaults when unset). */
export async function getCutScore(domainKey: TechDomainKey): Promise<CutScore> {
  const fallback: CutScore = {
    domainKey,
    passPct: DEFAULT_PASS_PCT,
    minItems: DEFAULT_MIN_ITEMS,
    method: null,
    rationale: null,
  };
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_cut_scores")
      .select("domain_key, pass_pct, min_items, method, rationale")
      .eq("domain_key", domainKey)
      .maybeSingle();
    if (!data) return fallback;
    return {
      domainKey,
      passPct: Number(data.pass_pct ?? DEFAULT_PASS_PCT),
      minItems: Number(data.min_items ?? DEFAULT_MIN_ITEMS),
      method: (data.method as string | null) ?? null,
      rationale: (data.rationale as string | null) ?? null,
    };
  } catch {
    return fallback;
  }
}

/** Count of APPROVED items per domain (for the review console readiness grid). */
export async function approvedCountByDomain(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("domain_key")
      .eq("status", "approved");
    for (const r of (data as { domain_key: string }[] | null) ?? []) {
      out[r.domain_key] = (out[r.domain_key] ?? 0) + 1;
    }
  } catch {
    /* not migrated — empty */
  }
  return out;
}

export type DomainReadiness = {
  domainKey: TechDomainKey;
  approved: number;
  minItems: number;
  certifiable: boolean;
};

/** Is each domain's approved-item pool deep enough to certify? Built from the
 *  framework so every domain shows, even at zero approved. */
export async function bankReadiness(): Promise<DomainReadiness[]> {
  const counts = await approvedCountByDomain();
  const out: DomainReadiness[] = [];
  for (const d of TECH_DOMAINS) {
    const cut = await getCutScore(d.key);
    const approved = counts[d.key] ?? 0;
    out.push({
      domainKey: d.key,
      approved,
      minItems: cut.minItems,
      certifiable: approved >= cut.minItems,
    });
  }
  return out;
}

/** All bank items for a domain (any status), newest first — for the console. */
export async function listBankItems(domainKey: TechDomainKey): Promise<BankItem[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("*")
      .eq("domain_key", domainKey)
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
 * Assemble a certified TechTest from APPROVED bank items. Returns null when the
 * approved pool is below the domain's min_items floor (caller then falls back
 * to the indicative AI path — no credential). Option positions are
 * re-randomised per administration.
 */
export async function buildCertifiedTest(
  domainKey: TechDomainKey,
  size: number = CERTIFIED_TEST_SIZE
): Promise<CertifiedAssembly | null> {
  const domain = techDomainByKey(domainKey);
  if (!domain) return null;
  const cut = await getCutScore(domainKey);

  let rows: BankItem[] = [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("id, skill, question_en, options_en, correct_index, difficulty")
      .eq("domain_key", domainKey)
      .eq("status", "approved");
    rows = (data as BankItem[] | null) ?? [];
  } catch {
    return null; // table absent → can't certify
  }

  const usable = rows.filter(
    (r) => Array.isArray(r.options_en) && r.options_en.length === 4 && r.correct_index >= 0 && r.correct_index < 4
  );
  if (usable.length < cut.minItems) return null;

  const picked = shuffle(usable).slice(0, Math.min(size, usable.length));
  const itemIds: string[] = [];
  const items: TechItem[] = picked.map((r, i): TechItem => {
    itemIds.push(r.id);
    const order = shuffledOrder();
    return {
      id: r.id || `c${i + 1}`,
      skill: r.skill,
      question: r.question_en,
      options: order.map((idx) => r.options_en[idx]),
      correct_index: order.indexOf(r.correct_index),
      difficulty: r.difficulty,
    };
  });

  return {
    test: {
      domain_key: domainKey,
      domain_name: domain.name,
      items,
      ai_generated: false,
      certified: true,
    },
    itemIds,
  };
}

/**
 * Record administration stats against the bank items a certified test used.
 * Best-effort; keeps the light p-value substrate fresh for future calibration.
 */
export async function recordItemAdministration(
  itemIds: string[],
  correctById: Record<string, boolean>
): Promise<void> {
  if (itemIds.length === 0) return;
  try {
    const sb = createServiceClient();
    for (const id of itemIds) {
      const { data } = await sb
        .from("tech_assessment_items")
        .select("times_administered, times_correct")
        .eq("id", id)
        .maybeSingle();
      if (!data) continue;
      await sb
        .from("tech_assessment_items")
        .update({
          times_administered: Number(data.times_administered ?? 0) + 1,
          times_correct: Number(data.times_correct ?? 0) + (correctById[id] ? 1 : 0),
        })
        .eq("id", id);
    }
  } catch {
    /* best-effort */
  }
}

type DraftedItem = {
  skill: string;
  question_en: string;
  question_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  difficulty: "easy" | "medium" | "hard";
  explanation_en: string | null;
};

/**
 * AI-author candidate items for a domain and insert them as 'draft' for SME
 * review. Bilingual (EN + AR) with a rationale for each correct answer (the
 * reviewer's aid + later learner feedback). Returns the number inserted.
 * Requires ANTHROPIC_API_KEY; returns 0 without it (nothing un-reviewed leaks).
 */
export async function draftAiItemsToBank(
  domainKey: TechDomainKey,
  count: number
): Promise<{ inserted: number; error?: string }> {
  const domain = techDomainByKey(domainKey);
  if (!domain) return { inserted: 0, error: "unknown domain" };
  const client = getAIClient();
  if (!client) return { inserted: 0, error: "no_api_key" };

  const n = Math.max(1, Math.min(20, count));
  const system =
    `You are a subject-matter assessment item writer for VIFM, a GCC finance & ` +
    `management training institute. You write fair, unambiguous multiple-choice ` +
    `items that test genuine technical competence, each with exactly one ` +
    `defensible correct answer, three plausible distractors, and a short ` +
    `rationale for the key. You never write trick questions. You produce a ` +
    `faithful Gulf-Arabic translation of every question and option.`;

  const user = [
    `Write exactly ${n} multiple-choice items assessing technical competence in:`,
    `DOMAIN: ${domain.name}`,
    `SKILLS (spread items across these): ${domain.skills.join("; ")}.`,
    ``,
    `Ramp difficulty across easy / medium / hard. Each item = a question + four`,
    `options (exactly one correct) + the single skill it best assesses (use the`,
    `exact skill names above) + a one-sentence rationale for why the key is`,
    `correct. Provide a faithful Gulf-Arabic translation of the question and the`,
    `four options (same option order).`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [ {`,
    `  "skill":"<one of the skills>",`,
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
    const skillSet = new Set(domain.skills);

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
        const optsAr = Array.isArray(r.options_ar) && (r.options_ar as unknown[]).length === 4
          ? (r.options_ar as unknown[]).map((o) => String(o))
          : null;
        return {
          skill: typeof r.skill === "string" && skillSet.has(r.skill) ? r.skill : domain.skills[0],
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
    console.error("[tech-item-bank] draft failed:", e);
    return { inserted: 0, error: "ai_error" };
  }

  if (drafted.length === 0) return { inserted: 0, error: "no_items" };

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("tech_assessment_items").insert(
      drafted.map((d) => ({
        domain_key: domainKey,
        skill: d.skill,
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
    console.error("[tech-item-bank] insert failed:", e);
    return { inserted: 0, error: "insert_error" };
  }
}
