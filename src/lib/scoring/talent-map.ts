/**
 * Talent-map scoring helpers - the reusable domain logic behind the
 * engagement Talent Map (9-box grid, succession readiness, skills heatmap).
 *
 * The 9-box plots each candidate on two axes derived from the VIFM
 * four-domain framework:
 *
 *   Performance (x) = how they deliver + work with others
 *                   = mean of RESULTS + PEOPLE competency scores
 *   Potential   (y) = capacity to grow + think strategically
 *                   = mean of THINKING + SELF competency scores
 *
 * Both use the 1-5 BARS consensus scale. Splitting the four domains this
 * way keeps the axes explainable and grounded in scored evidence rather
 * than a separate, unmeasured "potential" rating. When a candidate has no
 * scored competency in an axis's domains, the caller falls back to their
 * overall consensus mean so they still place on the grid.
 *
 * Pure + dependency-free so it can be unit-tested and reused by a PDF or
 * client-facing surface later.
 */

export type TalentBand = "low" | "med" | "high";

/** VIFM domain names (competency_domains.name), as seeded. */
export const PERFORMANCE_DOMAINS = ["RESULTS", "PEOPLE"] as const;
export const POTENTIAL_DOMAINS = ["THINKING", "SELF"] as const;

/**
 * Band a 1-5 BARS score. The mid band centres on "Competent" (3); below
 * 2.5 trends toward "Development Needed", 3.5+ toward "Strength".
 */
export function scoreBand(score: number): TalentBand {
  if (score < 2.5) return "low";
  if (score < 3.5) return "med";
  return "high";
}

export type NineBoxCell = {
  /** Established talent-management name for this quadrant. */
  label: string;
  /** Short coaching action for the cell. */
  action: string;
  /** Tone token consumed by the page for cell colour. */
  tone: "emerald" | "sky" | "slate" | "amber" | "rose";
};

/**
 * 9-box lookup keyed [potential][performance]. Potential is the vertical
 * axis (high = top row), performance the horizontal (high = right column).
 */
export const NINE_BOX: Record<TalentBand, Record<TalentBand, NineBoxCell>> = {
  high: {
    low: { label: "Potential Gem", action: "Stretch into delivery; pair with a strong performer.", tone: "amber" },
    med: { label: "Growth Talent", action: "Accelerate with broader scope and visibility.", tone: "sky" },
    high: { label: "Star", action: "Retain and prepare for the next role.", tone: "emerald" },
  },
  med: {
    low: { label: "Inconsistent", action: "Diagnose blockers; set clear short-term goals.", tone: "amber" },
    med: { label: "Core Player", action: "Keep engaged; targeted development on key gaps.", tone: "slate" },
    high: { label: "High Performer", action: "Reward and widen responsibilities.", tone: "sky" },
  },
  low: {
    low: { label: "Underperformer", action: "Structured improvement plan or role review.", tone: "rose" },
    med: { label: "Effective", action: "Solid in role; develop one signature strength.", tone: "slate" },
    high: { label: "Trusted Professional", action: "Deep expertise; leverage as a mentor.", tone: "sky" },
  },
};

export function nineBoxCell(potential: TalentBand, performance: TalentBand): NineBoxCell {
  return NINE_BOX[potential][performance];
}

/** OAR recommendation -> succession bucket presentation. */
export type SuccessionKey = "ready_now" | "ready_with_development" | "not_ready" | "unassessed";

export const SUCCESSION_META: Record<
  SuccessionKey,
  { label: string; blurb: string; tone: "emerald" | "amber" | "rose" | "slate" }
> = {
  ready_now: {
    label: "Ready Now",
    blurb: "Can step into the target role immediately.",
    tone: "emerald",
  },
  ready_with_development: {
    label: "Ready with Development",
    blurb: "Strong pipeline; ready within 12-24 months with focused development.",
    tone: "amber",
  },
  not_ready: {
    label: "Not Ready",
    blurb: "Significant development required before this role.",
    tone: "rose",
  },
  unassessed: {
    label: "Not Yet Rated",
    blurb: "No overall assessment rating recorded yet.",
    tone: "slate",
  },
};

export const SUCCESSION_ORDER: SuccessionKey[] = [
  "ready_now",
  "ready_with_development",
  "not_ready",
  "unassessed",
];

/**
 * Mean of the provided scores, or null when empty. Small helper kept here
 * so axis maths stays in one place.
 */
export function meanOrNull(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Map a 1-5 score to a heatmap colour band so the cohort skills heatmap
 * reads at a glance (green = strength, red = development need). Returns
 * literal hex values applied via inline style rather than Tailwind classes:
 * this module lives under src/lib, which is outside the Tailwind content
 * globs, so class strings here would be purged. Hex is self-contained.
 */
export function heatmapTone(score: number): { bg: string; fg: string } {
  if (score >= 4.5) return { bg: "#059669", fg: "#ffffff" }; // emerald-600
  if (score >= 3.5) return { bg: "#34d399", fg: "#022c22" }; // emerald-400
  if (score >= 3) return { bg: "#7dd3fc", fg: "#082f49" }; // sky-300
  if (score >= 2.5) return { bg: "#fcd34d", fg: "#451a03" }; // amber-300
  if (score >= 2) return { bg: "#fdba74", fg: "#431407" }; // orange-300
  return { bg: "#fb7185", fg: "#4c0519" }; // rose-400
}
