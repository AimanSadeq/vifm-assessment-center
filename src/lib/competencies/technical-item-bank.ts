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
import { shuffleChoices, type TechItem, type TechItemType, type TechTest } from "@/lib/ai/technical-assessment";

export type BankItemStatus = "draft" | "in_review" | "approved" | "rejected" | "retired";
/** Bank item format (migration 00082). Legacy rows are 'single'. */
export type BankItemType = "single" | "multi" | "scenario" | "true_false";

export type BankItem = {
  id: string;
  domain_key: string;
  skill: string;
  question_en: string;
  question_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  // Richer formats (00082): null/absent on legacy rows ⇒ treated as 'single'.
  question_type?: BankItemType | null;
  correct_indices?: number[] | null; // multi: full set of correct positions
  scenario_en?: string | null;       // scenario: case stem (EN)
  scenario_ar?: string | null;       // scenario: case stem (AR)
  difficulty: "easy" | "medium" | "hard";
  explanation_en: string | null;
  status: BankItemStatus;
  source: "ai_generated" | "human_authored";
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  times_administered: number;
  times_correct: number;
  irt_b: number | null; // Rasch difficulty (logit); null = uncalibrated (00060)
  irt_se: number | null;
  calibrated_at: string | null;
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The columns needed to assemble a key-bearing item from a bank row. */
export type AssemblyRow = {
  id: string;
  skill: string;
  question_en: string;
  question_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  question_type?: string | null;
  correct_indices?: number[] | null;
  scenario_en?: string | null;
  scenario_ar?: string | null;
  difficulty: "easy" | "medium" | "hard";
};

/** The column list for the type-aware (00082) assembly select. */
export const ASSEMBLY_COLS =
  "id, skill, question_en, question_ar, options_en, options_ar, correct_index, correct_indices, question_type, scenario_en, scenario_ar, difficulty";
/** Legacy column list (pre-00082) — used as a fallback so a bank that predates
 *  the richer-types migration still certifies as single-answer MCQ. */
export const ASSEMBLY_COLS_LEGACY =
  "id, skill, question_en, question_ar, options_en, options_ar, correct_index, difficulty";

/** Is a bank row a usable, well-formed item for the certified pool? Type-aware:
 *  single/scenario need 4 options + a valid correct_index; true_false needs 2
 *  options + correct_index 0|1; multi needs 4-6 options + 2+ correct (and a
 *  distractor). Legacy rows (no question_type) are treated as single. */
export function bankRowUsable(r: AssemblyRow): boolean {
  const type = (r.question_type ?? "single") as BankItemType;
  const opts = Array.isArray(r.options_en) ? r.options_en : [];
  if (type === "true_false") return opts.length === 2 && r.correct_index >= 0 && r.correct_index <= 1;
  if (type === "multi") {
    const ci = Array.isArray(r.correct_indices) ? r.correct_indices.map(Number) : [];
    return (
      opts.length >= 4 && opts.length <= 6 &&
      ci.length >= 2 && ci.length < opts.length &&
      ci.every((n) => Number.isInteger(n) && n >= 0 && n < opts.length)
    );
  }
  return opts.length === 4 && r.correct_index >= 0 && r.correct_index < 4; // single / scenario
}

/** Build a key-bearing TechItem from a bank row, re-randomising option positions
 *  per administration (true_false keeps canonical True/False order). Serves
 *  Arabic only when the question + every option are translated (never a mixed-
 *  language item); the scenario stem follows the same language, EN fallback. */
export function bankRowToTechItem(r: AssemblyRow, language: "en" | "ar"): TechItem {
  const type = (r.question_type ?? "single") as TechItemType;
  const useAr =
    language === "ar" && !!r.question_ar && Array.isArray(r.options_ar) && r.options_ar.length === r.options_en.length;
  const question = useAr ? (r.question_ar as string) : r.question_en;
  const options = useAr ? (r.options_ar as string[]) : r.options_en;
  const base = { id: r.id, skill: r.skill, question, difficulty: r.difficulty };

  if (type === "true_false") {
    return { ...base, type: "true_false", options, correct_index: r.correct_index };
  }
  if (type === "multi") {
    const ci = (Array.isArray(r.correct_indices) ? r.correct_indices : []).map(Number);
    const { options: shuffled, correct } = shuffleChoices(options, ci);
    return { ...base, type: "multi", options: shuffled, correct_index: correct[0] ?? 0, correct_indices: correct };
  }
  // single / scenario
  const { options: shuffled, correct } = shuffleChoices(options, [r.correct_index]);
  const item: TechItem = {
    ...base,
    type: type === "scenario" ? "scenario" : "single",
    options: shuffled,
    correct_index: correct[0] ?? 0,
  };
  if (type === "scenario") {
    const stem = useAr && r.scenario_ar ? r.scenario_ar : r.scenario_en;
    if (stem) item.scenario = stem;
  }
  return item;
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

// ── Taxonomy + bridge data access (migration 00054) — for the admin editor ──

export type DomainMeta = { key: string; nameEn: string; nameAr: string | null };

/** Editable display meta for a domain (the FK key never changes). */
export async function getDomainMeta(domainKey: string): Promise<DomainMeta | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("technical_domains")
      .select("key, name_en, name_ar")
      .eq("key", domainKey)
      .maybeSingle();
    if (!data) return null;
    return { key: data.key as string, nameEn: data.name_en as string, nameAr: (data.name_ar as string | null) ?? null };
  } catch {
    return null;
  }
}

export type BridgeRow = { id: string; competencyId: string; competencyName: string; weight: number };

/** The behavioural competencies a domain ENABLES (bridge rows), with names. */
export async function listDomainBridge(domainKey: string): Promise<BridgeRow[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("technical_domain_competencies")
      .select("id, competency_id, weight, competencies(name)")
      .eq("domain_key", domainKey)
      .order("weight", { ascending: false });
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      competency_id: string;
      weight: number;
      competencies: { name: string } | { name: string }[] | null;
    }>;
    return rows.map((r) => {
      const c = Array.isArray(r.competencies) ? r.competencies[0] : r.competencies;
      return { id: r.id, competencyId: r.competency_id, competencyName: c?.name ?? "—", weight: Number(r.weight) };
    });
  } catch {
    return [];
  }
}

export type CompetencyLite = { id: string; name: string; domain: string };

/** All 38 behavioural competencies (id + name + AC domain), for the bridge picker. */
export async function listBehaviouralCompetencies(): Promise<CompetencyLite[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("competencies")
      .select("id, name, sort_order, competency_clusters(sort_order, competency_domains(name, sort_order))");
    type Row = {
      id: string;
      name: string;
      sort_order: number;
      competency_clusters: { sort_order: number; competency_domains: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null } | { sort_order: number; competency_domains: unknown }[] | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    const flat = rows.map((r) => {
      const cl = Array.isArray(r.competency_clusters) ? r.competency_clusters[0] : r.competency_clusters;
      const dm = cl ? (Array.isArray(cl.competency_domains) ? cl.competency_domains[0] : cl.competency_domains) : null;
      const domainObj = dm as { name: string; sort_order: number } | null;
      return {
        id: r.id,
        name: r.name,
        domain: domainObj?.name ?? "",
        domainOrder: domainObj?.sort_order ?? 99,
        clusterOrder: cl?.sort_order ?? 99,
        compOrder: r.sort_order ?? 99,
      };
    });
    flat.sort((a, b) => a.domainOrder - b.domainOrder || a.clusterOrder - b.clusterOrder || a.compOrder - b.compOrder);
    return flat.map((f) => ({ id: f.id, name: f.name, domain: f.domain }));
  } catch {
    return [];
  }
}

// ── Certification pipeline stats (for the Technical Assessment Command dashboard) ──

export type TechDomainPipeline = {
  domainKey: string;
  domainName: string;
  approved: number;
  minItems: number;
  certifiable: boolean;
  assessed: number;
  credentials: number;
};

export type TechPipelineStats = {
  itemsTotal: number;
  itemsApproved: number;
  domainsWithCutScore: number;
  domainsCertifiable: number;
  totalDomains: number;
  resultsTotal: number;
  credentialsIssued: number;
  perDomain: TechDomainPipeline[];
};

/** Roll up the whole certification pipeline: bank → approved → cut-scores →
 *  certifiable → assessed → credentialed, plus a per-domain breakdown. */
export async function getTechPipelineStats(): Promise<TechPipelineStats> {
  const readiness = await bankReadiness();
  const stats: TechPipelineStats = {
    itemsTotal: 0,
    itemsApproved: 0,
    domainsWithCutScore: 0,
    domainsCertifiable: readiness.filter((r) => r.certifiable).length,
    totalDomains: readiness.length || TECH_DOMAINS.length,
    resultsTotal: 0,
    credentialsIssued: 0,
    perDomain: readiness.map((r) => ({
      domainKey: r.domainKey,
      domainName: techDomainByKey(r.domainKey)?.name ?? r.domainKey,
      approved: r.approved,
      minItems: r.minItems,
      certifiable: r.certifiable,
      assessed: 0,
      credentials: 0,
    })),
  };
  try {
    const sb = createServiceClient();
    const [itemsRes, cutRes, resRes] = await Promise.all([
      sb.from("tech_assessment_items").select("status"),
      sb.from("tech_assessment_cut_scores").select("domain_key"),
      sb.from("tech_assessment_results").select("domain_key, credential_code"),
    ]);
    const items = (itemsRes.data ?? []) as { status: string }[];
    stats.itemsTotal = items.length;
    stats.itemsApproved = items.filter((i) => i.status === "approved").length;
    stats.domainsWithCutScore = (cutRes.data ?? []).length;

    const results = (resRes.data ?? []) as { domain_key: string; credential_code: string | null }[];
    stats.resultsTotal = results.length;
    const assessedBy = new Map<string, number>();
    const credsBy = new Map<string, number>();
    for (const r of results) {
      assessedBy.set(r.domain_key, (assessedBy.get(r.domain_key) ?? 0) + 1);
      if (r.credential_code) credsBy.set(r.domain_key, (credsBy.get(r.domain_key) ?? 0) + 1);
    }
    stats.credentialsIssued = Array.from(credsBy.values()).reduce((a, b) => a + b, 0);
    stats.perDomain = stats.perDomain.map((d) => ({
      ...d,
      assessed: assessedBy.get(d.domainKey) ?? 0,
      credentials: credsBy.get(d.domainKey) ?? 0,
    }));
  } catch {
    /* tables not migrated — readiness-only base */
  }
  return stats;
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
  size: number = CERTIFIED_TEST_SIZE,
  language: "en" | "ar" = "en"
): Promise<CertifiedAssembly | null> {
  const domain = techDomainByKey(domainKey);
  if (!domain) return null;
  const cut = await getCutScore(domainKey);

  let rows: AssemblyRow[] = [];
  try {
    const sb = createServiceClient();
    const full = await sb
      .from("tech_assessment_items")
      .select(ASSEMBLY_COLS)
      .eq("domain_key", domainKey)
      .eq("status", "approved");
    if (full.error) {
      // migration 00082 not applied — certify single-answer MCQ from legacy cols.
      const legacy = await sb
        .from("tech_assessment_items")
        .select(ASSEMBLY_COLS_LEGACY)
        .eq("domain_key", domainKey)
        .eq("status", "approved");
      rows = (legacy.data as AssemblyRow[] | null) ?? [];
    } else {
      rows = (full.data as AssemblyRow[] | null) ?? [];
    }
  } catch {
    return null; // table absent → can't certify
  }

  const usable = rows.filter(bankRowUsable);
  if (usable.length < cut.minItems) return null;

  const picked = shuffle(usable).slice(0, Math.min(size, usable.length));
  const itemIds: string[] = [];
  const items: TechItem[] = picked.map((r, i): TechItem => {
    itemIds.push(r.id);
    return { ...bankRowToTechItem(r, language), id: r.id || `c${i + 1}` };
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

/** A validated, ready-to-store bank item in a mix of formats (no shuffle - the
 *  canonical option order is stored; assembly re-randomises per administration). */
export type BankDraft = {
  skill: string;
  question_type: BankItemType;
  question_en: string;
  question_ar: string | null;
  scenario_en: string | null;
  scenario_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  correct_indices: number[] | null;
  difficulty: "easy" | "medium" | "hard";
  explanation_en: string | null;
};

/** Shared item-writer persona for the mixed-format drafters. */
export const MIXED_ITEM_WRITER_SYSTEM =
  `You are a subject-matter assessment item writer for VIFM, a GCC finance & ` +
  `management training institute. You write fair, unambiguous technical-competency ` +
  `items in a MIX of formats (single-best-answer, select-all-that-apply, true/false, ` +
  `and short scenario), each defensible and never a trick question. You always ` +
  `provide a faithful Gulf-Arabic translation of every question, option, and scenario.`;

/** Build the mixed-format draft prompt for a subject (a domain, or one skill). */
export function mixedDraftPrompt(input: { count: number; subjectLine: string; skills: string[]; spread: boolean }): string {
  const { count, subjectLine, skills, spread } = input;
  return [
    `Write EXACTLY ${count} technical-competency assessment items, VARYING the format.`,
    subjectLine,
    `SKILLS (use the EXACT English name as the "skill" tag${spread ? "; spread items across them" : ""}): ${skills.join("; ")}.`,
    ``,
    `Use a MIX of formats (about half "single", plus some "true_false", "multi", and "scenario"):`,
    `  • "single"     - four options, exactly ONE correct (correct_index 0-3).`,
    `  • "true_false" - options ["True","False"], correct_index 0 or 1.`,
    `  • "multi"      - 4-6 options with 2-3 correct (correct_indices array; at least one wrong).`,
    `  • "scenario"   - a short realistic case in "scenario_en" (2-4 sentences with figures),`,
    `                   then a single-best-answer question (four options, correct_index).`,
    ``,
    `Ramp difficulty easy / medium / hard. Give a one-sentence "explanation_en" for why the`,
    `key is correct. Provide faithful Gulf-Arabic: "question_ar", "options_ar" (SAME order +`,
    `count as options_en), and "scenario_ar" for scenario items.`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [`,
    `  { "skill":"<skill>","question_type":"single","question_en":"...","question_ar":"...",`,
    `    "options_en":["a","b","c","d"],"options_ar":["أ","ب","ج","د"],"correct_index":0,"difficulty":"easy","explanation_en":"..." },`,
    `  { "skill":"<skill>","question_type":"true_false","question_en":"...","question_ar":"...",`,
    `    "options_en":["True","False"],"options_ar":["صحيح","خطأ"],"correct_index":0,"difficulty":"easy","explanation_en":"..." },`,
    `  { "skill":"<skill>","question_type":"multi","question_en":"Which apply?","question_ar":"...",`,
    `    "options_en":["a","b","c","d","e"],"options_ar":["..","..","..","..",".."],"correct_indices":[0,2],"difficulty":"medium","explanation_en":"..." },`,
    `  { "skill":"<skill>","question_type":"scenario","scenario_en":"<case>","scenario_ar":"<...>","question_en":"...","question_ar":"...",`,
    `    "options_en":["a","b","c","d"],"options_ar":["..","..","..",".."],"correct_index":1,"difficulty":"hard","explanation_en":"..." } ] }`,
  ].join("\n");
}

/** Validate one raw model item into a storable BankDraft (type-aware), or null. */
export function validateBankDraft(
  raw: Record<string, unknown>,
  skillSet: Set<string>,
  fallbackSkill: string
): BankDraft | null {
  if (typeof raw.question_en !== "string" || !raw.question_en.trim()) return null;
  const type: BankItemType =
    raw.question_type === "multi" ? "multi" :
    raw.question_type === "scenario" ? "scenario" :
    raw.question_type === "true_false" ? "true_false" : "single";
  const optsEn = Array.isArray(raw.options_en) ? (raw.options_en as unknown[]).map(String) : [];
  const skill = typeof raw.skill === "string" && skillSet.has(raw.skill) ? raw.skill : fallbackSkill;
  const difficulty: "easy" | "medium" | "hard" =
    raw.difficulty === "hard" ? "hard" : raw.difficulty === "medium" ? "medium" : "easy";
  const explanation_en = typeof raw.explanation_en === "string" ? raw.explanation_en : null;
  const question_ar = typeof raw.question_ar === "string" && raw.question_ar.trim() ? raw.question_ar : null;
  const optsArRaw = Array.isArray(raw.options_ar) ? (raw.options_ar as unknown[]).map(String) : null;
  const options_ar = optsArRaw && optsArRaw.length === optsEn.length ? optsArRaw : null;
  const common = { skill, question_en: String(raw.question_en), question_ar, options_en: optsEn, options_ar, difficulty, explanation_en };

  if (type === "true_false") {
    if (optsEn.length !== 2) return null;
    const ci = Number(raw.correct_index);
    if (!Number.isInteger(ci) || ci < 0 || ci > 1) return null;
    return { ...common, question_type: "true_false", scenario_en: null, scenario_ar: null, correct_index: ci, correct_indices: null };
  }
  if (type === "multi") {
    if (optsEn.length < 4 || optsEn.length > 6) return null;
    const ci = Array.isArray(raw.correct_indices)
      ? Array.from(new Set((raw.correct_indices as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < optsEn.length))).sort((a, b) => a - b)
      : [];
    if (ci.length < 2 || ci.length >= optsEn.length) return null;
    return { ...common, question_type: "multi", scenario_en: null, scenario_ar: null, correct_index: ci[0], correct_indices: ci };
  }
  // single / scenario
  if (optsEn.length !== 4) return null;
  const ci = Number(raw.correct_index);
  if (!Number.isInteger(ci) || ci < 0 || ci >= 4) return null;
  const scEn = type === "scenario" && typeof raw.scenario_en === "string" && raw.scenario_en.trim() ? raw.scenario_en.trim() : null;
  const scAr = scEn && typeof raw.scenario_ar === "string" && raw.scenario_ar.trim() ? raw.scenario_ar.trim() : null;
  return { ...common, question_type: scEn ? "scenario" : "single", scenario_en: scEn, scenario_ar: scAr, correct_index: ci, correct_indices: null };
}

/** Best-effort bilingual repair: fill missing Arabic on 4-option items (single /
 *  scenario) via translateItemsToArabic. Multi/true-false rely on the model's AR;
 *  assembly falls back to English per item when AR is incomplete. Mutates in place. */
export async function repairBankDraftsArabic(drafts: BankDraft[]): Promise<void> {
  const repairIdx = drafts
    .map((d, i) => (d.options_en.length === 4 && (!d.question_ar || !d.options_ar) ? i : -1))
    .filter((i) => i >= 0);
  if (repairIdx.length === 0) return;
  const trs = await translateItemsToArabic(
    repairIdx.map((i) => ({ question_en: drafts[i].question_en, options_en: drafts[i].options_en }))
  );
  repairIdx.forEach((idx, k) => {
    const tr = trs[k];
    if (tr) {
      drafts[idx].question_ar = tr.question_ar;
      drafts[idx].options_ar = tr.options_ar;
    }
  });
}

/** Insert validated drafts as 'draft' for SME review. Tolerant of migration 00082
 *  being absent: on a column error it retries inserting only the single-type
 *  items with the legacy column set (so drafting still works pre-migration). */
export async function insertBankDrafts(drafts: BankDraft[], domainKey: string | null): Promise<{ inserted: number; error?: string }> {
  if (drafts.length === 0) return { inserted: 0, error: "no_items" };
  try {
    const sb = createServiceClient();
    const ins = await sb.from("tech_assessment_items").insert(
      drafts.map((d) => ({
        domain_key: domainKey,
        skill: d.skill,
        question_type: d.question_type,
        question_en: d.question_en,
        question_ar: d.question_ar,
        scenario_en: d.scenario_en,
        scenario_ar: d.scenario_ar,
        options_en: d.options_en,
        options_ar: d.options_ar,
        correct_index: d.correct_index,
        correct_indices: d.correct_indices,
        difficulty: d.difficulty,
        explanation_en: d.explanation_en,
        status: "draft",
        source: "ai_generated",
      }))
    );
    if (!ins.error) return { inserted: drafts.length };

    // migration 00082 not applied — store only the single-type drafts (legacy cols).
    const singles = drafts.filter((d) => d.question_type === "single");
    if (singles.length === 0) return { inserted: 0, error: ins.error.message };
    const ins2 = await sb.from("tech_assessment_items").insert(
      singles.map((d) => ({
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
    if (ins2.error) return { inserted: 0, error: ins2.error.message };
    return { inserted: singles.length };
  } catch (e) {
    console.error("[tech-item-bank] insert failed:", e);
    return { inserted: 0, error: "insert_error" };
  }
}

/**
 * AI-author candidate items for a domain (a MIX of single / multi / scenario /
 * true-false) and insert them as 'draft' for SME review. Bilingual EN + AR with a
 * rationale. Requires ANTHROPIC_API_KEY; returns 0 without it (nothing leaks).
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
  const user = mixedDraftPrompt({ count: n, subjectLine: `DOMAIN: ${domain.name}`, skills: domain.skills, spread: true });

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
    const skillSet = new Set(domain.skills);
    drafted = (parsed.items ?? [])
      .map((r) => validateBankDraft(r, skillSet, domain.skills[0]))
      .filter((d): d is BankDraft => d !== null);
  } catch (e) {
    console.error("[tech-item-bank] draft failed:", e);
    return { inserted: 0, error: "ai_error" };
  }

  if (drafted.length === 0) return { inserted: 0, error: "no_items" };
  await repairBankDraftsArabic(drafted);
  return insertBankDrafts(drafted, domainKey);
}

/**
 * Translate a batch of items (question + four options) into Modern Standard
 * Arabic, preserving option ORDER. Returns one entry per input (null when the
 * model didn't return a usable translation). Used to repair draft items and to
 * backfill the bank. No-ops (all null) without an API key.
 */
export async function translateItemsToArabic(
  items: { question_en: string; options_en: string[] }[]
): Promise<({ question_ar: string; options_ar: string[] } | null)[]> {
  const client = getAIClient();
  if (!client || items.length === 0) return items.map(() => null);

  const system =
    `You are a professional Arabic translator for VIFM, a GCC finance & management ` +
    `training institute. Translate finance assessment items into clear Modern Standard ` +
    `Arabic. Keep standard finance acronyms (IFRS, WACC, CAPM, DCF, EBITDA, REIT) and ` +
    `numeric/currency values as commonly written. Preserve the option order exactly.`;
  const user = [
    `Translate each item's question and four options into Arabic, same option order.`,
    `Return JSON ONLY (no fences): { "items": [ { "question_ar":"...", "options_ar":["..","..","..",".."] } ] }`,
    `Items (index-aligned):`,
    JSON.stringify(items.map((it, i) => ({ i, question_en: it.question_en, options_en: it.options_en }))),
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return items.map(() => null);
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) return items.map(() => null);
    const parsed = JSON.parse(match[0]) as { items?: Array<{ question_ar?: unknown; options_ar?: unknown }> };
    const out = parsed.items ?? [];
    return items.map((_, i) => {
      const r = out[i];
      if (!r) return null;
      const qa = typeof r.question_ar === "string" && r.question_ar.trim() ? r.question_ar : null;
      const oa =
        Array.isArray(r.options_ar) && r.options_ar.length === 4
          ? (r.options_ar as unknown[]).map((o) => String(o))
          : null;
      return qa && oa ? { question_ar: qa, options_ar: oa } : null;
    });
  } catch (e) {
    console.error("[tech-item-bank] translate failed:", e);
    return items.map(() => null);
  }
}

/**
 * Fill missing Arabic on existing bank items (any status) — translates
 * question_en/options_en for rows whose question_ar/options_ar are absent and
 * writes them back. Idempotent (only touches rows missing Arabic). Closes the
 * gap for any legacy / manually-authored / import English-only items so the
 * certified path is fully Arabic. Optionally scoped to one domain.
 */
export async function backfillBankArabic(
  domainKey?: TechDomainKey
): Promise<{ updated: number; missing: number; error?: string }> {
  if (!getAIClient()) return { updated: 0, missing: 0, error: "no_api_key" };
  type Row = {
    id: string;
    question_en: string;
    question_ar: string | null;
    options_en: string[];
    options_ar: string[] | null;
  };
  let rows: Row[] = [];
  try {
    const sb = createServiceClient();
    const base = sb.from("tech_assessment_items").select("id, question_en, question_ar, options_en, options_ar");
    const { data, error } = domainKey ? await base.eq("domain_key", domainKey) : await base;
    if (error) return { updated: 0, missing: 0, error: error.message };
    rows = (data as Row[] | null) ?? [];
  } catch {
    return { updated: 0, missing: 0, error: "table_absent" };
  }

  const missing = rows.filter((r) => !r.question_ar || !Array.isArray(r.options_ar) || r.options_ar.length !== 4);
  if (missing.length === 0) return { updated: 0, missing: 0 };

  const trs = await translateItemsToArabic(missing.map((m) => ({ question_en: m.question_en, options_en: m.options_en })));
  const sb = createServiceClient();
  let updated = 0;
  for (let i = 0; i < missing.length; i++) {
    const tr = trs[i];
    if (!tr) continue;
    const { error } = await sb
      .from("tech_assessment_items")
      .update({ question_ar: tr.question_ar, options_ar: tr.options_ar })
      .eq("id", missing[i].id);
    if (!error) updated++;
  }
  return { updated, missing: missing.length };
}
