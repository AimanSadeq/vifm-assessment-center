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

/**
 * Single source of truth for "may this delegate see their OWN results"
 * (on-screen results page, personal PDF, and the auto results email).
 *
 * R1 rule: once a client contact is configured on the org, this is a
 * delegated/client engagement - the consultant sends the assessment and the
 * CLIENT receives the results (directly via send-to-client or collected via the
 * org "Collect all results" action), so the delegate does NOT see their own
 * results. Anonymous Mode A has no org (clientEmail null) and keeps them, as
 * does an org with an explicit respondent_can_view_results=false override.
 *
 * The on-screen page, the PDF route, and the completion email MUST all use this
 * helper so a delegate can't be denied the email yet still see results on
 * screen (the inconsistency behind "results still show after finishing").
 */
export function delegateCanSeeOwnResults(prefs: OrgResultsPrefs): boolean {
  return prefs.respondentCanView && !prefs.clientEmail;
}

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
