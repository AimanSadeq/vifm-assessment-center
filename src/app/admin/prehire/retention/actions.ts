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
 * Count Pre-Hire candidates past the retention window. Targets candidate records
 * (the PII surface) rather than requisitions, so a still-open requisition's
 * non-PII shell can survive while expired applicant data is removed.
 */
export async function countExpiredPrehireCandidates(): Promise<{ total: number; expired: number }> {
  const sb = createServiceClient();
  const totalRes = await sb.from("prehire_candidates").select("id", { count: "exact", head: true });
  const expiredRes = await sb
    .from("prehire_candidates")
    .select("id", { count: "exact", head: true })
    .lt("created_at", cutoffIso());
  return { total: totalRes.count ?? 0, expired: expiredRes.count ?? 0 };
}

/**
 * Purge Pre-Hire candidates older than the retention window. Destructive:
 * requires a typed confirmation. Deleting a candidate cascades to its stage
 * results and its immutable audit-log rows (the 00051 audit trigger blocks
 * UPDATE but permits retention-purge deletes). The requisition shell is kept.
 */
export async function purgePrehireCandidates(
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
    .from("prehire_candidates")
    .select("id")
    .lt("created_at", cutoffIso());
  if (error) return { error: error.message };
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { ok: true, purged: 0 };

  const del = await sb.from("prehire_candidates").delete().in("id", ids).select("id");
  if (del.error) return { error: del.error.message };

  revalidatePath("/admin/prehire/retention");
  return { ok: true, purged: del.data?.length ?? ids.length };
}
