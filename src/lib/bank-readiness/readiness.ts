// Cross-bank item/test readiness. For each Caliber service that serves questions,
// count how many VETTED (approved / live / active) items exist per unit vs a blueprint
// target, and flag which banks still generate items live at deal time ("scramble risk").
// Every loader is tolerant of an empty or un-applied table so the page never 500s.

import { createServiceClient } from "@/lib/supabase/server";
import { COGNITIVE_SUBTESTS } from "@/lib/psychometrics/framework";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { TECH_DOMAINS } from "@/lib/competencies/technical-framework";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";

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
  const std = new Set(TECH_DOMAINS.map((d) => d.key));
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

// ── psy_items powers BOTH Logica (cognitive) and Psychometrics (Big Five). Map scale_id -> scale_key once. ──
async function psyCounts(): Promise<Map<string, { total: number; approved: number }>> {
  const scales = await selectRows("psy_scales", "id, key");
  const idToKey = new Map(scales.map((s) => [String(s.id), String(s.key)]));
  const items = await selectRows("psy_items", "scale_id, status");
  const byKey: Array<Record<string, unknown>> = items.map((i) => ({
    scale_key: idToKey.get(String(i.scale_id)) ?? "?",
    status: i.status,
  }));
  return aggregate(byKey, "scale_key", (r) => r.status === "approved");
}

async function logica(counts: Map<string, { total: number; approved: number }>): Promise<BankReadiness> {
  const target = 8; // min approved/subtest before a real sitting serves the bank
  const { units, vetted, total } = unitsFrom(
    COGNITIVE_SUBTESTS.map((s) => ({ key: s.key, label: s.name_en })),
    counts,
    target,
  );
  // Once every subtest meets the blueprint floor, a candidate/voucher-bound sitting
  // serves the reviewed fixed-form bank (never live-AI) - so it no longer "scrambles".
  const filled = units.length > 0 && units.every((u) => u.approved >= target);
  return {
    key: "logica", label: "Logica (cognitive)", tier: "indicative", servesLive: !filled, hasReviewGate: true,
    vetted, total, units, targetPerUnit: target, console: "/admin/psychometrics",
    note: filled
      ? "Serving the SME-reviewed fixed-form bank (VIFM Cognitive Item-Bank Standard v1): per-subtest x per-facet blueprint, EN+AR, two-person review. A candidate/voucher-bound sitting fails safe (503) rather than fall back to live-AI. Still Tier-1 indicative until norms accumulate."
      : "Items are generated live from the LLM every sitting (no vetted form). Seed the cognitive bank in /admin/psychometrics to serve the reviewed fixed form instead.",
  };
}

// ── Fluent: eng_fluent_items, status='live', receptive skills only ──
async function fluent(): Promise<BankReadiness> {
  const rows = await selectRows("eng_fluent_items", "skill, status");
  const counts = aggregate(rows, "skill", (r) => r.status === "live");
  const target = 15;
  const { units, vetted, total } = unitsFrom(
    [{ key: "reading", label: "Reading" }, { key: "listening", label: "Listening" }],
    counts,
    target,
  );
  return {
    key: "fluent", label: "Fluent (English)", tier: "indicative", servesLive: true, hasReviewGate: false,
    vetted, total, units, targetPerUnit: target, console: "/ac/fluent/calibration",
    note: "Receptive items are AI-generated per sitting and served with no human vetting; the IRT/CAT engine is built but dead-wired. Writing + speaking are AI-scored tasks (not a bank).",
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

// ── Persona: hand-authored items in code (behavioral-items.ts) ──
function persona(): BankReadiness {
  const totalItems = BEHAVIORAL_COMPETENCIES.reduce((s, c) => s + ((c.items as unknown[])?.length ?? 0), 0);
  const comps = BEHAVIORAL_COMPETENCIES.length;
  return {
    key: "persona", label: "Persona (self-report)", tier: "indicative", servesLive: false, hasReviewGate: false,
    vetted: totalItems, total: totalItems, console: undefined,
    note: `Hand-authored: ${totalItems} items across ${comps} competencies (fixed, so no scramble). Gaps are downstream: GCC norms empty, no bank version pin, Arabic pending human sign-off.`,
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
    key: "reflect", label: "Reflect 360", tier: "reviewed", servesLive: false, hasReviewGate: false,
    vetted: templates, total: rows.length, console: undefined,
    note: `Multi-rater behaviour framework (frequency-rated, not scored). ${templates} library template(s); per-engagement frameworks are AI-decomposed with only informal review. No approval gate or admin authoring surface.`,
  };
}

// ── Pre-Hire quiz: no persisted bank at all ──
function prehire(): BankReadiness {
  return {
    key: "prehire", label: "Pre-Hire quiz", tier: "indicative", servesLive: true, hasReviewGate: false,
    vetted: 0, total: 0, console: undefined,
    note: "No item bank: every quiz deck is minted live from the LLM at start, so no SME sees an item before a hiring candidate does; two candidates for one job get non-equated forms.",
  };
}

/** Load readiness for every bank (DB queries run in parallel; all tolerant).
 *  Big Five / OCEAN personality is deliberately absent - it is retired (nothing
 *  serves it; Persona is the behavioural self-report now), so it is not a bank. */
export async function loadBankReadiness(): Promise<BankReadiness[]> {
  const counts = await psyCounts();
  const [t, l, f, a, ac, rf] = await Promise.all([
    techno(),
    logica(counts),
    fluent(),
    arc(),
    acBehavioural(),
    reflect(),
  ]);
  // Order: scramble-risk item banks first, then framework/reviewed banks.
  return [l, f, prehire(), t, a, ac, persona(), rf];
}
