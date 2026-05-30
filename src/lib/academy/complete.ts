/**
 * Academy course-completion core. Verifies the learner PASSED every lesson
 * knowledge-check, marks the enrollment completed (idempotently), and issues an
 * 'academy_completion' VIFM credential carrying the average score.
 *
 * The pass gate is what makes the completion certificate sellable: a credential
 * is only issued when the learner cleared every lesson's passing threshold
 * (score_pct >= passing_score_pct, default 70). A merely "completed" attempt
 * that scored below the threshold does NOT certify the course.
 *
 * Lives in lib (not the route file) because Next.js App Router route modules may
 * only export the HTTP handlers + route config. Best-effort credential issue:
 * a failed issue does not unwind the completion (an admin can re-issue). Uses
 * createServiceClient (untyped; bypasses RLS).
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
  outline_en: unknown[] | null;
};

type AttemptRow = { lesson_key: string; score_pct: number | null; passing_score_pct: number | null };

export type MarkCompleteResult = {
  ok: boolean;
  /** Why a non-ok result occurred (route maps this to an HTTP status). */
  reason?: "not_found" | "not_passed";
  verificationCode: string | null;
  alreadyComplete: boolean;
  passedLessons: number;
  totalLessons: number;
  scorePct: number | null;
};

/** Number of lessons in a course = top-level outline sections (empty -> 1 "Overview"). */
function lessonCount(course: CourseRow | null): number {
  return Math.max(1, (course?.outline_en ?? []).length);
}

/** Distinct lessons the learner PASSED + their best-score average. */
function passSummary(attempts: AttemptRow[]): { passedKeys: Set<string>; avg: number | null } {
  const best = new Map<string, number>();
  for (const a of attempts) {
    const score = Number(a.score_pct ?? 0);
    const pass = Number(a.passing_score_pct ?? 70);
    if (score >= pass) best.set(a.lesson_key, Math.max(best.get(a.lesson_key) ?? 0, score));
  }
  const scores = Array.from(best.values());
  const avg = scores.length > 0 ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null;
  return { passedKeys: new Set(best.keys()), avg };
}

export async function markEnrollmentComplete(enrollmentId: string): Promise<MarkCompleteResult> {
  const sb = createServiceClient();
  const fail = (reason: MarkCompleteResult["reason"], extra: Partial<MarkCompleteResult> = {}): MarkCompleteResult => ({
    ok: false,
    reason,
    verificationCode: null,
    alreadyComplete: false,
    passedLessons: 0,
    totalLessons: 0,
    scorePct: null,
    ...extra,
  });

  const { data: enrollment } = (await sb
    .from("vifm_enrollments")
    .select("id, candidate_id, course_id, status, completed_at")
    .eq("id", enrollmentId)
    .maybeSingle()) as { data: EnrollmentRow | null };
  if (!enrollment) return fail("not_found");

  const alreadyComplete = enrollment.status === "completed";

  // Already certified for this enrollment -> return the existing code, no re-gate.
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
      passedLessons: 0,
      totalLessons: 0,
      scorePct: null,
    };
  }

  // Load course (outline -> lesson count + labels) and the lesson attempts.
  const { data: course } = (await sb
    .from("vifm_courses")
    .select("id, code, title_en, title_ar, level, vertical, outline_en")
    .eq("id", enrollment.course_id)
    .maybeSingle()) as { data: CourseRow | null };

  const { data: attempts } = (await sb
    .from("academy_lesson_attempts")
    .select("lesson_key, score_pct, passing_score_pct")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "completed")) as { data: AttemptRow[] | null };

  const totalLessons = lessonCount(course);
  const { passedKeys, avg } = passSummary(attempts ?? []);
  const passedLessons = passedKeys.size;

  // The gate: every lesson's knowledge-check must be passed.
  if (passedLessons < totalLessons) {
    return fail("not_passed", { alreadyComplete, passedLessons, totalLessons });
  }

  if (!alreadyComplete) {
    await sb
      .from("vifm_enrollments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", enrollmentId);
  }

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
    scorePct: avg,
    metadata: { course_code: course?.code ?? null, course_id: enrollment.course_id, passed_lessons: passedLessons, total_lessons: totalLessons },
  });

  return {
    ok: true,
    verificationCode: issued?.verificationCode ?? null,
    alreadyComplete,
    passedLessons,
    totalLessons,
    scorePct: avg,
  };
}
