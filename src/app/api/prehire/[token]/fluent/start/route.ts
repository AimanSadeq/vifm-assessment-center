/**
 * Pre-Hire Fluent — start the English placement stage.
 *
 * POST -> { test, tts } where `test` is the answer-key-STRIPPED placement test
 * for the browser. The full test (with the answer key + listening scripts) is
 * persisted server-side in prehire_stage_results.detail.fullTest and never
 * reaches the client — integrity matters for a hiring screen.
 *
 * Mirrors the quiz/start contract: returns { done: true } if already completed,
 * resumes an in-progress attempt with the SAME test (no regeneration), or
 * generates a fresh one. Token-gated; all access via the service client.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import {
  generateFluentTest,
  stripAnswerKey,
  type FluentTest,
  type PublicFluentTest,
} from "@/lib/ai/fluent-english";
import { isAzureSpeechConfigured } from "@/lib/integrations/speech";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type StoredDetail = { fullTest?: FluentTest; tts?: boolean } | null;

// Build the browser payload: strip the answer key, and when neural TTS is on
// also drop the listening scripts (the client plays audio via /fluent/tts so
// it never needs the text — a reading-the-script shortcut is closed off).
function clientPayload(test: FluentTest, tts: boolean): PublicFluentTest {
  const pub = stripAnswerKey(test);
  if (tts) {
    pub.listening = pub.listening.map((it) => ({
      id: it.id,
      question: it.question,
      options: it.options,
      cefr: it.cefr,
    }));
  }
  return pub;
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (!ctx.requisition.stage_config.some((s) => s.kind === "fluent")) {
    return NextResponse.json({ error: "English test not configured for this role" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: existing } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail, started_at")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "fluent")
    .maybeSingle();

  if (existing?.status === "completed") {
    return NextResponse.json({ done: true });
  }

  const tts = isAzureSpeechConfigured();

  // Resume an in-progress attempt with the same test (no regeneration).
  const stored = (existing?.detail as StoredDetail)?.fullTest;
  if (stored && stored.reading?.length) {
    return NextResponse.json({ test: clientPayload(stored, tts), tts });
  }

  const test = await generateFluentTest({ language: "en" });

  await svc.from("prehire_stage_results").upsert(
    {
      prehire_candidate_id: ctx.candidate.id,
      kind: "fluent",
      status: "in_progress",
      detail: { fullTest: test, tts },
      started_at: existing?.started_at ?? new Date().toISOString(),
    },
    { onConflict: "prehire_candidate_id,kind" }
  );

  return NextResponse.json({ test: clientPayload(test, tts), tts });
}
