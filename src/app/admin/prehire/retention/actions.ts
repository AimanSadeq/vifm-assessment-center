"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import { RETENTION_MONTHS, PURGE_CONFIRMATION } from "./constants";
import { runRetentionForService } from "@/lib/retention/engine";
import { findRetentionSpec } from "@/lib/retention/specs";

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
  // Delegates to the one platform policy (src/lib/retention/policy.ts).
  //
  // Behavioural change: voucher redemptions are ANONYMISED rather than deleted,
  // so the seat ledger behind a voucher's used_count still reconciles. That
  // also removes the old ordering hazard here - the redemption FK is ON DELETE
  // SET NULL, so deleting a candidate first would orphan the redemption with
  // its PII intact and its link nulled. Anonymising keys on redeemed_at, which
  // is independent of whether the candidate link survived.
  const spec = findRetentionSpec("prehire");
  if (!spec) return { error: "No retention spec registered for Pre-Hire." };
  const out = await runRetentionForService(spec);
  if (out.errors.length) return { error: out.errors.join("; ") };
  const purged = out.deleted;
  const redemptionsPurged = out.anonymised;

  revalidatePath("/admin/prehire/retention");
  return { ok: true, purged, redemptionsPurged };
}
