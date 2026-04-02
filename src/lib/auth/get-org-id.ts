import { createClient } from "@/lib/supabase/server";

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
