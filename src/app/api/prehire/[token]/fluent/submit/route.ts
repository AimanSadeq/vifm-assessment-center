/**
 * Pre-Hire Fluent - score the English placement stage.
 *
 * POST { answers, writingResponse, speakingTranscript, pronunciation,
 *        integrityFlags } -> { normalized, cefr }
 *
 * The full test (with the answer key) is reloaded server-side from
 * prehire_stage_results.detail.fullTest - the client never submits the key.
 * Receptive skills are auto-scored; writing + speaking are Claude-scored
 * (ensemble), with Azure pronunciation blended into speaking when available.
 *
 * The overall CEFR band maps to 0–100 (A1→0 … C2→100) so it sits on the same
 * normalized scale as the quiz and CBI stages and rolls into the composite.
 * A failed cut never auto-rejects - it only flags the candidate for review.
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
  type WritingScore,
  type SpeakingScore,
} from "@/lib/ai/fluent-english";
import { isAzureSpeechConfigured, type PronunciationScore } from "@/lib/integrations/speech";
import { resolveFluentSkills, FLUENT_SKILLS, type FluentSkill } from "@/types/prehire";
import { computeIntegritySignal, type IntegrityFlags } from "@/lib/scoring/integrity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type StoredDetail = { fullTest?: FluentTest; tts?: boolean; skills?: FluentSkill[] } | null;
type Body = {
  answers?: Record<string, number>;
  writingResponse?: string;
  speakingTranscript?: string;
  pronunciation?: PronunciationScore | null;
  integrityFlags?: IntegrityFlags;
};

const clamp100 = (n: unknown): number => {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.min(100, Math.max(0, x));
};

/**
 * S-6: the pronunciation score arrives in the POST body, so it is candidate-
 * controlled, and it contributes 0.3 of the speaking CEFR (a posted 100 can
 * lift speaking ~2 bands). Two guards before it is allowed to move the band:
 *   1. Only honour it when Azure Speech is configured server-side - otherwise
 *      there is no trustworthy acoustic source, so a posted value would be pure
 *      inflation and we discard it (transcript-only scoring, the safe default).
 *   2. Clamp every sub-score into [0,100] so an out-of-range value can't skew
 *      the blend.
 * Residual boundary: even with Azure on, the value is client-reported; the
 * fully robust design would assess pronunciation server-side from the audio.
 */
function sanitizePronunciation(
  raw: PronunciationScore | null | undefined
): PronunciationScore | null {
  if (!raw || typeof raw !== "object") return null;
  if (!isAzureSpeechConfigured()) return null;
  return {
    accuracy: clamp100(raw.accuracy),
    fluency: clamp100(raw.fluency),
    completeness: clamp100(raw.completeness),
    prosody: raw.prosody == null ? null : clamp100(raw.prosody),
    pron: clamp100(raw.pron),
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

  const body = (await req.json().catch(() => null)) as Body | null;

  const svc = createServiceClient();
  const { data: stage } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "fluent")
    .maybeSingle();

  const storedDetail = stage?.detail as StoredDetail;
  const fullTest = storedDetail?.fullTest;
  // A receptive-only test legitimately has an empty reading array (CAL-PRE-503),
  // so gate on the stored test existing rather than on reading length.
  if (!stage || !fullTest) {
    return NextResponse.json({ error: "Start the English test first." }, { status: 400 });
  }
  if (stage.status === "completed") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  // Which sub-skills were administered. Omitted/empty = all four (back-compat).
  const skills = resolveFluentSkills({ skills: storedDetail?.skills ?? null });

  const answers = body?.answers ?? {};
  // Self-consistency: average over FLUENT_SCORE_SAMPLES model calls (default 1).
  const samples = Math.max(1, Math.min(5, Number(process.env.FLUENT_SCORE_SAMPLES) || 1));

  // Only score the writing skill if it was administered; otherwise leave it
  // undefined so computeFluentResult excludes it from the overall band.
  const writing: WritingScore | undefined =
    skills.includes("writing") && fullTest.writing
      ? await scoreFluentWritingEnsemble({
          task: fullTest.writing,
          response: String(body?.writingResponse ?? ""),
          language: "en",
          samples,
        })
      : undefined;

  const speakingTranscript = String(body?.speakingTranscript ?? "").trim();
  const speakingBase: SpeakingScore | undefined =
    skills.includes("speaking") && fullTest.speaking && speakingTranscript
      ? await scoreFluentSpeakingEnsemble({
          task: fullTest.speaking,
          transcript: speakingTranscript,
          language: "en",
          samples,
        })
      : undefined;
  // Blend Azure pronunciation (acoustic) into the Claude content score - but
  // only after sanitizing the client-supplied value (S-6: gate on Azure being
  // configured + clamp each sub-score).
  const speaking = speakingBase
    ? blendPronunciation(speakingBase, sanitizePronunciation(body?.pronunciation))
    : undefined;

  const result = computeFluentResult({
    // The stored test is already filtered to the selected receptive skills, so
    // an unselected reading/listening array is [] and scores as "not assessed".
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

  // Partial placement = fewer than all four skills administered (CAL-PRE-503).
  // Persist the assessed-skills list so the report can label it and decline to
  // present a full Overall CEFR.
  const partial = skills.length < FLUENT_SKILLS.length;

  // CAL-FLU-601 + integrity pass: persist the widened flags + the advisory
  // signal for the recruiter/fairness view (never auto-fails the candidate).
  // aiLikelihood is SERVER-AUTHORITATIVE - the AI examiner's estimate from the
  // writing score overwrites (or removes) anything the candidate posted under
  // that key, mirroring the AC fluent route.
  const integrityFlags: IntegrityFlags = {
    ...(body?.integrityFlags ?? {}),
    aiLikelihood: typeof writing?.ai_likelihood === "number" ? writing.ai_likelihood : undefined,
  };
  if (integrityFlags.aiLikelihood === undefined) delete integrityFlags.aiLikelihood;

  const { error } = await svc
    .from("prehire_stage_results")
    .update({
      status: "completed",
      raw_score: idx + 1,
      normalized_score: normalized,
      passed,
      detail: { result, answers, skills, partial },
      flags: { ...integrityFlags, signal: computeIntegritySignal(integrityFlags) },
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
    detail: { kind: "fluent", normalized, passed, cefr: result.overall_cefr, skills, partial },
  });

  return NextResponse.json({ normalized, cefr: result.overall_cefr, partial });
}
