// ─────────────────────────────────────────────────────────────
// VIFM DARE Framework - dimension model (v1.0, locked 2026-07-03).
//
// Each of the 41 VIFM Persona competencies maps to ONE of four decision roles,
// after the decision-rights literature (McKinsey DARE; cf. Bain RAPID):
//   D - Decide     own the call: commit, be accountable, hold the line.
//   A - Advise     improve others' decisions: expertise, candour, trust.
//   R - Recommend  build the case: analyse, frame options, persuade.
//   E - Execute    deliver the decision: people, process, resources.
//
// This is a content-mapping decision (reviewed by VIFM), not a validated
// typology, and it describes SELF-perceived behavioural readiness for a role
// in a decision process - it does not allocate authority. Full model:
// docs/VIFM-DARE-Framework.md.
// ─────────────────────────────────────────────────────────────

export type DareRole = "decide" | "advise" | "recommend" | "execute";

const PREFIX = "a0000001-0000-0000-0000-0000000000";
const id = (suffix: string) => PREFIX + suffix;

// 8 D / 10 A / 8 R / 15 E = 41.
export const DARE_ROLE: Record<string, DareRole> = {
  // ── D - Decide ──
  [id("05")]: "decide", // Sound Judgement
  [id("11")]: "decide", // Outcome Ownership
  [id("12")]: "decide", // Accountability for Commitments
  [id("31")]: "decide", // Principled Courage
  [id("32")]: "decide", // Ethical Conduct
  [id("15")]: "decide", // Operating Through Uncertainty
  [id("36")]: "decide", // Composure Under Stress
  [id("41")]: "decide", // Value Creation
  // ── A - Advise ──
  [id("02")]: "advise", // Commercial & Market Awareness
  [id("03")]: "advise", // Financial Literacy & Acumen
  [id("09")]: "advise", // Digital & Data Fluency
  [id("08")]: "advise", // Systems & Global Perspective
  [id("33")]: "advise", // Cultural & Inclusive Sensitivity
  [id("30")]: "advise", // Emotional Regulation & Empathy
  [id("23")]: "advise", // Relationship Networks
  [id("27")]: "advise", // Trust & Credibility
  [id("21")]: "advise", // Constructive Conflict Handling
  [id("29")]: "advise", // Self-Insight
  // ── R - Recommend ──
  [id("04")]: "recommend", // Critical Analysis
  [id("06")]: "recommend", // Creative Problem-Solving
  [id("07")]: "recommend", // Navigating Complexity
  [id("01")]: "recommend", // Forward Strategy Setting
  [id("19")]: "recommend", // Clear & Adaptive Communication
  [id("20")]: "recommend", // Persuasion & Buy-in
  [id("22")]: "recommend", // Principled Negotiation
  [id("34")]: "recommend", // Adaptive Learning Capacity
  // ── E - Execute ──
  [id("13")]: "execute", // Planning & Prioritisation
  [id("14")]: "execute", // Process Optimisation
  [id("38")]: "execute", // Resource Mobilisation
  [id("10")]: "execute", // Proactive Initiative
  [id("16")]: "execute", // Learning by Doing
  [id("39")]: "execute", // Customer Orientation
  [id("40")]: "execute", // Stakeholder Management
  [id("25")]: "execute", // Building Cohesive Teams
  [id("26")]: "execute", // Cross-Functional Collaboration
  [id("18")]: "execute", // Mobilising Around Purpose
  [id("24")]: "execute", // Coaching & Talent Growth
  [id("28")]: "execute", // Interpersonal Adaptability
  [id("17")]: "execute", // Resilience Under Pressure
  [id("37")]: "execute", // Sustainable Wellbeing
  [id("35")]: "execute", // Continuous Self-Development
};

export const DARE_ROLES: DareRole[] = ["decide", "advise", "recommend", "execute"];

export const DARE_META: Record<
  DareRole,
  { letter: string; label: string; noun: string; hex: string; blurb: string }
> = {
  decide: {
    letter: "D",
    label: "Decide",
    noun: "Decider",
    hex: "#4f46e5",
    blurb: "Owns the call - commits the organisation, carries accountability, and holds the line under pressure and ambiguity.",
  },
  advise: {
    letter: "A",
    label: "Advise",
    noun: "Adviser",
    hex: "#0891b2",
    blurb: "Improves others' decisions - brings domain perspective, candour, and trusted relationships without needing the vote.",
  },
  recommend: {
    letter: "R",
    label: "Recommend",
    noun: "Recommender",
    hex: "#d97706",
    blurb: "Builds the case - analyses, frames real options, and brings forward a persuasive, evidence-based recommendation.",
  },
  execute: {
    letter: "E",
    label: "Execute",
    noun: "Executor",
    hex: "#059669",
    blurb: "Delivers the decision - mobilises people, process, and resources so the call becomes results.",
  },
};

// Read against the scale midpoint until a Persona norm sample exists.
export const DARE_MIDPOINT = 3.0;
/** Top-two within this = a dual-role profile. */
export const DUAL_GAP = 0.25;
/** All four within this = a versatile profile. */
export const VERSATILE_SPREAD = 0.5;

export type DareRow = { id: string; name: string; definition?: string; score: number; role: DareRole };

export type DareProfile = {
  scores: Record<DareRole, number>; // 1-5 mean per role (answered competencies only)
  counts: Record<DareRole, number>; // competencies answered per role
  primary: DareRole;
  secondary: DareRole;
  /** "Decider" | "Recommender / Adviser" | "Versatile" */
  profileLabel: string;
  profileBlurb: string;
  rowsByRole: Record<DareRole, DareRow[]>; // score-desc within each role
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export function computeDareProfile(
  scoreById: Map<string, number>,
  nameById: Map<string, string>,
  definitionById: Map<string, string>,
): DareProfile {
  const rowsByRole: Record<DareRole, DareRow[]> = { decide: [], advise: [], recommend: [], execute: [] };
  for (const [cid, role] of Object.entries(DARE_ROLE)) {
    const score = scoreById.get(cid);
    if (score == null) continue;
    rowsByRole[role].push({
      id: cid,
      name: nameById.get(cid) ?? "Competency",
      definition: definitionById.get(cid),
      score,
      role,
    });
  }
  for (const role of DARE_ROLES) rowsByRole[role].sort((a, b) => b.score - a.score);

  const scores = {} as Record<DareRole, number>;
  const counts = {} as Record<DareRole, number>;
  for (const role of DARE_ROLES) {
    scores[role] = mean(rowsByRole[role].map((r) => r.score));
    counts[role] = rowsByRole[role].length;
  }

  const ranked = [...DARE_ROLES].sort((a, b) => scores[b] - scores[a]);
  const primary = ranked[0];
  const secondary = ranked[1];
  const spread = scores[ranked[0]] - scores[ranked[3]];
  const topGap = scores[primary] - scores[secondary];

  let profileLabel: string;
  let profileBlurb: string;
  if (spread <= VERSATILE_SPREAD) {
    profileLabel = "Versatile";
    profileBlurb =
      "Self-ratings sit close together across all four decision roles - a flexible profile that can take whichever seat the decision needs. Valuable in small teams; in larger organisations, pick the seat deliberately per decision.";
  } else if (topGap <= DUAL_GAP) {
    profileLabel = `${DARE_META[primary].noun} / ${DARE_META[secondary].noun}`;
    profileBlurb =
      `Strengths concentrate almost equally in the ${DARE_META[primary].label} and ${DARE_META[secondary].label} roles - a dual-role profile. ` +
      `${DARE_META[primary].blurb} ${DARE_META[secondary].blurb}`;
  } else {
    profileLabel = DARE_META[primary].noun;
    profileBlurb = DARE_META[primary].blurb;
  }

  return { scores, counts, primary, secondary, profileLabel, profileBlurb, rowsByRole };
}
