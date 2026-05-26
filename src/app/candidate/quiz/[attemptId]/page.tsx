export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizInterface } from "./_components/quiz-interface";
import type { CandidateQuizAttempt } from "@/types/database";

type Props = { params: { attemptId: string } };

export default async function QuizAttemptPage({ params }: Props) {
  const supabase = await createClient();
  const { attemptId } = params;

  const { data: attempt, error } = await supabase
    .from("candidate_quiz_attempts")
    .select(
      "id, candidate_id, competency_id, status, questions, answers, total_count, started_at, competencies(id, name)"
    )
    .eq("id", attemptId)
    .single();

  if (error || !attempt) return notFound();

  // Already finalised - straight to results page.
  if (attempt.status !== "in_progress") {
    redirect(`/candidate/quiz/${attemptId}/results`);
  }

  const competency = attempt.competencies as unknown as { id: string; name: string } | null;

  return (
    <QuizInterface
      attemptId={attempt.id as string}
      competencyName={competency?.name ?? "Skill"}
      questions={attempt.questions as CandidateQuizAttempt["questions"]}
      initialAnswers={attempt.answers as CandidateQuizAttempt["answers"]}
      startedAt={attempt.started_at as string}
    />
  );
}
