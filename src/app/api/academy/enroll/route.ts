/**
 * Academy enrollment. POST { candidateId, courseId, source? }.
 * Idempotent: returns the existing enrollment if present (never resets
 * progress on a re-click). Best-effort - no-ops gracefully if 00049 is
 * not yet applied. Uses createServiceClient (untyped) for the write.
 *
 * Under AUTH_ENABLED=false the candidate identity is trusted from the body
 * (dev). Under auth=on, gate against auth.uid() -> candidates.profile_id.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { guardAcademyCandidate } from "@/lib/academy/access";

export const dynamic = "force-dynamic";

const VALID_SOURCES = ["self", "admin_assigned", "recommender"];

export async function POST(req: Request) {
  let body: { candidateId?: string; courseId?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const candidateId = body.candidateId?.trim();
  const courseId = body.courseId?.trim();
  if (!candidateId || !courseId) {
    return NextResponse.json({ error: "candidateId and courseId are required" }, { status: 400 });
  }

  // Ownership: admin, or the candidate enrolling themselves.
  const denied = await guardAcademyCandidate(candidateId);
  if (denied) return denied;

  const source = VALID_SOURCES.includes(body.source ?? "") ? body.source : "self";

  try {
    const sb = createServiceClient();

    // Idempotent: if already enrolled, return it (do not reset status/progress).
    const { data: existing } = await sb
      .from("vifm_enrollments")
      .select("id, status")
      .eq("candidate_id", candidateId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ enrollment_id: existing.id, status: existing.status, existing: true });
    }

    const { data, error } = await sb
      .from("vifm_enrollments")
      .insert({ candidate_id: candidateId, course_id: courseId, source })
      .select("id, status")
      .single();
    if (error || !data) {
      console.error("[academy] enroll failed:", error?.message?.slice(0, 100));
      return NextResponse.json({ error: "enroll failed" }, { status: 500 });
    }
    return NextResponse.json({ enrollment_id: data.id, status: data.status, existing: false });
  } catch (e) {
    console.error("[academy] enroll error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
