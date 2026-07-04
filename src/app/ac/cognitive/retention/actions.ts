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

/** Count cognitive results past the retention window (read-only; used by the page). */
export async function countExpiredCognitiveResults(): Promise<{ total: number; expired: number }> {
  const sb = createServiceClient();
  const totalRes = await sb
    .from("psy_results")
    .select("id", { count: "exact", head: true })
    .eq("kind", "cognitive");
  const expiredRes = await sb
    .from("psy_results")
    .select("id", { count: "exact", head: true })
    .eq("kind", "cognitive")
    .lt("created_at", cutoffIso());
  return { total: totalRes.count ?? 0, expired: expiredRes.count ?? 0 };
}

/**
 * Purge cognitive results older than the retention window. Destructive: requires
 * a typed confirmation. Per-item response rows cascade (ON DELETE CASCADE).
 * Voucher-redemption ROWS are kept for seat/commercial accounting, but their PII
 * (redeemer name / email / company / IP / user-agent) is ANONYMISED past the same
 * window, and expired psy_sessions (keyed test + taker email) are swept, so no
 * personal data outlives the 2-year retention rule (mirrors the Persona purge).
 */
export async function purgeCognitiveResults(
  formData: FormData,
): Promise<{ ok: true; purged: number; anonymised: number; sessionsSwept: number } | { error: string }> {
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

  // 1. Delete expired results (per-item responses cascade).
  const { data: rows, error } = await sb
    .from("psy_results")
    .select("id")
    .eq("kind", "cognitive")
    .lt("created_at", cutoff);
  if (error) return { error: error.message };
  const ids = (rows ?? []).map((r) => r.id as string);
  let purged = 0;
  if (ids.length > 0) {
    const del = await sb.from("psy_results").delete().in("id", ids).select("id");
    if (del.error) return { error: del.error.message };
    purged = del.data?.length ?? ids.length;
  }

  // 2. Anonymise voucher-redemption PII past the window (NOT NULL columns get a
  //    redaction sentinel; nullable forensic columns cleared). Best-effort.
  let anonymised = 0;
  try {
    const anon = await sb
      .from("cognitive_voucher_redemptions")
      .update({ redeemer_name: "[purged]", redeemer_email: "[purged]", company_name: "[purged]", ip: null, user_agent: null })
      .lt("redeemed_at", cutoff)
      .neq("redeemer_email", "[purged]")
      .select("id");
    anonymised = anon.data?.length ?? 0;
  } catch {
    /* redemptions table not migrated - nothing to anonymise */
  }

  // 3. Sweep expired cognitive sessions - each carries the full keyed test +
  //    taker email and is unusable past its ~3h TTL, but nothing else deletes
  //    them, so they would otherwise retain PII indefinitely. Best-effort.
  let sessionsSwept = 0;
  try {
    const sw = await sb
      .from("psy_sessions")
      .delete()
      .eq("kind", "cognitive")
      .lt("expires_at", new Date().toISOString())
      .select("id");
    sessionsSwept = sw.data?.length ?? 0;
  } catch {
    /* psy_sessions not migrated */
  }

  revalidatePath("/ac/cognitive/retention");
  return { ok: true, purged, anonymised, sessionsSwept };
}
