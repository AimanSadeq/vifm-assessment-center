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
 * a typed confirmation. Per-item response rows cascade (ON DELETE CASCADE);
 * voucher redemptions keep their row (result_id is ON DELETE SET NULL).
 */
export async function purgeCognitiveResults(
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
    .from("psy_results")
    .select("id")
    .eq("kind", "cognitive")
    .lt("created_at", cutoffIso());
  if (error) return { error: error.message };
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { ok: true, purged: 0 };

  const del = await sb.from("psy_results").delete().in("id", ids).select("id");
  if (del.error) return { error: del.error.message };

  revalidatePath("/ac/cognitive/retention");
  return { ok: true, purged: del.data?.length ?? ids.length };
}
