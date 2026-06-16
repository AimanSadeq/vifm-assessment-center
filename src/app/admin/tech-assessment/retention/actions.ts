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

async function countOlder(table: string, cutoff: string): Promise<{ total: number; expired: number }> {
  const sb = createServiceClient();
  try {
    const totalRes = await sb.from(table).select("id", { count: "exact", head: true });
    if (totalRes.error) return { total: 0, expired: 0 };
    const expiredRes = await sb.from(table).select("id", { count: "exact", head: true }).lt("created_at", cutoff);
    return { total: totalRes.count ?? 0, expired: expiredRes.count ?? 0 };
  } catch {
    return { total: 0, expired: 0 };
  }
}

/**
 * Count technical results/sessions past the retention window. Aggregates the
 * indicative/certified results, the server-held test sessions, and the
 * performance-based sandbox sessions (tolerant of any table being unmigrated).
 */
export async function countExpiredTechnical(): Promise<{ total: number; expired: number }> {
  const cutoff = cutoffIso();
  const parts = await Promise.all([
    countOlder("tech_assessment_results", cutoff),
    countOlder("tech_assessment_sessions", cutoff),
    countOlder("technical_sandbox_sessions", cutoff),
  ]);
  return parts.reduce(
    (acc, p) => ({ total: acc.total + p.total, expired: acc.expired + p.expired }),
    { total: 0, expired: 0 },
  );
}

async function purgeTable(table: string, cutoff: string): Promise<number> {
  const sb = createServiceClient();
  try {
    const { data, error } = await sb.from(table).select("id").lt("created_at", cutoff);
    if (error) return 0;
    const ids = (data ?? []).map((r) => r.id as string);
    if (ids.length === 0) return 0;
    const del = await sb.from(table).delete().in("id", ids).select("id");
    if (del.error) return 0;
    return del.data?.length ?? ids.length;
  } catch {
    return 0;
  }
}

/**
 * Purge technical results/sessions older than the retention window. Destructive:
 * requires a typed confirmation. Sandbox sessions cascade to their per-block
 * responses. Issued credentials (vifm_credentials) are kept - they are the
 * verifiable record and carry no technical-result FK.
 */
export async function purgeTechnical(
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

  const cutoff = cutoffIso();
  const purged =
    (await purgeTable("tech_assessment_results", cutoff)) +
    (await purgeTable("tech_assessment_sessions", cutoff)) +
    (await purgeTable("technical_sandbox_sessions", cutoff));

  revalidatePath("/admin/tech-assessment/retention");
  return { ok: true, purged };
}
