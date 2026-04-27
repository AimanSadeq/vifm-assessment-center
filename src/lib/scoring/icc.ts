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
