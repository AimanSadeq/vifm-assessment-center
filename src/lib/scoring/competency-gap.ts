/**
 * Competency gap-severity computation.
 *
 * Converts a numeric BARS score (1-5) and a target proficiency (default 3 =
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

/** Round to one decimal for display; whole numbers stay whole. */
function tidy(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Severity of a raw gap (target - score, unrounded). The bands sit on the
 * half-levels, so whole-number gaps land exactly where they always did
 * (3+ significant, 2 moderate, 1 minor, 0 on target, -1 strength, -2 or
 * lower significant strength). Targets can be half-levels (4.5, 2.5), and
 * rounding both sides first turned a half-level shortfall into "1 level".
 */
export function gapSeverity(rawGap: number): GapSeverity {
  if (rawGap >= 2.5) return "significant_gap";
  if (rawGap >= 1.5) return "moderate_gap";
  if (rawGap >= 0.5) return "minor_gap";
  if (rawGap > -0.5) return "on_target";
  if (rawGap > -1.5) return "strength";
  return "significant_strength";
}

/** "1 level", "2 levels", "0.5 level", "1.5 levels". */
export function formatGapLevels(gap: number): string {
  const g = tidy(gap);
  return `${g} ${g > 1 ? "levels" : "level"}`;
}

export function getCompetencyGap(
  score: number | null | undefined,
  target: number = DEFAULT_TARGET
): GapBadgeData | null {
  if (score == null || !Number.isFinite(score)) return null;
  const t = tidy(target);
  const s = tidy(score);
  const gap = tidy(t - s);
  const severity = gapSeverity(gap);
  const label =
    severity === "significant_gap"
      ? `Significant Gap (${formatGapLevels(gap)})`
      : severity === "moderate_gap"
        ? `Moderate Gap (${formatGapLevels(gap)})`
        : severity === "minor_gap"
          ? `Minor Gap (${formatGapLevels(gap)})`
          : severity === "on_target"
            ? "On Target"
            : severity === "strength"
              ? "Strength"
              : "Significant Strength";
  return { severity, label, gap, score: s, target: t };
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
