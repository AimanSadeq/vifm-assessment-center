/**
 * Pre-Hire Fluent - start the English placement stage.
 *
 * POST -> { test, tts } where `test` is the answer-key-STRIPPED placement test
 * for the browser. The full test (with the answer key + listening scripts) is
 * persisted server-side in prehire_stage_results.detail.fullTest and never
 * reaches the client - integrity matters for a hiring screen.
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
import { resolveFluentSkills, type FluentSkill } from "@/types/prehire";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// `skills` records which CEFR sub-skills this stage administers (CAL-PRE-503).
// Stored alongside the full test so submit scores exactly the same set.
type StoredDetail = { fullTest?: FluentTest; tts?: boolean; skills?: FluentSkill[] } | null;

// Filter the FULL test (still server-side, key intact) to the selected skills:
// drop unselected receptive arrays to [] (they then score as "not assessed");
// productive tasks (writing/speaking) stay on the stored object but submit only
// scores them when selected. Receptive filtering happens here so the stored
// fullTest mirrors exactly what the candidate sees.
function filterFullTest(test: FluentTest, skills: FluentSkill[]): FluentTest {
  return {
    ...test,
    reading: skills.includes("reading") ? test.reading : [],
    listening: skills.includes("listening") ? test.listening : [],
  };
}

// Build the browser payload: strip the answer key, drop the productive tasks that
// were not selected, and when neural TTS is on also drop the listening scripts
// (the client plays audio via /fluent/tts so it never needs the text - a
// reading-the-script shortcut is closed off). The full test is already filtered
// to the selected receptive skills before reaching here.
function clientPayload(test: FluentTest, tts: boolean, skills: FluentSkill[]): PublicFluentTest {
  const pub = stripAnswerKey(test);
  if (tts) {
    pub.listening = pub.listening.map((it) => ({
      id: it.id,
      question: it.question,
      options: it.options,
      cefr: it.cefr,
    }));
  }
  if (!skills.includes("writing")) pub.writing = undefined;
  if (!skills.includes("speaking")) pub.speaking = undefined;
  return pub;
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (!ctx.candidate.consent_at) {
    return NextResponse.json({ error: "Consent is required before starting an assessment." }, { status: 403 });
  }
  if (ctx.requisition.status !== "open") {
    return NextResponse.json({ error: "This screening is no longer accepting submissions." }, { status: 403 });
  }
  const fluentEntry = ctx.requisition.stage_config.find((s) => s.kind === "fluent");
  if (!fluentEntry) {
    return NextResponse.json({ error: "English test not configured for this role" }, { status: 400 });
  }
  // Omitted/empty skills = all four (back-compat with legacy requisitions).
  const skills = resolveFluentSkills(fluentEntry);

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

  // Resume an in-progress attempt with the same test (no regeneration). Use the
  // skills stored at first start so a mid-flight requisition edit can't change
  // an in-progress test; fall back to the resolved set for pre-CAL-PRE-503 rows.
  const storedDetail = existing?.detail as StoredDetail;
  const stored = storedDetail?.fullTest;
  if (stored) {
    // A receptive-only (e.g. listening-only) test legitimately has an empty
    // reading array, so resume whenever a stored full test is present rather
    // than gating on reading length (the pre-CAL-PRE-503 check).
    const storedSkills = resolveFluentSkills({ skills: storedDetail?.skills ?? null });
    return NextResponse.json({ test: clientPayload(stored, tts, storedSkills), tts });
  }

  const generated = await generateFluentTest({ language: "en" });
  const test = filterFullTest(generated, skills);

  await svc.from("prehire_stage_results").upsert(
    {
      prehire_candidate_id: ctx.candidate.id,
      kind: "fluent",
      status: "in_progress",
      detail: { fullTest: test, tts, skills },
      started_at: existing?.started_at ?? new Date().toISOString(),
    },
    { onConflict: "prehire_candidate_id,kind" }
  );

  return NextResponse.json({ test: clientPayload(test, tts, skills), tts });
}
