// ─────────────────────────────────────────────────────────────
// Persona Leadership Report - dimension model.
//
// Each of the 41 VIFM Persona competencies maps to ONE of two dimensions, after
// the transactional/transformational (Bass & Avolio Full Range) model:
//   - management  (transactional): structure, execution, oversight, consistency.
//   - leadership  (transformational): vision, influence, change, people growth.
//
// This is a content-mapping decision (reviewed by VIFM), not a validated
// typology. The matrix it feeds shows SELF-perceived orientation, to be
// triangulated with a Reflect 360 before any leadership-readiness conclusion.
// ─────────────────────────────────────────────────────────────

export type LeadershipDimension = "management" | "leadership";

const PREFIX = "a0000001-0000-0000-0000-0000000000";
const id = (suffix: string) => PREFIX + suffix;

// 16 management / 25 leadership = 41.
export const LEADERSHIP_DIMENSION: Record<string, LeadershipDimension> = {
  // ── Management (transactional) ──
  [id("39")]: "management", // Customer Orientation
  [id("11")]: "management", // Outcome Ownership
  [id("07")]: "management", // Navigating Complexity
  [id("40")]: "management", // Stakeholder Management
  [id("17")]: "management", // Resilience Under Pressure
  [id("21")]: "management", // Constructive Conflict Handling
  [id("03")]: "management", // Financial Literacy & Acumen
  [id("12")]: "management", // Accountability for Commitments
  [id("36")]: "management", // Composure Under Stress
  [id("09")]: "management", // Digital & Data Fluency
  [id("13")]: "management", // Planning & Prioritisation
  [id("04")]: "management", // Critical Analysis
  [id("37")]: "management", // Sustainable Wellbeing
  [id("14")]: "management", // Process Optimisation
  [id("38")]: "management", // Resource Mobilisation
  [id("05")]: "management", // Sound Judgement
  // ── Leadership (transformational) ──
  [id("29")]: "leadership", // Self-Insight
  [id("01")]: "leadership", // Forward Strategy Setting
  [id("06")]: "leadership", // Creative Problem-Solving
  [id("19")]: "leadership", // Clear & Adaptive Communication
  [id("24")]: "leadership", // Coaching & Talent Growth
  [id("34")]: "leadership", // Adaptive Learning Capacity
  [id("15")]: "leadership", // Operating Through Uncertainty
  [id("10")]: "leadership", // Proactive Initiative
  [id("02")]: "leadership", // Commercial & Market Awareness
  [id("25")]: "leadership", // Building Cohesive Teams
  [id("30")]: "leadership", // Emotional Regulation & Empathy
  [id("16")]: "leadership", // Learning by Doing
  [id("20")]: "leadership", // Persuasion & Buy-in
  [id("35")]: "leadership", // Continuous Self-Development
  [id("26")]: "leadership", // Cross-Functional Collaboration
  [id("41")]: "leadership", // Value Creation
  [id("08")]: "leadership", // Systems & Global Perspective
  [id("31")]: "leadership", // Principled Courage
  [id("32")]: "leadership", // Ethical Conduct
  [id("18")]: "leadership", // Mobilising Around Purpose
  [id("22")]: "leadership", // Principled Negotiation
  [id("27")]: "leadership", // Trust & Credibility
  [id("28")]: "leadership", // Interpersonal Adaptability
  [id("23")]: "leadership", // Relationship Networks
  [id("33")]: "leadership", // Cultural & Inclusive Sensitivity
};

export const DIMENSION_LABEL: Record<LeadershipDimension, string> = {
  management: "Management (transactional)",
  leadership: "Leadership (transformational)",
};

export type LeadershipQuadrant = "integrated" | "visionary" | "operational" | "emerging";

// High/low cut on the 1-5 self-rating scale. Uses the scale midpoint today;
// will move to the norm median once a Persona norm sample exists (mirrors the
// indicative-until-normed posture stated in the methodology brief).
export const LEADERSHIP_MIDPOINT = 3.0;

export function leadershipStyle(management: number, leadership: number): {
  quadrant: LeadershipQuadrant;
  label: string;
  blurb: string;
} {
  const hm = management >= LEADERSHIP_MIDPOINT;
  const hl = leadership >= LEADERSHIP_MIDPOINT;
  if (hl && hm)
    return {
      quadrant: "integrated",
      label: "Integrated Leader",
      blurb:
        "Draws on both orientations - sets direction and influences people while also planning, executing, and holding the operational line. The versatile profile; the development focus is keeping both sides in balance under pressure.",
    };
  if (hl && !hm)
    return {
      quadrant: "visionary",
      label: "Visionary Leader",
      blurb:
        "Leads through vision, influence, and people - a strong transformational orientation. To convert that into reliable delivery, pair it with the transactional discipline of planning, oversight, and execution.",
    };
  if (!hl && hm)
    return {
      quadrant: "operational",
      label: "Operational Manager",
      blurb:
        "Leads through structure, execution, and oversight - a strong transactional orientation. To extend reach and engagement, develop the transformational side: vision-setting, influence, change, and developing others.",
    };
  return {
    quadrant: "emerging",
    label: "Emerging (Developing)",
    blurb:
      "Both orientations are still developing - a foundation-building stage. Concentrate development on the dimension most relevant to the target role, and re-assess after a focused growth cycle.",
  };
}

export type LeadershipRow = { id: string; name: string; definition?: string; score: number; dimension: LeadershipDimension };

export type LeadershipProfile = {
  management: number; // 1-5 mean of the management-set competencies actually answered
  leadership: number; // 1-5 mean of the leadership-set competencies actually answered
  orientation: number; // leadership - management (positive = leans transformational)
  average: number; // (management + leadership) / 2
  managementCount: number;
  leadershipCount: number;
  quadrant: LeadershipQuadrant;
  styleLabel: string;
  styleBlurb: string;
  managementRows: LeadershipRow[];
  leadershipRows: LeadershipRow[];
  topStrengths: LeadershipRow[];
  topDevelopment: LeadershipRow[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/**
 * Build the leadership profile from per-competency self scores. `nameById` /
 * `defById` resolve display name + definition. Only competencies that were
 * actually answered (present in scoreById) contribute to the axes.
 */
export function computeLeadershipProfile(
  scoreById: Map<string, number>,
  nameById: Map<string, string>,
  defById: Map<string, string>,
): LeadershipProfile {
  const managementRows: LeadershipRow[] = [];
  const leadershipRows: LeadershipRow[] = [];

  for (const [cid, dimension] of Object.entries(LEADERSHIP_DIMENSION)) {
    const score = scoreById.get(cid);
    if (score == null) continue;
    const row: LeadershipRow = {
      id: cid,
      name: nameById.get(cid) ?? cid,
      definition: defById.get(cid),
      score,
      dimension,
    };
    (dimension === "management" ? managementRows : leadershipRows).push(row);
  }

  // Highest score first within each dimension list.
  managementRows.sort((a, b) => b.score - a.score);
  leadershipRows.sort((a, b) => b.score - a.score);

  const management = mean(managementRows.map((r) => r.score));
  const leadership = mean(leadershipRows.map((r) => r.score));
  const style = leadershipStyle(management, leadership);

  const all = [...managementRows, ...leadershipRows];
  const topStrengths = [...all].sort((a, b) => b.score - a.score).slice(0, 5);
  const topDevelopment = [...all].sort((a, b) => a.score - b.score).slice(0, 5);

  return {
    management,
    leadership,
    orientation: round2(leadership - management),
    average: round2((management + leadership) / 2),
    managementCount: managementRows.length,
    leadershipCount: leadershipRows.length,
    quadrant: style.quadrant,
    styleLabel: style.label,
    styleBlurb: style.blurb,
    managementRows,
    leadershipRows,
    topStrengths,
    topDevelopment,
  };
}
