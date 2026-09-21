/**
 * The arithmetic overall centre rating.
 *
 * A selection centre must reach its overall rating by calculation rather than by
 * the panel agreeing a number in the room (BPS standard for assessment centres,
 * clause 7.4: arithmetic combination validates substantially better than
 * consensus discussion). The panel's judgement is still what produces the
 * per-competency ratings; this only fixes the last step.
 *
 * Deliberate properties:
 *  - The decimal is kept. Rounding early hides how close a candidate was to a
 *    band boundary, which is exactly what a challenged decision needs to show.
 *  - Every input is returned alongside the result, so the number can be
 *    reconstructed from the record later (clause 8.8).
 *  - A competency with no agreed rating is reported, never treated as a zero or
 *    silently dropped: an incomplete centre should look incomplete.
 *  - Unset weights count as 1. A centre that never weighted its competencies is
 *    saying they matter equally, which is a defensible reading; a centre that
 *    weighted SOME of them is not, and is reported as a problem.
 */

export type CompetencyInput = {
  competencyId: string;
  name?: string;
  /** Weight from the engagement design. Null means "not weighted". */
  weight: number | null;
  /** The agreed consensus rating, 1 to 5. Null means not yet agreed. */
  score: number | null;
};

export type OverallRatingResult = {
  /** Weighted mean of the agreed ratings, two decimals. Null when nothing can be computed. */
  score: number | null;
  /** The same figure banded to the 1 to 5 scale the rest of the platform uses. */
  band: number | null;
  /** Inputs, for the stored snapshot and for showing the working. */
  breakdown: { competencyId: string; name?: string; weight: number; score: number; contribution: number }[];
  /** Competencies with no agreed rating yet. */
  missing: { competencyId: string; name?: string }[];
  /** Reasons the rating cannot be treated as final. */
  problems: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeOverallRating(competencies: CompetencyInput[]): OverallRatingResult {
  const rated = competencies.filter((c) => c.score != null);
  const missing = competencies
    .filter((c) => c.score == null)
    .map((c) => ({ competencyId: c.competencyId, name: c.name }));

  const problems: string[] = [];
  if (competencies.length === 0) problems.push("This engagement has no competencies.");
  if (missing.length > 0) {
    problems.push(
      `${missing.length} of ${competencies.length} competencies have no agreed rating yet.`
    );
  }

  // Partial weighting is ambiguous: it is not clear whether the unweighted ones
  // were meant to count equally or not at all. Say so rather than choose.
  const weighted = competencies.filter((c) => c.weight != null && c.weight > 0);
  if (weighted.length > 0 && weighted.length < competencies.length) {
    problems.push(
      "Some competencies carry a weight and others do not. Weight all of them, or none, before relying on this rating."
    );
  }

  const breakdown = rated.map((c) => {
    const weight = c.weight != null && c.weight > 0 ? c.weight : 1;
    return {
      competencyId: c.competencyId,
      name: c.name,
      weight,
      score: c.score as number,
      contribution: round2(weight * (c.score as number)),
    };
  });

  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight === 0) {
    return { score: null, band: null, breakdown, missing, problems };
  }

  const score = round2(breakdown.reduce((sum, b) => sum + b.weight * b.score, 0) / totalWeight);
  return { score, band: Math.round(score), breakdown, missing, problems };
}

/**
 * Whether an arithmetic rating may be produced at all.
 *
 * The weights decide the answer, so a rating computed from weights nobody has
 * approved is not defensible (clause 7.3 requires weighting to come from the job
 * analysis). The JD extractor proposes weights; a person has to confirm them.
 */
export function canComputeOverallRating(engagement: {
  integration_method?: string | null;
  purpose?: string | null;
  weights_confirmed_at?: string | null;
}): { allowed: boolean; reason?: string } {
  const method = engagement.integration_method
    ?? (engagement.purpose === "selection" ? "weighted_average" : "consensus");
  if (method !== "weighted_average") {
    return { allowed: false, reason: "This centre reaches its overall rating by assessor discussion." };
  }
  if (!engagement.weights_confirmed_at) {
    return {
      allowed: false,
      reason:
        "The competency weights for this engagement have not been confirmed. Confirm them on the engagement "
        + "before an overall rating is calculated.",
    };
  }
  return { allowed: true };
}

export function integrationMethodFor(engagement: {
  integration_method?: string | null;
  purpose?: string | null;
}): "weighted_average" | "consensus" {
  if (engagement.integration_method === "weighted_average") return "weighted_average";
  if (engagement.integration_method === "consensus") return "consensus";
  return engagement.purpose === "selection" ? "weighted_average" : "consensus";
}
