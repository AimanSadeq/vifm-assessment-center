/**
 * What the centre agreement can say for itself, from the engagement as designed.
 *
 * The agreement (VIFM Assessment Centre Agreement and Statement of Work) is the
 * document the BPS standard requires between VIFM and the client (3.21-3.30,
 * 5.10). Most of its answers already live in Caliber: the purpose, the
 * criteria and weights, the exercises, the rating rule, who receives reports,
 * feedback, retention. Re-typing them into Word is how an agreement drifts
 * from the centre it describes, so they are read from the engagement here.
 *
 * This module is pure and decides only WHAT is known. Anything it cannot know
 * (commercial terms, the client's legal name, dates the design has not set)
 * comes back as null, and the document shows a yellow fill-in in its place.
 * It never invents an answer: a missing value stays visibly missing.
 */

import { APPEAL_WINDOW_DAYS, PACK_NOTICE_DAYS, packNoticeDays } from "@/lib/ac/participant-rules";
import { centreRoleName } from "@/lib/ac/centre-roles";

export type AgreementInput = {
  engagement: Record<string, unknown>;
  organisationName: string | null;
  competencies: { name: string; weight: number | null }[];
  exercises: { name: string; exerciseType: string | null; durationMinutes: number | null; competencies: string[] }[];
  roles: { roleKey: string; name: string; isExternal: boolean }[];
  participantCount: number;
  contentApproved: { approved: number; total: number } | null;
  generatedAt: string;
};

export type Purpose = "selection" | "development" | "succession" | null;
export type RatingRule = "calculated" | "discussed" | null;

export type AgreementPrefill = {
  clientName: string | null;
  centreName: string;
  purpose: Purpose;
  ratingRule: RatingRule;
  weightsConfirmedOn: string | null;
  weights: { competency: string; weight: string }[];
  exercises: { name: string; type: string; competencies: string; minutes: string | null }[];
  designRationale: string | null;
  alternativesConsidered: string | null;
  needSummary: string | null;
  jobAnalysis: string | null;
  decisions: string | null;
  decisionTiming: string | null;
  targetRole: string | null;
  participants: number | null;
  centreDates: string | null;
  delivery: string | null;
  otherInstruments: { kind: "context_only" | "documented_conversion"; note: string | null } | null;
  externalEvidence: { permitted: boolean; framework: string | null } | null;
  recipients: string | null;
  feedback: { provided: string | null; form: string | null; when: string | null; mandatory: boolean };
  researchUse: boolean | null;
  retentionMonths: number;
  appealWindowDays: number;
  packNoticeDays: number;
  packPublished: { on: string; noticeGiven: number | null; lateReason: string | null } | null;
  clientAppealProcedure: string | null;
  fairnessApplies: boolean | null;
  contentStatus: string | null;
  planApproval: string | null;
  participantContact: { name: string | null; email: string | null };
  centreManager: string | null;
  roleCounts: { role: string; providedBy: string; count: number }[];
  facilities: string | null;
};

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  in_basket: "In-basket",
  role_play: "Role play",
  group_exercise: "Group exercise",
  case_study: "Case study",
  oral_presentation: "Oral presentation",
  competency_based_interview: "Competency-based interview",
};

const FEEDBACK_FORM: Record<string, string> = {
  written_report: "Written report",
  verbal_debrief: "Oral debrief",
  both: "Written report and oral debrief",
};

const text = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s ? s : null;
};

export const fmtAgreementDate = (v: unknown): string | null => {
  if (!v) return null;
  const raw = String(v);
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

function purposeOf(v: unknown): Purpose {
  return v === "selection" || v === "development" || v === "succession" ? v : null;
}

export function buildAgreementPrefill(input: AgreementInput): AgreementPrefill {
  const e = input.engagement;
  const purpose = purposeOf(e.purpose);

  // Same resolution as the scoring library: an explicit method wins; without
  // one, selection is calculated and everything else is discussed.
  const method = text(e.integration_method);
  const ratingRule: RatingRule =
    method === "weighted_average" ? "calculated"
      : method === "consensus" ? "discussed"
        : purpose === "selection" ? "calculated"
          : purpose ? "discussed" : null;

  const start = fmtAgreementDate(e.start_date);
  const end = fmtAgreementDate(e.end_date);
  const centreDates = start && end && start !== end ? `${start} to ${end}` : start ?? end;

  const otherRule = text(e.other_methods_rule);
  const extRule = text(e.external_evidence_rule);

  const offer = text(e.pack_feedback_offer);
  const mandatory = purpose === "development" || purpose === "succession";
  const provided = offer === null ? null : offer === "none" ? "No" : "Yes";

  const publishedAt = text(e.pack_published_at);

  const approved = input.contentApproved;
  const contentStatus = approved && approved.total > 0
    ? approved.approved === approved.total
      ? `All ${approved.total} behavioural indicators used at this centre have been approved by a subject-matter expert (at ${input.generatedAt}).`
      : `${approved.approved} of ${approved.total} behavioural indicators used at this centre have been approved by a subject-matter expert so far (at ${input.generatedAt}). Until review is complete, results are indicative.`
    : null;

  const counts = new Map<string, { role: string; providedBy: Set<string>; count: number }>();
  for (const r of input.roles) {
    const key = r.roleKey;
    const row = counts.get(key) ?? { role: centreRoleName(key), providedBy: new Set<string>(), count: 0 };
    row.count += 1;
    // is_external means "outside VIFM" (a client manager as role-player, say),
    // not necessarily the Client, so the agreement says exactly that.
    row.providedBy.add(r.isExternal ? "Outside VIFM" : "VIFM");
    counts.set(key, row);
  }
  const manager = input.roles.find((r) => r.roleKey === "centre_manager");

  return {
    clientName: input.organisationName,
    centreName: text(e.name) ?? "Assessment centre",
    purpose,
    ratingRule,
    weightsConfirmedOn: fmtAgreementDate(e.weights_confirmed_at),
    weights: input.competencies.map((c) => ({ competency: c.name, weight: c.weight == null ? "1" : String(c.weight) })),
    exercises: input.exercises.map((x) => ({
      name: x.name,
      type: EXERCISE_TYPE_LABELS[x.exerciseType ?? ""] ?? x.exerciseType ?? "",
      competencies: x.competencies.join(", "),
      minutes: x.durationMinutes ? String(x.durationMinutes) : null,
    })),
    designRationale: text(e.design_rationale),
    alternativesConsidered: text(e.alternatives_considered),
    needSummary: text(e.pack_purpose_statement),
    jobAnalysis: text(e.job_analysis_note) ?? text(e.job_analysis_method),
    decisions: text(e.pack_decisions),
    decisionTiming: text(e.pack_decision_timing),
    targetRole: text(e.target_role),
    participants: input.participantCount > 0 ? input.participantCount : null,
    centreDates,
    delivery: text(e.pack_location),
    otherInstruments:
      otherRule === "context_only" || otherRule === "documented_conversion"
        ? { kind: otherRule, note: text(e.other_methods_note) }
        : null,
    externalEvidence:
      extRule === "permitted" ? { permitted: true, framework: text(e.external_evidence_framework) }
        : extRule === "not_permitted" ? { permitted: false, framework: null }
          : null,
    recipients: text(e.pack_report_recipients),
    feedback: {
      provided,
      form: offer && offer !== "none" ? FEEDBACK_FORM[offer] ?? offer : null,
      when: text(e.pack_feedback_when),
      mandatory,
    },
    researchUse: typeof e.research_use === "boolean" ? e.research_use : null,
    retentionMonths: typeof e.retention_months === "number" ? e.retention_months : 24,
    appealWindowDays: APPEAL_WINDOW_DAYS,
    packNoticeDays: PACK_NOTICE_DAYS,
    packPublished: publishedAt
      ? {
          on: fmtAgreementDate(publishedAt) ?? publishedAt,
          noticeGiven: packNoticeDays(text(e.start_date), publishedAt),
          lateReason: text(e.pack_late_reason),
        }
      : null,
    clientAppealProcedure: text(e.appeals_note),
    fairnessApplies: purpose === null ? null : purpose !== "development",
    contentStatus,
    planApproval: e.plan_approved_at
      ? `agreed with ${text(e.plan_approved_client_name) ?? "the Client"} on ${fmtAgreementDate(e.plan_approved_at)}`
      : null,
    participantContact: { name: text(e.participant_contact_name), email: text(e.participant_contact_email) },
    centreManager: manager ? manager.name : null,
    roleCounts: Array.from(counts.values()).map((r) => ({
      role: r.role,
      providedBy: Array.from(r.providedBy).sort().join(" and "),
      count: r.count,
    })),
    facilities: text(e.facilities_note),
  };
}
