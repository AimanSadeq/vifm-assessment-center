import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Get the organization_id for the current client user.
 * Reads from the authenticated user's profile.
 */
export async function getClientOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  return profile?.organization_id ?? null;
}

/**
 * Resolve the ARA-store organisation id for the current client_manager (their
 * profile is bound to the AC-store organizations.id; ARC + Reflect engagements
 * live under ara_organizations.id). Reads the link off any of the org's
 * allocations (granting populates ara_organization_id via the dual-store
 * registry). Returns null if no allocation carries the ARA id yet.
 */
export async function getClientAraOrgId(): Promise<string | null> {
  const acOrgId = await getClientOrgId();
  if (!acOrgId) return null;
  try {
    const sv = createServiceClient();
    const { data } = await sv
      .from("client_service_allocations")
      .select("ara_organization_id")
      .eq("organization_id", acOrgId)
      .not("ara_organization_id", "is", null)
      .limit(1)
      .maybeSingle<{ ara_organization_id: string | null }>();
    return data?.ara_organization_id ?? null;
  } catch {
    return null;
  }
}
