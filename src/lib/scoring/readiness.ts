/**
 * Succession Readiness scoring engine.
 *
 * Turns a candidate's observed competency evidence into a succession
 * readiness tier against a TARGET ROLE. The readiness signal is driven by
 * the 360 "Others" view (manager / peer / direct-report / skip-level /
 * other); the self-assessment never moves the tier and is differenced
 * against Others only to surface self-awareness (over-rating, under-rating,
 * blind spots).
 *
 * Design goals, mirroring src/lib/scoring/talent-map.ts:
 *   - PURE + dependency-free, so it unit-tests cleanly and can be reused by
 *     a server action, a PDF, or a client-facing surface.
 *   - CONFIG-DRIVEN. Every threshold, the knockout rule, the weighting
 *     switch, the coverage floor, the advisory bands, and the optional year
 *     layer come in via a ReadinessConfig object. The admin panel persists
 *     that object so the index can be tuned without a code change.
 *
 * v2 adds two ADVISORY confidence signals that never change the tier:
 *   - borderline: the candidate sits within `borderlineBand` of a cutoff, so
 *     the tier is a near-call and should not be over-read.
 *   - low rater agreement: the 360 Others disagree sharply on a competency
 *     (Others spread at or above `raterAgreementSpreadMax`).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * THE READINESS INDEX - how it is calculated
 * ──────────────────────────────────────────────────────────────────────────
 * Computed over the target role's competencies (role_profile_competencies),
 * each carrying a weight (0.5–10), a priority (high/medium/low), and a target
 * proficiency on the 1–5 scale (role_profiles.default_target_proficiency,
 * typically 4).
 *
 *   1. Coverage. A role competency is "covered" when the 360 produced an
 *      Others-mean for it from at least `minOthersPerCompetency` raters.
 *      coveragePct = covered / total role competencies. If coveragePct is
 *      below `coverageMinPct`, the result is `insufficient_data` and NO tier
 *      is asserted (thin data must not masquerade as a verdict).
 *
 *   2. Weighted Others level. Over covered competencies:
 *         weightedOthers = Σ(othersMean × weight) / Σ(weight)
 *      (`useWeights = false` collapses every weight to 1, i.e. a plain mean.)
 *
 *   3. Gap. weightedTarget is the same weighted blend of each covered
 *      competency's target. overallGap = weightedOthers − weightedTarget.
 *      When every target is the role default T, weightedTarget = T and the
 *      gap is simply (weightedOthers − T).
 *
 *   4. Tier from gap (cutoffs are descending, all configurable):
 *         gap ≥ readyNowGapCut   (0.0)  → Ready Now
 *         gap ≥ readySoonGapCut  (−0.5) → Ready Soon
 *         gap ≥ developingGapCut (−1.0) → Developing
 *         otherwise                     → Not Ready
 *
 *   5. Knockout guardrail. If `knockoutEnabled`, any covered competency whose
 *      priority equals `knockoutPriority` (default "high") and whose
 *      Others-mean sits `knockoutGap` (default 1.0) or more below its target
 *      caps the final tier at `knockoutCapTier` (default "Developing"). A
 *      strong average never fast-tracks someone failing a must-have.
 *
 *   6. Self vs Others (self-awareness only, never changes the tier). Per
 *      competency, selfOthersGap = selfMean − othersMean, flagged as
 *      over-rater / under-rater / aligned, plus blind-spot (Others below
 *      target while Self at or above) and hidden-strength (Others at or above
 *      target while Self below). In combined mode the self source is the
 *      behavioral self-assessment; otherwise it is the 360 self-rater.
 *
 *   7. Optional year layer. When `yearLayerEnabled`, the tier is mapped to a
 *      client-defined horizon label (`yearMap`) for stakeholder-facing copy.
 *      It is presentation only and is derived FROM the tier, never the maths.
 *
 *   8. Advisory confidence (v2, never changes the tier). `borderline` is set
 *      when overallGap is within `borderlineBand` of any cutoff;
 *      `lowAgreementCount` counts covered competencies whose Others spread is
 *      at or above `raterAgreementSpreadMax`. Surface both as caveats.
 */

import {
  scoreBand,
  nineBoxCell,
  PERFORMANCE_DOMAINS,
  POTENTIAL_DOMAINS,
  meanOrNull,
  type TalentBand,
  type NineBoxCell,
} from "@/lib/scoring/talent-map";

export type ReadinessTier = "ready_now" | "ready_soon" | "developing" | "not_ready";
export type ReadinessStatus = ReadinessTier | "insufficient_data";
export type RoleCompetencyPriority = "high" | "medium" | "low";

/** Where the readiness signal came from. The tier is normally driven by the
 *  360 "Others" view; in a Persona-only succession run (no 360) the candidate's
 *  Persona self-ratings drive it instead, and the report must say so. */
export type ReadinessEvidenceSource = "others_360" | "persona_self";

/** Tunable parameters. Persisted by the admin panel; see DEFAULT below. */
export type ReadinessConfig = {
  /** Tier gap cutoffs (weightedOthers − weightedTarget). Must be descending. */
  readyNowGapCut: number;
  readySoonGapCut: number;
  developingGapCut: number;
  /** Knockout guardrail on must-have competencies. */
  knockoutEnabled: boolean;
  knockoutPriority: RoleCompetencyPriority;
  knockoutGap: number;
  knockoutCapTier: ReadinessTier;
  /** Aggregation + data sufficiency. */
  useWeights: boolean;
  minOthersPerCompetency: number;
  /** Fraction (0–1) of role competencies that must be covered to assert a tier. */
  coverageMinPct: number;
  /** Advisory: |gap − cutoff| at or under this flags the result as borderline. */
  borderlineBand: number;
  /** Advisory: a competency's Others spread (max−min) at or above this flags low agreement. */
  raterAgreementSpreadMax: number;
  /** Optional stakeholder-facing horizon layer. */
  yearLayerEnabled: boolean;
  yearMap: Record<ReadinessTier, string>;
};

export const DEFAULT_READINESS_CONFIG: ReadinessConfig = {
  readyNowGapCut: 0.0,
  readySoonGapCut: -0.5,
  developingGapCut: -1.0,
  knockoutEnabled: true,
  knockoutPriority: "high",
  knockoutGap: 1.0,
  knockoutCapTier: "developing",
  useWeights: true,
  minOthersPerCompetency: 1,
  coverageMinPct: 0.7,
  borderlineBand: 0.1,
  raterAgreementSpreadMax: 3,
  yearLayerEnabled: false,
  yearMap: {
    ready_now: "0–2 years",
    ready_soon: "1–3 years",
    developing: "3–5 years",
    not_ready: "Beyond 5 years / not in pipeline",
  },
};

/**
 * Self-awareness thresholds. Kept as documented engine constants rather than
 * config: they shape narrative flags, not the readiness decision. Adjust here
 * if a client needs a different sensitivity.
 */
export const SELF_GAP_ALIGNED_BAND = 0.75; // |self − others| under this = "aligned"

export type SelfAwarenessFlag =
  | "over_rater"
  | "under_rater"
  | "aligned"
  | "blind_spot"
  | "hidden_strength"
  | null;

/** Presentation metadata for each tier (label + tone token + blurb). */
export const READINESS_TIER_META: Record<
  ReadinessStatus,
  { label: string; blurb: string; tone: "emerald" | "sky" | "amber" | "rose" | "slate" }
> = {
  ready_now: {
    label: "Ready Now",
    blurb: "Meets or exceeds the target-role bar on the role's weighted competencies.",
    tone: "emerald",
  },
  ready_soon: {
    label: "Ready Soon",
    blurb: "Just short of the bar; a focused, near-term development push closes it.",
    tone: "sky",
  },
  developing: {
    label: "Developing",
    blurb: "Moderate gaps to the role bar; a structured development plan is required.",
    tone: "amber",
  },
  not_ready: {
    label: "Not Ready",
    blurb: "Substantial gaps to the role bar; not a current succession candidate for this role.",
    tone: "rose",
  },
  insufficient_data: {
    label: "Insufficient Data",
    blurb: "Too few rated competencies to assert a readiness tier.",
    tone: "slate",
  },
};

/** Tier severity, best → worst. Index used to apply the knockout cap. */
const TIER_ORDER: ReadinessTier[] = ["ready_now", "ready_soon", "developing", "not_ready"];

/** One target-role competency requirement (role_profile_competencies + target). */
export type RoleCompetencyReq = {
  /** competencies.id (the main AC catalogue id). */
  competencyId: string;
  name: string;
  weight: number;
  priority: RoleCompetencyPriority;
  /** Target proficiency 1–5 (defaults to role_profiles.default_target_proficiency). */
  target: number;
  /** VIFM domain (RESULTS / PEOPLE / THINKING / SELF) for the 9-box axes.
   *  Optional: when absent the 9-box falls back to the overall mean per axis. */
  domain?: string | null;
};

/** Per-competency observed evidence, already aggregated from the 360. */
export type ObservedCompetency = {
  /** competencies.id (mapped from the Reflect competency - see handover §5). */
  competencyId: string;
  /** 360 Others-mean (excludes self). Null when no/too-few Others raters. */
  othersMean: number | null;
  /** Self source (behavioral self-assessment in combined mode, else 360 self). */
  selfMean: number | null;
  /** Distinct Others raters contributing to othersMean. */
  othersCount?: number;
  /** Spread of the Others ratings (max−min across rater groups). Enables the low-agreement flag. */
  othersSpread?: number | null;
};

export type CompetencyReadiness = {
  competencyId: string;
  name: string;
  weight: number;
  priority: RoleCompetencyPriority;
  target: number;
  domain: string | null;
  othersMean: number | null;
  /** othersMean − target. */
  gap: number | null;
  covered: boolean;
  knockoutTriggered: boolean;
  selfMean: number | null;
  /** selfMean − othersMean. */
  selfOthersGap: number | null;
  selfFlag: SelfAwarenessFlag;
  /** Advisory: Others disagree sharply on this competency (spread ≥ raterAgreementSpreadMax). */
  lowAgreement: boolean;
};

export type ReadinessResult = {
  status: ReadinessStatus;
  /** Null when status is insufficient_data. */
  tier: ReadinessTier | null;
  weightedOthers: number | null;
  weightedTarget: number | null;
  overallGap: number | null;
  /** 0–1. */
  coveragePct: number;
  coveredCount: number;
  totalCount: number;
  knockoutApplied: boolean;
  /** Set only when yearLayerEnabled. */
  yearLabel: string | null;
  competencies: CompetencyReadiness[];
  overallSelf: number | null;
  overallSelfOthersGap: number | null;
  /** Advisory confidence flags (never change the tier). */
  borderline: boolean;
  borderlineNote: string | null;
  nearestCutoffDistance: number | null;
  lowAgreementCount: number;
  /** Where the signal came from (360 vs Persona-only). */
  evidenceSource: ReadinessEvidenceSource;
  /** 9-box placement (SD-2). Performance = RESULTS+PEOPLE mean, Potential =
   *  THINKING+SELF mean, banded low/med/high. Null when no covered evidence. */
  performanceMean: number | null;
  potentialMean: number | null;
  performanceBand: TalentBand | null;
  potentialBand: TalentBand | null;
  nineBoxLabel: string | null;
  nineBoxAction: string | null;
  nineBoxTone: NineBoxCell["tone"] | null;
};

function weightedMean(pairs: Array<{ value: number; weight: number }>): number | null {
  const wsum = pairs.reduce((a, p) => a + p.weight, 0);
  if (wsum <= 0) return null;
  return pairs.reduce((a, p) => a + p.value * p.weight, 0) / wsum;
}

type NineBox = {
  performanceMean: number | null;
  potentialMean: number | null;
  performanceBand: TalentBand | null;
  potentialBand: TalentBand | null;
  nineBoxLabel: string | null;
  nineBoxAction: string | null;
  nineBoxTone: NineBoxCell["tone"] | null;
};
const EMPTY_NINE_BOX: NineBox = {
  performanceMean: null, potentialMean: null, performanceBand: null, potentialBand: null,
  nineBoxLabel: null, nineBoxAction: null, nineBoxTone: null,
};

/**
 * 9-box placement from the covered competencies' driver means (SD-2). Reuses
 * the AC talent-map axes: Performance = RESULTS+PEOPLE, Potential = THINKING+
 * SELF. When a domain has no covered competency, that axis falls back to the
 * overall driver mean so the candidate still plots (mirrors talent-map.ts).
 */
function computeNineBox(
  covered: CompetencyReadiness[],
  overallDriverMean: number | null
): NineBox {
  const perf = covered
    .filter((c) => c.domain != null && (PERFORMANCE_DOMAINS as readonly string[]).includes(c.domain))
    .map((c) => c.othersMean as number);
  const pot = covered
    .filter((c) => c.domain != null && (POTENTIAL_DOMAINS as readonly string[]).includes(c.domain))
    .map((c) => c.othersMean as number);
  const performanceMean = meanOrNull(perf) ?? overallDriverMean;
  const potentialMean = meanOrNull(pot) ?? overallDriverMean;
  if (performanceMean == null || potentialMean == null) return EMPTY_NINE_BOX;
  const performanceBand = scoreBand(performanceMean);
  const potentialBand = scoreBand(potentialMean);
  const cell = nineBoxCell(potentialBand, performanceBand);
  return {
    performanceMean,
    potentialMean,
    performanceBand,
    potentialBand,
    nineBoxLabel: cell.label,
    nineBoxAction: cell.action,
    nineBoxTone: cell.tone,
  };
}

function tierFromGap(gap: number, cfg: ReadinessConfig): ReadinessTier {
  if (gap >= cfg.readyNowGapCut) return "ready_now";
  if (gap >= cfg.readySoonGapCut) return "ready_soon";
  if (gap >= cfg.developingGapCut) return "developing";
  return "not_ready";
}

/** Cap `tier` so it is no better than `cap` in severity order. */
function capTier(tier: ReadinessTier, cap: ReadinessTier): ReadinessTier {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(cap) ? tier : cap;
}

function selfAwarenessFlag(
  selfMean: number | null,
  othersMean: number | null,
  target: number
): SelfAwarenessFlag {
  if (selfMean == null || othersMean == null) return null;
  const gap = selfMean - othersMean;
  const othersBelow = othersMean < target;
  const selfAtOrAbove = selfMean >= target;
  if (othersBelow && selfAtOrAbove) return "blind_spot";
  if (!othersBelow && !selfAtOrAbove) return "hidden_strength";
  if (gap > SELF_GAP_ALIGNED_BAND) return "over_rater";
  if (gap < -SELF_GAP_ALIGNED_BAND) return "under_rater";
  return "aligned";
}

/**
 * Compute a candidate's succession readiness for a target role.
 *
 * @param role     The target role's weighted competency requirements.
 * @param observed Per-competency 360 evidence (Others-mean + self source + optional spread).
 * @param config   Tunable parameters (defaults to DEFAULT_READINESS_CONFIG).
 */
export function computeReadiness(
  role: RoleCompetencyReq[],
  observed: ObservedCompetency[],
  config: ReadinessConfig = DEFAULT_READINESS_CONFIG,
  evidenceSource: ReadinessEvidenceSource = "others_360"
): ReadinessResult {
  const obsById = new Map(observed.map((o) => [o.competencyId, o]));
  const totalCount = role.length;

  const competencies: CompetencyReadiness[] = role.map((req) => {
    const o = obsById.get(req.competencyId);
    const othersMean = o?.othersMean ?? null;
    const othersCount = o?.othersCount ?? (othersMean != null ? 1 : 0);
    const covered = othersMean != null && othersCount >= config.minOthersPerCompetency;
    const selfMean = o?.selfMean ?? null;
    const gap = othersMean != null ? othersMean - req.target : null;
    const knockoutTriggered =
      config.knockoutEnabled &&
      covered &&
      req.priority === config.knockoutPriority &&
      othersMean! <= req.target - config.knockoutGap;
    const lowAgreement =
      covered && o?.othersSpread != null && (o.othersSpread as number) >= config.raterAgreementSpreadMax;
    return {
      competencyId: req.competencyId,
      name: req.name,
      weight: req.weight,
      priority: req.priority,
      target: req.target,
      domain: req.domain ?? null,
      othersMean,
      gap,
      covered,
      knockoutTriggered,
      selfMean,
      selfOthersGap: selfMean != null && othersMean != null ? selfMean - othersMean : null,
      selfFlag: selfAwarenessFlag(selfMean, othersMean, req.target),
      lowAgreement,
    };
  });

  const covered = competencies.filter((c) => c.covered);
  const coveredCount = covered.length;
  const coveragePct = totalCount > 0 ? coveredCount / totalCount : 0;
  const lowAgreementCount = covered.filter((c) => c.lowAgreement).length;

  // Self-awareness headline is available even when readiness can't be asserted.
  const selfPairs = competencies
    .filter((c) => c.selfMean != null)
    .map((c) => ({ value: c.selfMean as number, weight: config.useWeights ? c.weight : 1 }));
  const overallSelf = weightedMean(selfPairs);

  if (coveredCount === 0 || coveragePct < config.coverageMinPct) {
    return {
      status: "insufficient_data",
      tier: null,
      weightedOthers: null,
      weightedTarget: null,
      overallGap: null,
      coveragePct,
      coveredCount,
      totalCount,
      knockoutApplied: false,
      yearLabel: null,
      competencies,
      overallSelf,
      overallSelfOthersGap: null,
      borderline: false,
      borderlineNote: null,
      nearestCutoffDistance: null,
      lowAgreementCount,
      evidenceSource,
      ...EMPTY_NINE_BOX,
    };
  }

  const w = (c: CompetencyReadiness) => (config.useWeights ? c.weight : 1);
  const weightedOthers = weightedMean(
    covered.map((c) => ({ value: c.othersMean as number, weight: w(c) }))
  );
  const weightedTarget = weightedMean(covered.map((c) => ({ value: c.target, weight: w(c) })));
  const overallGap =
    weightedOthers != null && weightedTarget != null ? weightedOthers - weightedTarget : null;

  let tier = tierFromGap(overallGap as number, config);
  const knockoutApplied = config.knockoutEnabled && covered.some((c) => c.knockoutTriggered);
  if (knockoutApplied) tier = capTier(tier, config.knockoutCapTier);

  const overallOthersForGap = weightedMean(
    covered
      .filter((c) => c.selfMean != null)
      .map((c) => ({ value: c.othersMean as number, weight: w(c) }))
  );
  const overallSelfOthersGap =
    overallSelf != null && overallOthersForGap != null ? overallSelf - overallOthersForGap : null;

  // Advisory: how close is the gap to the nearest tier boundary?
  const g = overallGap as number;
  const cutoffs: Array<{ label: string; cut: number }> = [
    { label: "Ready Now", cut: config.readyNowGapCut },
    { label: "Ready Soon", cut: config.readySoonGapCut },
    { label: "Developing", cut: config.developingGapCut },
  ];
  let nearestCutoffDistance: number | null = null;
  let borderlineNote: string | null = null;
  for (const { label, cut } of cutoffs) {
    const d = Math.abs(g - cut);
    if (nearestCutoffDistance === null || d < nearestCutoffDistance) {
      nearestCutoffDistance = d;
      borderlineNote = `gap ${g.toFixed(2)} is ${d.toFixed(2)} from the ${label} cutoff (${cut.toFixed(2)})`;
    }
  }
  const borderline = nearestCutoffDistance !== null && nearestCutoffDistance <= config.borderlineBand;

  // 9-box placement from the covered driver means (SD-2).
  const nineBox = computeNineBox(covered, weightedOthers);

  return {
    status: tier,
    tier,
    weightedOthers,
    weightedTarget,
    overallGap,
    coveragePct,
    coveredCount,
    totalCount,
    knockoutApplied,
    yearLabel: config.yearLayerEnabled ? config.yearMap[tier] : null,
    competencies,
    overallSelf,
    overallSelfOthersGap,
    borderline,
    borderlineNote: borderline ? borderlineNote : null,
    nearestCutoffDistance,
    lowAgreementCount,
    evidenceSource,
    ...nineBox,
  };
}
