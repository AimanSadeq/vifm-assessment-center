/**
 * One entry point: the checklist status for a subject, in whichever service,
 * and the one rule for who may tick it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CHECKLISTS } from "./definitions";
import { evaluateChecklist } from "./evaluate";
import { loadAcChecklistFacts, type AcChecklistSubject } from "./ac-facts";
import { loadArcChecklistFacts, type ArcChecklistSubject } from "./arc-facts";
import { loadReflectChecklistFacts } from "./reflect-facts";
import { loadPrehireChecklistFacts } from "./prehire-facts";
import { isVoucherService, loadVoucherChecklistFacts } from "./voucher-facts";
import type { ChecklistManualRow, ChecklistService, ChecklistStatus } from "./types";

export type ChecklistSubject = {
  id: string;
  name: string;
  status: string;
  organisationName: string | null;
  /** Where the engagement itself lives. */
  href: string;
  /** Set for consultant-owned services (arc, reflect). */
  consultantId?: string | null;
  ac?: AcChecklistSubject;
  arc?: ArcChecklistSubject;
};

/** Where one subject's own page is. Voucher services have none, so the checklist page stands in. */
export function subjectHref(service: ChecklistService, id: string): string {
  switch (service) {
    case "ac": return `/admin/engagements/${id}`;
    case "arc": return `/ara/consultant/assessments/${id}`;
    case "reflect": return `/reflect/consultant/engagements/${id}`;
    case "prehire": return `/admin/prehire/${id}`;
    default: return `/admin/checklists/${service}/${id}`;
  }
}

/**
 * Admins manage every checklist. A consultant manages the checklist of an
 * AI Readiness assessment or a Reflect 360 engagement they own. Everyone
 * else is refused.
 */
export function canManageChecklist(caller: { role: string; uid: string } | null, service: ChecklistService, subject: { consultantId?: string | null }): boolean {
  if (!caller) return false;
  if (caller.role === "admin") return true;
  if (caller.role === "consultant" && (service === "arc" || service === "reflect")) return Boolean(subject.consultantId) && subject.consultantId === caller.uid;
  return false;
}

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
  const href = subjectHref(service, subjectId);
  if (service === "ac") {
    const r = await loadAcChecklistFacts(sb, subjectId);
    if (!r) return null;
    return {
      subject: { id: r.subject.id, name: r.subject.name, status: r.subject.status, organisationName: r.subject.organisationName, href, ac: r.subject },
      status: evaluateChecklist(CHECKLISTS.ac, r.facts, manual, subjectId),
    };
  }
  if (service === "arc") {
    const r = await loadArcChecklistFacts(sb, subjectId);
    if (!r) return null;
    return {
      subject: { id: r.subject.id, name: r.subject.name, status: r.subject.status, organisationName: r.subject.organisationName, href, consultantId: r.subject.consultantId, arc: r.subject },
      status: evaluateChecklist(CHECKLISTS.arc, r.facts, manual, subjectId),
    };
  }
  if (service === "reflect") {
    const r = await loadReflectChecklistFacts(sb, subjectId);
    if (!r) return null;
    return {
      subject: { ...r.subject, href },
      status: evaluateChecklist(CHECKLISTS.reflect, r.facts, manual, subjectId),
    };
  }
  if (service === "prehire") {
    const r = await loadPrehireChecklistFacts(sb, subjectId);
    if (!r) return null;
    return {
      subject: { ...r.subject, href },
      status: evaluateChecklist(CHECKLISTS.prehire, r.facts, manual, subjectId),
    };
  }
  if (isVoucherService(service)) {
    const r = await loadVoucherChecklistFacts(sb, service, subjectId);
    if (!r) return null;
    return {
      subject: { id: r.subject.id, name: r.subject.name, status: r.subject.status, organisationName: r.subject.organisationName, href },
      status: evaluateChecklist(CHECKLISTS[service], r.facts, manual, subjectId),
    };
  }
  return null;
}
