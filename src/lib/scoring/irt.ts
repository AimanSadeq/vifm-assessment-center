/**
 * Rasch (1PL) IRT helpers for VIFM Fluent's item bank (Phase 3 groundwork).
 *
 * Rasch model: P(correct | θ, b) = 1 / (1 + exp(-(θ − b)))
 *   θ = person ability, b = item difficulty (both on the logit scale).
 *
 * - raschDifficultyFromPValue(): closed-form difficulty from an item's
 *   proportion-correct (anchored at mean ability θ=0). A fuller JML/MML joint
 *   calibration can replace this once response volume justifies it; the
 *   p-value estimate is the standard, defensible starting point.
 * - estimateThetaRasch(): grid MLE of a taker's ability from responses to
 *   items with known difficulties.
 * - selectNextItem()/itemInformation()/thetaStandardError(): maximum-
 *   information adaptive selection - ready for a future CAT flow, dark until
 *   items are calibrated to status='live'.
 *
 * Pure + dependency-free, so it's unit-testable without a DB or model.
 */

export type CalibratedItem = { id: string; irt_b: number };

const clampP = (p: number): number => Math.min(0.99, Math.max(0.01, p));
const prob = (theta: number, b: number): number => 1 / (1 + Math.exp(-(theta - b)));

/**
 * Difficulty (logit) from proportion-correct, anchored at θ=0:
 *   p = 1/(1+exp(b))  ⇒  b = ln((1−p)/p)
 * Higher b = harder. SE from the binomial information at p.
 */
export function raschDifficultyFromPValue(correct: number, total: number): { b: number; se: number } {
  if (total <= 0) return { b: 0, se: Infinity };
  const p = clampP(correct / total);
  const b = Math.log((1 - p) / p);
  const se = 1 / Math.sqrt(total * p * (1 - p)); // SE of the logit
  return { b: Math.round(b * 1000) / 1000, se: Math.round(se * 1000) / 1000 };
}

/** Fisher information of a Rasch item at ability θ: I = P·(1−P). */
export function itemInformation(theta: number, b: number): number {
  const pp = prob(theta, b);
  return pp * (1 - pp);
}

/**
 * Grid MLE ability estimate over θ ∈ [−4, 4] (0.1 step).
 * responses: each administered item's difficulty + whether the taker got it right.
 */
export function estimateThetaRasch(responses: Array<{ b: number; correct: boolean }>): number {
  if (responses.length === 0) return 0;
  const logLik = (theta: number): number =>
    responses.reduce((sum, r) => {
      const pp = clampP(prob(theta, r.b));
      return sum + (r.correct ? Math.log(pp) : Math.log(1 - pp));
    }, 0);
  let best = 0;
  let bestLL = -Infinity;
  for (let t = -4; t <= 4.0001; t += 0.1) {
    const ll = logLik(t);
    if (ll > bestLL) {
      bestLL = ll;
      best = t;
    }
  }
  return Math.round(best * 100) / 100;
}

/** Pick the unadministered calibrated item with maximum information at θ. */
export function selectNextItem(
  theta: number,
  administeredIds: Set<string>,
  bank: CalibratedItem[]
): CalibratedItem | null {
  let best: CalibratedItem | null = null;
  let bestInfo = -Infinity;
  for (const it of bank) {
    if (administeredIds.has(it.id)) continue;
    const info = itemInformation(theta, it.irt_b);
    if (info > bestInfo) {
      bestInfo = info;
      best = it;
    }
  }
  return best;
}

/** Standard error of the θ estimate = 1/sqrt(total information administered). */
export function thetaStandardError(theta: number, administeredBs: number[]): number {
  const info = administeredBs.reduce((sum, b) => sum + itemInformation(theta, b), 0);
  return info > 0 ? 1 / Math.sqrt(info) : Infinity;
}
