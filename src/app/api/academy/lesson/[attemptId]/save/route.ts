/**
 * Academy lesson knowledge-check answer save. POST { questionIndex, pickedIndex }.
 *
 * Mirrors the candidate quiz saveQuizAnswerAction: fetch the attempt's
 * answers JSONB, update the slot by index, write back. Idempotent. Uses
 * createServiceClient (untyped; bypasses RLS) since AUTH_ENABLED=false in
 * dev and the academy_lesson_attempts table is untyped on the client.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { guardAcademyCandidate, candidateIdForAttempt } from "@/lib/academy/access";
import type { QuizAnswer, QuizQuestion } from "@/types/database";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { attemptId: string } }
) {
  const attemptId = params.attemptId?.trim();
  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  // Ownership: admin, or the candidate who owns this attempt.
  const denied = await guardAcademyCandidate(await candidateIdForAttempt(attemptId));
  if (denied) return denied;

  let body: { questionIndex?: number; pickedIndex?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const questionIndex = body.questionIndex;
  const pickedIndex = body.pickedIndex ?? null;
  if (typeof questionIndex !== "number" || questionIndex < 0) {
    return NextResponse.json({ error: "questionIndex is required" }, { status: 400 });
  }

  try {
    const sb = createServiceClient();

    const { data: attempt, error: fetchErr } = await sb
      .from("academy_lesson_attempts")
      .select("answers, status, questions")
      .eq("id", attemptId)
      .maybeSingle();

    if (fetchErr || !attempt) {
      return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "this attempt has already been finalised" },
        { status: 409 }
      );
    }

    const questions = (attempt.questions as QuizQuestion[]) ?? [];
    if (questionIndex >= questions.length) {
      return NextResponse.json({ error: "question index out of range" }, { status: 400 });
    }

    const answers = ((attempt.answers as QuizAnswer[]) ?? []).slice();
    answers[questionIndex] = {
      question_id: questions[questionIndex].id,
      picked_index: pickedIndex,
      answered_at: new Date().toISOString(),
    };

    const { error: updateErr } = await sb
      .from("academy_lesson_attempts")
      .update({ answers })
      .eq("id", attemptId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[academy] lesson save error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
