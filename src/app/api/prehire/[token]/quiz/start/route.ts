import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { generateQuizQuestions } from "@/lib/ai/quiz-generator";
import type { QuizQuestion } from "@/types/database";

type StoredDetail = { questions?: QuizQuestion[] } | null;

// Send the candidate everything EXCEPT the answer key (correct_index,
// explanations, points) - integrity matters for a hiring screen.
function strip(q: QuizQuestion) {
  return {
    id: q.id,
    type: q.type,
    prompt_en: q.prompt_en,
    prompt_ar: q.prompt_ar,
    options_en: q.options_en,
    options_ar: q.options_ar,
    sequence: q.sequence ?? null,
  };
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (!ctx.requisition.stage_config.some((s) => s.kind === "quiz")) {
    return NextResponse.json({ error: "Quiz not configured for this role" }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: existing } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "quiz")
    .maybeSingle();

  if (existing?.status === "completed") {
    return NextResponse.json({ done: true });
  }
  // Resume an in-progress attempt with the same questions (no regeneration).
  const stored = (existing?.detail as StoredDetail)?.questions;
  if (stored && stored.length > 0) {
    return NextResponse.json({ questions: stored.map(strip) });
  }

  const questions = await generateQuizQuestions({
    competency: {
      id: "prehire",
      name: `${ctx.requisition.title} — core competency`,
      description: `Core professional competencies for the ${ctx.requisition.title} role.`,
    },
    indicators: [],
    currentScore: null,
    targetScore: 3,
    bilingual: true,
  });

  if (!questions || questions.length === 0) {
    return NextResponse.json(
      { error: "Couldn't generate the assessment right now. Please try again shortly." },
      { status: 503 }
    );
  }

  await svc.from("prehire_stage_results").upsert(
    {
      prehire_candidate_id: ctx.candidate.id,
      kind: "quiz",
      status: "in_progress",
      detail: { questions },
      started_at: new Date().toISOString(),
    },
    { onConflict: "prehire_candidate_id,kind" }
  );

  return NextResponse.json({ questions: questions.map(strip) });
}
