"use server";

import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { createServiceClient } from "@/lib/supabase/server";
import { createRoleReadinessVouchers, type IssuedVoucher } from "@/lib/role-readiness/vouchers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

// Invite a candidate to a bespoke Role Readiness programme from the CLIENT portal.
// The org is resolved server-side (client_manager => own org; admin => ?org), never
// trusted from input, and the programme must actually be ASSIGNED to that org.
export async function clientInviteRoleCandidateAction(input: {
  roleConfigId: string;
  fullName: string;
  email: string;
  orgParam?: string;
}): Promise<{ ok: true; token: string } | { error: string }> {
  const access = await resolvePortalAccess(input.orgParam);
  if (!access.ok || !access.orgId) return { error: "Not authorized." };
  const orgId = access.orgId;
  if (!UUID_RE.test(input.roleConfigId)) return { error: "Invalid programme." };

  const name = (input.fullName || "").trim();
  const email = (input.email || "").trim();
  if (name.length < 2 || !EMAIL_RE.test(email)) return { error: "Enter a name and a valid email." };

  const sb = createServiceClient();
  // The programme must be published AND assigned to THIS org.
  const { data: assigned } = await sb
    .from("bespoke_services")
    .select("id")
    .eq("kind", "role_readiness")
    .eq("role_config_id", input.roleConfigId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!assigned) return { error: "This programme is not assigned to your organisation." };

  const { data, error } = await sb
    .from("rr_candidates")
    .insert({
      role_config_id: input.roleConfigId,
      organization_id: orgId,
      full_name: name,
      email,
      invited_at: new Date().toISOString(),
    })
    .select("access_token")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the invite." };
  return { ok: true, token: data.access_token as string };
}

// Issue vouchers from the CLIENT portal (org resolved server-side; programme must
// be assigned to the caller's org). Individual links or one shared multi-seat link.
export async function clientIssueRoleVouchersAction(input: {
  roleConfigId: string;
  mode: "individual" | "pool";
  emails?: string[];
  seats?: number;
  orgParam?: string;
}): Promise<{ ok: true; vouchers: IssuedVoucher[] } | { error: string }> {
  const access = await resolvePortalAccess(input.orgParam);
  if (!access.ok || !access.orgId) return { error: "Not authorized." };
  const orgId = access.orgId;
  if (!UUID_RE.test(input.roleConfigId)) return { error: "Invalid programme." };

  const sb = createServiceClient();
  const { data: assigned } = await sb
    .from("bespoke_services")
    .select("id")
    .eq("kind", "role_readiness")
    .eq("role_config_id", input.roleConfigId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!assigned) return { error: "This programme is not assigned to your organisation." };

  return createRoleReadinessVouchers({
    roleConfigId: input.roleConfigId,
    organizationId: orgId,
    mode: input.mode,
    emails: input.emails,
    seats: input.seats,
  });
}
