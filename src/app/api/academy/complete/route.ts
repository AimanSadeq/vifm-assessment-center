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

  try {
    const result = await markEnrollmentComplete(enrollmentId);
    if (!result.ok) {
      return NextResponse.json({ error: "enrollment not found" }, { status: 404 });
    }
    return NextResponse.json({
      verificationCode: result.verificationCode,
      alreadyComplete: result.alreadyComplete,
    });
  } catch (e) {
    console.error("[academy] complete error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
