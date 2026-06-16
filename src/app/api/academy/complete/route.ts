/**
 * Academy course completion. POST { enrollmentId }.
 *
 * Idempotently marks the enrollment completed and issues an
 * 'academy_completion' VIFM credential via the shared issuer. Best-effort:
 * a failed credential issue does not unwind the completion (an admin can
 * re-issue). Returns the new verification code, or the prior one when the
 * enrollment was already completed and credentialled.
 *
 * The reusable core (markEnrollmentComplete) lives in src/lib/academy/complete
 * so the per-lesson complete route can share it - App Router route files may
 * not export helpers.
 */
import { NextResponse } from "next/server";
import { markEnrollmentComplete } from "@/lib/academy/complete";
import { guardAcademyCandidate, candidateIdForEnrollment } from "@/lib/academy/access";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { enrollmentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const enrollmentId = body.enrollmentId?.trim();
  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId is required" }, { status: 400 });
  }

  // Ownership: admin, or the candidate who owns this enrollment. Gate before
  // completion + credential issuance.
  const denied = await guardAcademyCandidate(await candidateIdForEnrollment(enrollmentId));
  if (denied) return denied;

  try {
    const result = await markEnrollmentComplete(enrollmentId);
    if (!result.ok) {
      if (result.reason === "not_passed") {
        // Knowledge-check gate not cleared -> no completion, no credential.
        return NextResponse.json(
          {
            error: "Pass every lesson's knowledge-check before completing the course.",
            reason: "not_passed",
            passedLessons: result.passedLessons,
            totalLessons: result.totalLessons,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "enrollment not found" }, { status: 404 });
    }
    return NextResponse.json({
      verificationCode: result.verificationCode,
      alreadyComplete: result.alreadyComplete,
      scorePct: result.scorePct,
      passedLessons: result.passedLessons,
      totalLessons: result.totalLessons,
    });
  } catch (e) {
    console.error("[academy] complete error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
