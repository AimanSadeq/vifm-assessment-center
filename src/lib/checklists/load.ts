/**
 * One entry point: the checklist status for a subject, in whichever service.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CHECKLISTS } from "./definitions";
import { evaluateChecklist } from "./evaluate";
import { loadAcChecklistFacts, type AcChecklistSubject } from "./ac-facts";
import { loadArcChecklistFacts, type ArcChecklistSubject } from "./arc-facts";
import type { ChecklistManualRow, ChecklistService, ChecklistStatus } from "./types";

export type ChecklistSubject = {
  id: string;
  name: string;
  status: string;
  organisationName: string | null;
  /** Where the engagement itself lives. */
  href: string;
  consultantId?: string | null;
  ac?: AcChecklistSubject;
  arc?: ArcChecklistSubject;
};

export async function loadManualTicks(sb: SupabaseClient, service: ChecklistService, subjectId: string): Promise<ChecklistManualRow[]> {
  return Promise.resolve(
    sb.from("service_checklist_items").select("item_key, done_at, done_by_name, note").eq("service_key", service).eq("subject_id", subjectId)
  ).then((r) => (r.data ?? []) as ChecklistManualRow[], () => [] as ChecklistManualRow[]);
}

export async function loadChecklist(
  sb: SupabaseClient,
  service: ChecklistService,
  subjectId: string
): Promise<{ subject: ChecklistSubject; status: ChecklistStatus } | null> {
  const manual = await loadManualTicks(sb, service, subjectId);
  if (service === "ac") {
    const r = await loadAcChecklistFacts(sb, subjectId);
    if (!r) return null;
    return {
      subject: { id: r.subject.id, name: r.subject.name, status: r.subject.status, organisationName: r.subject.organisationName, href: `/admin/engagements/${subjectId}`, ac: r.subject },
      status: evaluateChecklist(CHECKLISTS.ac, r.facts, manual, subjectId),
    };
  }
  const r = await loadArcChecklistFacts(sb, subjectId);
  if (!r) return null;
  return {
    subject: { id: r.subject.id, name: r.subject.name, status: r.subject.status, organisationName: r.subject.organisationName, href: `/ara/consultant/assessments/${subjectId}`, consultantId: r.subject.consultantId, arc: r.subject },
    status: evaluateChecklist(CHECKLISTS.arc, r.facts, manual, subjectId),
  };
}
