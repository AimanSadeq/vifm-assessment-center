/**
 * Pre-Hire Fluent — score the English placement stage.
 *
 * POST { answers, writingResponse, speakingTranscript, pronunciation,
 *        integrityFlags } -> { normalized, cefr }
 *
 * The full test (with the answer key) is reloaded server-side from
 * prehire_stage_results.detail.fullTest — the client never submits the key.
 * Receptive skills are auto-scored; writing + speaking are Claude-scored
 * (ensemble), with Azure pronunciation blended into speaking when available.
 *
 * The overall CEFR band maps to 0–100 (A1→0 … C2→100) so it sits on the same
 * normalized scale as the quiz and CBI stages and rolls into the composite.
 * A failed cut never auto-rejects — it only flags the candidate for review.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken, rescoreCandidate } from "@/lib/prehire/candidate-access";
import { logPrehireEvent } from "@/lib/prehire/audit";
import {
  scoreFluentWritingEnsemble,
  scoreFluentSpeakingEnsemble,
  blendPronunciation,
  computeFluentResult,
  CEFR_ORDER,
  type FluentTest,
} from "@/lib/ai/fluent-english";
import type { PronunciationScore } from "@/lib/integrations/speech";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type StoredDetail = { fullTest?: FluentTest; tts?: boolean } | null;
type IntegrityFlags = { blurCount?: number; pasteCount?: number };
type Body = {
  answers?: Record<string, number>;
  writingResponse?: string;
  speakingTranscript?: string;
  pronunciation?: PronunciationScore | null;
  integrityFlags?: IntegrityFlags;
};

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Body | null;

  const svc = createServiceClient();
  const { data: stage } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "fluent")
    .maybeSingle();

  const fullTest = (stage?.detail as StoredDetail)?.fullTest;
  if (!stage || !fullTest || !fullTest.reading?.length) {
    return NextResponse.json({ error: "Start the English test first." }, { status: 400 });
  }
  if (stage.status === "completed") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  const answers = body?.answers ?? {};
  // Self-consistency: average over FLUENT_SCORE_SAMPLES model calls (default 1).
  const samples = Math.max(1, Math.min(5, Number(process.env.FLUENT_SCORE_SAMPLES) || 1));

  const writing = await scoreFluentWritingEnsemble({
    task: fullTest.writing,
    response: String(body?.writingResponse ?? ""),
    language: "en",
    samples,
  });

  const speakingTranscript = String(body?.speakingTranscript ?? "").trim();
  const speakingBase =
    fullTest.speaking && speakingTranscript
      ? await scoreFluentSpeakingEnsemble({
          task: fullTest.speaking,
          transcript: speakingTranscript,
          language: "en",
          samples,
        })
      : undefined;
  // Blend Azure pronunciation (acoustic) into the Claude content score.
  const speaking = speakingBase ? blendPronunciation(speakingBase, body?.pronunciation ?? null) : undefined;

  const result = computeFluentResult({
    reading: fullTest.reading,
    listening: fullTest.listening ?? [],
    answers,
    writing,
    speaking,
  });

  // CEFR band → 0–100 (A1→0 … C2→100), consistent with quiz/cbi normalization.
  const idx = Math.max(0, CEFR_ORDER.indexOf(result.overall_cefr));
  const normalized = Math.round((idx / (CEFR_ORDER.length - 1)) * 100);
  const cut = ctx.requisition.stage_config.find((s) => s.kind === "fluent")?.cut_score ?? null;
  const passed = cut == null ? true : normalized >= cut;

  const { error } = await svc
    .from("prehire_stage_results")
    .update({
      status: "completed",
      raw_score: idx + 1,
      normalized_score: normalized,
      passed,
      detail: { result, answers },
      flags: body?.integrityFlags ?? {},
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
    detail: { kind: "fluent", normalized, passed, cefr: result.overall_cefr },
  });

  return NextResponse.json({ normalized, cefr: result.overall_cefr });
}
