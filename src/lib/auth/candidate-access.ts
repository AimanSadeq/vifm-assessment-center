import { getCurrentCaller, AuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Ownership guard for candidate-scoped pages that read by a URL/searchParams
 * `candidates.id` through the RLS-bypassing service client.
 *
 * Inert while AUTH_ENABLED is false: getCurrentCaller() returns the synthetic
 * dev-admin (isDev: true), so this resolves to a no-op and the dev portal is
 * unchanged. When auth flips on, it enforces:
 *   - admin / dev-admin → always allowed (also covers the "view as candidate" flow)
 *   - candidate role     → allowed only if they own the candidate row
 *   - anything else      → denied
 *
 * A candidate's auth identity is profiles.id (= auth.uid()), linked to the
 * candidate record via candidates.profile_id — NOT candidates.id — so we
 * resolve the row's profile_id before comparing. Assessor access to candidate
 * pages is intentionally not granted here (assessors use the assessor portal);
 * add it if a real flow needs it.
 */
export async function requireCandidateAccess(candidateId: string): Promise<void> {
  const caller = await getCurrentCaller();
  if (!caller) throw new AuthorizationError("Not authenticated");
  if (caller.isDev || caller.role === "admin") return;

  if (caller.role === "candidate") {
    const sv = createServiceClient();
    const { data } = await sv
      .from("candidates")
      .select("profile_id")
      .eq("id", candidateId)
      .maybeSingle<{ profile_id: string | null }>();
    if (data && data.profile_id === caller.uid) return;
  }

  throw new AuthorizationError("Not permitted on this candidate");
}
