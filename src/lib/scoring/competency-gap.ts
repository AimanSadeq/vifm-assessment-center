/**
 * Competency gap-severity computation.
 *
 * Converts a numeric BARS score (1–5) and a target proficiency (default 3 =
 * Competent) into a labelled severity badge for at-a-glance reading in
 * reports, client dashboards, and the wash-up view.
 *
 * Default target is 3. Senior-role engagements can pass target=4 or 5 to
 * raise the bar - gap = target - score, so a higher target produces more
 * "Gap" badges and fewer "Strength" badges.
 */

export type GapSeverity =
  | "significant_gap"
  | "moderate_gap"
  | "minor_gap"
  | "on_target"
  | "strength"
  | "significant_strength";

export type GapBadgeData = {
  severity: GapSeverity;
  label: string;
  gap: number;
  score: number;
  target: number;
};

export const DEFAULT_TARGET = 3;

export function getCompetencyGap(
  score: number | null | undefined,
  target: number = DEFAULT_TARGET
): GapBadgeData | null {
  if (score == null || !Number.isFinite(score)) return null;
  const t = Math.round(target);
  const s = Math.round(score);
  const gap = t - s;

  if (gap >= 3) return { severity: "significant_gap", label: `Significant Gap (${gap} levels)`, gap, score: s, target: t };
  if (gap === 2) return { severity: "moderate_gap", label: "Moderate Gap (2 levels)", gap, score: s, target: t };
  if (gap === 1) return { severity: "minor_gap", label: "Minor Gap (1 level)", gap, score: s, target: t };
  if (gap === 0) return { severity: "on_target", label: "On Target", gap, score: s, target: t };
  if (gap === -1) return { severity: "strength", label: "Strength", gap, score: s, target: t };
  return { severity: "significant_strength", label: "Significant Strength", gap, score: s, target: t };
}

type Tone = { bg: string; fg: string; border: string };

export const GAP_TONES: Record<GapSeverity, Tone> = {
  significant_gap:      { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
  moderate_gap:         { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa" },
  minor_gap:            { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" },
  on_target:            { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
  strength:             { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  significant_strength: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d" },
};
