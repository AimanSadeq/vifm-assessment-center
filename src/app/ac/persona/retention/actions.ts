"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { RETENTION_MONTHS, PURGE_CONFIRMATION } from "./constants";
import { runRetentionForService } from "@/lib/retention/engine";
import { findRetentionSpec } from "@/lib/retention/specs";

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

  // Delegates to the ONE platform retention policy (src/lib/retention/policy.ts)
  // so the manual purge and the nightly cron can never diverge.
  const spec = findRetentionSpec("persona");
  if (!spec) return { error: "No retention spec registered for this service." };
  const out = await runRetentionForService(spec);
  if (out.errors.length) return { error: out.errors.join("; ") };
  const purged = out.deleted;
  const anonymised = out.anonymised;

  revalidatePath("/ac/persona/retention");
  return { ok: true, purged, anonymised };
}
