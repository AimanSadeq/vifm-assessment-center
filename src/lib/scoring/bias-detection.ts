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

    // Halo effect: proportion of ratings that are the same
    const modeCount = Math.max(
      ...Array.from({ length: 5 }, (_, i) =>
        ratings.filter((r) => r === i + 1).length
      )
    );
    const haloEffect = n > 0 ? modeCount / n : 0;

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
