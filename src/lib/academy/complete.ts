/**
 * Academy course-completion core. Marks an enrollment completed (idempotently)
 * and issues an 'academy_completion' VIFM credential via the shared issuer.
 *
 * Lives in lib (not in the route file) because Next.js App Router route
 * modules may only export the HTTP handlers + route config - exporting a
 * helper from route.ts breaks the production type-check. Both the
 * course-level complete route and the per-lesson complete route import this.
 *
 * Best-effort: a failed credential issue does not unwind the completion
 * (an admin can re-issue). Uses createServiceClient (untyped; bypasses RLS).
 */
import { createServiceClient } from "@/lib/supabase/server";
import { issueCredential } from "@/lib/credentials/issue";

type EnrollmentRow = {
  id: string;
  candidate_id: string;
  course_id: string;
  status: string;
  completed_at: string | null;
};

type CourseRow = {
  id: string;
  code: string | null;
  title_en: string;
  title_ar: string | null;
  level: string;
  vertical: string;
};

export type MarkCompleteResult = {
  ok: boolean;
  verificationCode: string | null;
  alreadyComplete: boolean;
};

/**
 * Marks the enrollment completed (if not already) and issues a credential.
 * Returns the verification code on success. Safe to call repeatedly: it will
 * not double-issue when a credential already exists for this enrollment.
 */
export async function markEnrollmentComplete(
  enrollmentId: string
): Promise<MarkCompleteResult> {
  const sb = createServiceClient();

  const { data: enrollment } = (await sb
    .from("vifm_enrollments")
    .select("id, candidate_id, course_id, status, completed_at")
    .eq("id", enrollmentId)
    .maybeSingle()) as { data: EnrollmentRow | null };
  if (!enrollment) return { ok: false, verificationCode: null, alreadyComplete: false };

  const alreadyComplete = enrollment.status === "completed";

  // Mark completed if needed.
  if (!alreadyComplete) {
    await sb
      .from("vifm_enrollments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", enrollmentId);
  }

  // Avoid double-issuing: a credential for this enrollment (source_id) means
  // we already certified it. Return the existing code.
  const { data: priorCred } = await sb
    .from("vifm_credentials")
    .select("verification_code")
    .eq("source_id", enrollmentId)
    .eq("credential_type", "academy_completion")
    .maybeSingle();
  if (priorCred) {
    return {
      ok: true,
      verificationCode: (priorCred.verification_code as string) ?? null,
      alreadyComplete,
    };
  }

  // Load course + candidate for the credential labels.
  const { data: course } = (await sb
    .from("vifm_courses")
    .select("id, code, title_en, title_ar, level, vertical")
    .eq("id", enrollment.course_id)
    .maybeSingle()) as { data: CourseRow | null };

  const { data: candidate } = (await sb
    .from("candidates")
    .select("full_name, email")
    .eq("id", enrollment.candidate_id)
    .maybeSingle()) as { data: { full_name: string; email: string | null } | null };

  const issued = await issueCredential({
    candidateId: enrollment.candidate_id,
    issuedToName: candidate?.full_name ?? "VIFM Learner",
    issuedToEmail: candidate?.email ?? null,
    type: "academy_completion",
    titleEn: `VIFM Academy - ${course?.title_en ?? "Course Completion"}`,
    titleAr: course?.title_ar ?? null,
    subtitleEn: course ? `${course.level} · ${course.vertical}` : null,
    sourceId: enrollmentId,
    scorePct: null,
    metadata: { course_code: course?.code ?? null, course_id: enrollment.course_id },
  });

  return {
    ok: true,
    verificationCode: issued?.verificationCode ?? null,
    alreadyComplete,
  };
}
