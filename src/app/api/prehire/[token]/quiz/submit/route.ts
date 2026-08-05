import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken, rescoreCandidate } from "@/lib/prehire/candidate-access";
import { logPrehireEvent } from "@/lib/prehire/audit";
import type { IntegrityFlags, IntegrityEvent } from "@/lib/scoring/integrity";
import type { QuizQuestion } from "@/types/database";

type StoredDetail = { questions?: QuizQuestion[] } | null;

// PDPL-safe: keep only non-negative counts/durations/lengths and the event log's
// kind + numeric metadata - never any pasted/copied text. Mirrors the Fluent
// stage's advisory capture; used to prompt a human glance, never to auto-fail.
function sanitizeIntegrity(raw: unknown): IntegrityFlags | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  const events: IntegrityEvent[] = Array.isArray(r.events)
    ? (r.events as unknown[])
        .map((e): IntegrityEvent | null => {
          if (!e || typeof e !== "object") return null;
          const o = e as Record<string, unknown>;
          const at = num(o.at);
          if (o.kind === "blur") return { kind: "blur", at, awayMs: num(o.awayMs) };
          if (o.kind === "paste") return { kind: "paste", at, pasteChars: num(o.pasteChars) };
          if (o.kind === "copy") return { kind: "copy", at, copyChars: num(o.copyChars) };
          return null;
        })
        .filter((e): e is IntegrityEvent => e !== null)
        .slice(0, 200)
    : [];
  return {
    blurCount: num(r.blurCount),
    pasteCount: num(r.pasteCount),
    copyCount: num(r.copyCount),
    awayMs: num(r.awayMs),
    pasteChars: num(r.pasteChars),
    copyChars: num(r.copyChars),
    events,
  };
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  // Parity with the start route: a closed/archived requisition must not score a
  // stage either, or a sitting begun while open could still be recorded after close.
  if (ctx.requisition.status !== "open") {
    return NextResponse.json({ error: "This screening is no longer accepting submissions." }, { status: 403 });
  }
  if (!ctx.candidate.consent_at) {
    return NextResponse.json({ error: "Consent is required before submitting an assessment." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    answers?: Record<string, number>;
    integrity?: unknown;
  } | null;
  const answers = body?.answers ?? {};
  const integrity = sanitizeIntegrity(body?.integrity);

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
  // Build review WITHOUT correct_index - storing the answer key alongside
  // candidate answers in the same row is unnecessary (the keyed questions array
  // already exists server-side if a human review ever needs it) and risks leaking
  // correct answers through a future RLS regression on prehire_stage_results.
  const review = questions.map((q) => {
    const picked = typeof answers[q.id] === "number" ? answers[q.id] : null;
    const isCorrect = picked === q.correct_index;
    if (isCorrect) correct++;
    return { id: q.id, picked, isCorrect };
  });
  const total = questions.length || 1;
  const normalized = Math.round((100 * correct) / total);

  const cut = ctx.requisition.stage_config.find((s) => s.kind === "quiz")?.cut_score ?? null;
  const passed = cut == null ? true : normalized >= cut;

  // Strip the answer key from the stored questions to prevent forensic leakage
  // through the completed stage result row. The human-readable review is in
  // detail.review; the graded totals are in raw_score/normalized_score.
  const strippedQuestions = questions.map(({ correct_index: _omit, ...rest }) => rest);

  const { error } = await svc
    .from("prehire_stage_results")
    .update({
      status: "completed",
      raw_score: correct,
      normalized_score: normalized,
      passed,
      detail: { questions: strippedQuestions, answers, review },
      // Advisory integrity telemetry (tab-away / copy / paste). Surfaced to
      // recruiters on the SME review page; never auto-fails. Only written when
      // the client captured something.
      ...(integrity ? { flags: integrity } : {}),
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
