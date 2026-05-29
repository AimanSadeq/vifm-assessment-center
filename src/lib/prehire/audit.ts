// Pre-Hire audit trail (migration 00051).
//
// Append-only record of significant actions for defensibility. Every write is
// BEST-EFFORT: it never throws and never blocks the primary operation, and it
// silently no-ops if prehire_audit_log hasn't been migrated yet (mirrors the
// fluent/academy tolerance pattern). The table's UPDATE trigger makes rows
// immutable once written; this module only ever inserts (and reads).

import { createServiceClient } from "@/lib/supabase/server";
import type { PrehireAuditEntry } from "@/types/prehire";

/** Canonical action names — keep these stable; the trail is a permanent record. */
export type PrehireAuditAction =
  | "requisition_created"
  | "candidate_added"
  | "invitation_sent"
  | "consent_given"
  | "stage_completed"
  | "demographics_submitted"
  | "decision_recorded"
  | "export_taken";

export type LogPrehireEvent = {
  action: PrehireAuditAction;
  requisitionId?: string | null;
  candidateId?: string | null;
  actorId?: string | null;
  /** Free-text actor when there's no account (system, dev admin, candidate). */
  actorLabel?: string | null;
  detail?: Record<string, unknown> | null;
};

export async function logPrehireEvent(e: LogPrehireEvent): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from("prehire_audit_log").insert({
      requisition_id: e.requisitionId ?? null,
      candidate_id: e.candidateId ?? null,
      actor_id: e.actorId ?? null,
      actor_label: e.actorLabel ?? null,
      action: e.action,
      detail: e.detail ?? null,
    });
  } catch {
    /* table not migrated, or transient write failure — never block the caller */
  }
}

/** Read the most recent audit entries for a requisition (admin/defensibility view). */
export async function getPrehireAudit(requisitionId: string, limit = 100): Promise<PrehireAuditEntry[]> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("prehire_audit_log")
      .select("id, requisition_id, candidate_id, actor_id, actor_label, action, detail, created_at")
      .eq("requisition_id", requisitionId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as PrehireAuditEntry[];
  } catch {
    return [];
  }
}
