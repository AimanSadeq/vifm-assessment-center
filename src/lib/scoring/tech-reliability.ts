import { proficiencyFromPercent } from "@/lib/competencies/technical-framework";

/**
 * Reliability + confidence band for a technical assessment result.
 *
 * A single 1–5 proficiency level reads as point-certain, but a short MCQ test
 * carries real uncertainty - from few items (binomial standard error) and from
 * disagreement ACROSS the in-scope skills. We surface an indicative RANGE
 * (e.g. "Working–Proficient") + an underpowered flag rather than implying false
 * precision. This is classical (works on every run, calibrated or not); a fully
 * adaptive IRT run (tech-cat.ts) yields a tighter true standard error.
 */

// A fixed-form function test (~24 items) is the rule-of-thumb for a stable band;
// the 8-item domain screeners read as under-powered against it.
const TARGET_ITEMS = 24;

export type TechBand = {
  levelLow: number;
  levelHigh: number;
  labelLow: string;
  labelHigh: string;
  pctLow: number;
  pctHigh: number;
  halfWidthPct: number; // ± in percentage points
  underpowered: boolean;
};

/**
 * Indicative ± band on the overall score, combining the binomial SE of the
 * proportion-correct with cross-skill disagreement (item-count-weighted SD of
 * per-skill accuracy) and a small-sample inflation term that shrinks toward
 * zero as the test approaches ~24 items. Mapped back onto the 1–5 scale via the
 * same proficiencyFromPercent cut-points as the point estimate, so the band
 * always brackets the reported level.
 */
export function technicalConfidenceBand(input: {
  correct: number;
  total: number;
  perSkill: { correct: number; total: number }[];
}): TechBand {
  const n = Math.max(1, input.total);
  const p = Math.min(1, Math.max(0, input.correct / n));
  const binomSem = Math.sqrt((p * (1 - p)) / n); // SE of the proportion

  // Cross-skill disagreement: item-count-weighted SD of per-skill accuracy.
  const parts = input.perSkill.filter((s) => s.total > 0).map((s) => ({ p: s.correct / s.total, w: s.total }));
  const wSum = parts.reduce((a, s) => a + s.w, 0) || 1;
  const meanP = parts.reduce((a, s) => a + s.p * s.w, 0) / wSum;
  const varP = parts.reduce((a, s) => a + s.w * (s.p - meanP) * (s.p - meanP), 0) / wSum;
  const skillSd = Math.sqrt(varP);

  // Shrinks to 0 as n → TARGET_ITEMS; full weight on a tiny test.
  const sampleInflation = 0.08 * (1 - Math.min(1, n / TARGET_ITEMS));

  // ~95% half-width on the proportion, capped so even a short uneven test stays
  // interpretable (≤ ±25 pts) rather than spanning the whole scale.
  const halfWidth = Math.min(0.25, 1.4 * binomSem + 0.35 * skillSd + sampleInflation);

  const pctLow = Math.max(0, Math.round((p - halfWidth) * 100));
  const pctHigh = Math.min(100, Math.round((p + halfWidth) * 100));
  const low = proficiencyFromPercent(pctLow);
  const high = proficiencyFromPercent(pctHigh);

  return {
    levelLow: low.level,
    levelHigh: high.level,
    labelLow: low.label,
    labelHigh: high.label,
    pctLow,
    pctHigh,
    halfWidthPct: Math.round(halfWidth * 100),
    underpowered: n < TARGET_ITEMS,
  };
}
