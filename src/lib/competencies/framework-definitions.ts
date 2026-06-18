// ─────────────────────────────────────────────────────────────
// VIFM competency framework - cluster + domain definitions.
//
// The DB stores domains, clusters and competencies (competencies carry a
// `description`; domains and clusters carry only a name). These short
// definitions for the 4 domains and 9 clusters are authored here so the
// framework page can show "the 9 definitions" without a schema change. Keyed by
// the exact name in competency_domains / competency_clusters. First-pass copy,
// safe to edit. EN only - the admin framework page renders LTR/EN.
// ─────────────────────────────────────────────────────────────

export const DOMAIN_DEFINITIONS: Record<string, string> = {
  THINKING: "How the person reasons, decides and innovates - the cognitive side of performance.",
  RESULTS: "How the person delivers, adapts and creates value - the execution side of performance.",
  PEOPLE: "How the person communicates, influences, leads and develops others.",
  SELF: "How the person manages their own integrity, growth and personal effectiveness.",
};

export const CLUSTER_DEFINITIONS: Record<string, string> = {
  // THINKING
  "Strategic & Commercial Reasoning":
    "Reading markets, finances and competitive forces to set direction and make sound, evidence-based decisions under uncertainty.",
  "Innovation & Complexity":
    "Generating original solutions and making sense of complex, interconnected and digital problems across the wider system.",
  // RESULTS
  "Delivery & Execution":
    "Turning intent into measurable outcomes - taking initiative, owning commitments, and planning and optimising work to deliver.",
  "Adaptability & Change":
    "Staying effective through uncertainty - experimenting, recovering from setbacks, and rallying people around a clear purpose.",
  "Customer & Stakeholder Focus":
    "Anticipating customer and stakeholder needs and connecting the work to sustainable, commercially meaningful value.",
  // PEOPLE
  "Influence & Communication":
    "Conveying ideas, earning genuine buy-in, handling conflict and negotiation, and building the relationships that move work forward.",
  "Leading & Developing Others":
    "Growing talent and building trusted, cohesive teams that collaborate across boundaries toward shared goals.",
  // SELF
  "Integrity & Character":
    "Acting with self-awareness, ethics, courage and inclusion - doing the right thing in the spirit as well as the letter of the rules.",
  "Growth & Personal Effectiveness":
    "Learning continuously, staying composed under pressure, sustaining wellbeing, and marshalling the resources to perform.",
};
