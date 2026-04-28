"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  startQuizSchema,
  saveQuizAnswerSchema,
  completeQuizSchema,
  type StartQuizValues,
  type SaveQuizAnswerValues,
  type CompleteQuizValues,
} from "@/lib/validations/assessor";
import { generateQuizQuestions } from "@/lib/ai/quiz-generator";
import { isAIConfigured } from "@/lib/ai/client";
import { publishToAllAdmins } from "@/lib/notifications/publish";
import type { BehavioralIndicator, QuizAnswer, QuizQuestion } from "@/types/database";

/**
 * Kicks off an AI-generated quiz attempt for a single competency. Returns the
 * new attempt id on success — caller redirects to /candidate/quiz/[id].
 *
 * The AI call is the slow step (15–30 s); the page shows a "Preparing your
 * quiz" loading state during that window.
 */
export async function startQuizAttemptAction(values: StartQuizValues) {
  const parsed = startQuizSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  if (!isAIConfigured()) {
    return {
      error:
        "AI is not configured on this server. Set ANTHROPIC_API_KEY in .env.local to enable quizzes.",
    };
  }

  const supabase = await createClient();
  const { candidateId, competencyId } = parsed.data;

  // Pull the competency, behavioural indicators, dev tips, and the candidate's
  // current consensus rating + role-profile target — everything the AI needs
  // to ground a competency-specific deck.
  const [compRes, indRes, consRes, candRes] = await Promise.all([
    supabase
      .from("competencies")
      .select("id, name, description")
      .eq("id", competencyId)
      .single(),
    supabase
      .from("behavioral_indicators")
      .select("indicator_type, description")
      .eq("competency_id", competencyId),
    supabase
      .from("consensus_ratings")
      .select("final_score")
      .eq("candidate_id", candidateId)
      .eq("competency_id", competencyId)
      .maybeSingle(),
    supabase
      .from("candidates")
      .select("id, role_profile_id, role_profiles(default_target_proficiency)")
      .eq("id", candidateId)
      .single(),
  ]);

  if (compRes.error || !compRes.data) {
    return { error: "Competency not found." };
  }
  if (candRes.error || !candRes.data) {
    return { error: "Candidate not found." };
  }

  const profile = candRes.data.role_profiles as unknown as {
    default_target_proficiency: number | null;
  } | null;
  const target = profile?.default_target_proficiency ?? 3;
  const currentScore = consRes.data?.final_score ?? null;

  // Behavioural indicators include both real BIs and development tips with
  // a "[DEV TIP] " prefix (per migration 00004). Split them so the AI sees
  // tips as actionable suggestions and BIs as observed-in-the-job behaviours.
  const allIndicators =
    (indRes.data as Pick<BehavioralIndicator, "indicator_type" | "description">[] | null) ?? [];
  const indicators = allIndicators.filter((r) => !r.description.startsWith("[DEV TIP]"));
  const developmentTips = allIndicators
    .filter((r) => r.description.startsWith("[DEV TIP]"))
    .map((r) => r.description.replace(/^\[DEV TIP\]\s*/, ""))
    .slice(0, 3);

  // Always ask for bilingual output (en + ar). The candidate's locale
  // toggle on the quiz page picks which to show; if they never switch
  // languages, the Arabic fields just sit unused. Cost is one extra
  // pass through Claude per generation, which is fine because
  // generation is a one-shot per attempt.
  const questions = await generateQuizQuestions({
    competency: compRes.data,
    indicators,
    developmentTips,
    currentScore,
    targetScore: target,
    bilingual: true,
  });

  if (!questions || questions.length === 0) {
    return {
      error:
        "AI extraction failed — no valid questions returned. Check the server logs and try again.",
    };
  }

  // Pre-seed answers array so saveQuizAnswerAction can update by index.
  const initialAnswers: QuizAnswer[] = questions.map((q) => ({
    question_id: q.id,
    picked_index: null,
    answered_at: new Date().toISOString(),
  }));

  const { data: attempt, error: insertErr } = await supabase
    .from("candidate_quiz_attempts")
    .insert({
      candidate_id: candidateId,
      competency_id: competencyId,
      status: "in_progress",
      questions,
      answers: initialAnswers,
      total_count: questions.length,
    })
    .select("id")
    .single();

  if (insertErr || !attempt) {
    return {
      error: insertErr?.message ?? "Could not create the quiz attempt — RLS may have blocked it.",
    };
  }

  return { attemptId: attempt.id as string };
}

/**
 * Saves the candidate's pick on a single question. Updates the answers JSONB
 * in place by index. Idempotent — re-saving the same answer is a no-op.
 */
export async function saveQuizAnswerAction(values: SaveQuizAnswerValues) {
  const parsed = saveQuizAnswerSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { attemptId, questionIndex, pickedIndex } = parsed.data;

  // Fetch the current answers, update by index, write back. Done as a single
  // round-trip via upsert-style; RLS protects the candidate from touching
  // someone else's attempt.
  const { data: attempt, error: fetchErr } = await supabase
    .from("candidate_quiz_attempts")
    .select("answers, status, questions")
    .eq("id", attemptId)
    .single();

  if (fetchErr || !attempt) return { error: "Attempt not found." };
  if (attempt.status !== "in_progress") {
    return { error: "This attempt has already been finalised." };
  }

  const questions = attempt.questions as QuizQuestion[];
  if (questionIndex >= questions.length) {
    return { error: "Question index out of range." };
  }

  const answers = (attempt.answers as QuizAnswer[]).slice();
  answers[questionIndex] = {
    question_id: questions[questionIndex].id,
    picked_index: pickedIndex,
    answered_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabase
    .from("candidate_quiz_attempts")
    .update({ answers })
    .eq("id", attemptId);

  if (updateErr) return { error: updateErr.message };
  return { success: true };
}

/**
 * Finalises an attempt: scores it, computes time taken, sets status to
 * "completed". The result page reads from this same row, so the score never
 * changes between saves.
 */
export async function completeQuizAttemptAction(values: CompleteQuizValues) {
  const parsed = completeQuizSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { attemptId } = parsed.data;

  const { data: attempt, error: fetchErr } = await supabase
    .from("candidate_quiz_attempts")
    .select("started_at, questions, answers, status, candidate_id")
    .eq("id", attemptId)
    .single();

  if (fetchErr || !attempt) return { error: "Attempt not found." };
  if (attempt.status !== "in_progress") {
    return { error: "This attempt has already been finalised." };
  }

  const questions = attempt.questions as QuizQuestion[];
  const answers = attempt.answers as QuizAnswer[];

  let earnedPoints = 0;
  let possiblePoints = 0;
  let correctCount = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    possiblePoints += q.points;
    if (answers[i]?.picked_index === q.correct_index) {
      earnedPoints += q.points;
      correctCount += 1;
    }
  }

  const scorePct =
    possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 10000) / 100 : 0;

  const startedAt = new Date(attempt.started_at as string);
  const completedAt = new Date();
  const timeTakenSeconds = Math.max(
    0,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
  );

  // The auth-aware client read above already enforced ownership. The write
  // now runs through the service-role client because migration 00019's
  // candidate_quiz_attempts_immutable_check trigger would refuse a
  // candidate's own session updating status/score/completed_at fields.
  // Service-role contexts have auth_role()=null and short-circuit the
  // trigger.
  const service = createServiceClient();
  const { error: updateErr } = await service
    .from("candidate_quiz_attempts")
    .update({
      status: "completed",
      score_pct: scorePct,
      correct_count: correctCount,
      time_taken_seconds: timeTakenSeconds,
      completed_at: completedAt.toISOString(),
    })
    .eq("id", attemptId);

  if (updateErr) return { error: updateErr.message };

  // H3: notify admins when a quiz completes — useful signal that a learner
  // is engaging with self-serve content between assessor-led sessions.
  // Pull candidate + competency labels for a meaningful body.
  const { data: candNamed } = await supabase
    .from("candidates")
    .select("full_name")
    .eq("id", attempt.candidate_id)
    .maybeSingle();
  const competencyId = (await supabase
    .from("candidate_quiz_attempts")
    .select("competency_id, competencies(name)")
    .eq("id", attemptId)
    .maybeSingle()).data;
  const competencyName = (competencyId?.competencies as unknown as { name?: string } | null)
    ?.name;
  // Dedupe retake-spam: a candidate finishing the same competency's
  // quiz multiple times in 24h produces one admin notification, not N.
  // The latest score isn't reflected in the surviving notification, but
  // the admin still sees the candidate is engaging — which is the
  // signal the notification is for.
  const competencyIdValue = (competencyId?.competency_id as string | undefined) ?? "unknown";
  // MM:SS so admins can spot speed-runs (suspicious) and slow-thoughtful
  // attempts (engaged) at a glance, without expanding the notification.
  const mins = Math.floor(timeTakenSeconds / 60);
  const secs = timeTakenSeconds % 60;
  const durationLabel = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  await publishToAllAdmins({
    kind: "quiz_completed",
    title: `${candNamed?.full_name ?? "A candidate"} completed an AI quiz`,
    body: competencyName
      ? `${competencyName} · ${Math.round(scorePct)}% (${correctCount}/${questions.length}) · ${durationLabel}`
      : `Score: ${Math.round(scorePct)}% · ${durationLabel}`,
    link: `/admin/engagements`,
    data: { attemptId, scorePct, correctCount, timeTakenSeconds },
    dedupeKey: `quiz_completed:${attempt.candidate_id}:${competencyIdValue}`,
  });

  revalidatePath(`/candidate/skills/${attempt.candidate_id}`);
  return { success: true, scorePct, correctCount };
}

/**
 * Marks an attempt as abandoned without scoring. The candidate can still see
 * the questions they reached on the results page, but score and correct_count
 * are left null so the candidate can retake without a "Failed" stigma.
 */
export async function abandonQuizAttemptAction(values: CompleteQuizValues) {
  const parsed = completeQuizSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { attemptId } = parsed.data;

  const { data: attempt, error: fetchErr } = await supabase
    .from("candidate_quiz_attempts")
    .select("started_at, status, candidate_id")
    .eq("id", attemptId)
    .single();
  if (fetchErr || !attempt) return { error: "Attempt not found." };
  if (attempt.status !== "in_progress") {
    return { error: "This attempt has already been finalised." };
  }

  const startedAt = new Date(attempt.started_at as string);
  const completedAt = new Date();
  const timeTakenSeconds = Math.max(
    0,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
  );

  // Service-role write — same reason as completeQuizAttemptAction:
  // the candidate_quiz_attempts_immutable_check trigger refuses
  // candidate-context updates to status/completed_at.
  const service = createServiceClient();
  const { error: updateErr } = await service
    .from("candidate_quiz_attempts")
    .update({
      status: "abandoned",
      time_taken_seconds: timeTakenSeconds,
      completed_at: completedAt.toISOString(),
    })
    .eq("id", attemptId);

  if (updateErr) return { error: updateErr.message };

  revalidatePath(`/candidate/skills/${attempt.candidate_id}`);
  return { success: true };
}
