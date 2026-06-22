"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { createClientOrganization } from "@/lib/clients/registry";
import { provisionClientManagerLogin } from "@/lib/auth/provision-client-manager";
import { generateCandidateSetupLink } from "@/lib/auth/provision-candidate";
import type { CaliberService } from "@/lib/clients/portal-services";

type Caller = Awaited<ReturnType<typeof requireRole>>;
async function gateAdmin(): Promise<{ caller: Caller } | { error: string }> {
  try {
    return { caller: await requireRole(["admin"]) };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

/** Admin: grant (or top up) a client's quota + expiry for one service. */
export async function grantAllocationAction(input: {
  organizationId: string;
  service: CaliberService;
  seatsTotal: number;
  expiresAt?: string | null;
  notes?: string;
  /** Admin-pinned per-service config the client cannot override (e.g. Techno
   *  { functionId }). Only written when provided, so a top-up preserves it. */
  serviceConfig?: Record<string, unknown>;
}): Promise<{ ok: true } | { error: string }> {
  const g = await gateAdmin();
  if ("error" in g) return { error: g.error };
  if (!input.organizationId) return { error: "Select a client organization" };
  if (!input.service) return { error: "Select a service" };
  const seats = Math.max(0, Math.floor(Number(input.seatsTotal) || 0));

  const sb = createServiceClient();
  const { data: org } = await sb
    .from("organizations")
    .select("name")
    .eq("id", input.organizationId)
    .maybeSingle<{ name: string }>();
  if (!org) return { error: "Organization not found" };

  // Ensure the matching ARA-store org exists + capture its id (idempotent).
  const reg = await createClientOrganization({ name: org.name });
  const araOrgId = reg.ok ? reg.araOrganizationId : null;

  // Upsert WITHOUT seats_used so a top-up preserves seats already consumed.
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    ara_organization_id: araOrgId,
    service: input.service,
    seats_total: seats,
    expires_at: input.expiresAt || null,
    notes: input.notes?.trim() || null,
    status: "active",
    granted_by: g.caller.isDev ? null : g.caller.uid,
  };
  // Only write service_config when the admin provided one, so a plain top-up
  // does not wipe an existing pinned config.
  if (input.serviceConfig && Object.keys(input.serviceConfig).length > 0) {
    row.service_config = input.serviceConfig;
  }
  const { error } = await sb.from("client_service_allocations").upsert(row, { onConflict: "organization_id,service" });
  if (error) {
    if (/seats_within_total/.test(error.message)) return { error: "New total is below the seats already used." };
    if (/relation .* does not exist|client_service_allocations/i.test(error.message))
      return { error: "Apply migrations 00150 + 00151 first." };
    return { error: error.message };
  }
  revalidatePath("/admin/clients/allocations");
  return { ok: true };
}

/** Admin: provision (or reuse) a client-manager login bound to the org. */
export async function provisionClientManagerAction(input: {
  organizationId: string;
  email: string;
  fullName: string;
}): Promise<{ data: { setupLink: string | null } } | { error: string }> {
  const g = await gateAdmin();
  if ("error" in g) return { error: g.error };
  if (!input.organizationId) return { error: "Select a client organization" };
  const email = (input.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };

  const res = await provisionClientManagerLogin({
    email,
    fullName: input.fullName?.trim() || email,
    organizationId: input.organizationId,
  });
  if (!res.ok) return { error: res.error ?? "Could not provision the manager" };

  const setupLink = await generateCandidateSetupLink(email);
  revalidatePath("/admin/clients/allocations");
  return { data: { setupLink } };
}
