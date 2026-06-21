import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Authorisation guard for candidate report / learning-plan API routes.
 * Returns a NextResponse to send on denial, or null when access is allowed.
 *
 * Policy:
 *   - admin                  -> allow
 *   - client                 -> allow only for their own org's candidate
 *   - candidate              -> allow only for their own record
 *   - anyone else / no user  -> 401 / 403
 *
 * The OAR-finalised gate stays in each route (this guard is only about *who*).
 */
export async function guardCandidateReportAccess(
  engagementId: string,
  candidateId: string,
): Promise<NextResponse | null> {
  const caller = await getCurrentCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role === "admin") return null;

  const sv = createServiceClient();
  const { data: cand } = await sv
    .from("candidates")
    .select("id, profile_id, engagement_id, engagements(organization_id)")
    .eq("id", candidateId)
    .maybeSingle<{
      id: string;
      profile_id: string | null;
      engagement_id: string;
      engagements: { organization_id: string }[] | { organization_id: string } | null;
    }>();
  if (!cand || cand.engagement_id !== engagementId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // For the candidate + client consumers, the report must ALSO be released.
  // Admins (returned at the top) generate/preview any status; candidates and
  // clients only ever see a released report. Without this, a self-candidate or
  // own-org client could pull an unreleased (draft) report straight from the
  // API even though the in-app viewer hides it. Covers the learning-plan route
  // too (it shares this guard).
  const requireReleased = async (): Promise<NextResponse | null> => {
    const { count } = await sv
      .from("candidate_reports")
      .select("id", { count: "exact", head: true })
      .eq("engagement_id", engagementId)
      .eq("candidate_id", candidateId)
      .eq("status", "released");
    return count && count > 0
      ? null
      : NextResponse.json({ error: "Report not available" }, { status: 403 });
  };

  if (caller.role === "candidate") {
    if (cand.profile_id !== caller.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return requireReleased();
  }

  if (caller.role === "client") {
    const orgId = await getClientOrgId();
    const engOrg = Array.isArray(cand.engagements)
      ? cand.engagements[0]?.organization_id
      : cand.engagements?.organization_id;
    if (!orgId || engOrg !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return requireReleased();
  }

  // assessors / consultants are not consumers of candidate client reports
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
