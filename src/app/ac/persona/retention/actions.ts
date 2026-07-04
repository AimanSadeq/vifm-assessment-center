"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { RETENTION_MONTHS, PURGE_CONFIRMATION } from "./constants";

function cutoffIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - RETENTION_MONTHS);
  return d.toISOString();
}

/**
 * Count standalone Persona sessions past the retention window. Only counts
 * self-served / voucher runs (candidate_id IS NULL) - candidate-bound sessions
 * feed Succession Readiness and are governed by the engagement's own lifecycle.
 */
export async function countExpiredPersonaSessions(): Promise<{ total: number; expired: number }> {
  const sb = createServiceClient();
  const totalRes = await sb
    .from("behavioral_assessment_sessions")
    .select("id", { count: "exact", head: true })
    .is("candidate_id", null);
  const expiredRes = await sb
    .from("behavioral_assessment_sessions")
    .select("id", { count: "exact", head: true })
    .is("candidate_id", null)
    .lt("created_at", cutoffIso());
  return { total: totalRes.count ?? 0, expired: expiredRes.count ?? 0 };
}

/**
 * Purge standalone Persona sessions older than the retention window. Destructive:
 * requires a typed confirmation. Per-item response rows cascade (ON DELETE
 * CASCADE). Voucher redemption ROWS are kept for seat/commercial accounting, but
 * their personal data (redeemer name / email / company / IP / user-agent) is
 * ANONYMISED past the same window so no PII outlives the 2-year retention rule.
 * Candidate-bound sessions are never touched here.
 */
export async function purgePersonaSessions(
  formData: FormData,
): Promise<{ ok: true; purged: number; anonymised: number } | { error: string }> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  if (String(formData.get("confirmation") ?? "").trim() !== PURGE_CONFIRMATION) {
    return { error: `Type ${PURGE_CONFIRMATION} to confirm.` };
  }

  const sb = createServiceClient();
  const cutoff = cutoffIso();
  const { data: rows, error } = await sb
    .from("behavioral_assessment_sessions")
    .select("id")
    .is("candidate_id", null)
    .lt("created_at", cutoff);
  if (error) return { error: error.message };
  const ids = (rows ?? []).map((r) => r.id as string);

  if (ids.length > 0) {
    const del = await sb.from("behavioral_assessment_sessions").delete().in("id", ids).select("id");
    if (del.error) return { error: del.error.message };
  }

  // Anonymise redemption PII past the retention window (NOT NULL columns get a
  // redaction sentinel; nullable forensic columns are cleared). Best-effort +
  // tolerant of the table not being migrated.
  let anonymised = 0;
  try {
    const anon = await sb
      .from("persona_voucher_redemptions")
      .update({ redeemer_name: "[purged]", redeemer_email: "[purged]", company_name: "[purged]", ip: null, user_agent: null })
      .lt("redeemed_at", cutoff)
      .neq("redeemer_email", "[purged]")
      .select("id");
    anonymised = anon.data?.length ?? 0;
  } catch {
    /* redemptions table not migrated - nothing to anonymise */
  }

  revalidatePath("/ac/persona/retention");
  return { ok: true, purged: ids.length, anonymised };
}
