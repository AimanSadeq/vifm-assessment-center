/**
 * Format a recommender fit score / gap for display: at most one decimal
 * place, with no trailing ".0" on whole numbers. AC/ARA gaps are integers
 * (shown clean), while Reflect gaps come from fractional means - this caps
 * them so the UI never shows 7.40000001.
 *
 * Dependency-free so it's safe to import from client components, server
 * components, and React-PDF documents alike.
 */
export const formatFitScore = (n: number): string => (Math.round(n * 10) / 10).toString();

/**
 * Present a raw fit score on a 0–10 scale (one decimal), relative to the
 * strongest match in the same list (the top course = 10.0). Ranking is
 * unchanged - this is presentation only, so an open-ended weighted sum
 * (e.g. 10.2) reads as a clean score out of 10 (e.g. 9.2, 5.7). Returns a
 * string with no trailing ".0" (so the top match reads "10", not "10.0").
 * Pass the list's top (maximum) raw score.
 *
 * Dependency-free, like formatFitScore, so it's safe in client components,
 * server components, and React-PDF / HTML report renderers alike.
 */
export const fitScoreOutOfTen = (score: number, topScore: number): string =>
  topScore > 0 ? formatFitScore((score / topScore) * 10) : "0";
