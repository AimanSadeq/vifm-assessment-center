// Cross-bank item/test readiness. For each Caliber service that serves questions,
// count how many VETTED (approved / live / active) items exist per unit vs a blueprint
// target, and flag which banks still generate items live at deal time ("scramble risk").
// Every loader is tolerant of an empty or un-applied table so the page never 500s.

import { createServiceClient } from "@/lib/supabase/server";
import { COGNITIVE_SUBTESTS } from "@/lib/psychometrics/framework";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { TECH_DOMAINS } from "@/lib/competencies/technical-framework";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { PROMPT_MIN as FLUENT_PROMPT_MIN } from "@/lib/quiz-bank/fluent-constants";
import { loadPersonaBankStatus } from "@/lib/persona/bank";

export type Tier = "certified" | "reviewed" | "indicative";
export type UnitReadiness = { unit: string; approved: number; total: number; target: number };
export type BankReadiness = {
  key: string;
  label: string;
  tier: Tier;
  /** Generates items live from the LLM at sitting time (no vetted form) - the scramble risk. */
  servesLive: boolean;
  /** Has a draft -> approved SME review lifecycle. */
  hasReviewGate: boolean;
  /** Instrument is retired - no runtime serves it, so it is not a deal-time risk. */
  retired?: boolean;
  vetted: number; // approved/live/active items
  total: number;
  /** Per-unit fill (present only for the true item banks). */
  units?: UnitReadiness[];
  targetPerUnit?: number;
  console?: string; // admin route to manage the bank
  note: string;
};

/** Sum + per-key aggregation of a small table selected into memory. */
function aggregate(
  rows: Array<Record<string, unknown>>,
  keyCol: string,
  isVetted: (r: Record<string, unknown>) => boolean,
): Map<string, { total: number; approved: number }> {
  const m = new Map<string, { total: number; approved: number }>();
  for (const r of rows) {
    const k = String(r[keyCol] ?? "");
    const cur = m.get(k) ?? { total: 0, approved: 0 };
    cur.total += 1;
    if (isVetted(r)) cur.approved += 1;
    m.set(k, cur);
  }
  return m;
}

async function selectRows(table: string, cols: string): Promise<Array<Record<string, unknown>>> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.from(table).select(cols).limit(10000);
    if (error || !data) return [];
    return data as unknown as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

function unitsFrom(
  catalogue: Array<{ key: string; label: string }>,
  counts: Map<string, { total: number; approved: number }>,
  target: number,
): { units: UnitReadiness[]; vetted: number; total: number } {
  const units = catalogue.map((c) => {
    const c2 = counts.get(c.key) ?? { total: 0, approved: 0 };
    return { unit: c.label, approved: c2.approved, total: c2.total, target };
  });
  return {
    units,
    vetted: units.reduce((s, u) => s + u.approved, 0),
    total: units.reduce((s, u) => s + u.total, 0),
  };
}

// ── Techno: tech_assessment_items, APPROVED certifies; in_review awaits SME sign-off ──
async function techno(): Promise<BankReadiness> {
  const allRows = await selectRows("tech_assessment_items", "domain_key, status");
  // Only count items in the 10 certification domains (ignore orphan/legacy drafts
  // with non-taxonomy domain keys so the totals match the per-domain view).
  const std = new Set<string>(TECH_DOMAINS.map((d) => d.key));
  const rows = allRows.filter((r) => std.has(String(r.domain_key)));
  const approvedCounts = aggregate(rows, "domain_key", (r) => r.status === "approved");
  const target = 8; // matches the cut-score min_items default
  const { units, vetted } = unitsFrom(
    TECH_DOMAINS.map((d) => ({ key: d.key, label: d.name })),
    approvedCounts,
    target,
  );
  const inReview = rows.filter((r) => r.status === "in_review").length;
  const totalPool = rows.length;
  // A domain certifies (and issues a credential) only from APPROVED items; until
  // every domain clears the floor the runner serves indicative AI (no credential).
  const certifiable = units.length > 0 && units.every((u) => u.approved >= target);
  return {
    key: "techno", label: "Techno (technical)", tier: "certified", servesLive: !certifiable, hasReviewGate: true,
    vetted, total: totalPool, units, targetPerUnit: target, console: "/admin/tech-assessment/items",
    note: certifiable
      ? "Every domain has enough SME-approved items; the certified path assembles from approved items and issues a technical_proficiency credential."
      : inReview > 0
        ? `${inReview} item(s) authored and awaiting SME approval. A domain certifies (issues a credential) only with ${target}+ APPROVED items; until then it serves indicative AI (no credential).`
        : "Certified path assembles from approved items only; below the min-items floor a domain serves indicative AI (no credential).",
  };
}

// ── psy_items powers Logica (cognitive). Map scale_id -> scale_key once; also
//    surface the in_review backlog so the gate reads honestly on the dashboard. ──
async function psyCounts(): Promise<{ byScale: Map<string, { total: number; approved: number }>; inReview: number }> {
  const scales = await selectRows("psy_scales", "id, key");
  const idToKey = new Map(scales.map((s) => [String(s.id), String(s.key)]));
  const items = await selectRows("psy_items", "scale_id, status");
  const byKey: Array<Record<string, unknown>> = items.map((i) => ({
    scale_key: idToKey.get(String(i.scale_id)) ?? "?",
    status: i.status,
  }));
  const cogKeys = new Set<string>(COGNITIVE_SUBTESTS.map((s) => s.key));
  const inReview = byKey.filter((r) => r.status === "in_review" && cogKeys.has(String(r.scale_key))).length;
  return { byScale: aggregate(byKey, "scale_key", (r) => r.status === "approved"), inReview };
}

async function logica(psy: { byScale: Map<string, { total: number; approved: number }>; inReview: number }): Promise<BankReadiness> {
  const target = 8; // min APPROVED/subtest before a real sitting serves the bank
  const { units, vetted, total } = unitsFrom(
    COGNITIVE_SUBTESTS.map((s) => ({ key: s.key, label: s.name_en })),
    psy.byScale,
    target,
  );
  // The bank only serves once a human SME has APPROVED every subtest to the floor.
  // Seeded items land in_review by design (an automated seed must not self-approve),
  // so the review gate is a real human step - until then a sitting mints live-AI.
  const filled = units.length > 0 && units.every((u) => u.approved >= target);
  return {
    key: "logica", label: "Logica (cognitive)", tier: "indicative", servesLive: !filled, hasReviewGate: true,
    vetted, total, units, targetPerUnit: target, console: "/admin/psychometrics",
    note: filled
      ? "Every subtest has SME-approved items to the blueprint floor, so a candidate/voucher-bound sitting serves the reviewed fixed form (VIFM Cognitive Item-Bank Standard v1: per-subtest x per-facet, EN+AR, two-person review) instead of live-AI. Still Tier-1 indicative until local norms + IRT calibration accumulate."
      : psy.inReview > 0
        ? `${psy.inReview} cognitive item(s) authored and awaiting SME approval. The bank stays gated until a human SME approves every subtest to ${target}+ items; until then a sitting mints items live-AI. Indicative regardless (no local norms/IRT, no credential).`
        : "Items are generated live from the LLM every sitting (no vetted form). Seed the cognitive bank + SME-approve it in /admin/psychometrics to serve the reviewed fixed form instead.",
  };
}

// ── Fluent: eng_fluent_items, status='live'. Receptive (reading/listening) are
//    CEFR-ramped MCQs; productive (writing/speaking) are AI-scored prompts. ──
async function fluent(): Promise<BankReadiness> {
  const rows = await selectRows("eng_fluent_items", "skill, status");
  // Curated pool = reviewed states only (exclude the raw accumulated draft items
  // that the runner logs per sitting for calibration, which are not a vetted bank).
  const curated = rows.filter((r) => ["in_review", "live", "approved"].includes(String(r.status)));
  const liveCounts = aggregate(curated, "skill", (r) => r.status === "live");
  const rampTarget = 10; // the served CEFR ramp is 10 items per receptive skill
  const promptTarget = FLUENT_PROMPT_MIN; // a servable rotation per productive skill
  const receptive = unitsFrom(
    [{ key: "reading", label: "Reading" }, { key: "listening", label: "Listening" }],
    liveCounts,
    rampTarget,
  );
  const productive = unitsFrom(
    [{ key: "writing", label: "Writing (prompts)" }, { key: "speaking", label: "Speaking (prompts)" }],
    liveCounts,
    promptTarget,
  );
  const units = [...receptive.units, ...productive.units];
  const vetted = receptive.vetted + productive.vetted;
  const inReview = curated.filter((r) => r.status === "in_review").length;
  // Serving is gated by the RECEPTIVE ramp (the real scramble risk); productive
  // prompts always keep an in-code vetted fallback, so they never "scramble".
  const receptiveServable = receptive.units.every((u) => u.approved >= rampTarget);
  return {
    key: "fluent", label: "Fluent (English)", tier: "indicative", servesLive: !receptiveServable, hasReviewGate: curated.length > 0,
    vetted, total: curated.length, units, targetPerUnit: rampTarget, console: curated.length > 0 ? "/admin/fluent-bank" : "/ac/fluent/calibration",
    note: receptiveServable
      ? "Reading + listening served from the reviewed live bank (CEFR-ramped). Writing + speaking prompts serve from the vetted bank once promoted (else an in-code vetted rotation) - all four skills gated."
      : inReview > 0
        ? `${inReview} vetted item(s)/prompt(s) awaiting SME promotion to 'live'. Reading + listening mint live-AI until each has a full CEFR ramp; writing + speaking prompts serve the vetted bank once promoted (else the in-code vetted rotation).`
        : "Receptive items + productive prompts are AI-generated per sitting with no human vetting until the bank is filled and promoted.",
  };
}

// ── ARC: ara_questions on the ACTIVE bank version, is_active, by pillar ──
async function arc(): Promise<BankReadiness> {
  const versions = await selectRows("ara_question_bank_versions", "id, is_active");
  const active = new Set(versions.filter((v) => v.is_active).map((v) => String(v.id)));
  const rows = await selectRows("ara_questions", "pillar_id, version_id, is_active");
  const onActive = rows.filter((r) => active.has(String(r.version_id)));
  const counts = aggregate(onActive, "pillar_id", (r) => r.is_active === true);
  const target = 10;
  const { units, vetted, total } = unitsFrom(
    ARA_PILLARS.map((p) => ({ key: p.id, label: p.name_en ?? p.id })),
    counts,
    target,
  );
  return {
    key: "arc", label: "AR Compass (ARC)", tier: "reviewed", servesLive: false, hasReviewGate: true,
    vetted, total, units, targetPerUnit: target, console: "/ara/admin",
    note: "Seeded vetted production bank v1.1 with version-pinning (one active). Content-validity evidence (anchor instruments) is not yet populated; no reverse-keyed consistency items.",
  };
}

// ── Persona: managed bank (persona_items, migration 00185); code fallback ──
async function persona(): Promise<BankReadiness> {
  const comps = BEHAVIORAL_COMPETENCIES.length;
  const s = await loadPersonaBankStatus();
  if (!s.tableReady) {
    const totalItems = BEHAVIORAL_COMPETENCIES.reduce((sum, c) => sum + ((c.items as unknown[])?.length ?? 0), 0);
    return {
      key: "persona", label: "Persona (self-report)", tier: "indicative", servesLive: false, hasReviewGate: false,
      vetted: totalItems, total: totalItems, console: undefined,
      note: `Code-resident: ${totalItems} items across ${comps} competencies (fixed, no scramble). Apply migration 00185 + seed to manage them in the DB with an SME review gate.`,
    };
  }
  return {
    key: "persona", label: "Persona (self-report)", tier: "indicative", servesLive: false, hasReviewGate: true,
    vetted: s.approved, total: s.total, console: "/admin/persona-bank",
    note: s.pending > 0
      ? `${s.pending} of ${s.total} self-report items pending SME review across ${comps} competencies. Persona serves fixed items (never live-AI), but results are flagged provisional until an SME approves the content.`
      : `All ${s.total} self-report items are SME-approved across ${comps} competencies. Fixed bank, no scramble.`,
  };
}

// ── AC behavioural: behavioral_indicators per competency ──
async function acBehavioural(): Promise<BankReadiness> {
  const indicators = await selectRows("behavioral_indicators", "competency_id");
  const withIndicators = new Set(indicators.map((i) => String(i.competency_id)));
  const comps = await selectRows("competencies", "id");
  const total = comps.length || 41;
  const covered = comps.filter((c) => withIndicators.has(String(c.id))).length;
  return {
    key: "ac", label: "AC behavioural", tier: "reviewed", servesLive: false, hasReviewGate: false,
    vetted: indicators.length, total: indicators.length, console: "/admin/framework",
    note: `Seeded BARS framework (assessor-rated, not MCQ). ${covered}/${total || "?"} competencies have behavioral indicators${covered < total ? ` - ${total - covered} have none` : ""}. Tags/Q&A live only in a script, not a migration.`,
  };
}

// ── Reflect 360: seeded library templates (not a candidate-facing scored bank) ──
async function reflect(): Promise<BankReadiness> {
  const rows = await selectRows("reflect_frameworks", "id, is_template");
  const templates = rows.filter((r) => r.is_template).length;
  return {
    key: "reflect", label: "Reflect 360", tier: "reviewed", servesLive: false, hasReviewGate: true,
    vetted: templates, total: rows.length, console: undefined,
    note: `Multi-rater behaviour framework (frequency-rated, not scored). ${templates} library template(s). Per-engagement frameworks are AI-decomposed, but a consultant must now APPROVE the framework before an engagement can launch / raters are invited (gate). Seat/client-portal shells clone a pre-reviewed template, so they are approved by construction.`,
  };
}

// ── Pre-Hire quiz: competency_quiz_items (approved certifies; in_review awaits SME).
//    Rolled up to the 4 VIFM domains (competency -> cluster -> domain) so the card
//    shows the same per-unit "N in review" breakdown the other gated banks have. ──
async function prehire(): Promise<BankReadiness> {
  const rows = await selectRows("competency_quiz_items", "competency_id, status");
  // competency -> VIFM domain, via the cluster chain (tolerant of missing tables).
  const comps = await selectRows("competencies", "id, cluster_id");
  const clusters = await selectRows("competency_clusters", "id, domain_id");
  const domains = await selectRows("competency_domains", "id, name, sort_order");
  const clusterToDomain = new Map(clusters.map((c) => [String(c.id), String(c.domain_id)]));
  const domainName = new Map(domains.map((d) => [String(d.id), String(d.name)]));
  const compToDomain = new Map(
    comps.map((c) => [String(c.id), domainName.get(clusterToDomain.get(String(c.cluster_id)) ?? "") ?? "?"]),
  );
  const compsPerDomain = new Map<string, number>();
  for (const c of comps) {
    const dn = compToDomain.get(String(c.id)) ?? "?";
    compsPerDomain.set(dn, (compsPerDomain.get(dn) ?? 0) + 1);
  }

  const approvedByComp = new Map<string, number>();
  const perDomain = new Map<string, { approved: number; total: number }>();
  let inReview = 0;
  for (const r of rows) {
    const s = String(r.status);
    const dn = compToDomain.get(String(r.competency_id)) ?? "?";
    const pd = perDomain.get(dn) ?? { approved: 0, total: 0 };
    pd.total += 1;
    if (s === "approved") {
      approvedByComp.set(String(r.competency_id), (approvedByComp.get(String(r.competency_id)) ?? 0) + 1);
      pd.approved += 1;
    } else if (s === "in_review") inReview += 1;
    perDomain.set(dn, pd);
  }

  const TOTAL_COMPS = 41; // the VIFM behavioural framework
  const perCompTarget = 8; // a rotatable pool for the ~2-item-per-competency draw
  const compsReady = Array.from(approvedByComp.values()).filter((n) => n >= perCompTarget).length;
  const vetted = Array.from(approvedByComp.values()).reduce((a, b) => a + b, 0);
  const hasBank = rows.length > 0;

  // 4 domain rollups (in sort order); each domain's target = 8 x its competencies.
  const orderedDomains = domains
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const units: UnitReadiness[] | undefined = hasBank && orderedDomains.length > 0
    ? orderedDomains.map((d) => {
        const dn = String(d.name);
        const pd = perDomain.get(dn) ?? { approved: 0, total: 0 };
        return { unit: dn, approved: pd.approved, total: pd.total, target: perCompTarget * (compsPerDomain.get(dn) ?? 0) };
      })
    : undefined;

  return {
    key: "prehire", label: "Pre-Hire quiz", tier: "indicative", servesLive: compsReady < TOTAL_COMPS, hasReviewGate: hasBank,
    vetted, total: rows.length, units, targetPerUnit: perCompTarget, console: hasBank ? "/admin/quiz-bank" : undefined,
    note: !hasBank
      ? "No item bank: every quiz deck is minted live from the LLM at start, so no SME sees an item before a hiring candidate does; two candidates for one job get non-equated forms."
      : vetted > 0
        ? `${compsReady}/${TOTAL_COMPS} competencies have an approved pool; a sitting draws vetted items where available and falls back to live-AI otherwise. ${inReview} more in review.`
        : `${inReview} SJT item(s) authored and awaiting SME approval (rolled up by domain below); until a competency's pool is approved the screen still mints live-AI.`,
  };
}

/** Load readiness for every bank (DB queries run in parallel; all tolerant).
 *  Big Five / OCEAN personality is deliberately absent - it is retired (nothing
 *  serves it; Persona is the behavioural self-report now), so it is not a bank. */
export async function loadBankReadiness(): Promise<BankReadiness[]> {
  const psy = await psyCounts();
  const [t, l, f, a, ac, rf, ph, pe] = await Promise.all([
    techno(),
    logica(psy),
    fluent(),
    arc(),
    acBehavioural(),
    reflect(),
    prehire(),
    persona(),
  ]);
  // Order: scramble-risk item banks first, then framework/reviewed banks.
  return [l, f, ph, t, a, ac, pe, rf];
}
