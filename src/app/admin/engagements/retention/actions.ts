"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
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
  // Gather the expired ids paginated: an unpaginated select caps at 1000, so a
  // backlog > 1000 would purge only the first 1000 per run and silently leave the
  // rest over-retained past the compliance window.
  let ids: string[];
  try {
    const rows = await fetchAllPages<{ id: string }>((from, to) =>
      sb
        .from("engagements")
        .select("id")
        .in("status", TERMINAL_STATUSES as unknown as string[])
        .lt("created_at", cutoffIso())
        .order("id")
        .range(from, to),
    );
    ids = rows.map((r) => r.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to gather expired engagements." };
  }
  if (ids.length === 0) return { ok: true, purged: 0 };

  // Delete in chunks so the in(...) URL stays sane for a large backlog. The
  // engagement delete cascades to its children (candidates, assignments,
  // observations, ratings, consensus, OAR, reports) via ON DELETE CASCADE.
  let purged = 0;
  for (const chunk of chunkIds(ids)) {
    const del = await sb.from("engagements").delete().in("id", chunk).select("id");
    if (del.error) return { error: del.error.message };
    purged += del.data?.length ?? chunk.length;
  }

  revalidatePath("/admin/engagements/retention");
  return { ok: true, purged };
}
