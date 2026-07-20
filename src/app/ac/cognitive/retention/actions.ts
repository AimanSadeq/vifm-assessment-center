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

  // Delegates to the ONE platform retention policy (src/lib/retention/policy.ts)
  // so the manual purge and the nightly cron can never diverge.
  const spec = findRetentionSpec("cognitive");
  if (!spec) return { error: "No retention spec registered for this service." };
  const out = await runRetentionForService(spec);
  if (out.errors.length) return { error: out.errors.join("; ") };
  const purged = out.deleted;
  const anonymised = out.anonymised;
  const sessionsSwept = out.swept;

  revalidatePath("/ac/cognitive/retention");
  return { ok: true, purged, anonymised, sessionsSwept };
}
