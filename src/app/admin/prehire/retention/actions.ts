"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
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
): Promise<{ ok: true; purged: number; redemptionsPurged: number } | { error: string }> {
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
  // Page the id-gather: an unpaginated select caps at 1000, so a >1000 backlog
  // would leave expired applicant + redeemer PII past the retention window while
  // countExpiredPrehireCandidates (an uncapped head count) still shows the true
  // total - the exact retention-control failure this action must not have.
  let rows: { id: string }[];
  try {
    rows = await fetchAllPages<{ id: string }>((from, to) =>
      sb.from("prehire_candidates").select("id").lt("created_at", cutoff).order("id").range(from, to),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read expired candidates." };
  }
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return { ok: true, purged: 0, redemptionsPurged: 0 };

  // Delete voucher-redemption PII first. The redemption FK is ON DELETE SET NULL,
  // so deleting the candidate would orphan the redemption row (redeemer name /
  // email / IP) with its candidate link nulled - leaving PII past the window.
  // Remove them while the candidate_id still matches. Chunk the .in() (a >1000
  // uuid list also bloats the URL). Best-effort (un-migrated table just no-ops).
  let redemptionsPurged = 0;
  try {
    for (const batch of chunkIds(ids)) {
      const rdel = await sb.from("prehire_voucher_redemptions").delete().in("candidate_id", batch).select("id");
      redemptionsPurged += rdel.data?.length ?? 0;
    }
  } catch {
    /* redemptions table absent */
  }

  let purged = 0;
  for (const batch of chunkIds(ids)) {
    const del = await sb.from("prehire_candidates").delete().in("id", batch).select("id");
    if (del.error) return { error: del.error.message };
    purged += del.data?.length ?? 0;
  }

  revalidatePath("/admin/prehire/retention");
  return { ok: true, purged, redemptionsPurged };
}
