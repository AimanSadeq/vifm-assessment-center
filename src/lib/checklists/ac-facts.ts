/**
 * What the platform knows about one Assessment Center engagement, as checklist
 * facts. Reuses the same review functions the engagement page uses (design
 * record, centre roles, staffing, timetable, feedback), so a tick here means
 * exactly what the panel on the engagement page means.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistFacts } from "./types";
import { reviewDesignRecord } from "@/lib/ac/design-record";
import { reviewCentreRoles } from "@/lib/ac/centre-roles-review";
import { reviewStaffing } from "@/lib/ac/staffing";
import { reviewTimetable } from "@/lib/ac/timetable";
import { reviewFeedback } from "@/lib/ac/feedback";
import { buildJoiningPack, type PackEngagement, type PackExercise } from "@/lib/ac/joining-pack";
import { packNoticeDays, PACK_NOTICE_DAYS } from "@/lib/ac/participant-rules";

type Row = Record<string, unknown>;

export type AcChecklistSubject = {
  id: string;
  name: string;
  status: string;
  organisationName: string | null;
  startDate: string | null;
  endDate: string | null;
  purpose: string | null;
};

const safe = <T,>(p: PromiseLike<{ data: T[] | null }>, fallback: T[] = []) =>
  Promise.resolve(p).then((r) => (r.data ?? fallback) as T[], () => fallback);

export async function loadAcChecklistFacts(
  sb: SupabaseClient,
  engagementId: string
): Promise<{ subject: AcChecklistSubject; facts: ChecklistFacts } | null> {
  const { data: eng } = await sb.from("engagements").select("*, organizations(name)").eq("id", engagementId).maybeSingle();
  if (!eng) return null;
  const e = eng as Row;
  const orgId = (e.organization_id as string | null) ?? null;

  const [candidates, comps, exRows, matrix, roleRows, assignments, oars, reports, consents, slots, feedbackRows, review, followups, deliveryLog, proposals] = await Promise.all([
    safe<Row>(sb.from("candidates").select("id, full_name, adjustment_status, decision_communicated_at").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("engagement_competencies").select("competency_id, rationale, source, competencies(name)").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("engagement_exercises").select("exercise_id, exercises(id, name, exercise_type, duration_minutes)").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("exercise_competency_matrix").select("exercise_id, competency_id").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("ac_engagement_roles").select("role_key, profile_id, is_external").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("assessor_assignments").select("assessor_id, candidate_id, exercise_id").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("overall_assessment_ratings").select("candidate_id").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("candidate_reports").select("candidate_id, status").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("consent_records").select("candidate_id, consent_type, consented")),
    safe<Row>(sb.from("ac_schedule_slots").select("id, kind, exercise_id, candidate_id, assessor_id, starts_at, ends_at, room").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("ac_feedback_records").select("candidate_id, form, delivered_at, delivered_by_name, deliverer_trained, summary, acknowledged_at").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("ac_centre_reviews").select("completed_at").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("ac_outcome_followups").select("id").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("ac_delivery_log").select("id").eq("engagement_id", engagementId)),
    orgId ? safe<Row>(sb.from("proposals").select("status").eq("organization_id", orgId)) : Promise.resolve([] as Row[]),
  ]);

  const candidateIds = candidates.map((c) => c.id as string);
  const exercises = exRows.map((x) => x.exercises as unknown as Row | null).filter((x): x is Row => Boolean(x));
  const exerciseTypes = exercises.map((x) => x.exercise_type as string).filter(Boolean);

  const competenceRows = roleRows.length
    ? await safe<Row>(sb.from("ac_role_competence").select("profile_id, role_key, status, expires_on").in("profile_id", Array.from(new Set(roleRows.map((r) => r.profile_id as string)))))
    : [];

  const indicatorRows = comps.length
    ? await safe<Row>(sb.from("behavioral_indicators").select("competency_id").in("competency_id", comps.map((c) => c.competency_id as string)))
    : [];
  const indicatorCount = new Map<string, number>();
  for (const i of indicatorRows) indicatorCount.set(i.competency_id as string, (indicatorCount.get(i.competency_id as string) ?? 0) + 1);

  const design = reviewDesignRecord({
    engagement: e as never,
    competencies: comps.map((c) => {
      const comp = c.competencies as { name?: string } | { name?: string }[] | null;
      return {
        competencyId: c.competency_id as string,
        name: (Array.isArray(comp) ? comp[0]?.name : comp?.name) ?? "Unnamed",
        rationale: (c.rationale as string | null) ?? null,
        source: (c.source as string | null) ?? null,
        indicatorCount: indicatorCount.get(c.competency_id as string) ?? 0,
      };
    }),
    exercises: exercises.map((x) => ({
      id: x.id as string,
      name: x.name as string,
      exerciseType: (x.exercise_type as string | null) ?? null,
      durationMinutes: (x.duration_minutes as number | null) ?? null,
    })),
    matrix: matrix.map((m) => ({ exerciseId: m.exercise_id as string, competencyId: m.competency_id as string })),
  });
  const designProblems = design.thinlyObserved.length + design.withoutIndicators.length + design.withoutRationale.length;

  const roles = reviewCentreRoles({
    purpose: (e.purpose as string | null) ?? null,
    usesRolePlay: exerciseTypes.includes("role_play"),
    usesFactFind: exerciseTypes.includes("case_study"),
    assignments: roleRows.map((r) => ({ role_key: r.role_key as string, profile_id: r.profile_id as string, is_external: Boolean(r.is_external) })),
    competence: competenceRows.map((c) => ({ profile_id: c.profile_id as string, role_key: c.role_key as string, status: c.status as string, expires_on: (c.expires_on as string | null) ?? null })),
  });

  const staffing = reviewStaffing({
    candidateIds,
    assignments: assignments.map((a) => ({ assessorId: a.assessor_id as string, candidateId: a.candidate_id as string, exerciseId: (a.exercise_id as string | null) ?? null })),
  });

  const assessorIds = Array.from(new Set(assignments.map((a) => a.assessor_id as string)));
  const timetable = reviewTimetable({
    slots: slots.map((s) => ({
      id: s.id as string,
      kind: s.kind as "exercise" | "briefing" | "break" | "lunch" | "washup" | "feedback" | "other",
      exerciseId: (s.exercise_id as string | null) ?? null,
      candidateId: (s.candidate_id as string | null) ?? null,
      assessorId: (s.assessor_id as string | null) ?? null,
      startsAt: s.starts_at as string,
      endsAt: s.ends_at as string,
      room: (s.room as string | null) ?? null,
    })),
    participants: candidates.map((c) => ({ id: c.id as string, name: c.full_name as string })),
    assessors: assessorIds.map((id) => ({ id, name: id })),
    designExercises: exercises.map((x) => ({ id: x.id as string, name: x.name as string })),
  });

  const rated = new Set(oars.map((o) => o.candidate_id as string));
  const feedback = reviewFeedback({
    purpose: (e.purpose as string | null) ?? null,
    centreEndDate: (e.end_date as string | null) ?? null,
    participants: candidates.map((c) => ({ candidateId: c.id as string, name: c.full_name as string, rated: rated.has(c.id as string) })),
    records: feedbackRows.map((f) => ({
      candidateId: f.candidate_id as string,
      form: f.form as "written_report" | "oral" | "both",
      deliveredAt: f.delivered_at as string,
      deliveredByName: f.delivered_by_name as string,
      delivererTrained: Boolean(f.deliverer_trained),
      hasSummary: Boolean(f.summary),
      acknowledgedAt: (f.acknowledged_at as string | null) ?? null,
    })),
  });

  const pack = buildJoiningPack(e as PackEngagement, exercises as unknown as PackExercise[]);
  const consented = new Set(consents.filter((c) => c.consented && c.consent_type === "assessment_participation" && candidateIds.includes(c.candidate_id as string)).map((c) => c.candidate_id as string));
  const released = reports.filter((r) => r.status === "released").length;
  const decided = candidates.filter((c) => c.decision_communicated_at).length;
  const requestedAdjustments = candidates.filter((c) => c.adjustment_status === "requested").length;
  const won = proposals.some((p) => p.status === "won");
  const issued = proposals.some((p) => p.status === "issued");
  const noticeGiven = e.pack_published_at ? packNoticeDays((e.start_date as string | null) ?? null, e.pack_published_at as string) : null;
  const n = candidates.length;
  const status = String(e.status ?? "draft");
  const plan = e.evaluation_plan as Record<string, unknown> | null;

  const facts: ChecklistFacts = {
    "ac.proposal": { done: won, detail: won ? "Proposal won" : issued ? "Proposal issued, not yet accepted" : orgId ? "No proposal for this organisation" : "No organisation" },
    "ac.purpose": { done: Boolean(e.purpose), detail: (e.purpose as string | null) ?? "Not set" },
    "ac.plan_approved": { done: Boolean(e.plan_approved_at), detail: e.plan_approved_at ? `Agreed by ${(e.plan_approved_client_name as string | null) ?? "the client"}` : "Not yet agreed" },
    "ac.weights": { done: Boolean(e.weights_confirmed_at), detail: e.weights_confirmed_at ? "Confirmed" : "Not confirmed" },
    "ac.recipients": { done: Boolean(e.pack_report_recipients), detail: e.pack_report_recipients ? String(e.pack_report_recipients).slice(0, 80) : "Not named" },
    "ac.feedback_spec": { done: Boolean(e.pack_feedback_offer), detail: (e.pack_feedback_offer as string | null) ?? "Not specified" },
    "ac.eval_plan": { done: Boolean(plan), detail: plan ? [plan.validation && "validation", plan.reaction && "reaction", plan.utility && "utility"].filter(Boolean).join(", ") || "Agreed: none of the studies" : "Not agreed" },
    "ac.org": { done: Boolean(orgId), detail: orgId ? undefined : "No organisation on the engagement" },
    "ac.design": { done: design.missing.length === 0 && designProblems === 0, detail: design.missing.length || designProblems ? `${design.missing.length} unwritten, ${designProblems} problem${designProblems === 1 ? "" : "s"}` : "Complete" },
    "ac.roles": { done: roles.blocking.length === 0 && roleRows.length > 0, detail: roleRows.length === 0 ? "No roles assigned" : roles.blocking.length ? roles.blocking[0] : "All assigned and competent" },
    "ac.staffing": { done: n > 0 && assignments.length > 0 && staffing.blocking.length === 0, detail: assignments.length === 0 ? "No assessor assignments" : staffing.blocking.length ? staffing.blocking[0] : `${staffing.assessors} assessors for ${staffing.participants}` },
    "ac.candidates": { done: n > 0, detail: `${n} participant${n === 1 ? "" : "s"}` },
    "ac.pack": { done: Boolean(e.pack_published_at) && (noticeGiven === null || noticeGiven >= PACK_NOTICE_DAYS || Boolean(e.pack_late_reason)), detail: e.pack_published_at ? (noticeGiven !== null ? `Published with ${noticeGiven} days' notice${noticeGiven < PACK_NOTICE_DAYS ? (e.pack_late_reason ? ", reason recorded" : ", no reason recorded") : ""}` : "Published") : pack.missing.length ? `${pack.missing.length} item${pack.missing.length === 1 ? "" : "s"} still missing` : "Complete, not published" },
    "ac.consent": { done: n > 0 && consented.size === n, detail: `${consented.size} of ${n} consented` },
    "ac.adjustments": { done: requestedAdjustments === 0, detail: requestedAdjustments ? `${requestedAdjustments} request${requestedAdjustments === 1 ? "" : "s"} waiting` : "None waiting" },
    "ac.timetable": { done: slots.length > 0 && timetable.blocking.length === 0, detail: slots.length === 0 ? "No timetable" : timetable.blocking.length ? `${timetable.blocking.length} clash${timetable.blocking.length === 1 ? "" : "es"}` : `${slots.length} slots, no clashes` },
    "ac.activated": { done: status === "active" || status === "completed" || status === "archived", detail: status },
    "ac.delivery_log": { done: deliveryLog.length > 0, detail: deliveryLog.length ? `${deliveryLog.length} entr${deliveryLog.length === 1 ? "y" : "ies"}` : "No entries" },
    "ac.rated": { done: n > 0 && rated.size === n, detail: `${rated.size} of ${n} rated` },
    "ac.reports": { done: rated.size > 0 && released >= rated.size, detail: `${released} of ${rated.size} released` },
    "ac.feedback_given": { done: rated.size > 0 && feedback.owed.length === 0, detail: feedback.owed.length ? `${feedback.owed.length} owed` : rated.size ? "All given" : "Nobody rated yet" },
    "ac.decisions": { done: n > 0 && decided === n, detail: `${decided} of ${n} communicated` },
    "ac.review": { done: review.some((r) => r.completed_at), detail: review.some((r) => r.completed_at) ? "Completed" : "Not completed" },
    "ac.followups": { done: followups.length > 0, detail: followups.length ? `${followups.length} scheduled` : "None scheduled" },
  };

  const org = e.organizations as { name?: string } | { name?: string }[] | null;
  return {
    subject: {
      id: engagementId,
      name: String(e.name ?? "Engagement"),
      status,
      organisationName: (Array.isArray(org) ? org[0]?.name : org?.name) ?? null,
      startDate: (e.start_date as string | null) ?? null,
      endDate: (e.end_date as string | null) ?? null,
      purpose: (e.purpose as string | null) ?? null,
    },
    facts,
  };
}
