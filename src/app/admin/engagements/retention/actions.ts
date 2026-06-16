"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { RETENTION_MONTHS, PURGE_CONFIRMATION } from "./constants";

// Only closed projects are eligible for purge - never an active/draft engagement.
const TERMINAL_STATUSES = ["completed", "archived"] as const;

function cutoffIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - RETENTION_MONTHS);
  return d.toISOString();
}

/**
 * Count completed/archived engagements past the retention window. "total" is all
 * closed engagements; "expired" is those older than the window.
 */
export async function countExpiredAcEngagements(): Promise<{ total: number; expired: number }> {
  const sb = createServiceClient();
  const totalRes = await sb
    .from("engagements")
    .select("id", { count: "exact", head: true })
    .in("status", TERMINAL_STATUSES as unknown as string[]);
  const expiredRes = await sb
    .from("engagements")
    .select("id", { count: "exact", head: true })
    .in("status", TERMINAL_STATUSES as unknown as string[])
    .lt("created_at", cutoffIso());
  return { total: totalRes.count ?? 0, expired: expiredRes.count ?? 0 };
}

/**
 * Purge completed/archived engagements older than the retention window.
 * Destructive: requires a typed confirmation. Deleting an engagement cascades to
 * its candidates, assessor assignments, observations, ratings, consensus, OAR and
 * reports (ON DELETE CASCADE). Issued credentials (vifm_credentials) are kept -
 * they are the verifiable record and carry no engagement FK.
 */
export async function purgeAcEngagements(
  formData: FormData,
): Promise<{ ok: true; purged: number } | { error: string }> {
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
  const { data: rows, error } = await sb
    .from("engagements")
    .select("id")
    .in("status", TERMINAL_STATUSES as unknown as string[])
    .lt("created_at", cutoffIso());
  if (error) return { error: error.message };
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { ok: true, purged: 0 };

  const del = await sb.from("engagements").delete().in("id", ids).select("id");
  if (del.error) return { error: del.error.message };

  revalidatePath("/admin/engagements/retention");
  return { ok: true, purged: del.data?.length ?? ids.length };
}
