// ─────────────────────────────────────────────────────────────
// VIFM EQ Framework - dimension model (v1.0, locked 2026-07-03).
//
// The emotionally-loaded SUBSET (22 of 41) of the VIFM Persona competencies
// maps to Goleman's four emotional-intelligence quadrants:
//   Self-Awareness | Self-Management | Social Awareness (Empathy) | Relationship Management
// The other 19 competencies (cognitive/commercial/executional) are OUTSIDE the
// EI domain and are never scored by this lens. Content-mapping decision
// (reviewed by VIFM), not a validated EI instrument - full model + judgment
// calls: docs/VIFM-EQ-Framework.md.
// ─────────────────────────────────────────────────────────────

export type EqQuadrant = "self_awareness" | "self_management" | "social_awareness" | "relationship_management";

const PREFIX = "a0000001-0000-0000-0000-0000000000";
const id = (suffix: string) => PREFIX + suffix;

// 3 SA / 5 SM / 3 SocA / 11 RM = 22 in scope.
export const EQ_QUADRANT: Record<string, EqQuadrant> = {
  // ── Self-Awareness ──
  [id("29")]: "self_awareness", // Self-Insight
  [id("35")]: "self_awareness", // Continuous Self-Development
  [id("37")]: "self_awareness", // Sustainable Wellbeing
  // ── Self-Management ──
  [id("36")]: "self_management", // Composure Under Stress
  [id("17")]: "self_management", // Resilience Under Pressure
  [id("15")]: "self_management", // Operating Through Uncertainty
  [id("32")]: "self_management", // Ethical Conduct
  [id("10")]: "self_management", // Proactive Initiative
  // ── Social Awareness (Empathy) ──
  [id("30")]: "social_awareness", // Emotional Regulation & Empathy
  [id("33")]: "social_awareness", // Cultural & Inclusive Sensitivity
  [id("39")]: "social_awareness", // Customer Orientation
  // ── Relationship Management ──
  [id("19")]: "relationship_management", // Clear & Adaptive Communication
  [id("20")]: "relationship_management", // Persuasion & Buy-in
  [id("24")]: "relationship_management", // Coaching & Talent Growth
  [id("21")]: "relationship_management", // Constructive Conflict Handling
  [id("25")]: "relationship_management", // Building Cohesive Teams
  [id("26")]: "relationship_management", // Cross-Functional Collaboration
  [id("18")]: "relationship_management", // Mobilising Around Purpose
  [id("23")]: "relationship_management", // Relationship Networks
  [id("27")]: "relationship_management", // Trust & Credibility
  [id("28")]: "relationship_management", // Interpersonal Adaptability
  [id("22")]: "relationship_management", // Principled Negotiation
};

export const EQ_QUADRANTS: EqQuadrant[] = ["self_awareness", "self_management", "social_awareness", "relationship_management"];

export const EQ_META: Record<
  EqQuadrant,
  { label: string; short: string; axis: string; hex: string; blurb: string }
> = {
  self_awareness: {
    label: "Self-Awareness",
    short: "Self-Aware",
    axis: "Self · Recognition",
    hex: "#0284c7",
    blurb: "Reading your own emotions, limits, and worth - the foundation quadrant the other three build on.",
  },
  self_management: {
    label: "Self-Management",
    short: "Self-Mgmt",
    axis: "Self · Regulation",
    hex: "#4f46e5",
    blurb: "Handling your emotions, impulses, and energy - staying composed, adaptable, principled, and proactive under pressure.",
  },
  social_awareness: {
    label: "Social Awareness (Empathy)",
    short: "Empathy",
    axis: "Social · Recognition",
    hex: "#d97706",
    blurb: "Reading other people and the organisation - empathy, cultural sensitivity, and service orientation.",
  },
  relationship_management: {
    label: "Relationship Management",
    short: "Relationships",
    axis: "Social · Regulation",
    hex: "#059669",
    blurb: "Using awareness to move people - communicating, influencing, coaching, handling conflict, and building teams and trust.",
  },
};

// Read against the scale midpoint until a Persona norm sample exists.
export const EQ_MIDPOINT = 3.0;

export type EqRow = { id: string; name: string; definition?: string; score: number; quadrant: EqQuadrant };

export type EqProfile = {
  scores: Record<EqQuadrant, number>; // 1-5 mean per quadrant (answered only)
  counts: Record<EqQuadrant, number>;
  /** Quadrant-balanced mean of the four quadrant scores. */
  eqIndex: number;
  strongest: EqQuadrant;
  priority: EqQuadrant; // lowest - the development quadrant
  runnerUp: EqQuadrant; // second-lowest
  rowsByQuadrant: Record<EqQuadrant, EqRow[]>; // score-desc within each quadrant
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export function computeEqProfile(
  scoreById: Map<string, number>,
  nameById: Map<string, string>,
  definitionById: Map<string, string>,
): EqProfile {
  const rowsByQuadrant: Record<EqQuadrant, EqRow[]> = {
    self_awareness: [],
    self_management: [],
    social_awareness: [],
    relationship_management: [],
  };
  for (const [cid, quadrant] of Object.entries(EQ_QUADRANT)) {
    const score = scoreById.get(cid);
    if (score == null) continue;
    rowsByQuadrant[quadrant].push({
      id: cid,
      name: nameById.get(cid) ?? "Competency",
      definition: definitionById.get(cid),
      score,
      quadrant,
    });
  }
  for (const q of EQ_QUADRANTS) rowsByQuadrant[q].sort((a, b) => b.score - a.score);

  const scores = {} as Record<EqQuadrant, number>;
  const counts = {} as Record<EqQuadrant, number>;
  for (const q of EQ_QUADRANTS) {
    scores[q] = mean(rowsByQuadrant[q].map((r) => r.score));
    counts[q] = rowsByQuadrant[q].length;
  }

  const answered = EQ_QUADRANTS.filter((q) => counts[q] > 0);
  const eqIndex = mean(answered.map((q) => scores[q]));
  const rankedDesc = [...answered].sort((a, b) => scores[b] - scores[a]);
  const rankedAsc = [...rankedDesc].reverse();

  return {
    scores,
    counts,
    eqIndex,
    strongest: rankedDesc[0] ?? "self_awareness",
    priority: rankedAsc[0] ?? "self_awareness",
    runnerUp: rankedAsc[1] ?? rankedAsc[0] ?? "self_management",
    rowsByQuadrant,
  };
}
