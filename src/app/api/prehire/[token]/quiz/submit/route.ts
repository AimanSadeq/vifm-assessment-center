import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken, rescoreCandidate } from "@/lib/prehire/candidate-access";
import { logPrehireEvent } from "@/lib/prehire/audit";
import type { QuizQuestion } from "@/types/database";

type StoredDetail = { questions?: QuizQuestion[] } | null;

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { answers?: Record<string, number> } | null;
  const answers = body?.answers ?? {};

  const svc = createServiceClient();
  const { data: stage } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "quiz")
    .maybeSingle();

  const questions = (stage?.detail as StoredDetail)?.questions;
  if (!stage || !questions || questions.length === 0) {
    return NextResponse.json({ error: "Start the assessment first." }, { status: 400 });
  }
  if (stage.status === "completed") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  let correct = 0;
  const review = questions.map((q) => {
    const picked = typeof answers[q.id] === "number" ? answers[q.id] : null;
    const isCorrect = picked === q.correct_index;
    if (isCorrect) correct++;
    return { id: q.id, picked, correct_index: q.correct_index, isCorrect };
  });
  const total = questions.length || 1;
  const normalized = Math.round((100 * correct) / total);

  const cut = ctx.requisition.stage_config.find((s) => s.kind === "quiz")?.cut_score ?? null;
  const passed = cut == null ? true : normalized >= cut;

  const { error } = await svc
    .from("prehire_stage_results")
    .update({
      status: "completed",
      raw_score: correct,
      normalized_score: normalized,
      passed,
      detail: { questions, answers, review },
      completed_at: new Date().toISOString(),
    })
    .eq("id", stage.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await rescoreCandidate(ctx.candidate.id);

  await logPrehireEvent({
    action: "stage_completed",
    requisitionId: ctx.requisition.id,
    candidateId: ctx.candidate.id,
    actorLabel: "candidate",
    detail: { kind: "quiz", normalized, passed },
  });

  return NextResponse.json({ normalized, correct, total, passed });
}
