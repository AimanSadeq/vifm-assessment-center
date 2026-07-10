// VIFM Psychometrics - scoring. Pure + dependency-free (server + client safe).
// Cognitive: % correct per subtest → indicative band + a g composite. Tier 1 is
// INDICATIVE - bands are based on raw scores, not local norms.

import {
  type PsyKind, type PsyBand,
  cognitiveBand, BAND_LABEL_EN, BAND_LABEL_AR,
} from "./framework";

// ── Item + test shapes ───────────────────────────────────────────
export type CognitiveItem = {
  id: string;
  scale: string;            // subtest key
  stem: string;
  options: string[];
  correct: number;          // index into options
  difficulty: "easy" | "medium" | "hard";
  /**
   * Per-administration option permutation (integrity pass): orig[i] = the
   * AUTHORED index of the option served at position i. Lets the response log
   * remap a chosen index back into the authored frame so bank items stay
   * analysable across shuffled sittings. Absent on unshuffled/legacy items;
   * never sent to the browser (stripAnswerKey drops it).
   */
  orig?: number[];
};
export type PsyTest =
  | { kind: "cognitive"; items: CognitiveItem[]; ai_generated: boolean; served_source?: "bank" | "ai" | "static" };

/** Client-facing test: answer keys (correct) stripped server-side. */
export type PsyTestPublic =
  | { kind: "cognitive"; items: { id: string; scale: string; stem: string; options: string[]; difficulty: string }[] };

export type ScaleScore = {
  key: string;
  raw: number;          // % correct
  normalized: number;   // 0–100
  band: PsyBand;
  bandLabel: string;
  sten?: number;        // norm-referenced (Tier 2)
  z?: number;           // Tier 2 - standard score vs the norm group
  percentile?: number;  // Tier 2 - percentile within the norm group
};

export type PsyResult = {
  kind: PsyKind;
  scales: ScaleScore[];
  overall?: { normalized: number; band: PsyBand; bandLabel: string; percentile?: number };
  answeredCount: number;
  totalCount: number;
  /** Tier 2 - set to "calibrated" once norm-referenced; absent/"indicative" otherwise. */
  tier?: "indicative" | "calibrated";
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** answers: itemId → selected option index (cognitive). */
export function computePsyResult(
  test: PsyTest,
  answers: Record<string, number>,
  lang: "en" | "ar" = "en"
): PsyResult {
  const label = (b: PsyBand) => (lang === "ar" ? BAND_LABEL_AR[b] : BAND_LABEL_EN[b]);

  const bySubtest = new Map<string, { correct: number; total: number }>();
  let answered = 0;
  for (const item of test.items) {
    const acc = bySubtest.get(item.scale) ?? { correct: 0, total: 0 };
    acc.total += 1;
    const a = answers[item.id];
    if (typeof a === "number") {
      answered += 1;
      if (a === item.correct) acc.correct += 1;
    }
    bySubtest.set(item.scale, acc);
  }
  const scales: ScaleScore[] = Array.from(bySubtest.entries()).map(([key, { correct, total }]) => {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const band = cognitiveBand(pct);
    return { key, raw: pct, normalized: pct, band, bandLabel: label(band) };
  });
  const g = scales.length ? Math.round(mean(scales.map((s) => s.normalized))) : 0;
  const gBand = cognitiveBand(g);
  return {
    kind: "cognitive",
    scales,
    overall: { normalized: g, band: gBand, bandLabel: label(gBand) },
    answeredCount: answered,
    totalCount: test.items.length,
  };
}
