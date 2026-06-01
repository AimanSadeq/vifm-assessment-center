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

  let rows: BankItem[] = [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("id, skill, question_en, question_ar, options_en, options_ar, correct_index, difficulty")
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
    // Serve Arabic for this item only when BOTH the question and four options are
    // translated — avoids a mixed-language item. Falls back to English otherwise.
    const useAr =
      language === "ar" && !!r.question_ar && Array.isArray(r.options_ar) && r.options_ar.length === 4;
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

  // Guarantee bilingual: repair any item the model left without valid Arabic so
  // the bank is never seeded English-only (keeps the certified path Arabic).
  const repairIdx = drafted
    .map((d, i) => (!d.question_ar || !d.options_ar ? i : -1))
    .filter((i) => i >= 0);
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
