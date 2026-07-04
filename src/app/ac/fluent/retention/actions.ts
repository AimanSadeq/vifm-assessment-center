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

/** Count results past the retention window (read-only; used by the page). */
export async function countExpiredFluentResults(): Promise<{ total: number; expired: number }> {
  const sb = createServiceClient();
  const totalRes = await sb.from("eng_fluent_results").select("id", { count: "exact", head: true });
  const expiredRes = await sb
    .from("eng_fluent_results")
    .select("id", { count: "exact", head: true })
    .lt("created_at", cutoffIso());
  return { total: totalRes.count ?? 0, expired: expiredRes.count ?? 0 };
}

/**
 * Purge Fluent results older than the retention window. Destructive: requires a
 * typed confirmation. Removes dependent score-run rows first. Voucher-redemption
 * ROWS are kept for seat/commercial accounting, but their PII (redeemer name /
 * email / company / IP / user-agent) is ANONYMISED past the same window, and
 * expired sessions (the keyed test + start IP) are swept, so no personal data
 * outlives the 2-year retention rule (mirrors the Logica / Persona purge).
 */
export async function purgeFluentResults(
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

  // 1. Delete expired results (+ dependent calibration runs).
  const { data: rows, error } = await sb
    .from("eng_fluent_results")
    .select("id")
    .lt("created_at", cutoff);
  if (error) return { error: error.message };
  const ids = (rows ?? []).map((r) => r.id as string);
  let purged = 0;
  if (ids.length > 0) {
    try {
      await sb.from("eng_fluent_score_runs").delete().in("result_id", ids);
    } catch {
      /* table absent - ignore */
    }
    const del = await sb.from("eng_fluent_results").delete().in("id", ids).select("id");
    if (del.error) return { error: del.error.message };
    purged = del.data?.length ?? ids.length;
  }

  // 2. Anonymise voucher-redemption PII past the window (best-effort).
  let anonymised = 0;
  try {
    const anon = await sb
      .from("eng_fluent_voucher_redemptions")
      .update({ redeemer_name: "[purged]", redeemer_email: "[purged]", company_name: "[purged]", ip: null, user_agent: null })
      .lt("redeemed_at", cutoff)
      .neq("redeemer_email", "[purged]")
      .select("id");
    anonymised = anon.data?.length ?? 0;
  } catch {
    /* redemptions table not migrated - nothing to anonymise */
  }

  // 3. Sweep expired sessions - each holds the full keyed test + start IP and is
  //    unusable past its TTL, but nothing else deletes them. Best-effort.
  let sessionsSwept = 0;
  try {
    const sw = await sb
      .from("eng_fluent_sessions")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");
    sessionsSwept = sw.data?.length ?? 0;
  } catch {
    /* sessions table not migrated */
  }

  revalidatePath("/ac/fluent/retention");
  return { ok: true, purged, anonymised, sessionsSwept };
}
