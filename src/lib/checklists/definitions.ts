/**
 * The master checklists. Owners: bd = business development, consultant,
 * admin, client. An item with `auto` reads the platform; the rest are ticked.
 *
 * Assessment Center items follow the BPS standard's sequence (contracting,
 * design, preparation, delivery, integration, reporting, review) and the centre
 * agreement template's clauses. AI Readiness Compass items follow the
 * consultant roadmap in the user guide.
 */

import type { ChecklistDef, ChecklistFacts, ChecklistService } from "./types";

const selection = (f: ChecklistFacts) => f["ac.purpose"]?.detail === "selection";
const staged = (f: ChecklistFacts) => f["arc.stage"]?.detail !== "department" && f["arc.stage"]?.detail !== "individual";

export const AC_CHECKLIST: ChecklistDef = {
  service: "ac",
  serviceLabel: "Assessment Center",
  items: [
    // ── Before the agreement ──
    { key: "ac.need", phase: "before", owner: "client", label: "The client has described its need and supplied job descriptions or a competency framework", hint: "Agreement clause 2.1 and 2.2." },
    { key: "ac.suitability", phase: "before", owner: "bd", label: "VIFM has advised whether an assessment centre is the right response, and any alternative considered", hint: "Agreement clause 2.3. Record advice against a centre where that is the honest view." },
    { key: "ac.proposal", phase: "before", owner: "bd", label: "Proposal issued and accepted", auto: "ac.proposal", link: () => "/admin/proposals" },
    { key: "ac.contacts", phase: "before", owner: "bd", label: "Client sponsor and day-to-day contact named", hint: "Agreement section 5, named contacts." },
    { key: "ac.dpa", phase: "before", owner: "bd", label: "Data protection law and the parties' roles confirmed with counsel", hint: "Agreement section 9. UAE Decree-Law 45/2021, Saudi PDPL or GDPR." },
    // ── The agreement ──
    { key: "ac.purpose", phase: "agreement", owner: "consultant", label: "Purpose recorded: selection, development or succession", auto: "ac.purpose", link: (id) => `/admin/engagements/${id}` },
    { key: "ac.agreement", phase: "agreement", owner: "bd", label: "Centre agreement completed from the design and signed by both parties", hint: "Download the pre-filled Word file from the design record, complete the yellow fields, sign before any implementation work.", link: (id) => `/api/admin/engagements/${id}/centre-agreement` },
    { key: "ac.plan_approved", phase: "agreement", owner: "client", label: "Centre plan agreed with the client", auto: "ac.plan_approved", link: (id) => `/admin/engagements/${id}` },
    { key: "ac.weights", phase: "agreement", owner: "client", label: "Competency weights confirmed before the centre", auto: "ac.weights", when: selection, hint: "A selection centre's overall rating is calculated from these." },
    { key: "ac.recipients", phase: "agreement", owner: "client", label: "Report recipients agreed and named", auto: "ac.recipients", hint: "Joining pack: who receives reports." },
    { key: "ac.feedback_spec", phase: "agreement", owner: "consultant", label: "Feedback to participants specified: whether, what form, by when", auto: "ac.feedback_spec" },
    { key: "ac.eval_plan", phase: "agreement", owner: "consultant", label: "Post-centre evaluation plan agreed: validation, reaction, utility", auto: "ac.eval_plan", hint: "Validity evidence panel, Agree the plan." },
    // ── Set-up ──
    { key: "ac.org", phase: "setup", owner: "admin", label: "Client organisation on the platform", auto: "ac.org", link: () => "/admin/clients" },
    { key: "ac.design", phase: "setup", owner: "consultant", label: "Design record complete: criteria linked to the job, every competency in two or more exercises", auto: "ac.design" },
    { key: "ac.roles", phase: "setup", owner: "admin", label: "Centre roles assigned, everyone with a current competence record", auto: "ac.roles" },
    { key: "ac.staffing", phase: "setup", owner: "admin", label: "Staffing rules met: two assessors per participant, one per three", auto: "ac.staffing" },
    { key: "ac.candidates", phase: "setup", owner: "client", label: "Participants nominated and added", auto: "ac.candidates" },
    { key: "ac.pack", phase: "setup", owner: "admin", label: "Joining pack published at least 21 days before the centre", auto: "ac.pack" },
    { key: "ac.consent", phase: "setup", owner: "client", label: "Every participant has consented", auto: "ac.consent" },
    { key: "ac.adjustments", phase: "setup", owner: "consultant", label: "Adjustment requests answered", auto: "ac.adjustments" },
    { key: "ac.timetable", phase: "setup", owner: "admin", label: "Timetable built and checked for clashes", auto: "ac.timetable" },
    { key: "ac.materials", phase: "setup", owner: "admin", label: "Materials prepared and checked against the centre manual's checklist", hint: "Agreement section 5; BPS 5.26." },
    { key: "ac.contingency", phase: "setup", owner: "admin", label: "Technical support and the fallback if the platform is unavailable named", hint: "Agreement clause 12.4." },
    { key: "ac.stakeholders", phase: "setup", owner: "consultant", label: "Client observers or sponsors attending the centre briefed on how to behave", hint: "BPS 5.27." },
    // ── Delivery ──
    { key: "ac.activated", phase: "delivery", owner: "admin", label: "Engagement activated", auto: "ac.activated" },
    { key: "ac.delivery_log", phase: "delivery", owner: "admin", label: "Incidents during the centre logged, or confirmed that there were none", auto: "ac.delivery_log", hint: "Tick manually if there were no incidents." },
    { key: "ac.rated", phase: "delivery", owner: "consultant", label: "Integration meeting held and every participant given an overall rating", auto: "ac.rated" },
    // ── Reporting and close ──
    { key: "ac.reports", phase: "close", owner: "consultant", label: "Reports checked and released to the named recipients", auto: "ac.reports" },
    { key: "ac.guidance", phase: "close", owner: "consultant", label: "Guidance note for decision makers sent with the reports", link: (id) => `/api/reports/${id}/guidance` },
    { key: "ac.feedback_given", phase: "close", owner: "consultant", label: "Feedback delivered to every rated participant", auto: "ac.feedback_given" },
    { key: "ac.decisions", phase: "close", owner: "client", label: "Client decisions recorded and communicated to participants", auto: "ac.decisions" },
    { key: "ac.review", phase: "close", owner: "consultant", label: "Post-centre review completed", auto: "ac.review" },
    { key: "ac.followups", phase: "close", owner: "consultant", label: "Six- and twelve-month outcome follow-ups scheduled", auto: "ac.followups" },
    { key: "ac.evidence", phase: "close", owner: "consultant", label: "Evidence pack shared with the client", link: (id) => `/api/admin/engagements/${id}/evidence-pack` },
    { key: "ac.invoice", phase: "close", owner: "bd", label: "Final invoice issued" },
  ],
};

export const ARC_CHECKLIST: ChecklistDef = {
  service: "arc",
  serviceLabel: "AI Readiness Compass",
  items: [
    // ── Before the agreement ──
    { key: "arc.need", phase: "before", owner: "bd", label: "Client objectives and the units or departments in scope understood" },
    { key: "arc.region", phase: "before", owner: "bd", label: "Client region and sector confirmed (UAE or Saudi frameworks are never mixed)", auto: "arc.region" },
    { key: "arc.stage", phase: "before", owner: "bd", label: "Engagement stage and pillar scope agreed", auto: "arc.stage", hint: "Department 4 pillars, Division 6, Enterprise all 8. The stage sets the report length and the fee." },
    { key: "arc.proposal", phase: "before", owner: "bd", label: "Proposal issued and accepted", auto: "arc.proposal", link: () => "/admin/proposals" },
    { key: "arc.contact", phase: "before", owner: "bd", label: "Client contact named on the organisation", auto: "arc.contact" },
    { key: "arc.dpa", phase: "before", owner: "bd", label: "Data protection basis confirmed: respondents' answers and the client's report" },
    // ── The agreement ──
    { key: "arc.sow", phase: "agreement", owner: "bd", label: "Agreement or statement of work signed" },
    { key: "arc.delivery_terms", phase: "agreement", owner: "consultant", label: "Report language, delivery route and walkthrough agreed with the client", hint: "English, Arabic or side-by-side; VIFM delivers the report, never the platform." },
    { key: "arc.results_policy", phase: "agreement", owner: "consultant", label: "Agreed whether respondents see their own results and whether results go to the client", hint: "Organisation settings: respondent can view results; send results to client." },
    { key: "arc.layers", phase: "agreement", owner: "consultant", label: "Optional layers decided: individual readiness, agentic-AI tier, talent lens", auto: "arc.layers" },
    { key: "arc.reassessment", phase: "agreement", owner: "bd", label: "Year-on-year reassessment discussed" },
    // ── Set-up ──
    { key: "arc.org", phase: "setup", owner: "admin", label: "Client organisation created", auto: "arc.org", link: () => "/admin/clients" },
    { key: "arc.assessment", phase: "setup", owner: "consultant", label: "Assessment created on the active question bank", auto: "arc.assessment" },
    { key: "arc.sandbox", phase: "setup", owner: "consultant", label: "Not marked as a sandbox", auto: "arc.sandbox" },
    { key: "arc.weights", phase: "setup", owner: "consultant", label: "Pillar weights set, or the defaults accepted", auto: "arc.weights" },
    { key: "arc.respondents", phase: "setup", owner: "client", label: "Respondents added with roles and pillar assignments", auto: "arc.respondents" },
    { key: "arc.invited", phase: "setup", owner: "consultant", label: "Invitations sent to every respondent", auto: "arc.invited" },
    { key: "arc.vouchers", phase: "setup", owner: "admin", label: "Practice-access vouchers issued, where the client uses them", hint: "Skip if respondents are invited directly." },
    // ── Delivery ──
    { key: "arc.active", phase: "delivery", owner: "consultant", label: "Assessment activated", auto: "arc.active" },
    { key: "arc.completion", phase: "delivery", owner: "consultant", label: "Every respondent has completed", auto: "arc.completion" },
    { key: "arc.reminders", phase: "delivery", owner: "consultant", label: "Silent respondents reminded", hint: "Respondents tab, Send reminder." },
    { key: "arc.materials", phase: "delivery", owner: "consultant", label: "Supporting materials from the client uploaded" },
    { key: "arc.phase2", phase: "delivery", owner: "consultant", label: "Phase 2 workshop held and consultant notes written", auto: "arc.notes", when: staged },
    { key: "arc.validated", phase: "delivery", owner: "consultant", label: "Validated scores entered where the workshop changed a self-rating", when: staged },
    // ── Reporting and close ──
    { key: "arc.completed", phase: "close", owner: "consultant", label: "Assessment marked completed", auto: "arc.completed" },
    { key: "arc.report", phase: "close", owner: "consultant", label: "Report generated and stored", auto: "arc.report" },
    { key: "arc.report_reviewed", phase: "close", owner: "consultant", label: "Report read in full by the consultant before delivery" },
    { key: "arc.delivered", phase: "close", owner: "consultant", label: "Report delivered to the client" },
    { key: "arc.walkthrough", phase: "close", owner: "consultant", label: "Walkthrough session held", when: staged },
    { key: "arc.frozen", phase: "close", owner: "admin", label: "Assessment frozen or archived", auto: "arc.frozen" },
    { key: "arc.invoice", phase: "close", owner: "bd", label: "Final invoice issued" },
    { key: "arc.next", phase: "close", owner: "bd", label: "Next year's reassessment scheduled" },
  ],
};

export const REFLECT_CHECKLIST: ChecklistDef = {
  service: "reflect",
  serviceLabel: "Reflect 360",
  items: [
    // ── Before the agreement ──
    { key: "reflect.need", phase: "before", owner: "client", label: "Client has supplied its values or leadership competencies, or chosen the VIFM library template" },
    { key: "reflect.region", phase: "before", owner: "bd", label: "Client region and sector confirmed", auto: "reflect.region" },
    { key: "reflect.proposal", phase: "before", owner: "bd", label: "Proposal issued and accepted", auto: "reflect.proposal", link: () => "/admin/proposals" },
    { key: "reflect.contact", phase: "before", owner: "bd", label: "Client contact named on the organisation", auto: "reflect.contact" },
    { key: "reflect.dpa", phase: "before", owner: "bd", label: "Data protection basis confirmed: rater answers are confidential and only reported in groups" },
    // ── The agreement ──
    { key: "reflect.sow", phase: "agreement", owner: "bd", label: "Agreement or statement of work signed" },
    { key: "reflect.rater_model", phase: "agreement", owner: "consultant", label: "Rater model agreed: who nominates raters, which roles, how many per group", hint: "Self, manager, peers and direct reports; the minimum per group protects anonymity." },
    { key: "reflect.anonymity", phase: "agreement", owner: "consultant", label: "Anonymity threshold set and explained to the client", auto: "reflect.anonymity" },
    { key: "reflect.language", phase: "agreement", owner: "consultant", label: "Form and report language agreed", auto: "reflect.language" },
    { key: "reflect.debrief_plan", phase: "agreement", owner: "consultant", label: "Debrief and development-plan follow-through agreed: who coaches, and when" },
    { key: "reflect.reassessment", phase: "agreement", owner: "bd", label: "Next-cycle reassessment discussed" },
    // ── Set-up ──
    { key: "reflect.org", phase: "setup", owner: "admin", label: "Client organisation on the platform", auto: "reflect.org", link: () => "/admin/clients" },
    { key: "reflect.sandbox", phase: "setup", owner: "consultant", label: "Not marked as a sandbox", auto: "reflect.sandbox" },
    { key: "reflect.framework", phase: "setup", owner: "consultant", label: "Framework built: each competency decomposed into observable behaviours", auto: "reflect.framework", link: (id) => `/reflect/consultant/engagements/${id}/framework-preview` },
    { key: "reflect.framework_approved", phase: "setup", owner: "consultant", label: "Framework reviewed and approved (this locks it for launch)", auto: "reflect.framework_approved", link: (id) => `/reflect/consultant/engagements/${id}` },
    { key: "reflect.participants", phase: "setup", owner: "client", label: "Participants nominated and added", auto: "reflect.participants" },
    { key: "reflect.raters", phase: "setup", owner: "client", label: "Every participant has a self rating, a manager and enough other raters", auto: "reflect.raters" },
    { key: "reflect.window", phase: "setup", owner: "consultant", label: "Field window set", auto: "reflect.window" },
    // ── Delivery ──
    { key: "reflect.launched", phase: "delivery", owner: "consultant", label: "Engagement launched", auto: "reflect.launched" },
    { key: "reflect.invited", phase: "delivery", owner: "consultant", label: "Every rater invited", auto: "reflect.invited" },
    { key: "reflect.completion", phase: "delivery", owner: "consultant", label: "Every rater has completed", auto: "reflect.completion" },
    { key: "reflect.reminders", phase: "delivery", owner: "consultant", label: "Silent raters reminded", auto: "reflect.reminders", hint: "Reminders go out automatically after 72 hours of silence; tick if chased another way." },
    // ── Reporting and close ──
    { key: "reflect.reports", phase: "close", owner: "consultant", label: "Participant report generated for everyone", auto: "reflect.reports" },
    { key: "reflect.cohort_report", phase: "close", owner: "consultant", label: "Cohort report generated", auto: "reflect.cohort_report", link: (id) => `/reflect/consultant/engagements/${id}/cohort-report` },
    { key: "reflect.debriefs", phase: "close", owner: "consultant", label: "Debrief held with every participant", auto: "reflect.debriefs" },
    { key: "reflect.idps", phase: "close", owner: "consultant", label: "Development plan agreed with every participant", auto: "reflect.idps" },
    { key: "reflect.delivered", phase: "close", owner: "consultant", label: "Cohort report delivered to the client sponsor" },
    { key: "reflect.closed", phase: "close", owner: "admin", label: "Engagement completed or archived", auto: "reflect.closed" },
    { key: "reflect.invoice", phase: "close", owner: "bd", label: "Final invoice issued" },
    { key: "reflect.next", phase: "close", owner: "bd", label: "Next cycle scheduled" },
  ],
};

export const PREHIRE_CHECKLIST: ChecklistDef = {
  service: "prehire",
  serviceLabel: "Pre-Hire",
  items: [
    // ── Before the agreement ──
    { key: "prehire.need", phase: "before", owner: "client", label: "Client has described the role and supplied the job description" },
    { key: "prehire.proposal", phase: "before", owner: "bd", label: "Proposal issued and accepted", auto: "prehire.proposal", link: () => "/admin/proposals" },
    { key: "prehire.recipient", phase: "before", owner: "bd", label: "Client recipient for the screening reports named", auto: "prehire.recipient" },
    { key: "prehire.dpa", phase: "before", owner: "bd", label: "Data protection basis and the candidate consent wording confirmed" },
    // ── The agreement ──
    { key: "prehire.sow", phase: "agreement", owner: "bd", label: "Agreement or statement of work signed" },
    { key: "prehire.guardrail", phase: "agreement", owner: "bd", label: "Client understands the composite is a screening signal, never a decision: the client decides" },
    { key: "prehire.plan", phase: "agreement", owner: "consultant", label: "Stage plan agreed: stages, weights and cut scores", auto: "prehire.plan" },
    { key: "prehire.profile", phase: "agreement", owner: "consultant", label: "Role profile or competencies bound to the requisition", auto: "prehire.profile" },
    { key: "prehire.english", phase: "agreement", owner: "consultant", label: "English requirement decided", auto: "prehire.english" },
    { key: "prehire.results_policy", phase: "agreement", owner: "consultant", label: "Agreed what candidates are told about the outcome and by whom" },
    // ── Set-up ──
    { key: "prehire.org", phase: "setup", owner: "admin", label: "Client organisation on the platform", auto: "prehire.org", link: () => "/admin/clients" },
    { key: "prehire.open", phase: "setup", owner: "admin", label: "Requisition open", auto: "prehire.open" },
    { key: "prehire.candidates", phase: "setup", owner: "client", label: "Candidates added", auto: "prehire.candidates" },
    { key: "prehire.vouchers", phase: "setup", owner: "admin", label: "Access codes issued, where the client distributes them itself", auto: "prehire.vouchers", hint: "Skip if candidates are invited directly by email." },
    { key: "prehire.invited", phase: "setup", owner: "admin", label: "Every candidate invited", auto: "prehire.invited" },
    { key: "prehire.consent", phase: "setup", owner: "client", label: "Every candidate has consented", auto: "prehire.consent" },
    // ── Delivery ──
    { key: "prehire.completed", phase: "delivery", owner: "consultant", label: "Every candidate has completed every stage", auto: "prehire.completed" },
    { key: "prehire.scored", phase: "delivery", owner: "consultant", label: "Composite score computed for every candidate", auto: "prehire.scored" },
    { key: "prehire.cbi_review", phase: "delivery", owner: "consultant", label: "AI interview transcripts and integrity flags reviewed by a person before any report goes out", link: (id) => `/admin/prehire/${id}` },
    { key: "prehire.fairness", phase: "delivery", owner: "consultant", label: "Fairness page reviewed: adverse impact and audit trail", link: (id) => `/admin/prehire/${id}/fairness` },
    // ── Reporting and close ──
    { key: "prehire.reports_sent", phase: "close", owner: "consultant", label: "Screening report sent to the client for every candidate", auto: "prehire.reports_sent" },
    { key: "prehire.export", phase: "close", owner: "admin", label: "ATS export taken, where the client wants one", auto: "prehire.export", hint: "Tick manually if the client does not want an export." },
    { key: "prehire.decisions", phase: "close", owner: "client", label: "Client decisions made and candidates informed by the client" },
    { key: "prehire.closed", phase: "close", owner: "admin", label: "Requisition closed", auto: "prehire.closed" },
    { key: "prehire.invoice", phase: "close", owner: "bd", label: "Final invoice issued" },
  ],
};

/**
 * The four voucher-based instruments share one process: the client buys
 * seats, codes are issued and sent, takers complete, results are reviewed and
 * delivered. Only the scope item and the links differ.
 */
function voucherChecklist(
  service: ChecklistService,
  serviceLabel: string,
  o: { scopeLabel: string; vouchersHref: string; cohortHref: string; reportsLabel: string; integrity?: boolean }
): ChecklistDef {
  const p = service;
  const items: ChecklistDef["items"] = [
    // ── Before the agreement ──
    { key: `${p}.need`, phase: "before", owner: "bd", label: "Client objective, cohort size and intended use of the results understood" },
    { key: `${p}.proposal`, phase: "before", owner: "bd", label: "Proposal issued and accepted", auto: `${p}.proposal`, link: () => "/admin/proposals" },
    { key: `${p}.contact`, phase: "before", owner: "bd", label: "Client contact recorded on the codes", auto: `${p}.contact` },
    { key: `${p}.dpa`, phase: "before", owner: "bd", label: "Data protection basis confirmed: takers' results and who may see them" },
    // ── The agreement ──
    { key: `${p}.sow`, phase: "agreement", owner: "bd", label: "Agreement or statement of work signed" },
    { key: `${p}.scope`, phase: "agreement", owner: "consultant", label: o.scopeLabel, auto: `${p}.scope` },
    { key: `${p}.results_policy`, phase: "agreement", owner: "consultant", label: "Agreed who receives results: the taker, the client, or both, and in what form" },
    { key: `${p}.language`, phase: "agreement", owner: "consultant", label: "Default language agreed", auto: `${p}.language` },
    // ── Set-up ──
    { key: `${p}.org`, phase: "setup", owner: "admin", label: "Client organisation on the platform and linked to the codes", auto: `${p}.org`, link: () => "/admin/clients" },
    { key: `${p}.seats`, phase: "setup", owner: "admin", label: "Codes issued with the agreed number of seats", auto: `${p}.seats`, link: () => o.vouchersHref },
    { key: `${p}.expiry`, phase: "setup", owner: "admin", label: "Expiry date set and still ahead", auto: `${p}.expiry` },
    { key: `${p}.codes_sent`, phase: "setup", owner: "admin", label: "Codes or links sent to the client, or to each delegate", hint: "Email the batch to the client contact, or the links to each delegate, from the vouchers page.", link: () => o.vouchersHref },
    { key: `${p}.briefing`, phase: "setup", owner: "client", label: "Takers briefed: what the assessment is, how long it takes, device and browser needs" },
    // ── Delivery ──
    { key: `${p}.redeemed`, phase: "delivery", owner: "consultant", label: "Every seat redeemed", auto: `${p}.redeemed` },
    { key: `${p}.completed`, phase: "delivery", owner: "consultant", label: "Every taker has completed", auto: `${p}.completed` },
    { key: `${p}.reminders`, phase: "delivery", owner: "consultant", label: "Non-starters chased through the client contact" },
  ];
  if (o.integrity) {
    items.push({ key: `${p}.integrity`, phase: "delivery", owner: "consultant", label: "Integrity flags reviewed before results go to the client", link: () => o.cohortHref });
  }
  items.push(
    // ── Reporting and close ──
    { key: `${p}.reports`, phase: "close", owner: "consultant", label: o.reportsLabel, auto: `${p}.reports`, link: () => o.cohortHref },
    { key: `${p}.cohort`, phase: "close", owner: "consultant", label: "Cohort view reviewed and shared with the client", link: () => o.cohortHref },
    { key: `${p}.debrief`, phase: "close", owner: "consultant", label: "Client debrief held" },
    { key: `${p}.closed`, phase: "close", owner: "admin", label: "Codes disabled or expired", auto: `${p}.closed`, link: () => o.vouchersHref },
    { key: `${p}.invoice`, phase: "close", owner: "bd", label: "Final invoice issued" }
  );
  return { service, serviceLabel, items };
}

export const PERSONA_CHECKLIST = voucherChecklist("persona", "Persona", {
  scopeLabel: "Purpose set (development or hiring) and the competency scope or role profile chosen",
  vouchersHref: "/ac/persona/vouchers",
  cohortHref: "/ac/persona/cohort",
  reportsLabel: "Report available for every completed sitting",
});

export const LOGICA_CHECKLIST = voucherChecklist("logica", "Logica", {
  scopeLabel: "Subtests in scope agreed",
  vouchersHref: "/ac/cognitive/vouchers",
  cohortHref: "/ac/cognitive/cohort",
  reportsLabel: "Report available for every completed sitting",
});

export const FLUENT_CHECKLIST = voucherChecklist("fluent", "Fluent", {
  scopeLabel: "Proctoring decided",
  vouchersHref: "/ac/fluent/vouchers",
  cohortHref: "/ac/fluent/cohort",
  reportsLabel: "Results and certificate emailed to every taker",
  integrity: true,
});

export const TECHNO_CHECKLIST = voucherChecklist("techno", "Techno", {
  scopeLabel: "Function and talent lens chosen",
  vouchersHref: "/admin/tech-sandbox/vouchers",
  cohortHref: "/admin/tech-sandbox/results",
  reportsLabel: "Report stored for every submitted session",
  integrity: true,
});

export const CHECKLISTS: Record<ChecklistService, ChecklistDef> = {
  ac: AC_CHECKLIST,
  arc: ARC_CHECKLIST,
  reflect: REFLECT_CHECKLIST,
  prehire: PREHIRE_CHECKLIST,
  persona: PERSONA_CHECKLIST,
  logica: LOGICA_CHECKLIST,
  fluent: FLUENT_CHECKLIST,
  techno: TECHNO_CHECKLIST,
};

export function isChecklistService(v: string): v is ChecklistService {
  return Object.prototype.hasOwnProperty.call(CHECKLISTS, v);
}
