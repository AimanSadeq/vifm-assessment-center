// Pre-Hire adverse-impact (disparate-impact) analysis — the 4/5ths rule.
//
// For each demographic dimension we compute the selection rate per group, take
// the highest-selected group as the reference, and flag any group whose
// selection rate is below 80% (4/5ths) of the reference. This is the standard
// fairness screen used in employment selection (US EEOC Uniform Guidelines; a
// widely-adopted heuristic elsewhere including GCC good practice).
//
// IMPORTANT framing:
//   • This is a MONITORING signal, not proof of discrimination. A flag warrants
//     review of the instrument's job-relatedness, not an automatic change.
//   • Small samples make the ratio unstable — we surface n and an `underpowered`
//     caveat rather than implying false precision.
//   • Demographics are voluntary self-ID; 'prefer_not_to_say' / null are counted
//     as "not disclosed" and excluded from group rates (never imputed).
//
// Pure + dependency-free (type-only imports) so it's unit-testable and safe to
// import from scripts.

import type {
  PrehireGender,
  PrehireAgeBand,
  PrehireNationalityGroup,
  PrehireDecision,
} from "@/types/prehire";

export const FOUR_FIFTHS = 0.8;
const MIN_GROUP_N = 5; // a group smaller than this gives an unstable rate
const MIN_POOL = 30; // EEOC informal floor for meaningful impact-ratio analysis

export type AdverseImpactCandidate = {
  gender: PrehireGender | null;
  age_band: PrehireAgeBand | null;
  nationality_group: PrehireNationalityGroup | null;
  decision: PrehireDecision | null;
  recommendation: string | null;
};

export type SelectionBasis = "decision" | "recommendation";

export type GroupResult = {
  group: string;
  label: string;
  n: number;
  selected: number;
  selectionRate: number; // 0..1
  impactRatio: number | null; // group rate / reference rate; null if reference rate is 0
  isReference: boolean;
  adverseImpact: boolean; // ratio < 0.8 and not the reference group
  smallSample: boolean; // n < MIN_GROUP_N
};

export type ImpactDimension = "gender" | "age_band" | "nationality_group";

export type DimensionResult = {
  dimension: ImpactDimension;
  label: string;
  groups: GroupResult[];
  referenceGroup: string | null;
  notDisclosed: number;
  anyAdverseImpact: boolean;
  underpowered: boolean;
};

export type AdverseImpactReport = {
  basis: SelectionBasis;
  poolSize: number;
  selectedTotal: number;
  dimensions: DimensionResult[];
  generatedAt: string;
};

const GENDER_LABELS: Record<string, string> = { male: "Male", female: "Female" };
const AGE_LABELS: Record<string, string> = {
  under_25: "Under 25",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_plus": "55+",
};
const NATIONALITY_LABELS: Record<string, string> = { national: "National / citizen", expatriate: "Expatriate / resident" };

const DIMENSION_LABELS: Record<ImpactDimension, string> = {
  gender: "Gender",
  age_band: "Age band",
  nationality_group: "Nationality",
};
const LABEL_MAPS: Record<ImpactDimension, Record<string, string>> = {
  gender: GENDER_LABELS,
  age_band: AGE_LABELS,
  nationality_group: NATIONALITY_LABELS,
};

const isDisclosed = (v: string | null): v is string => v != null && v !== "prefer_not_to_say";

/** Pick the basis automatically: prefer real human decisions, fall back to the AI signal. */
export function pickBasis(candidates: AdverseImpactCandidate[]): SelectionBasis {
  const hasDecisions = candidates.some((c) => c.decision === "advanced" || c.decision === "rejected");
  return hasDecisions ? "decision" : "recommendation";
}

/**
 * Is this candidate part of the analysis pool, and were they selected?
 *  - decision basis: pool = {advanced, rejected}; selected = advanced.
 *    (hold = undecided, withdrawn = self-removed → excluded from the pool)
 *  - recommendation basis: pool = {advance, review, hold}; selected = advance.
 *    (incomplete / null → excluded; not yet a screening outcome)
 */
function poolMembership(c: AdverseImpactCandidate, basis: SelectionBasis): { inPool: boolean; selected: boolean } {
  if (basis === "decision") {
    if (c.decision === "advanced") return { inPool: true, selected: true };
    if (c.decision === "rejected") return { inPool: true, selected: false };
    return { inPool: false, selected: false };
  }
  const rec = c.recommendation;
  if (rec === "advance") return { inPool: true, selected: true };
  if (rec === "review" || rec === "hold") return { inPool: true, selected: false };
  return { inPool: false, selected: false };
}

function analyzeDimension(
  pool: Array<{ c: AdverseImpactCandidate; selected: boolean }>,
  dimension: ImpactDimension
): DimensionResult {
  const labels = LABEL_MAPS[dimension];
  const counts = new Map<string, { n: number; selected: number }>();
  let notDisclosed = 0;

  for (const { c, selected } of pool) {
    const v = c[dimension];
    if (!isDisclosed(v)) {
      notDisclosed += 1;
      continue;
    }
    const entry = counts.get(v) ?? { n: 0, selected: 0 };
    entry.n += 1;
    if (selected) entry.selected += 1;
    counts.set(v, entry);
  }

  // Reference group = highest selection rate among groups with at least one member.
  let referenceGroup: string | null = null;
  let refRate = -1;
  for (const [group, { n, selected }] of Array.from(counts.entries())) {
    const rate = n > 0 ? selected / n : 0;
    if (rate > refRate) {
      refRate = rate;
      referenceGroup = group;
    }
  }

  const groups: GroupResult[] = Array.from(counts.entries())
    .map(([group, { n, selected }]) => {
      const selectionRate = n > 0 ? selected / n : 0;
      const impactRatio = refRate > 0 ? selectionRate / refRate : null;
      const isReference = group === referenceGroup;
      return {
        group,
        label: labels[group] ?? group,
        n,
        selected,
        selectionRate,
        impactRatio,
        isReference,
        adverseImpact: !isReference && impactRatio != null && impactRatio < FOUR_FIFTHS,
        smallSample: n < MIN_GROUP_N,
      };
    })
    .sort((a, b) => b.selectionRate - a.selectionRate);

  const poolSize = pool.length;
  const underpowered = poolSize < MIN_POOL || groups.some((g) => g.smallSample) || groups.length < 2;

  return {
    dimension,
    label: DIMENSION_LABELS[dimension],
    groups,
    referenceGroup,
    notDisclosed,
    anyAdverseImpact: groups.some((g) => g.adverseImpact),
    underpowered,
  };
}

export function computeAdverseImpact(
  candidates: AdverseImpactCandidate[],
  basisOverride?: SelectionBasis
): AdverseImpactReport {
  const basis = basisOverride ?? pickBasis(candidates);
  const pool = candidates
    .map((c) => ({ c, ...poolMembership(c, basis) }))
    .filter((m) => m.inPool)
    .map((m) => ({ c: m.c, selected: m.selected }));

  const dimensions: ImpactDimension[] = ["gender", "age_band", "nationality_group"];

  return {
    basis,
    poolSize: pool.length,
    selectedTotal: pool.filter((p) => p.selected).length,
    dimensions: dimensions.map((d) => analyzeDimension(pool, d)),
    generatedAt: new Date().toISOString(),
  };
}
