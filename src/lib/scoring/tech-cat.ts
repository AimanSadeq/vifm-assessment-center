/**
 * Adaptive (CAT) layer for the technical item bank (Phase-3 #2).
 *
 * Thin, PURE wrapper over the generic Rasch engine in ./irt.ts (reused verbatim
 * from Fluent): it adds the technical-specific pieces - seeding a difficulty
 * from the easy/medium/hard label, mapping a θ estimate onto the 1–5
 * proficiency scale with a confidence band, and a maximum-information adaptive
 * SIMULATION used to prove the flow converges with fewer items than a fixed
 * form. No DB import, so it stays unit-testable + node-runnable; the DB-side
 * calibration writer lives in technical-function-bank.ts.
 */
import {
  raschDifficultyFromPValue,
  selectNextItem,
  estimateThetaRasch,
  thetaStandardError,
  type CalibratedItem,
} from "./irt";
import { proficiencyFromPercent, type TechProficiency } from "@/lib/competencies/technical-framework";

/** Logit prior for an uncalibrated item, from its authored difficulty band. */
export const DIFFICULTY_PRIOR: Record<"easy" | "medium" | "hard", number> = {
  easy: -1.0,
  medium: 0.0,
  hard: 1.0,
};

/** Min administrations before the data-driven p-value estimate beats the prior. */
export const MIN_ADMIN_FOR_PVALUE = 15;

export function seedDifficulty(difficulty: "easy" | "medium" | "hard"): number {
  return DIFFICULTY_PRIOR[difficulty] ?? 0;
}

/**
 * The (irt_b, irt_se) to persist for an item: estimated from its proportion-
 * correct once it has enough administrations, else seeded from the difficulty
 * prior (se null = "prior, not yet data-calibrated").
 */
export function calibrateItemFields(input: {
  difficulty: "easy" | "medium" | "hard";
  timesAdministered: number;
  timesCorrect: number;
}): { irt_b: number; irt_se: number | null } {
  if (input.timesAdministered >= MIN_ADMIN_FOR_PVALUE) {
    const { b, se } = raschDifficultyFromPValue(input.timesCorrect, input.timesAdministered);
    return { irt_b: b, irt_se: se };
  }
  return { irt_b: seedDifficulty(input.difficulty), irt_se: null };
}

/** θ (logit) → 0–100 normalized: θ=0→50, ±4 → 0/100 (12.5 pts per logit). */
export function thetaToNormalized(theta: number): number {
  return Math.round(Math.min(100, Math.max(0, 50 + 12.5 * theta)));
}

export type TechAbility = TechProficiency & { lowLevel: number; highLevel: number; se: number };

/** Map a θ estimate + its standard error onto the 1–5 band (point + ±1.96·SE). */
export function thetaToProficiency(theta: number, se = 0): TechAbility {
  const point = proficiencyFromPercent(thetaToNormalized(theta));
  const lo = proficiencyFromPercent(thetaToNormalized(theta - 1.96 * se));
  const hi = proficiencyFromPercent(thetaToNormalized(theta + 1.96 * se));
  return { ...point, lowLevel: lo.level, highLevel: hi.level, se: Math.round(se * 1000) / 1000 };
}

export type AdaptiveStep = { b: number; correct: boolean; theta: number; se: number };
export type AdaptiveSim = {
  itemsUsed: number;
  theta: number;
  se: number;
  converged: boolean;
  trail: AdaptiveStep[];
};

/**
 * Simulate a maximum-information CAT against a calibrated bank for a taker of
 * known true ability. Picks the most informative unused item at the running θ,
 * simulates a Rasch response, re-estimates θ, and stops once the standard error
 * drops to `targetSe` (or the bank/maxItems is exhausted). Proves the adaptive
 * flow converges with fewer items than answering the whole bank.
 */
export function simulateAdaptive(
  bank: CalibratedItem[],
  trueTheta: number,
  opts: { targetSe?: number; maxItems?: number; minItems?: number; rng?: () => number } = {}
): AdaptiveSim {
  const targetSe = opts.targetSe ?? 0.4;
  const maxItems = Math.min(opts.maxItems ?? bank.length, bank.length);
  const minItems = opts.minItems ?? 4;
  const rng = opts.rng ?? Math.random;

  const used = new Set<string>();
  const responses: Array<{ b: number; correct: boolean }> = [];
  const trail: AdaptiveStep[] = [];
  let theta = 0;

  while (used.size < maxItems) {
    const next = selectNextItem(theta, used, bank);
    if (!next) break;
    used.add(next.id);
    const pCorrect = 1 / (1 + Math.exp(-(trueTheta - next.irt_b)));
    const correct = rng() < pCorrect;
    responses.push({ b: next.irt_b, correct });
    theta = estimateThetaRasch(responses);
    const se = thetaStandardError(theta, responses.map((r) => r.b));
    trail.push({ b: next.irt_b, correct, theta, se });
    if (used.size >= minItems && se <= targetSe) {
      return { itemsUsed: used.size, theta, se, converged: true, trail };
    }
  }
  const se = thetaStandardError(theta, responses.map((r) => r.b));
  return { itemsUsed: used.size, theta, se, converged: se <= targetSe, trail };
}
