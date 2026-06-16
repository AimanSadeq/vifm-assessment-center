import { createServiceClient } from "@/lib/supabase/server";

// Client-level results-delivery preferences (migration 00108). Resolves who may
// see a delegate's results and whether they are sent to the client contact.
//
// Tolerant by design: anonymous Mode A snapshots have no org, and if migration
// 00108 isn't applied the columns are absent - both cases fall back to the
// permissive default (delegate sees results, no client send), i.e. today's
// behaviour, so nothing breaks before the migration lands.

export type OrgResultsPrefs = {
  respondentCanView: boolean;
  clientEmail: string | null;
  sendToClient: boolean;
};

const PERMISSIVE: OrgResultsPrefs = {
  respondentCanView: true,
  clientEmail: null,
  sendToClient: false,
};

export async function getOrgResultsPrefs(
  organizationId: string | null | undefined,
): Promise<OrgResultsPrefs> {
  if (!organizationId) return PERMISSIVE; // anonymous / no client org
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("ara_organizations")
      .select("respondent_can_view_results, client_contact_email, send_results_to_client")
      .eq("id", organizationId)
      .maybeSingle<{
        respondent_can_view_results: boolean | null;
        client_contact_email: string | null;
        send_results_to_client: boolean | null;
      }>();
    if (error || !data) return PERMISSIVE; // columns not migrated / no row
    return {
      respondentCanView: data.respondent_can_view_results ?? true,
      clientEmail: (data.client_contact_email ?? "").trim() || null,
      sendToClient: data.send_results_to_client ?? false,
    };
  } catch {
    return PERMISSIVE;
  }
}
