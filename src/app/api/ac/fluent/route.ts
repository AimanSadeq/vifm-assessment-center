/**
 * VIFM Fluent — English placement prototype API (stateless scoring).
 *
 * POST /api/ac/fluent
 *   { action: "start", language }                     -> FluentTest
 *   { action: "score", language, reading, listening,
 *     answers, writingTask, writingResponse,
 *     speakingTask, speakingTranscript }               -> FluentResult
 *
 * Prototype note: the test (incl. answer key) lives client-side between
 * start and score — fine for a demo. Production would persist the test
 * server-side (eng_* tables) so the key never reaches the browser.
 *
 * Speaking audio is transcribed by the sibling /transcribe route (Whisper);
 * this route only ever sees the resulting text.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateFluentTest,
  scoreFluentWriting,
  scoreFluentSpeaking,
  computeFluentResult,
  type FluentLanguage,
  type FluentResult,
  type ReadingItem,
  type ListeningItem,
  type WritingTask,
  type SpeakingTask,
} from "@/lib/ai/fluent-english";

export const dynamic = "force-dynamic";

type Body = {
  action?: "start" | "score";
  language?: FluentLanguage;
  reading?: ReadingItem[];
  listening?: ListeningItem[];
  answers?: Record<string, number>;
  writingTask?: WritingTask;
  writingResponse?: string;
  speakingTask?: SpeakingTask | null;
  speakingTranscript?: string;
  takerName?: string | null;
  takerEmail?: string | null;
  aiGenerated?: boolean;
};

/**
 * Persist a completed result so it survives a refresh and feeds the
 * cohort report + certificate. Best-effort: if the eng_fluent_results
 * table isn't migrated yet (or the write fails), we swallow the error
 * and return the result without an id — the flow still completes, the
 * certificate button just won't appear.
 */
async function persistResult(
  result: FluentResult,
  meta: { language: FluentLanguage; takerName: string | null; takerEmail: string | null; aiGenerated: boolean }
): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const aiScored = result.writing.ai_generated || result.speaking.ai_generated;
    const { data, error } = await sb
      .from("eng_fluent_results")
      .insert({
        taker_name: meta.takerName,
        taker_email: meta.takerEmail,
        ui_language: meta.language,
        overall_cefr: result.overall_cefr,
        reading_correct: result.reading_correct,
        reading_total: result.reading_total,
        reading_cefr: result.reading_cefr,
        listening_correct: result.listening_correct,
        listening_total: result.listening_total,
        listening_cefr: result.listening_cefr,
        writing_cefr: result.writing.cefr,
        speaking_attempted: result.speaking.attempted,
        speaking_cefr: result.speaking.attempted ? result.speaking.cefr : null,
        ai_generated: meta.aiGenerated,
        ai_scored: aiScored,
        result,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const language: FluentLanguage = body.language === "ar" ? "ar" : "en";

  if (body.action === "start") {
    const test = await generateFluentTest({ language });
    return NextResponse.json(test);
  }

  if (body.action === "score") {
    const reading = Array.isArray(body.reading) ? body.reading : null;
    const listening = Array.isArray(body.listening) ? body.listening : [];
    const writingTask = body.writingTask ?? null;
    if (!reading || !writingTask) {
      return NextResponse.json(
        { error: "reading items and writingTask are required" },
        { status: 400 }
      );
    }

    const writing = await scoreFluentWriting({
      task: writingTask,
      response: String(body.writingResponse ?? ""),
      language,
    });

    const speakingTask = body.speakingTask ?? null;
    const speakingTranscript = String(body.speakingTranscript ?? "").trim();
    const speaking =
      speakingTask && speakingTranscript
        ? await scoreFluentSpeaking({ task: speakingTask, transcript: speakingTranscript, language })
        : undefined;

    const result = computeFluentResult({
      reading,
      listening,
      answers: body.answers ?? {},
      writing,
      speaking,
    });

    const result_id = await persistResult(result, {
      language,
      takerName: body.takerName?.trim() ? body.takerName.trim() : null,
      takerEmail: body.takerEmail?.trim() ? body.takerEmail.trim() : null,
      aiGenerated: body.aiGenerated === true,
    });

    return NextResponse.json({ ...result, result_id });
  }

  return NextResponse.json({ error: "action must be 'start' or 'score'" }, { status: 400 });
}
