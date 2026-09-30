/**
 * What the platform knows about one Reflect 360 engagement, as checklist facts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistFacts } from "./types";

type Row = Record<string, unknown>;

export type ReflectChecklistSubject = {
  id: string;
  name: string;
  status: string;
  organisationName: string | null;
  consultantId: string | null;
};

const safe = <T,>(p: PromiseLike<{ data: T[] | null }>, fallback: T[] = []) =>
  Promise.resolve(p).then((r) => (r.data ?? fallback) as T[], () => fallback);

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function loadReflectChecklistFacts(
  sb: SupabaseClient,
  engagementId: string
): Promise<{ subject: ReflectChecklistSubject; facts: ChecklistFacts } | null> {
  const { data: e0 } = await sb
    .from("reflect_engagements")
    .select("*, organization:ara_organizations(id, name, region, sector, client_contact_name, client_contact_email)")
    .eq("id", engagementId)
    .maybeSingle();
  if (!e0) return null;
  const e = e0 as Row;
  const org = (e.organization as Row | null) ?? null;
  const orgId = (e.organization_id as string | null) ?? null;
  const status = String(e.status ?? "draft");
  const minN = Number(e.anonymity_min_n ?? 3);

  const [frameworks, participants, raters, emails, reports, proposals] = await Promise.all([
    safe<Row>(sb.from("reflect_frameworks").select("id, approved_at").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("reflect_participants").select("id, status, debrief_status").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("reflect_raters").select("id, participant_id, rater_role, status, invited_at, completed_at").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("reflect_email_log").select("email_type, status").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("reflect_reports").select("report_kind, participant_id").eq("engagement_id", engagementId)),
    orgId ? safe<Row>(sb.from("proposals").select("status").eq("ara_organization_id", orgId)) : Promise.resolve([] as Row[]),
  ]);

  const frameworkIds = frameworks.map((f) => String(f.id));
  const competencies = frameworkIds.length ? await safe<Row>(sb.from("reflect_competencies").select("id").in("framework_id", frameworkIds)) : [];
  const compIds = competencies.map((c) => String(c.id));
  const behaviours = compIds.length ? await safe<Row>(sb.from("reflect_behaviors").select("id").in("competency_id", compIds)) : [];
  const participantIds = participants.map((p) => String(p.id));
  const idps = participantIds.length ? await safe<Row>(sb.from("reflect_idps").select("participant_id, status").in("participant_id", participantIds)) : [];

  const nP = participants.length;
  const nR = raters.length;
  const invited = raters.filter((r) => r.invited_at).length;
  const completed = raters.filter((r) => r.status === "completed" || r.completed_at).length;
  const short = participants.filter((p) => {
    const mine = raters.filter((r) => r.participant_id === p.id);
    const self = mine.some((r) => r.rater_role === "self");
    const manager = mine.some((r) => r.rater_role === "manager");
    const others = mine.filter((r) => r.rater_role !== "self" && r.rater_role !== "manager").length;
    return !(self && manager && others >= minN);
  }).length;
  const approved = frameworks.some((f) => f.approved_at) || Boolean(e.framework_approved_at);
  const invitationsLogged = emails.filter((m) => m.email_type === "reflect_rater_invitation" && m.status !== "failed").length;
  const reminders = emails.filter((m) => m.email_type === "reflect_rater_reminder" && m.status !== "failed").length;
  const participantReports = new Set(reports.filter((r) => r.report_kind === "participant" && r.participant_id).map((r) => String(r.participant_id))).size;
  const cohortReport = reports.some((r) => r.report_kind === "cohort");
  const debriefed = participants.filter((p) => p.debrief_status === "completed").length;
  const idpAgreed = new Set(idps.filter((i) => i.status && i.status !== "draft").map((i) => String(i.participant_id))).size;
  const won = proposals.some((p) => p.status === "won");
  const issued = proposals.some((p) => p.status === "issued");
  const live = status === "live" || status === "scoring" || status === "complete" || status === "archived";
  const closed = status === "complete" || status === "archived" || Boolean(e.archived_at) || Boolean(e.closed_at);

  const facts: ChecklistFacts = {
    "reflect.region": { done: Boolean(org?.region && org?.sector), detail: org ? `${String(org.region ?? "?")}, ${String(org.sector ?? "?")}` : "No organisation" },
    "reflect.proposal": { done: won, detail: won ? "Proposal won" : issued ? "Proposal issued, not yet accepted" : orgId ? "No proposal for this organisation" : "No organisation" },
    "reflect.contact": { done: Boolean(org?.client_contact_name || org?.client_contact_email), detail: org?.client_contact_name ? String(org.client_contact_name) : "No contact on the organisation" },
    "reflect.language": { done: true, detail: `Report: ${String(e.report_language ?? "bilingual")}; form: ${String(e.default_language ?? "en")}` },
    "reflect.anonymity": { done: minN >= 3, detail: `${minN} raters per group before scores show${minN < 3 ? " (below the usual 3)" : ""}` },
    "reflect.org": { done: Boolean(orgId), detail: org?.name ? String(org.name) : "No organisation" },
    "reflect.sandbox": { done: !e.is_sandbox, detail: e.is_sandbox ? "Marked as sandbox: results will be purged" : "Live engagement" },
    "reflect.framework": { done: compIds.length > 0 && behaviours.length > 0, detail: compIds.length ? `${count(compIds.length, "competency", "competencies")}, ${count(behaviours.length, "behaviour")}` : "No framework yet" },
    "reflect.framework_approved": { done: approved, detail: approved ? "Approved" : "Not approved: launch is blocked" },
    "reflect.participants": { done: nP > 0, detail: count(nP, "participant") + (e.participant_target_count ? ` of ${String(e.participant_target_count)} planned` : "") },
    "reflect.raters": { done: nP > 0 && short === 0, detail: nP === 0 ? "No participants" : short === 0 ? `${count(nR, "rater")}; every participant has self, manager and at least ${minN} others` : `${short} of ${nP} participants short of self + manager + ${minN} others` },
    "reflect.window": { done: Boolean(e.field_window_start && e.field_window_end), detail: e.field_window_start ? `${String(e.field_window_start)} to ${String(e.field_window_end ?? "?")}` : "No field window set" },
    "reflect.launched": { done: live, detail: e.launched_at ? `Launched ${String(e.launched_at).slice(0, 10)}` : status },
    "reflect.invited": { done: nR > 0 && (invited === nR || invitationsLogged >= nR), detail: `${Math.max(invited, Math.min(invitationsLogged, nR))} of ${nR} invited` },
    "reflect.completion": { done: nR > 0 && completed === nR, detail: `${completed} of ${nR} raters completed` },
    "reflect.reminders": { done: reminders > 0 || (nR > 0 && completed === nR), detail: reminders ? count(reminders, "reminder") + " sent" : "No reminders sent" },
    "reflect.reports": { done: nP > 0 && participantReports >= nP, detail: `${participantReports} of ${nP} participant reports generated` },
    "reflect.cohort_report": { done: cohortReport, detail: cohortReport ? "Generated" : "Not generated" },
    "reflect.debriefs": { done: nP > 0 && debriefed === nP, detail: `${debriefed} of ${nP} debriefs held` },
    "reflect.idps": { done: nP > 0 && idpAgreed === nP, detail: `${idpAgreed} of ${nP} development plans agreed` },
    "reflect.closed": { done: closed, detail: e.archived_at ? "Archived" : status },
  };

  return {
    subject: {
      id: engagementId,
      name: String(e.name ?? "Reflect 360 engagement"),
      status,
      organisationName: org?.name ? String(org.name) : null,
      consultantId: (e.consultant_id as string | null) ?? null,
    },
    facts,
  };
}
