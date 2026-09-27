/**
 * Visual encodings for the ARC organisational report, declared once.
 *
 * Every colour a heatmap cell, matrix quadrant, roadmap bar, status chip,
 * delta arrow or use-case tag uses comes from here, and the legend that
 * explains them reads the same values - so the key can never say one thing
 * while the chart shows another.
 *
 * The score vocabulary is deliberately NOT here. Maturity levels, overall
 * bands and the AI Ready benchmark live in @/lib/constants/ara-pillars and
 * @/lib/ara/dashboard-tree; the visuals and the legend both read them there.
 */

/** Heatmap cell tints per maturity level: `base` for a minority share of the
 *  cohort, `strong` for a majority. Keyed by level number 1-5. */
export const HEATMAP_LEVEL_TINT: Record<number, { base: string; strong: string }> = {
  1: { base: "#fdeef0", strong: "#FB7185" },
  2: { base: "#fef2e7", strong: "#FDBA74" },
  3: { base: "#fef8e7", strong: "#FBBF24" },
  4: { base: "#eaf7f0", strong: "#34D399" },
  5: { base: "#e6f6ee", strong: "#12805c" },
};

/** Share-of-cohort thresholds that pick a heatmap cell's shading. Three steps
 *  keep it legible in print; no alpha gradients. */
export const HEATMAP_SHARE_STEPS = { strong: 0.4, tint: 0.15 } as const;

/** Investment matrix quadrant fills (pastel) and the ink used for their labels. */
export const MATRIX_QUADRANT_FILL = {
  quickWins: "#ccfbf1",
  strategicBets: "#fef3c7",
  fillIns: "#f3f4f6",
  reconsider: "#ffe4e6",
} as const;
export const MATRIX_QUADRANT_INK = {
  quickWins: "#115e59",
  strategicBets: "#92400e",
  fillIns: "#4b5563",
  reconsider: "#9f1239",
} as const;

/** Roadmap horizons: the months each covers and its bar colour. */
export const GANTT_HORIZONS = {
  quick: { start: 1, end: 3, color: "#00b4ff", labelColor: "#075985" },
  build: { start: 4, end: 9, color: "#5391D5", labelColor: "#1e3a8a" },
  transform: { start: 10, end: 12, color: "#010131", labelColor: "white" },
} as const;

/** Compliance status colours: met / partial / action required / not evaluated. */
export const COMPLIANCE_STATUS_COLORS = {
  emerald: "#34D399",
  amber: "#FBBF24",
  rose: "#FB7185",
  muteGrey: "#9ca3af",
} as const;

/** Year-on-year and benchmark deltas. */
export const DELTA_COLORS = { up: "#34D399", down: "#FB7185", flat: "#6b7280" } as const;

/** AI use-case portfolio: lifecycle stage and risk rating. */
export const USE_CASE_STAGE_COLORS = {
  ideation: "#9ca3af",
  piloting: "#FDBA74",
  production: "#34D399",
  retired: "#6b7280",
} as const;
export const USE_CASE_RISK_COLORS = {
  low: "#34D399",
  medium: "#FBBF24",
  high: "#FDBA74",
  critical: "#FB7185",
} as const;
