// VIFM Psychometrics - scoring. Pure + dependency-free (server + client safe).
// Cognitive: % correct per subtest → indicative band + a g composite.
// Personality: 1–5 Likert mean per trait (reverse-scored) → band + sten, with
// lightweight validity flags (social desirability + inconsistency). Tier 1 is
// INDICATIVE - bands are based on raw scores, not local norms.

import {
  type PsyKind, type PsyBand,
  cognitiveBand, traitBand, stenFromMean, BAND_LABEL_EN, BAND_LABEL_AR,
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
export type PersonalityItem = {
  id: string;
  scale: "O" | "C" | "E" | "A" | "S";
  text: string;
  reverse: boolean;
};

export type PsyTest =
  | { kind: "cognitive"; items: CognitiveItem[]; ai_generated: boolean }
  | { kind: "personality"; items: PersonalityItem[] };

/** Client-facing test: answer keys (correct / reverse) stripped server-side. */
export type PsyTestPublic =
  | { kind: "cognitive"; items: { id: string; scale: string; stem: string; options: string[]; difficulty: string }[] }
  | { kind: "personality"; items: { id: string; scale: string; text: string }[]; anchors: string[] };

export type ScaleScore = {
  key: string;
  raw: number;          // cognitive: % correct; personality: 1–5 mean
  normalized: number;   // 0–100
  band: PsyBand;
  bandLabel: string;
  sten?: number;        // personality (Tier 1) / norm-referenced (Tier 2)
  z?: number;           // Tier 2 - standard score vs the norm group
  percentile?: number;  // Tier 2 - percentile within the norm group
};

export type PsyValidity = { socialDesirability: number; inconsistency: number; flag: boolean };

export type PsyResult = {
  kind: PsyKind;
  scales: ScaleScore[];
  overall?: { normalized: number; band: PsyBand; bandLabel: string; percentile?: number };
  validity?: PsyValidity;
  answeredCount: number;
  totalCount: number;
  /** Tier 2 - set to "calibrated" once norm-referenced; absent/"indicative" otherwise. */
  tier?: "indicative" | "calibrated";
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** answers: itemId → selected option index (cognitive) or 1–5 Likert value (personality). */
export function computePsyResult(
  test: PsyTest,
  answers: Record<string, number>,
  lang: "en" | "ar" = "en"
): PsyResult {
  const label = (b: PsyBand) => (lang === "ar" ? BAND_LABEL_AR[b] : BAND_LABEL_EN[b]);

  if (test.kind === "cognitive") {
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

  // personality
  const byTrait = new Map<string, number[]>();
  const allScores: number[] = [];
  let answered = 0;
  for (const item of test.items) {
    const raw = answers[item.id];
    if (typeof raw !== "number") continue;
    answered += 1;
    const score = item.reverse ? 6 - raw : raw; // 1–5, keyed so high = more of the trait
    const arr = byTrait.get(item.scale) ?? [];
    arr.push(score);
    byTrait.set(item.scale, arr);
    allScores.push(score);
  }
  const scales: ScaleScore[] = Array.from(byTrait.entries()).map(([key, scores]) => {
    const m = mean(scores);
    const band = traitBand(m);
    return {
      key,
      raw: Math.round(m * 100) / 100,
      normalized: Math.round(((m - 1) / 4) * 100),
      band,
      bandLabel: label(band),
      sten: stenFromMean(m),
    };
  });

  // Validity (indicative): social desirability = how uniformly high across traits;
  // inconsistency = mean within-trait spread (high spread ⇒ careless/contradictory).
  const traitMeans = scales.map((s) => (s.raw));
  const socialDesirability = traitMeans.length ? Math.round(mean(traitMeans) * 100) / 100 : 0;
  const inconsistency = Math.round(mean(Array.from(byTrait.values()).map((arr) => stdev(arr))) * 100) / 100;
  const flag = socialDesirability >= 4.5 || inconsistency >= 1.6;

  return {
    kind: "personality",
    scales,
    validity: { socialDesirability, inconsistency, flag },
    answeredCount: answered,
    totalCount: test.items.length,
  };
}
