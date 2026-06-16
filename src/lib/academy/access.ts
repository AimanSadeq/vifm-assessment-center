import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Ownership guard for Academy learner action routes (enroll / lesson start /
 * save / complete). Academy lessons are taken by the candidate themselves; an
 * admin may act on any candidate's behalf. Every other role is denied.
 * Returns a NextResponse to send on denial, or null when access is allowed.
 *
 * These routes use the service-role client (which bypasses RLS), so without
 * this check any authenticated user could pass another candidate's id and
 * drive lesson scoring / credential issuance. Under AUTH_ENABLED=false the
 * caller resolves to a synthetic admin, preserving the dev "trust the body"
 * behaviour.
 */
export async function guardAcademyCandidate(
  candidateId: string | null | undefined,
): Promise<NextResponse | null> {
  const caller = await getCurrentCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role === "admin") return null;
  if (caller.role !== "candidate" || !candidateId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sv = createServiceClient();
  const { data: cand } = await sv
    .from("candidates")
    .select("profile_id")
    .eq("id", candidateId)
    .maybeSingle<{ profile_id: string | null }>();

  return cand && cand.profile_id === caller.uid
    ? null
    : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Resolve the candidate that owns an enrollment (null if not found). */
export async function candidateIdForEnrollment(
  enrollmentId: string,
): Promise<string | null> {
  const sv = createServiceClient();
  const { data } = await sv
    .from("vifm_enrollments")
    .select("candidate_id")
    .eq("id", enrollmentId)
    .maybeSingle<{ candidate_id: string }>();
  return data?.candidate_id ?? null;
}

/** Resolve the candidate that owns a lesson attempt (null if not found). */
export async function candidateIdForAttempt(
  attemptId: string,
): Promise<string | null> {
  const sv = createServiceClient();
  const { data } = await sv
    .from("academy_lesson_attempts")
    .select("candidate_id")
    .eq("id", attemptId)
    .maybeSingle<{ candidate_id: string }>();
  return data?.candidate_id ?? null;
}
