// Single source of truth for the downloadable VIFM methodology briefs. Each
// service's brief is a markdown doc under docs/ (the authored source); the route
// /api/methodology/[slug]/pdf renders it to a branded PDF via methodologyBriefHtml.
// Imported by that route AND by the /evidence "Research & validity" hub so the
// list of services and the actual downloads can never drift apart.

export type MethodologyBrief = {
  /** URL slug: /api/methodology/<slug>/pdf */
  slug: string;
  /** Display name of the service. */
  service: string;
  /** One-line descriptor for the hub card. */
  tagline: string;
  /** Brandbar eyebrow printed on the PDF (current product branding). */
  eyebrow: string;
  /** Markdown source file under docs/. */
  file: string;
  /** Download filename. */
  filename: string;
  /** Which talent pillar the service principally serves (for grouping/sorting). */
  pillar: "acquire" | "manage" | "both";
};

export const METHODOLOGY_BRIEFS: readonly MethodologyBrief[] = [
  {
    slug: "assessment-center",
    service: "Assessment Center",
    tagline: "Observed behavioural competency assessment",
    eyebrow: "VIFM Assessment Center®",
    file: "AC-Methodology-Brief.md",
    filename: "VIFM-Assessment-Center-Methodology-Brief.pdf",
    pillar: "both",
  },
  {
    slug: "ai-readiness",
    service: "AI Readiness (AR Compass)",
    tagline: "Organisational and individual AI readiness",
    eyebrow: "VIFM AI Readiness Compass®",
    file: "ARA-Methodology-Brief.md",
    filename: "VIFM-AI-Readiness-Compass-Methodology-Brief.pdf",
    pillar: "both",
  },
  {
    slug: "techno",
    service: "Techno",
    tagline: "Function-specific technical proficiency",
    eyebrow: "VIFM Techno®",
    file: "Technical-Methodology-Brief.md",
    filename: "VIFM-Techno-Methodology-Brief.pdf",
    pillar: "both",
  },
  {
    slug: "logica",
    service: "Logica",
    tagline: "Indicative cognitive reasoning aptitude",
    eyebrow: "VIFM Logica®",
    file: "Logica-Methodology-Brief.md",
    filename: "VIFM-Logica-Methodology-Brief.pdf",
    pillar: "both",
  },
  {
    slug: "persona",
    service: "Persona",
    tagline: "Behavioural competency self-assessment",
    eyebrow: "VIFM Persona®",
    file: "Persona-Methodology-Brief.md",
    filename: "VIFM-Persona-Methodology-Brief.pdf",
    pillar: "both",
  },
  {
    slug: "fluent",
    service: "Fluent",
    tagline: "Indicative CEFR English placement",
    eyebrow: "VIFM Fluent®",
    file: "Fluent-Methodology-Brief.md",
    filename: "VIFM-Fluent-Methodology-Brief.pdf",
    pillar: "both",
  },
  {
    slug: "prehire",
    service: "Pre-Hire",
    tagline: "Commercial pre-employment screening",
    eyebrow: "VIFM Pre-Hire®",
    file: "Pre-Hire-Methodology-Brief.md",
    filename: "VIFM-Pre-Hire-Methodology-Brief.pdf",
    pillar: "acquire",
  },
  {
    slug: "reflect",
    service: "Reflect 360",
    tagline: "Multi-rater leadership feedback",
    eyebrow: "VIFM Reflect 360®",
    file: "Reflect-Methodology-Brief.md",
    filename: "VIFM-Reflect-360-Methodology-Brief.pdf",
    pillar: "manage",
  },
  {
    slug: "succession-readiness",
    service: "Succession Readiness",
    tagline: "Self and 360 readiness against a target role",
    eyebrow: "VIFM Succession Readiness®",
    file: "Succession-Readiness-Methodology-Brief.md",
    filename: "VIFM-Succession-Readiness-Methodology-Brief.pdf",
    pillar: "manage",
  },
  {
    slug: "academy",
    service: "VIFM Academy",
    tagline: "Course delivery and completion certification",
    eyebrow: "VIFM Academy®",
    file: "Academy-Methodology-Brief.md",
    filename: "VIFM-Academy-Methodology-Brief.pdf",
    pillar: "manage",
  },
];

export function findMethodologyBrief(slug: string): MethodologyBrief | undefined {
  return METHODOLOGY_BRIEFS.find((b) => b.slug === slug);
}
