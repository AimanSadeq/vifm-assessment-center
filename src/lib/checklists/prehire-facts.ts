/**
 * What the platform knows about one Pre-Hire requisition, as checklist facts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistFacts } from "./types";
import { fetchAllPages } from "@/lib/ara/paginate";

type Row = Record<string, unknown>;

export type PrehireChecklistSubject = {
  id: string;
  name: string;
  status: string;
  organisationName: string | null;
};

const safe = <T,>(p: PromiseLike<{ data: T[] | null }>, fallback: T[] = []) =>
  Promise.resolve(p).then((r) => (r.data ?? fallback) as T[], () => fallback);

/** Page a per-requisition read; an unknown column (pre-migration) yields []. */
async function pageRows(sb: SupabaseClient, table: string, cols: string, col: string, id: string): Promise<Row[]> {
  try {
    return await fetchAllPages<Row>(
      (from, to) => sb.from(table).select(cols).eq(col, id).order("id").range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
    );
  } catch {
    return [];
  }
}

export async function loadPrehireChecklistFacts(
  sb: SupabaseClient,
  requisitionId: string
): Promise<{ subject: PrehireChecklistSubject; facts: ChecklistFacts } | null> {
  const { data: r0 } = await sb
    .from("prehire_requisitions")
    .select("*, organizations(name)")
    .eq("id", requisitionId)
    .maybeSingle();
  if (!r0) return null;
  const r = r0 as Row;
  const org = (r.organizations as Row | null) ?? null;
  const orgId = (r.organization_id as string | null) ?? null;
  const status = String(r.status ?? "draft");
  const plan = Array.isArray(r.stage_config) ? (r.stage_config as Row[]) : [];

  // Base columns first; the later columns (00051 consent, 00063 report
  // delivery) are read separately so a fresh environment still renders.
  const [base, delivery, consented, audit, vouchers, proposals] = await Promise.all([
    pageRows(sb, "prehire_candidates", "id, status, invited_at, completed_at, composite_score", "requisition_id", requisitionId),
    pageRows(sb, "prehire_candidates", "id, report_sent_at", "requisition_id", requisitionId),
    pageRows(sb, "prehire_candidates", "id, consent_at", "requisition_id", requisitionId),
    safe<Row>(sb.from("prehire_audit_log").select("action").eq("requisition_id", requisitionId)),
    safe<Row>(sb.from("prehire_vouchers").select("id, max_uses, used_count").eq("requisition_id", requisitionId)),
    orgId ? safe<Row>(sb.from("proposals").select("status").eq("organization_id", orgId)) : Promise.resolve([] as Row[]),
  ]);
  const ids = base.map((c) => String(c.id));
  const stages = ids.length ? await safe<Row>(sb.from("prehire_stage_results").select("prehire_candidate_id, status").in("prehire_candidate_id", ids)) : [];

  const n = base.length;
  const invited = base.filter((c) => c.invited_at).length;
  const consent = consented.filter((c) => c.consent_at).length;
  const weighted = plan.filter((s) => Number(s.weight ?? 0) > 0).length;
  const doneAll = base.filter((c) => {
    const mine = stages.filter((s) => s.prehire_candidate_id === c.id && (s.status === "completed" || s.status === "skipped"));
    return c.completed_at || (weighted > 0 && mine.length >= weighted);
  }).length;
  const scored = base.filter((c) => c.composite_score != null).length;
  const sent = delivery.filter((c) => c.report_sent_at).length;
  const exported = audit.some((a) => a.action === "export_taken");
  const seats = vouchers.reduce((s, v) => s + Number(v.max_uses ?? 0), 0);
  const won = proposals.some((p) => p.status === "won");
  const issued = proposals.some((p) => p.status === "issued");
  const comps = Array.isArray(r.competency_ids) ? (r.competency_ids as unknown[]).length : 0;
  const weightSum = plan.reduce((s, x) => s + Number(x.weight ?? 0), 0);

  const facts: ChecklistFacts = {
    "prehire.proposal": { done: won, detail: won ? "Proposal won" : issued ? "Proposal issued, not yet accepted" : orgId ? "No proposal for this organisation" : "No organisation" },
    "prehire.recipient": { done: Boolean(r.client_recipient_email), detail: r.client_recipient_email ? String(r.client_recipient_email) : "No client recipient set" },
    "prehire.plan": { done: plan.length > 0 && Math.abs(weightSum - 1) < 0.02, detail: plan.length ? plan.map((s) => `${String(s.kind)} ${Math.round(Number(s.weight ?? 0) * 100)}%${s.cut_score != null ? ` cut ${String(s.cut_score)}` : ""}`).join(", ") : "No stages configured" },
    "prehire.profile": { done: Boolean(r.role_profile_id) || comps > 0, detail: r.role_profile_id ? "Role profile bound" : comps ? `${comps} competencies selected` : "No role profile or competencies" },
    "prehire.english": { done: true, detail: r.english_required ? "English required: Fluent stage applies" : "English not required" },
    "prehire.org": { done: Boolean(orgId), detail: org?.name ? String(org.name) : "No organisation" },
    "prehire.open": { done: status !== "draft", detail: status },
    "prehire.candidates": { done: n > 0, detail: `${n} candidate${n === 1 ? "" : "s"}` },
    "prehire.invited": { done: n > 0 && invited === n, detail: `${invited} of ${n} invited` },
    "prehire.vouchers": { done: true, detail: vouchers.length ? `${vouchers.length} code${vouchers.length === 1 ? "" : "s"}, ${seats} seat${seats === 1 ? "" : "s"}` : "None issued (candidates invited directly)" },
    "prehire.consent": { done: n > 0 && consent === n, detail: `${consent} of ${n} consented` },
    "prehire.completed": { done: n > 0 && doneAll === n, detail: `${doneAll} of ${n} completed every stage` },
    "prehire.scored": { done: n > 0 && scored === n, detail: `${scored} of ${n} with a composite score` },
    "prehire.reports_sent": { done: n > 0 && sent === n, detail: `${sent} of ${n} reports sent to the client` },
    "prehire.export": { done: exported, detail: exported ? "Export taken (audit trail)" : "No export taken" },
    "prehire.closed": { done: status === "closed" || status === "archived", detail: status },
  };

  return {
    subject: {
      id: requisitionId,
      name: String(r.title ?? "Requisition"),
      status,
      organisationName: org?.name ? String(org.name) : null,
    },
    facts,
  };
}
