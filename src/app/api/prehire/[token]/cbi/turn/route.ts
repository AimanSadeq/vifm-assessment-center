import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { nextInterviewerTurn, MAX_CANDIDATE_ANSWERS, type CbiMessage } from "@/lib/ai/cbi-interviewer";

type CbiDetail = { history?: CbiMessage[] } | null;

function competencyFor(title: string) {
  return {
    id: "prehire-cbi",
    name: `${title} - behavioural competency`,
    description: `Behavioural competency for the ${title} role.`,
    positiveIndicators: [] as string[],
    negativeIndicators: [] as string[],
  };
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (!ctx.requisition.stage_config.some((s) => s.kind === "cbi")) {
    return NextResponse.json({ error: "Interview not configured for this role" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { answer?: string } | null;
  const answer = (body?.answer ?? "").toString().trim();

  const svc = createServiceClient();
  const { data: stage } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail, started_at")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "cbi")
    .maybeSingle();

  if (stage?.status === "completed") return NextResponse.json({ done: true });

  const history: CbiMessage[] = [...(((stage?.detail as CbiDetail)?.history) ?? [])];

  // Resume / re-start idempotency: if there's no new answer and the transcript
  // already ends on a pending interviewer question, return that question rather
  // than generating (and persisting) a duplicate. Lets a mid-interview refresh
  // pick up where it left off.
  const last = history[history.length - 1];
  if (!answer && last?.role === "interviewer") {
    const answered = history.filter((m) => m.role === "candidate").length;
    return NextResponse.json({
      message: last.text,
      shouldConclude: answered >= MAX_CANDIDATE_ANSWERS,
    });
  }

  if (answer) history.push({ role: "candidate", text: answer });

  const turn = await nextInterviewerTurn({
    competency: competencyFor(ctx.requisition.title),
    history,
    language: "en",
  });
  history.push({ role: "interviewer", text: turn.message });

  await svc.from("prehire_stage_results").upsert(
    {
      prehire_candidate_id: ctx.candidate.id,
      kind: "cbi",
      status: "in_progress",
      detail: { history },
      started_at: stage?.started_at ?? new Date().toISOString(),
    },
    { onConflict: "prehire_candidate_id,kind" }
  );

  return NextResponse.json({ message: turn.message, shouldConclude: turn.shouldConclude });
}
