import { createServiceClient } from "@/lib/supabase/server";

/**
 * Get the organization_id for the current client user.
 * TODO: When auth is enabled, read from the authenticated user's profile.
 * For now, returns the first organization as a dev fallback.
 */
export async function getClientOrgId(): Promise<string | null> {
  // TODO: Replace with auth-based lookup:
  // const supabase = await createClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
  // return profile?.organization_id ?? null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();
  return data?.id ?? null;
}
