// Client voucher/seat allocation ledger access (service-role). The admin grants
// a quota per (org, service); the client manager draws from it when issuing. All
// writes go through the atomic claim/release RPCs (migration 00151) so quota is
// race-safe. Authorization (role + org) is enforced by the CALLER (the server
// action) before calling drawAllocation - org is always derived from the
// caller's profile, never trusted from input.

import { createServiceClient } from "@/lib/supabase/server";
import type { CaliberService } from "./portal-services";

export type Allocation = {
  id: string;
  organization_id: string;
  ara_organization_id: string | null;
  service: CaliberService;
  seats_total: number;
  seats_used: number;
  seats_remaining: number; // derived
  expires_at: string | null;
  status: "active" | "suspended";
  service_config: Record<string, unknown>;
  notes: string | null;
};

type AllocationRow = Omit<Allocation, "seats_remaining">;

const SELECT =
  "id, organization_id, ara_organization_id, service, seats_total, seats_used, expires_at, status, service_config, notes";

function toAllocation(r: AllocationRow): Allocation {
  return { ...r, seats_remaining: Math.max(0, (r.seats_total ?? 0) - (r.seats_used ?? 0)) };
}

/** Is an allocation currently usable (active, unexpired, seats remaining)? */
export function allocationUsable(a: Allocation): boolean {
  if (a.status !== "active") return false;
  if (a.expires_at && new Date(a.expires_at).getTime() <= Date.now()) return false;
  return a.seats_remaining > 0;
}

/** All allocations for an org (admin + client dashboards). Tolerant of an
 *  un-applied migration (returns []). */
export async function getAllocationsForOrg(organizationId: string): Promise<Allocation[]> {
  if (!organizationId) return [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("client_service_allocations")
      .select(SELECT)
      .eq("organization_id", organizationId);
    return ((data ?? []) as AllocationRow[]).map(toAllocation);
  } catch {
    return [];
  }
}

export type DrawResult =
  | { ok: true; allocation: Allocation }
  | { ok: false; reason: "over_quota" | "error"; message?: string };

/**
 * Atomically reserve `count` seats from the (org, service) allocation. Returns
 * over_quota when there is no active, unexpired allocation with enough seats.
 * Pair every successful draw with releaseAllocation() if the downstream issuance
 * fails, so seats are not lost.
 */
export async function drawAllocation(
  organizationId: string,
  service: CaliberService,
  count = 1
): Promise<DrawResult> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("claim_allocation_seats", {
    p_org: organizationId,
    p_service: service,
    p_count: count,
  });
  if (error) return { ok: false, reason: "error", message: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as AllocationRow | null;
  if (!row || !row.id) return { ok: false, reason: "over_quota" };
  return { ok: true, allocation: toAllocation(row) };
}

/** Return previously-claimed seats (best-effort) after a downstream failure. */
export async function releaseAllocation(
  organizationId: string,
  service: CaliberService,
  count = 1
): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.rpc("release_allocation_seats", { p_org: organizationId, p_service: service, p_count: count });
  } catch {
    /* best-effort */
  }
}
