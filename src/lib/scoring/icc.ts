/**
 * Intraclass Correlation Coefficient (ICC) calculation.
 * ICC(2,1) - Two-way random, single measures, absolute agreement.
 * Used to measure inter-rater reliability.
 * Target: >0.70 Year 1, >0.80 Year 3.
 */

type RatingMatrix = number[][]; // rows = subjects (candidates×competencies), cols = raters

export function calculateICC(matrix: RatingMatrix): number {
  const n = matrix.length; // number of subjects
  if (n < 2) return 0;

  const k = matrix[0].length; // number of raters
  if (k < 2) return 0;

  // Grand mean
  let grandSum = 0;
  let totalCount = 0;
  for (const row of matrix) {
    for (const val of row) {
      grandSum += val;
      totalCount++;
    }
  }
  const grandMean = grandSum / totalCount;

  // Subject means (row means)
  const subjectMeans = matrix.map(
    (row) => row.reduce((a, b) => a + b, 0) / row.length
  );

  // Rater means (column means)
  const raterMeans: number[] = [];
  for (let j = 0; j < k; j++) {
    let colSum = 0;
    for (let i = 0; i < n; i++) {
      colSum += matrix[i][j];
    }
    raterMeans.push(colSum / n);
  }

  // Between-subjects sum of squares (MSR)
  let SSR = 0;
  for (let i = 0; i < n; i++) {
    SSR += k * (subjectMeans[i] - grandMean) ** 2;
  }
  const MSR = SSR / (n - 1);

  // Between-raters sum of squares (MSC)
  let SSC = 0;
  for (let j = 0; j < k; j++) {
    SSC += n * (raterMeans[j] - grandMean) ** 2;
  }
  const MSC = SSC / (k - 1);

  // Residual sum of squares (MSE)
  let SSE = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      SSE +=
        (matrix[i][j] - subjectMeans[i] - raterMeans[j] + grandMean) ** 2;
    }
  }
  const MSE = SSE / ((n - 1) * (k - 1));

  // ICC(2,1) formula
  const numerator = MSR - MSE;
  const denominator =
    MSR + (k - 1) * MSE + (k / n) * (MSC - MSE);

  if (denominator === 0) return 0;

  return Math.max(0, Math.min(1, numerator / denominator));
}

/**
 * Build a COMPLETE-CASE inter-rater matrix from a map of subject -> (rater -> score),
 * choosing the rater PAIR that co-rated the most subjects. Returns rows of
 * [scoreA, scoreB] for the subjects both rated - NO missing-cell imputation - or
 * null if no pair co-rated at least 2 subjects.
 *
 * This replaces the old "impute every missing cell with the subject mean" hack,
 * which manufactured agreement (an imputed cell == the subject mean contributes
 * near-perfect agreement) and inflated the ICC. ICC(2,1) assumes a fully-crossed
 * design; in an assessment centre only a subset of assessors co-rate any given
 * candidate/competency, so the honest input is the largest genuinely-crossed
 * (complete-case) block, which for AC data is almost always a rater pair.
 */
export function bestPairMatrix(
  subjectRaters: Map<string, Map<string, number>>,
): number[][] | null {
  const raters = new Set<string>();
  for (const m of Array.from(subjectRaters.values())) {
    for (const r of Array.from(m.keys())) raters.add(r);
  }
  const raterList = Array.from(raters);
  let best: number[][] | null = null;
  for (let i = 0; i < raterList.length; i++) {
    for (let j = i + 1; j < raterList.length; j++) {
      const a = raterList[i];
      const b = raterList[j];
      const rows: number[][] = [];
      for (const m of Array.from(subjectRaters.values())) {
        const va = m.get(a);
        const vb = m.get(b);
        if (va !== undefined && vb !== undefined) rows.push([va, vb]);
      }
      if (rows.length >= 2 && (!best || rows.length > best.length)) best = rows;
    }
  }
  return best;
}

/**
 * Combine several per-engagement complete-case matrices into one headline ICC,
 * weighting each engagement's ICC by its subject count. Returns null when no
 * matrix is valid (>= 2 subjects and >= 2 raters) - the dashboard then honestly
 * shows "insufficient data" rather than a fabricated number.
 */
export function pooledICC(matrices: number[][][]): number | null {
  const valid = matrices.filter((m) => m.length >= 2 && (m[0]?.length ?? 0) >= 2);
  if (valid.length === 0) return null;
  let weightedSum = 0;
  let weight = 0;
  for (const m of valid) {
    weightedSum += calculateICC(m) * m.length;
    weight += m.length;
  }
  return weight > 0 ? weightedSum / weight : null;
}

export function getICCInterpretation(icc: number): {
  label: string;
  color: string;
} {
  if (icc >= 0.9) return { label: "Excellent", color: "text-green-700" };
  if (icc >= 0.8) return { label: "Good", color: "text-green-600" };
  if (icc >= 0.7) return { label: "Acceptable", color: "text-yellow-600" };
  if (icc >= 0.5) return { label: "Moderate", color: "text-orange-600" };
  return { label: "Poor", color: "text-red-600" };
}
