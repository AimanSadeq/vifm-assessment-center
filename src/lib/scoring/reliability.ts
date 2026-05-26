import { CEFR_ORDER, type CefrLevel, type FluentResult } from "@/lib/ai/fluent-english";

/**
 * Reliability + confidence band for a VIFM Fluent result.
 *
 * A single CEFR level reads as point-certain, but the estimate carries real
 * uncertainty - especially from a short receptive section (research wants
 * ~40 items; Fluent currently has ~10) and from disagreement across the four
 * skills. We surface an indicative RANGE (e.g. "B1–B2") plus an underpowered
 * flag rather than implying false precision. A proper item bank + IRT
 * (Phase 3) would replace the small-sample term with a true standard error.
 */

const toNum = (c: CefrLevel): number => CEFR_ORDER.indexOf(c) + 1;
const toCefr = (n: number): CefrLevel => CEFR_ORDER[Math.min(5, Math.max(0, Math.round(n) - 1))];

const TARGET_RECEPTIVE_ITEMS = 40; // psychometric rule-of-thumb for a stable fixed-form section

export type ReceptiveSem = {
  n: number;
  correct: number;
  accuracy: number;
  sem: number; // standard error of the accuracy proportion
  underpowered: boolean;
};

/** Binomial standard error of a receptive section's accuracy + an under-powered flag. */
export function receptiveSem(correct: number, total: number): ReceptiveSem {
  const accuracy = total > 0 ? correct / total : 0;
  const sem = total > 0 ? Math.sqrt((accuracy * (1 - accuracy)) / total) : 0;
  return { n: total, correct, accuracy, sem, underpowered: total > 0 && total < TARGET_RECEPTIVE_ITEMS };
}

export type ConfidenceBand = {
  overall: CefrLevel;
  low: CefrLevel;
  high: CefrLevel;
  halfWidth: number; // in CEFR-level units
  underpowered: boolean; // < 40 receptive items
  receptiveItems: number;
};

/**
 * Indicative ± band on the overall CEFR, combining cross-skill disagreement
 * (weighted SD of the per-skill levels, using the same weights as the blend)
 * with a small-sample inflation term that shrinks as the receptive section
 * approaches ~40 items.
 */
export function overallConfidenceBand(result: FluentResult): ConfidenceBand {
  const parts: Array<{ num: number; weight: number }> = [];
  if (result.reading_total > 0) parts.push({ num: toNum(result.reading_cefr), weight: 1 });
  if (result.listening_total > 0) parts.push({ num: toNum(result.listening_cefr), weight: 1 });
  parts.push({ num: toNum(result.writing.cefr), weight: 1.2 });
  if (result.speaking.attempted) parts.push({ num: toNum(result.speaking.cefr), weight: 1.2 });

  const wSum = parts.reduce((a, p) => a + p.weight, 0);
  const mean = wSum > 0 ? parts.reduce((a, p) => a + p.num * p.weight, 0) / wSum : 1;
  const variance =
    wSum > 0 ? parts.reduce((a, p) => a + p.weight * (p.num - mean) * (p.num - mean), 0) / wSum : 0;
  const sd = Math.sqrt(variance);

  const receptiveItems = result.reading_total + result.listening_total;
  const sampleInflation =
    receptiveItems > 0 ? Math.min(0.4, 0.4 * (1 - receptiveItems / TARGET_RECEPTIVE_ITEMS)) : 0.4;
  // Capped at ±1.5 levels so even an uneven short test stays interpretable
  // (≈3-level span worst case) rather than spanning the whole scale.
  const halfWidth = Math.min(1.5, Math.max(0.5, 0.4 + 0.5 * sd + sampleInflation));

  return {
    overall: result.overall_cefr,
    low: toCefr(mean - halfWidth),
    high: toCefr(mean + halfWidth),
    halfWidth: Math.round(halfWidth * 10) / 10,
    underpowered: receptiveItems > 0 && receptiveItems < TARGET_RECEPTIVE_ITEMS,
    receptiveItems,
  };
}

/** "B1" if the band collapses to one level, else "B1–B2". */
export function formatBand(band: ConfidenceBand): string {
  return band.low === band.high ? band.low : `${band.low}–${band.high}`;
}
