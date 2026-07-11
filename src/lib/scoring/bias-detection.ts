/**
 * Assessor bias detection metrics.
 * Identifies patterns that may indicate rater errors.
 */

export type BiasMetric = {
  assessorName: string;
  assessorId: string;
  meanRating: number;
  standardDeviation: number;
  leniencyBias: number; // positive = lenient, negative = strict
  centralTendencyBias: number; // low SD = central tendency
  haloEffect: number; // high correlation between competencies
  ratingCount: number;
};

export function calculateBiasMetrics(
  assessorRatings: {
    assessorId: string;
    assessorName: string;
    ratings: number[];
    /**
     * Optional per-candidate rating vectors: each inner array is ONE candidate's
     * scores across the competencies this assessor rated. Required for a true
     * halo-effect measure (low within-candidate spread across competencies). When
     * absent, haloEffect is reported as 0 rather than the old modal-concentration
     * proxy, which merely duplicated centralTendencyBias and flagged the wrong
     * assessors.
     */
    ratingsByCandidate?: number[][];
  }[]
): BiasMetric[] {
  // Overall mean across all assessors
  const allRatings = assessorRatings.flatMap((a) => a.ratings);
  const overallMean =
    allRatings.length > 0
      ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
      : 3;

  // Overall SD
  const overallSD =
    allRatings.length > 1
      ? Math.sqrt(
          allRatings.reduce((sum, r) => sum + (r - overallMean) ** 2, 0) /
            (allRatings.length - 1)
        )
      : 1;

  return assessorRatings.map((assessor) => {
    const { ratings } = assessor;
    const n = ratings.length;

    if (n === 0) {
      return {
        assessorName: assessor.assessorName,
        assessorId: assessor.assessorId,
        meanRating: 0,
        standardDeviation: 0,
        leniencyBias: 0,
        centralTendencyBias: 0,
        haloEffect: 0,
        ratingCount: 0,
      };
    }

    const mean = ratings.reduce((a, b) => a + b, 0) / n;
    const sd =
      n > 1
        ? Math.sqrt(
            ratings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (n - 1)
          )
        : 0;

    // Leniency bias: how far above/below the overall mean
    const leniencyBias = mean - overallMean;

    // Central tendency: low SD compared to overall
    const centralTendencyBias =
      overallSD > 0 ? Math.max(0, 1 - sd / overallSD) : 0;

    // Halo effect: an assessor giving ONE candidate near-identical scores across
    // DIFFERENT competencies (the halo). Measured per candidate as within-candidate
    // agreement across competencies = 1 - (SD / max-SD-on-a-1..5-scale), averaged
    // over the assessor's candidates that have >= 2 competency scores. Requires the
    // per-candidate structure; without it (legacy callers) halo is 0, not the old
    // modal-concentration proxy that merely re-measured central tendency.
    const perCandidate = (assessor.ratingsByCandidate ?? []).filter((v) => v.length >= 2);
    let haloEffect = 0;
    if (perCandidate.length > 0) {
      // POPULATION SD (divide by v.length) so the spread is bounded in [0, 2] on
      // the 1-5 BARS scale - the population SD of the max-spread set {1,5} is
      // exactly 2. (The sample SD, /(n-1), would exceed 2 and clamp the whole
      // disagreement end of the scale to 0.) 1 - sd/2 is then a clean [0,1]
      // within-candidate agreement across competencies.
      const MAX_SD = 2;
      const agreements = perCandidate.map((v) => {
        const m = v.reduce((a, b) => a + b, 0) / v.length;
        const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
        return Math.max(0, 1 - sd / MAX_SD);
      });
      haloEffect = agreements.reduce((a, b) => a + b, 0) / agreements.length;
    }

    return {
      assessorName: assessor.assessorName,
      assessorId: assessor.assessorId,
      meanRating: Math.round(mean * 100) / 100,
      standardDeviation: Math.round(sd * 100) / 100,
      leniencyBias: Math.round(leniencyBias * 100) / 100,
      centralTendencyBias: Math.round(centralTendencyBias * 100) / 100,
      haloEffect: Math.round(haloEffect * 100) / 100,
      ratingCount: n,
    };
  });
}
