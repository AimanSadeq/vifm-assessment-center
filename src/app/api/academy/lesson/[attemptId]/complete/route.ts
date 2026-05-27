/**
 * Academy lesson knowledge-check completion. POST (no body needed).
 *
 * Scores the attempt against the stored questions (points-weighted, like the
 * candidate quiz), writes status='completed' + score_pct + correct_count +
 * completed_at, then checks whether every lesson of the enrollment's course
 * is now complete. If so, finalises the enrollment and issues the Academy
 * credential via the shared markEnrollmentComplete() helper (kept DRY).
 *
 * "All lessons complete" = count of completed attempts >= outline section
 * count, with the empty-outline-counts-as-one-lesson rule. Pass = score_pct
 * >= passing_score_pct (fixed 70). Uses createServiceClient throughout.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { markEnrollmentComplete } from "@/lib/academy/complete";
import type {
  QuizAnswer,
  QuizQuestion,
  VifmCourseOutlineSection,
} from "@/types/database";

export const dynamic = "force-dynamic";

type AttemptRow = {
  id: string;
  enrollment_id: string;
  course_id: string;
  started_at: string;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  status: string;
  passing_score_pct: number;
};

export async function POST(
  _req: Request,
  { params }: { params: { attemptId: string } }
) {
  const attemptId = params.attemptId?.trim();
  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  try {
    const sb = createServiceClient();

    const { data: attempt, error: fetchErr } = (await sb
      .from("academy_lesson_attempts")
      .select(
        "id, enrollment_id, course_id, started_at, questions, answers, status, passing_score_pct"
      )
      .eq("id", attemptId)
      .maybeSingle()) as { data: AttemptRow | null; error: { message: string } | null };

    if (fetchErr || !attempt) {
      return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    }

    const questions = attempt.questions ?? [];
    const answers = attempt.answers ?? [];
    const passing = Number(attempt.passing_score_pct ?? 70);

    // Score (points-weighted), even if already finalised, so an idempotent
    // re-POST returns a consistent pass/fail without mutating the row again.
    let earned = 0;
    let possible = 0;
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      possible += q.points;
      if (answers[i]?.picked_index === q.correct_index) {
        earned += q.points;
        correctCount += 1;
      }
    }
    const scorePct = possible > 0 ? Math.round((earned / possible) * 10000) / 100 : 0;
    const passed = scorePct >= passing;

    // Finalise only on the first completion.
    if (attempt.status === "in_progress") {
      const startedAt = new Date(attempt.started_at);
      const completedAt = new Date();
      const timeTakenSeconds = Math.max(
        0,
        Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
      );
      const { error: updateErr } = await sb
        .from("academy_lesson_attempts")
        .update({
          status: "completed",
          score_pct: scorePct,
          correct_count: correctCount,
          time_taken_seconds: timeTakenSeconds,
          completed_at: completedAt.toISOString(),
        })
        .eq("id", attemptId);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    // How many lessons does this course have?
    const { data: course } = (await sb
      .from("vifm_courses")
      .select("outline_en")
      .eq("id", attempt.course_id)
      .maybeSingle()) as { data: { outline_en: VifmCourseOutlineSection[] | null } | null };
    const outlineLen = course?.outline_en?.length ?? 0;
    const lessonCount = Math.max(1, outlineLen); // empty outline = one virtual lesson

    // How many distinct lessons are completed for this enrollment?
    const { data: completedRows } = await sb
      .from("academy_lesson_attempts")
      .select("lesson_key")
      .eq("enrollment_id", attempt.enrollment_id)
      .eq("status", "completed");
    const completedKeys = new Set(
      ((completedRows as { lesson_key: string }[] | null) ?? []).map((r) => r.lesson_key)
    );
    const allComplete = completedKeys.size >= lessonCount;

    let verificationCode: string | null = null;
    if (allComplete) {
      const result = await markEnrollmentComplete(attempt.enrollment_id);
      verificationCode = result.verificationCode;
    }

    return NextResponse.json({
      passed,
      scorePct,
      correctCount,
      totalCount: questions.length,
      allComplete,
      verificationCode,
    });
  } catch (e) {
    console.error("[academy] lesson complete error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
