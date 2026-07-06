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

/** Default, editable boilerplate seeded into a new proposal. */
export const DEFAULT_PAYMENT_TERMS =
  "50% on signature of the statement of work, 50% on delivery. Fees are exclusive of any applicable taxes and are valid until the date shown above.";

export function defaultTerms(clientName: string, currency: string): string {
  return (
    `This proposal is confidential and prepared exclusively for ${clientName}. ` +
    `All fees are quoted in ${currency} and are valid until the date shown above. ` +
    "Any engagement is subject to VIFM's standard terms of service and a signed statement of work. " +
    "Assessment data is processed in line with applicable data-protection law (UAE Federal Decree-Law No. 45 of 2021, " +
    "Saudi PDPL, and GDPR where relevant) and retained for a maximum of 24 months unless contractually extended."
  );
}
