/**
 * What the platform knows about one AI Readiness Compass assessment, as
 * checklist facts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistFacts } from "./types";
import { ARA_STAGE_MAP, getPillarsForAssessment } from "@/lib/constants/ara-stages";

type Row = Record<string, unknown>;

export type ArcChecklistSubject = {
  id: string;
  name: string;
  status: string;
  organisationName: string | null;
  stage: string;
  year: number | null;
  consultantId: string | null;
};

const safe = <T,>(p: PromiseLike<{ data: T[] | null }>, fallback: T[] = []) =>
  Promise.resolve(p).then((r) => (r.data ?? fallback) as T[], () => fallback);

export async function loadArcChecklistFacts(
  sb: SupabaseClient,
  assessmentId: string
): Promise<{ subject: ArcChecklistSubject; facts: ChecklistFacts } | null> {
  const { data: a } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, region, sector, client_contact_name, client_contact_email)")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!a) return null;
  const e = a as Row;
  const org = (e.organization as Row | null) ?? null;
  const orgId = (e.organization_id as string | null) ?? null;

  const [respondents, notes, reports, proposals] = await Promise.all([
    safe<Row>(sb.from("ara_respondents").select("id, invited_at, completed_at, individual_only").eq("assessment_id", assessmentId)),
    safe<Row>(sb.from("ara_consultant_notes").select("id").eq("assessment_id", assessmentId)),
    safe<Row>(sb.from("ara_reports").select("id, language, generated_at").eq("assessment_id", assessmentId)),
    orgId ? safe<Row>(sb.from("proposals").select("status").eq("ara_organization_id", orgId)) : Promise.resolve([] as Row[]),
  ]);

  const stage = String(e.engagement_stage ?? "");
  const pillars = getPillarsForAssessment({ engagement_stage: stage as never, pillars_in_scope: (e.pillars_in_scope as never) ?? null });
  const n = respondents.length;
  const invited = respondents.filter((r) => r.invited_at).length;
  const completed = respondents.filter((r) => r.completed_at).length;
  const status = String(e.status ?? "draft");
  const won = proposals.some((p) => p.status === "won");
  const issued = proposals.some((p) => p.status === "issued");
  const weights = e.pillar_weights as Record<string, unknown> | null;
  const layers = [e.include_individual_layer && "individual", e.include_agentic_layer && "agentic", e.talent_lens && `lens: ${String(e.talent_lens)}`].filter(Boolean);

  const facts: ChecklistFacts = {
    "arc.region": { done: Boolean(org?.region && org?.sector), detail: org ? `${String(org.region ?? "?")}, ${String(org.sector ?? "?")}` : "No organisation" },
    "arc.stage": { done: Boolean(stage), detail: stage ? `${ARA_STAGE_MAP[stage as keyof typeof ARA_STAGE_MAP]?.label_en ?? stage}: ${pillars.length} pillars` : "Not set" },
    "arc.proposal": { done: won, detail: won ? "Proposal won" : issued ? "Proposal issued, not yet accepted" : orgId ? "No proposal for this organisation" : "No organisation" },
    "arc.contact": { done: Boolean(org?.client_contact_name || org?.client_contact_email), detail: org?.client_contact_name ? String(org.client_contact_name) : "No contact on the organisation" },
    "arc.layers": { done: true, detail: layers.length ? layers.join(", ") : "Pillars only" },
    "arc.org": { done: Boolean(orgId), detail: org?.name ? String(org.name) : "No organisation" },
    "arc.assessment": { done: Boolean(e.question_bank_version_id), detail: e.question_bank_version_id ? "On a pinned question bank" : "No question bank pinned" },
    "arc.sandbox": { done: !e.is_sandbox, detail: e.is_sandbox ? "Marked as sandbox: results will be purged" : "Live assessment" },
    "arc.weights": { done: true, detail: weights && Object.keys(weights).length ? "Custom weights" : "Default weights" },
    "arc.respondents": { done: n > 0, detail: `${n} respondent${n === 1 ? "" : "s"}` },
    "arc.invited": { done: n > 0 && invited === n, detail: `${invited} of ${n} invited` },
    "arc.active": { done: status !== "draft", detail: status },
    "arc.completion": { done: n > 0 && completed === n, detail: `${completed} of ${n} completed` },
    "arc.notes": { done: notes.length > 0, detail: notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}` : "No consultant notes" },
    "arc.completed": { done: status === "completed" || status === "frozen" || Boolean(e.archived_at), detail: status },
    "arc.report": { done: reports.length > 0, detail: reports.length ? `${reports.length} version${reports.length === 1 ? "" : "s"} stored` : "Not generated" },
    "arc.frozen": { done: status === "frozen" || Boolean(e.archived_at), detail: e.archived_at ? "Archived" : status },
  };

  return {
    subject: {
      id: assessmentId,
      name: [org?.name ? String(org.name) : "Assessment", e.scope_label ? String(e.scope_label) : null, e.assessment_year ? String(e.assessment_year) : null].filter(Boolean).join(" - "),
      status,
      organisationName: org?.name ? String(org.name) : null,
      stage,
      year: (e.assessment_year as number | null) ?? null,
      consultantId: (e.consultant_id as string | null) ?? null,
    },
    facts,
  };
}
