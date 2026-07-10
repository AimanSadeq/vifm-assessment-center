import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, AuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";

// ─────────────────────────────────────────────────────────────
// Assessment Center (AC) ownership + immutability guards.
//
// The assessor write actions (observation / rating / integration / wash-up
// consensus + OAR) run through the SERVICE client, which bypasses RLS. So the
// RLS policies that "only permit the owning assessor" never actually execute on
// those paths - the guard has to be enforced in application code here. Without
// this, a role check alone lets any authenticated assessor clobber the ratings,
// consensus, and final OAR (which feeds client reports + ac_ready_now
// credentials) of any candidate in any other client's engagement.
//
// Model: admins always pass (oversight + the AUTH_ENABLED=false synthetic-admin
// dev path); real assessors pass only for engagements/assignments they own.
// ─────────────────────────────────────────────────────────────

const ASSESSOR_ROLES: AraCaller["role"][] = ["lead_assessor", "associate_assessor", "admin"];

/** Engagement statuses in which assessment writes are FROZEN: once an engagement
 *  is completed/archived, the report is released and (for ready_now OARs) a
 *  publicly verifiable credential is issued, so the underlying ratings/consensus/
 *  OAR must be immutable. */
const LOCKED_STATUSES = new Set(["completed", "archived"]);

/**
 * Admin: always allowed. Assessor: allowed only if they hold at least one
 * assessor_assignment on this engagement. Unassigned assessors / other roles:
 * denied. Returns the caller.
 */
export async function requireAssessorForEngagement(engagementId: string): Promise<AraCaller> {
  const caller = await requireRole(ASSESSOR_ROLES);
  if (caller.role === "admin") return caller;

  const sv = createServiceClient();
  const { data } = await sv
    .from("assessor_assignments")
    .select("id")
    .eq("engagement_id", engagementId)
    .eq("assessor_id", caller.uid)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!data) throw new AuthorizationError("You are not assigned to this engagement.");
  return caller;
}

/**
 * Admin: always allowed. Assessor: allowed only if they OWN this assignment
 * (assessor_assignments.assessor_id === caller.uid). Returns the caller plus the
 * assignment's engagement/candidate ids so the write path can run the
 * immutability check and scope its own writes.
 */
export async function requireAssignmentOwner(
  assignmentId: string,
): Promise<{ caller: AraCaller; engagementId: string; candidateId: string }> {
  const caller = await requireRole(ASSESSOR_ROLES);
  const sv = createServiceClient();
  const { data: asg } = await sv
    .from("assessor_assignments")
    .select("id, assessor_id, engagement_id, candidate_id")
    .eq("id", assignmentId)
    .maybeSingle<{ id: string; assessor_id: string; engagement_id: string; candidate_id: string }>();
  if (!asg) throw new AuthorizationError("Assignment not found.");
  if (caller.role !== "admin" && asg.assessor_id !== caller.uid) {
    throw new AuthorizationError("That assignment does not belong to you.");
  }
  return { caller, engagementId: asg.engagement_id, candidateId: asg.candidate_id };
}

/** Throws unless the competency is in the engagement's scored competency set
 *  (engagement_competencies). Prevents an assigned assessor writing a consensus
 *  rating for an out-of-scope competency, which would pollute the candidate's
 *  report/radar and the OAR-eligibility count. */
export async function assertCompetencyInEngagement(
  competencyId: string,
  engagementId: string,
  sv = createServiceClient(),
): Promise<void> {
  const { data } = await sv
    .from("engagement_competencies")
    .select("competency_id")
    .eq("engagement_id", engagementId)
    .eq("competency_id", competencyId)
    .maybeSingle<{ competency_id: string }>();
  if (!data) throw new AuthorizationError("That competency is not in scope for this engagement.");
}

/** Throws unless the candidate belongs to the engagement (prevents cross-engagement
 *  consensus/OAR writes with a mismatched candidate). */
export async function assertCandidateInEngagement(
  candidateId: string,
  engagementId: string,
  sv = createServiceClient(),
): Promise<void> {
  const { data } = await sv
    .from("candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("engagement_id", engagementId)
    .maybeSingle<{ id: string }>();
  if (!data) throw new AuthorizationError("That candidate is not part of this engagement.");
}

/** Throws if the engagement is finalised (completed/archived), so assessment
 *  writes cannot mutate a released report / issued-credential run. */
export async function assertEngagementUnlocked(
  engagementId: string,
  sv = createServiceClient(),
): Promise<void> {
  const { data } = await sv
    .from("engagements")
    .select("status")
    .eq("id", engagementId)
    .maybeSingle<{ status: string }>();
  if (!data) throw new AuthorizationError("Engagement not found.");
  if (LOCKED_STATUSES.has(data.status)) {
    throw new AuthorizationError("This engagement is finalised - its ratings can no longer be changed.");
  }
}
