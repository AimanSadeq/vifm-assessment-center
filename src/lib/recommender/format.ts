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
