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

// ─────────────────────────────────────────────────────────────
// Framework GRID visual config (the branded /admin/framework page).
//
// One small config object so a future domain is a one-line change, per the
// grid handover. Keyed by the EXACT competency_domains.name in the DB
// (uppercase: THINKING / RESULTS / PEOPLE / SELF). A domain not found here
// falls back to a generated colour from the dark->accent ramp + a default icon.
// ─────────────────────────────────────────────────────────────

export type DomainIconKey = "thinking" | "results" | "people" | "self";

export type DomainVisual = {
  /** Header background + cluster accent + competency-number text colour. */
  color: string;
  /** ~6% tint of the domain colour - background of the competency number badge. */
  tint: string;
  icon: DomainIconKey;
  captionEn: string;
  captionAr: string;
};

export const DOMAIN_VISUALS: Record<string, DomainVisual> = {
  THINKING: { color: "#010131", tint: "#EAECF6", icon: "thinking", captionEn: "Cognitive & strategic", captionAr: "إدراكي واستراتيجي" },
  RESULTS: { color: "#1A3A6B", tint: "#E7EDF7", icon: "results", captionEn: "Delivery", captionAr: "الإنجاز والتنفيذ" },
  PEOPLE: { color: "#3D6DB0", tint: "#E9F0FA", icon: "people", captionEn: "Interpersonal", captionAr: "العلاقات الشخصية" },
  SELF: { color: "#5391D5", tint: "#EAF2FB", icon: "self", captionEn: "Intrapersonal", captionAr: "الذات" },
};

// Ramp endpoints (dark -> accent). Used to generate an evenly-spaced colour for
// any domain not in DOMAIN_VISUALS, so the page survives a domain-set change.
const RAMP_FROM = "#010131";
const RAMP_TO = "#5391D5";

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgbToHex = (r: number, g: number, b: number): string =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Evenly-spaced colour i of n along the dark->accent ramp (n>=1). */
export function rampColor(i: number, n: number): string {
  const t = n <= 1 ? 0 : i / (n - 1);
  const [r1, g1, b1] = hexToRgb(RAMP_FROM);
  const [r2, g2, b2] = hexToRgb(RAMP_TO);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** ~6% tint of a colour over white - used for number-badge backgrounds. */
export function tintColor(hex: string, amount = 0.92): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Resolve a domain's visuals: explicit config, else a generated ramp entry. */
export function resolveDomainVisual(name: string, index: number, total: number): DomainVisual {
  const hit = DOMAIN_VISUALS[name];
  if (hit) return hit;
  const color = rampColor(index, total);
  const icons: DomainIconKey[] = ["thinking", "results", "people", "self"];
  return { color, tint: tintColor(color), icon: icons[index % icons.length], captionEn: "", captionAr: "" };
}

// ── Proficiency scale (5-point BARS) - the grid's scale card ──
export type BarsLevel = { level: number; labelEn: string; labelAr: string; color: string; target?: boolean };

export const BARS_SCALE: BarsLevel[] = [
  { level: 1, labelEn: "Significant Gap", labelAr: "فجوة كبيرة", color: "#D0DFF4" },
  { level: 2, labelEn: "Development Needed", labelAr: "بحاجة إلى تطوير", color: "#A8C4E5" },
  { level: 3, labelEn: "Meets Requirement", labelAr: "يلبّي المتطلّب", color: "#5391D5", target: true },
  { level: 4, labelEn: "Above Requirement", labelAr: "يفوق المتطلّب", color: "#1A3A6B" },
  { level: 5, labelEn: "Role Model", labelAr: "قدوة يُحتذى", color: "#010131" },
];
