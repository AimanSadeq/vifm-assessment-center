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
import { sendEmail } from "@/lib/integrations/email";
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

type IntegrityFlags = { blurCount?: number; pasteCount?: number };

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
  integrityFlags?: IntegrityFlags;
};

const CEFR_LABEL: Record<string, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper-intermediate",
  C1: "Advanced",
  C2: "Proficient / Mastery",
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
  meta: {
    language: FluentLanguage;
    takerName: string | null;
    takerEmail: string | null;
    aiGenerated: boolean;
    integrityFlags: IntegrityFlags | null;
  }
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
    const id = data.id as string;

    // Best-effort: integrity_flags exists only after migration 00043. A
    // separate update (not part of the insert) keeps a 00042-only DB working.
    if (meta.integrityFlags && Object.keys(meta.integrityFlags).length > 0) {
      try {
        await sb.from("eng_fluent_results").update({ integrity_flags: meta.integrityFlags }).eq("id", id);
      } catch {
        /* column not migrated — ignore */
      }
    }
    return id;
  } catch {
    return null;
  }
}

/** Email the taker their result + certificate link. Best-effort. */
async function emailFluentResult(
  resultId: string,
  to: string,
  takerName: string | null,
  result: FluentResult
): Promise<void> {
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    const certUrl = `${base}/api/ac/fluent/${resultId}/certificate`;
    await sendEmail({
      to,
      template: "fluent_result",
      data: {
        takerName: takerName || "Candidate",
        level: result.overall_cefr,
        levelLabel: CEFR_LABEL[result.overall_cefr] || "",
        reading: result.reading_cefr ?? "—",
        listening: result.listening_total > 0 ? result.listening_cefr : "—",
        writing: result.writing.cefr,
        speaking: result.speaking.attempted ? result.speaking.cefr : "—",
        certUrl,
      },
    });
    const sb = createServiceClient();
    try {
      await sb.from("eng_fluent_results").update({ email_sent_at: new Date().toISOString() }).eq("id", resultId);
    } catch {
      /* email_sent_at column not migrated — ignore */
    }
  } catch (e) {
    console.error("[fluent] result email failed:", e);
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

    const takerName = body.takerName?.trim() ? body.takerName.trim() : null;
    const takerEmail = body.takerEmail?.trim() ? body.takerEmail.trim() : null;

    const result_id = await persistResult(result, {
      language,
      takerName,
      takerEmail,
      aiGenerated: body.aiGenerated === true,
      integrityFlags: body.integrityFlags ?? null,
    });

    // Email the taker their result + certificate link (best-effort).
    if (result_id && takerEmail) {
      await emailFluentResult(result_id, takerEmail, takerName, result);
    }

    return NextResponse.json({ ...result, result_id });
  }

  return NextResponse.json({ error: "action must be 'start' or 'score'" }, { status: 400 });
}
