// Proposal service catalogue: maps each Caliber service to its rate-card key,
// display label, brand accent, downloadable methodology brief slug, and a concise
// "technical approach" blurb used in the proposal's technical section. Derived
// from the canonical PORTAL_SERVICES so the proposal list never drifts from the
// 7 sellable services.

import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";

/** Caliber service key -> the /api/methodology/[slug]/pdf brief slug. */
export const PROPOSAL_METHODOLOGY_SLUG: Record<CaliberService, string> = {
  fluent: "fluent",
  logica: "logica",
  persona: "persona",
  techno: "techno",
  prehire: "prehire",
  arc: "ai-readiness",
  reflect: "reflect",
};

/** One-paragraph "what it measures + how" for the proposal's technical section. */
export const PROPOSAL_BLURB: Record<CaliberService, string> = {
  fluent:
    "Indicative CEFR English placement across reading, listening, writing and speaking. Receptive skills are auto-scored; productive skills are AI-scored against a CEFR rubric with human-review calibration. Positioned as indicative placement, not a certified high-stakes qualification.",
  logica:
    "Indicative cognitive reasoning aptitude across numerical, verbal, inductive and deductive reasoning. The full keyed test is held server-side and graded there, with option order re-randomised per administration to protect result validity.",
  persona:
    "Behavioural competency self-assessment mapped to the VIFM 41-competency framework, with optional decision-rights (DARE) and emotional-intelligence lenses on the same sitting. Produces a development-grade profile and, where a target role is set, a role-fit view.",
  techno:
    "Function-specific technical proficiency drawn from an SME-reviewed item bank. Delivers an indicative 1-5 band per domain, or a certified, publicly verifiable credential when the score clears the documented cut-score. Secure delivery with a server-held answer key.",
  prehire:
    "Commercial pre-employment screening that orchestrates a competency check, an English placement and a short behavioural interview into a single advisory composite. It is a screening signal, never an auto-reject - a person always makes the hiring decision.",
  arc:
    "Organisational and individual AI readiness across eight pillars, benchmarked against peers with year-on-year tracking. Deliverables include a bilingual (EN/AR) consultant report, a capability-building plan and a regulatory-alignment view for UAE and Saudi frameworks.",
  reflect:
    "Multi-rater 360 leadership feedback against the client's own competency framework. Self, manager, peer and direct-report ratings roll up into anonymity-protected participant and cohort reports with an individual development plan.",
};

/** Concrete deliverables per service, listed under each technical-approach block. */
export const PROPOSAL_DELIVERABLES: Record<CaliberService, string[]> = {
  fluent: [
    "Individual CEFR placement report with per-skill breakdown (reading, listening, writing, speaking)",
    "Downloadable placement certificate per participant",
    "Cohort placement matrix for programme planning",
  ],
  logica: [
    "Individual reasoning profile with per-subtest bands (numerical, verbal, inductive, deductive)",
    "Cohort analytics with band distributions",
    "Administration integrity signals surfaced to the programme owner",
  ],
  persona: [
    "Individual behavioural profile across the VIFM 41-competency framework",
    "Optional decision-rights (DARE) and emotional-intelligence report lenses",
    "Role-fit view where a target role profile is set",
    "Cohort intelligence sheet for the sponsoring organization",
  ],
  techno: [
    "Per-domain technical proficiency bands with skill-level detail",
    "Publicly verifiable Technical Proficiency credential where the documented cut-score is met",
    "Cohort readiness view across the assessed functions",
  ],
  prehire: [
    "Per-candidate screening report with advisory composite (never an auto-reject)",
    "Ranked shortlist across the full requisition",
    "Adverse-impact (4/5ths) monitoring view and immutable audit trail",
    "ATS-ready JSON/CSV export",
  ],
  arc: [
    "Bilingual (EN/AR) organizational AI-readiness report across the assessed pillars",
    "Pillar heatmap, investment matrix and phased capability-building roadmap",
    "Regulatory-alignment view for the applicable UAE / Saudi frameworks",
    "Year-on-year comparison on reassessment",
  ],
  reflect: [
    "Anonymity-protected participant 360 report per leader",
    "Individual development plan (IDP) per participant",
    "Organization-wide cohort report with strengths and blind-spots",
  ],
};

export type ProposalServiceMeta = {
  key: CaliberService;
  label: string;
  accent: string;
  methodologySlug: string;
  blurb: string;
};

export const PROPOSAL_SERVICES: ProposalServiceMeta[] = PORTAL_SERVICES.map((s) => ({
  key: s.id,
  label: s.label,
  accent: s.accent,
  methodologySlug: PROPOSAL_METHODOLOGY_SLUG[s.id],
  blurb: PROPOSAL_BLURB[s.id],
}));

export function proposalService(key: string): ProposalServiceMeta | undefined {
  return PROPOSAL_SERVICES.find((s) => s.key === key);
}

/** Per-service pricing basis, shown on licence rows and denormalised onto the
 *  licence model (e.g. "Persona - per employee"). */
export const PROPOSAL_SERVICE_BASIS: Record<CaliberService, string> = {
  prehire: "per candidate",
  logica: "per individual",
  persona: "per employee",
  techno: "per individual",
  fluent: "per individual",
  arc: "per business unit",
  reflect: "per leader",
};

/** Short category label carried onto the licence model (denormalised snapshot). */
export const PROPOSAL_SERVICE_CATEGORY: Record<CaliberService, string> = {
  prehire: "Pre-employment screening",
  logica: "Reasoning aptitude",
  persona: "Behavioural self-assessment",
  techno: "Technical proficiency",
  fluent: "English placement",
  arc: "AI readiness diagnostic",
  reflect: "Leadership 360 feedback",
};

/** Default, editable boilerplate seeded into a new proposal. */
export const DEFAULT_PAYMENT_TERMS =
  "50% on signature of the statement of work, 50% on delivery. Fees are exclusive of any applicable taxes and are valid until the date shown above.";

/** SaaS payment schedule seeded when a new proposal opens in licence mode. */
export const DEFAULT_LICENCE_PAYMENT_TERMS =
  "50% upon signing; 50% upon go-live; annually in advance thereafter. The licence is annual and renewable; renewal for Year 2 is capped at no more than a 5% uplift. Fees are exclusive of any applicable taxes.";

// ── Section selection + recommendation tiers (Phase 2) ──
// The document outline, each section carrying a recommendation tier. MANDATORY
// sections always render (and are the only ones cross-referenced by other
// sections, so a reference can never point at an excluded section). RECOMMENDED
// default on; OPTIONAL default off. Single source for proposal-html + the builder.
export type SectionTier = "mandatory" | "recommended" | "optional";

export const PROPOSAL_SECTION_DEFS: { title: string; tier: SectionTier }[] = [
  { title: "Executive summary", tier: "mandatory" },
  { title: "About VIFM", tier: "mandatory" },
  { title: "Understanding of your requirements", tier: "mandatory" },
  { title: "Proposed solution & technical approach", tier: "mandatory" },
  { title: "Psychometric foundations", tier: "recommended" },
  { title: "Methodology & quality standards", tier: "recommended" },
  { title: "Platform, integration & security", tier: "recommended" },
  { title: "Implementation plan", tier: "recommended" },
  { title: "Project governance & team", tier: "mandatory" },
  { title: "Data protection & privacy", tier: "mandatory" },
  { title: "AI governance & standards", tier: "recommended" },
  { title: "Service level & support", tier: "mandatory" },
  { title: "Relevant experience", tier: "optional" },
  { title: "Commercial proposal", tier: "mandatory" },
  { title: "Assumptions & exclusions", tier: "recommended" },
  { title: "Terms & conditions", tier: "mandatory" },
  { title: "Definitions", tier: "recommended" },
  { title: "Acceptance & next steps", tier: "mandatory" },
  { title: "Sample reports", tier: "optional" },
];

export const PROPOSAL_SECTION_TITLES = PROPOSAL_SECTION_DEFS.map((s) => s.title);

const MANDATORY_SECTIONS = PROPOSAL_SECTION_DEFS.filter((s) => s.tier === "mandatory").map((s) => s.title);

/** Default ticked set for a NEW proposal: mandatory + recommended (optional off). */
export function defaultSectionSelection(): string[] {
  return PROPOSAL_SECTION_DEFS.filter((s) => s.tier !== "optional").map((s) => s.title);
}

/** Renamed section titles: a saved selection referencing an old title still
 *  resolves to the current one (so an existing proposal doesn't silently lose
 *  the section after a rename). */
export const SECTION_TITLE_ALIASES: Record<string, string> = {
  "Evidence & sample reports": "Sample reports",
};

/** Resolve the ordered set of sections to render. `null`/empty selection ⇒ the
 *  default (mandatory + recommended). Mandatory sections are always included. */
export function resolveIncludedSections(sel: string[] | null | undefined): string[] {
  if (!sel || !Array.isArray(sel) || sel.length === 0) return defaultSectionSelection();
  const chosen = new Set(sel.map((t) => SECTION_TITLE_ALIASES[t] ?? t));
  return PROPOSAL_SECTION_DEFS.filter((s) => s.tier === "mandatory" || chosen.has(s.title)).map((s) => s.title);
}

export { MANDATORY_SECTIONS };

export function defaultTerms(clientName: string, currency: string): string {
  return (
    `This proposal is confidential and prepared exclusively for ${clientName}. ` +
    `All fees are quoted in ${currency} and are valid until the date shown above. ` +
    "Any engagement is subject to VIFM's standard terms of service and a signed statement of work. " +
    "Assessment data is processed in line with applicable data-protection law (UAE Federal Decree-Law No. 45 of 2021, " +
    "Saudi PDPL, and GDPR where relevant) and retained for a maximum of 24 months unless contractually extended."
  );
}
