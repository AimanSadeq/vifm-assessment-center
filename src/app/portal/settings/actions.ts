"use server";

import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { updateOrgSettings } from "@/lib/clients/org-settings";

/**
 * Set the org-level Fluent proctoring policy (integrity pass). Access is gated
 * exactly like the portal pages: a client_manager writes only their own org, an
 * admin can write the previewed org. The write itself is service-role.
 */
export async function setFluentProctoringPolicyAction(input: {
  orgParam: string | null;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await resolvePortalAccess(input.orgParam);
  const orgId = access.ok ? access.orgId : null;
  if (!orgId) return { ok: false, error: "No organisation access." };
  return updateOrgSettings(orgId, { fluent_proctoring_required: input.enabled === true });
}
