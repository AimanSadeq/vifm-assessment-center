/**
 * Quadratic Weighted Kappa (QWK) - the field-standard metric for agreement
 * between an automated scorer and human raters in automated essay/speech
 * scoring. QWK ≥ 0.70 is the conventional "acceptable" threshold.
 *
 * QWK = 1 − Σ(w·O) / Σ(w·E), where for an N-category ordinal scale:
 *   w[i,j] = (i−j)² / (N−1)²              (quadratic disagreement weight)
 *   O      = observed confusion matrix     (counts of rater-A × rater-B)
 *   E      = expected matrix from marginals (histA[i]·histB[j] / n)
 *
 * Range: 1 = perfect agreement, 0 = chance, <0 = worse than chance.
 * Dependency-free + pure, so it's unit-testable and reusable.
 */

export const QWK_ACCEPTABLE = 0.7;

/**
 * @param a   rater-A scores as 1-based ordinal ranks (e.g. CEFR A1=1 … C2=6)
 * @param b   rater-B scores, same length + scale
 * @param categories number of ordinal categories (default 6 for CEFR)
 * Returns NaN if inputs are empty or mismatched.
 */
export function quadraticWeightedKappa(a: number[], b: number[], categories = 6): number {
  if (a.length === 0 || a.length !== b.length) return NaN;
  const N = Math.max(2, categories);
  const idx = (x: number) => Math.min(N - 1, Math.max(0, Math.round(x) - 1)); // 1..N → 0..N-1

  const O: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const histA = new Array(N).fill(0);
  const histB = new Array(N).fill(0);
  const n = a.length;
  for (let k = 0; k < n; k++) {
    const i = idx(a[k]);
    const j = idx(b[k]);
    O[i][j] += 1;
    histA[i] += 1;
    histB[j] += 1;
  }

  let num = 0;
  let den = 0;
  const denom = (N - 1) * (N - 1);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const w = ((i - j) * (i - j)) / denom;
      const e = (histA[i] * histB[j]) / n;
      num += w * O[i][j];
      den += w * e;
    }
  }
  // den === 0 means no expected disagreement (e.g. all scores identical) →
  // there is nothing to disagree about; treat as perfect agreement.
  if (den === 0) return 1;
  return 1 - num / den;
}

/** Build an N×N confusion matrix (rows = rater A, cols = rater B), 1-based ranks. */
export function confusionMatrix(a: number[], b: number[], categories = 6): number[][] {
  const N = Math.max(2, categories);
  const idx = (x: number) => Math.min(N - 1, Math.max(0, Math.round(x) - 1));
  const M: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let k = 0; k < Math.min(a.length, b.length); k++) M[idx(a[k])][idx(b[k])] += 1;
  return M;
}
