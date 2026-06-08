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
 * Present a raw fit score as a 0–100% "match", relative to the strongest
 * match in the same list (the top course = 100%). Ranking is unchanged — this
 * is presentation only, so an open-ended weighted sum (e.g. 10.2) reads as an
 * interpretable percentage. Pass the list's top (maximum) raw score.
 *
 * Dependency-free, like formatFitScore, so it's safe in client components,
 * server components, and React-PDF / HTML report renderers alike.
 */
export const fitMatchPercent = (score: number, topScore: number): number =>
  topScore > 0 ? Math.max(0, Math.min(100, Math.round((score / topScore) * 100))) : 0;
