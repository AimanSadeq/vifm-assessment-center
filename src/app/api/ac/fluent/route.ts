/**
 * Fluent - English placement API.
 *
 * POST /api/ac/fluent
 *   { action: "start", language }
 *     -> { session_id, test }  (test is answer-key STRIPPED; the full test
 *        with correct_index is held server-side in eng_fluent_sessions)
 *   { action: "score", language, sessionId, answers, writingResponse,
 *     speakingTranscript, takerName, takerEmail, integrityFlags, ... }
 *     -> FluentResult  (server loads the stored test by sessionId and grades it)
 *
 * Integrity: the answer key never reaches the browser. If eng_fluent_sessions
 * isn't migrated yet, both actions fall back to the legacy client-graded path
 * (full test to the browser, client posts it back) so deployment is non-breaking.
 *
 * Speaking audio is transcribed by the sibling /transcribe route (Whisper);
 * this route only ever sees the resulting text.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/integrations/email";
import {
  generateFluentTest,
  scoreFluentWritingEnsemble,
  scoreFluentSpeakingEnsemble,
  computeFluentResult,
  stripAnswerKey,
  blendPronunciation,
  type FluentLanguage,
  type FluentResult,
  type FluentTest,
  type WritingScore,
  type SpeakingScore,
  type ReadingItem,
  type ListeningItem,
  type WritingTask,
  type SpeakingTask,
} from "@/lib/ai/fluent-english";
import { AI_MODEL } from "@/lib/ai/client";
import { overallConfidenceBand, type ConfidenceBand } from "@/lib/scoring/reliability";
import { isAzureSpeechConfigured, type PronunciationScore } from "@/lib/integrations/speech";
import { issueCredential } from "@/lib/credentials/issue";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

type IntegrityFlags = { blurCount?: number; pasteCount?: number };

type Body = {
  action?: "start" | "score";
  language?: FluentLanguage;
  sessionId?: string;
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
  candidateId?: string | null;
  engagementId?: string | null;
  pronunciation?: PronunciationScore | null;
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
 * and return the result without an id - the flow still completes, the
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
    candidateId: string | null;
    engagementId: string | null;
    reliability: ConfidenceBand;
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
        result: { ...result, reliability: meta.reliability },
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
        /* column not migrated - ignore */
      }
    }

    // Best-effort: candidate binding columns exist only after migration 00044.
    if (meta.candidateId) {
      try {
        await sb
          .from("eng_fluent_results")
          .update({ candidate_id: meta.candidateId, engagement_id: meta.engagementId })
          .eq("id", id);
      } catch {
        /* columns not migrated - ignore */
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
        reading: result.reading_cefr ?? "-",
        listening: result.listening_total > 0 ? result.listening_cefr : "-",
        writing: result.writing.cefr,
        speaking: result.speaking.attempted ? result.speaking.cefr : "-",
        certUrl,
      },
    });
    const sb = createServiceClient();
    try {
      await sb.from("eng_fluent_results").update({ email_sent_at: new Date().toISOString() }).eq("id", resultId);
    } catch {
      /* email_sent_at column not migrated - ignore */
    }
  } catch (e) {
    console.error("[fluent] result email failed:", e);
  }
}

/** Audit each AI scoring run for calibration (best-effort; migration 00046). */
async function persistScoreRuns(
  resultId: string,
  writing: WritingScore,
  speaking: SpeakingScore | undefined,
  samples: number,
  texts: { writingResponse: string; speakingTranscript: string }
): Promise<void> {
  try {
    const sb = createServiceClient();
    const rows: Array<Record<string, unknown>> = [
      {
        result_id: resultId,
        skill: "writing",
        model: AI_MODEL,
        ai_cefr: writing.cefr,
        samples,
        criteria: {
          task_achievement: writing.task_achievement,
          coherence: writing.coherence,
          lexical_range: writing.lexical_range,
          grammar: writing.grammar,
        },
        // Keep the candidate's text so a human can re-rate it for calibration.
        raw: { ai_generated: writing.ai_generated, response: texts.writingResponse.slice(0, 8000) },
      },
    ];
    if (speaking?.attempted) {
      rows.push({
        result_id: resultId,
        skill: "speaking",
        model: AI_MODEL,
        ai_cefr: speaking.cefr,
        samples,
        criteria: {
          fluency: speaking.fluency,
          coherence: speaking.coherence,
          lexical_range: speaking.lexical_range,
          grammar: speaking.grammar,
        },
        raw: { ai_generated: speaking.ai_generated, transcript: texts.speakingTranscript.slice(0, 8000) },
      });
    }
    await sb.from("eng_fluent_score_runs").insert(rows);
  } catch {
    /* table not migrated - ignore */
  }
}

/** Stable content identity for an item, so identical items merge in the bank. */
function itemHash(skill: string, content: string, question: string, options: string[], correctIndex: number): string {
  return createHash("sha256")
    .update(JSON.stringify({ skill, content, question, options, correctIndex }))
    .digest("hex");
}

/**
 * Log receptive responses into the item bank for future Rasch calibration
 * (migration 00048). Best-effort: upserts each distinct item by content_hash,
 * then records which option was chosen + whether it was correct. No-op if the
 * tables aren't migrated.
 */
async function logItemResponses(
  reading: ReadingItem[],
  listening: ListeningItem[],
  answers: Record<string, number>,
  sessionId: string | null
): Promise<void> {
  try {
    const all = [
      ...reading.map((r) => ({
        skill: "reading" as const,
        hash: itemHash("reading", r.passage, r.question, r.options, r.correct_index),
        item: r,
      })),
      ...listening.map((l) => ({
        skill: "listening" as const,
        hash: itemHash("listening", l.script, l.question, l.options, l.correct_index),
        item: l,
      })),
    ];
    if (all.length === 0) return;

    const sb = createServiceClient();
    const { data: upserted, error } = await sb
      .from("eng_fluent_items")
      .upsert(
        all.map((a) => ({ content_hash: a.hash, skill: a.skill, stem: a.item, cefr_label: a.item.cefr })),
        { onConflict: "content_hash" }
      )
      .select("id, content_hash");
    if (error || !upserted) return;

    const idByHash = new Map(
      (upserted as Array<{ id: string; content_hash: string }>).map((u) => [u.content_hash, u.id])
    );
    const rows = all
      .map((a) => {
        const itemId = idByHash.get(a.hash);
        if (!itemId) return null;
        const chosen = answers[a.item.id];
        return {
          item_id: itemId,
          session_id: sessionId,
          chosen_index: typeof chosen === "number" ? chosen : null,
          correct: chosen === a.item.correct_index,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await sb.from("eng_fluent_item_responses").insert(rows);
  } catch {
    /* item bank not migrated - ignore */
  }
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 3; // 3 hours

/**
 * Persist the full generated test (with answer key) server-side and return a
 * session id. Best-effort: returns null if eng_fluent_sessions isn't migrated,
 * so the caller falls back to the legacy client-graded flow.
 */
async function createSession(
  test: FluentTest,
  meta: { language: FluentLanguage; candidateId: string | null; engagementId: string | null }
): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("eng_fluent_sessions")
      .insert({
        ui_language: meta.language,
        test,
        candidate_id: meta.candidateId,
        engagement_id: meta.engagementId,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

/** Load the full server-stored test by session id; null if missing/expired. */
async function loadSession(id: string): Promise<FluentTest | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("eng_fluent_sessions")
      .select("test, expires_at")
      .eq("id", id)
      .single();
    if (error || !data || !data.test) return null;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
    // Record consumption (best-effort; re-scoring is allowed).
    try {
      await sb.from("eng_fluent_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", id);
    } catch {
      /* ignore */
    }
    return data.test as FluentTest;
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
    const candidateId = body.candidateId?.trim() ? body.candidateId.trim() : null;
    const engagementId = body.engagementId?.trim() ? body.engagementId.trim() : null;
    const session_id = await createSession(test, { language, candidateId, engagementId });
    const tts = isAzureSpeechConfigured();
    if (session_id) {
      // Secure flow: the answer key stays server-side.
      const publicTest = stripAnswerKey(test);
      // When neural TTS is on, the client plays listening audio via /tts and
      // never needs the script text - strip it from the payload too.
      if (tts) {
        publicTest.listening = publicTest.listening.map((it) => ({
          id: it.id,
          question: it.question,
          options: it.options,
          cefr: it.cefr,
        }));
      }
      return NextResponse.json({ session_id, test: publicTest, tts });
    }
    // Legacy fallback (eng_fluent_sessions not migrated): full test client-side.
    return NextResponse.json({ ...test, tts });
  }

  if (body.action === "score") {
    // Resolve the test: secure path loads it server-side by session id (the
    // answer key never left the server); legacy path uses the posted test.
    let reading: ReadingItem[] | null = null;
    let listening: ListeningItem[] = [];
    let writingTask: WritingTask | null = null;
    let speakingTask: SpeakingTask | null = null;
    let aiGenerated = body.aiGenerated === true;

    if (body.sessionId) {
      const test = await loadSession(body.sessionId);
      if (!test) {
        return NextResponse.json({ error: "invalid or expired session" }, { status: 400 });
      }
      reading = test.reading;
      listening = test.listening ?? [];
      writingTask = test.writing;
      speakingTask = test.speaking;
      aiGenerated = test.ai_generated;
    } else {
      reading = Array.isArray(body.reading) ? body.reading : null;
      listening = Array.isArray(body.listening) ? body.listening : [];
      writingTask = body.writingTask ?? null;
      speakingTask = body.speakingTask ?? null;
    }

    if (!reading || !writingTask) {
      return NextResponse.json(
        { error: "a valid session (or reading items + writingTask) is required" },
        { status: 400 }
      );
    }

    // Self-consistency: average over FLUENT_SCORE_SAMPLES model calls (default 1).
    const samples = Math.max(1, Math.min(5, Number(process.env.FLUENT_SCORE_SAMPLES) || 1));
    const writingResponse = String(body.writingResponse ?? "");
    const writing = await scoreFluentWritingEnsemble({
      task: writingTask,
      response: writingResponse,
      language,
      samples,
    });

    const speakingTranscript = String(body.speakingTranscript ?? "").trim();
    const speakingBase =
      speakingTask && speakingTranscript
        ? await scoreFluentSpeakingEnsemble({ task: speakingTask, transcript: speakingTranscript, language, samples })
        : undefined;
    // Blend Azure pronunciation (acoustic) into the Claude content score.
    const speaking = speakingBase
      ? blendPronunciation(speakingBase, body.pronunciation ?? null)
      : undefined;

    const result = computeFluentResult({
      reading,
      listening,
      answers: body.answers ?? {},
      writing,
      speaking,
    });
    const reliability = overallConfidenceBand(result);

    const takerName = body.takerName?.trim() ? body.takerName.trim() : null;
    const takerEmail = body.takerEmail?.trim() ? body.takerEmail.trim() : null;

    const result_id = await persistResult(result, {
      language,
      takerName,
      takerEmail,
      aiGenerated,
      integrityFlags: body.integrityFlags ?? null,
      candidateId: body.candidateId?.trim() ? body.candidateId.trim() : null,
      engagementId: body.engagementId?.trim() ? body.engagementId.trim() : null,
      reliability,
    });

    // Audit the AI scoring run for calibration (best-effort).
    if (result_id) {
      await persistScoreRuns(result_id, writing, speaking, samples, { writingResponse, speakingTranscript });
    }

    // Log receptive responses into the item bank (best-effort; CAT groundwork).
    await logItemResponses(reading, listening, body.answers ?? {}, body.sessionId ?? null);

    // Email the taker their result + certificate link (best-effort).
    if (result_id && takerEmail) {
      await emailFluentResult(result_id, takerEmail, takerName, result);
    }

    // Issue a verifiable CEFR credential (best-effort; VIFM Verify).
    if (result_id) {
      await issueCredential({
        candidateId: body.candidateId?.trim() ? body.candidateId.trim() : null,
        issuedToName: takerName || "Candidate",
        issuedToEmail: takerEmail,
        type: "fluent_cefr",
        titleEn: `English Placement - CEFR ${result.overall_cefr}`,
        subtitleEn: `Indicative ${result.overall_cefr} placement across reading, listening, writing and speaking`,
        sourceId: result_id,
        metadata: { cefr: result.overall_cefr, language },
      });
    }

    return NextResponse.json({ ...result, reliability, result_id });
  }

  return NextResponse.json({ error: "action must be 'start' or 'score'" }, { status: 400 });
}
