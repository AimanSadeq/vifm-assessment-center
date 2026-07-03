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
import { computeIntegritySignal, type IntegrityFlags, type IntegritySignal } from "@/lib/scoring/integrity";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

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
  redemptionToken?: string | null;
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
    /** Advisory integrity signal computed from the flags (CAL-FLU-601). */
    integrity: IntegritySignal;
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
    // Fold the advisory signal (CAL-FLU-601) into the jsonb alongside the raw
    // flags so the cohort view can read it without recomputing.
    try {
      await sb
        .from("eng_fluent_results")
        .update({ integrity_flags: { ...(meta.integrityFlags ?? {}), signal: meta.integrity } })
        .eq("id", id);
    } catch {
      /* column not migrated - ignore */
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
          register: writing.register,
          etiquette: writing.etiquette,
          mechanics: writing.mechanics,
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

/**
 * Stable content identity for an item, so identical items merge in the bank.
 * Order-invariant: options are hashed SORTED and the key is the correct option's
 * TEXT, not its index - per-administration option shuffling (integrity pass)
 * must not fragment the calibration bank into one row per permutation.
 */
function itemHash(skill: string, content: string, question: string, options: string[], correctIndex: number): string {
  return createHash("sha256")
    .update(JSON.stringify({ skill, content, question, options: [...options].sort(), correct: options[correctIndex] ?? correctIndex }))
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
    // Canonical frame (integrity pass): options are shuffled per administration,
    // so the shared bank row must be permutation-stable. The stored stem uses
    // SORTED options (the same canonical order the content_hash keys on) with a
    // remapped correct_index, and chosen_index is remapped into that frame too -
    // otherwise each sitting would overwrite the row's stem with its own shuffle
    // and chosen_index would be incoherent across sittings.
    const toCanonical = <T extends { options: string[]; correct_index: number }>(item: T) => {
      const sorted = [...item.options].sort();
      return {
        stem: { ...item, options: sorted, correct_index: sorted.indexOf(item.options[item.correct_index]) },
        chosenIn: (chosen: number | undefined) =>
          typeof chosen === "number" && item.options[chosen] !== undefined
            ? sorted.indexOf(item.options[chosen])
            : null,
      };
    };
    const all = [
      ...reading.map((r) => ({
        skill: "reading" as const,
        hash: itemHash("reading", r.passage, r.question, r.options, r.correct_index),
        item: r,
        canon: toCanonical(r),
      })),
      ...listening.map((l) => ({
        skill: "listening" as const,
        hash: itemHash("listening", l.script, l.question, l.options, l.correct_index),
        item: l,
        canon: toCanonical(l),
      })),
    ];
    if (all.length === 0) return;

    const sb = createServiceClient();
    const { data: upserted, error } = await sb
      .from("eng_fluent_items")
      .upsert(
        all.map((a) => ({ content_hash: a.hash, skill: a.skill, stem: a.canon.stem, cefr_label: a.item.cefr })),
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
          chosen_index: a.canon.chosenIn(chosen),
          // Correctness is judged in the administration frame the taker saw.
          correct: chosen === a.item.correct_index,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await sb.from("eng_fluent_item_responses").insert(rows);
  } catch {
    /* item bank not migrated - ignore */
  }
}

/**
 * Link a completed result to its voucher redemption: stamp the result with the
 * voucher's client org + the redemption id, and back-link the redemption's
 * result_id. Best-effort; no-ops cleanly until migration 00104 is applied.
 */
async function linkRedemption(resultId: string, redemptionToken: string): Promise<void> {
  try {
    const sb = createServiceClient();
    const { data: redemption } = await sb
      .from("eng_fluent_voucher_redemptions")
      .select("id, organization_id")
      .eq("redemption_token", redemptionToken)
      .maybeSingle<{ id: string; organization_id: string | null }>();
    if (!redemption) return;
    await sb
      .from("eng_fluent_results")
      .update({ organization_id: redemption.organization_id, voucher_redemption_id: redemption.id })
      .eq("id", resultId);
    await sb.from("eng_fluent_voucher_redemptions").update({ result_id: resultId }).eq("id", redemption.id);
  } catch {
    /* tables/columns not migrated - ignore */
  }
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 3; // 3 hours

/** Best-effort client IP from the proxy headers (Render sets x-forwarded-for). */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Persist the full generated test (with answer key) server-side and return a
 * session id. Best-effort: returns null if eng_fluent_sessions isn't migrated,
 * so the caller falls back to the legacy client-graded flow.
 */
async function createSession(
  test: FluentTest,
  meta: { language: FluentLanguage; candidateId: string | null; engagementId: string | null; startIp: string | null }
): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const base = {
      ui_language: meta.language,
      test,
      candidate_id: meta.candidateId,
      engagement_id: meta.engagementId,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
    // start_ip (00142) is appended only when known; peel it on a missing-column
    // error so a pending migration degrades to no IP-change detection.
    const withIp = meta.startIp ? { ...base, start_ip: meta.startIp } : base;
    let res = await sb.from("eng_fluent_sessions").insert(withIp).select("id").single();
    if (res.error && meta.startIp) {
      res = await sb.from("eng_fluent_sessions").insert(base).select("id").single();
    }
    if (res.error || !res.data) return null;
    return res.data.id as string;
  } catch {
    return null;
  }
}

type SessionRow = {
  test: FluentTest;
  expires_at: string | null;
  start_ip: string | null;
  candidate_id: string | null;
  engagement_id: string | null;
};

type LoadedSession = {
  test: FluentTest;
  startIp: string | null;
  candidateId: string | null;
  engagementId: string | null;
};

/**
 * Atomically claim + load the server-stored test by session id. Returns null if
 * the session is missing, expired, or already consumed.
 *
 * Security (audit fixes):
 * - Single-use: the load IS the consume. We flip consumed_at from NULL to now in
 *   the same statement and only proceed if THIS call won the row. A replay (or a
 *   double-submit race) sees zero rows and is rejected, so a session can never be
 *   re-scored into a second result + credential. Mirrors the single-use consume
 *   hardening applied across the other voucher/session flows.
 * - candidate_id / engagement_id are read from the SESSION (stamped at start),
 *   never trusted from the score request body, so a caller cannot bind a result
 *   or credential to a candidate they don't own.
 */
async function loadSession(id: string): Promise<LoadedSession | null> {
  try {
    const sb = createServiceClient();
    const now = new Date().toISOString();
    // Atomic single-use claim. `.is("consumed_at", null)` makes the update a
    // no-op for an already-consumed session, so only the first caller gets a row.
    // Try with start_ip (00142); fall back without it on a missing column.
    let res = await sb
      .from("eng_fluent_sessions")
      .update({ consumed_at: now })
      .eq("id", id)
      .is("consumed_at", null)
      .select("test, expires_at, start_ip, candidate_id, engagement_id")
      .maybeSingle<SessionRow>();
    if (res.error) {
      res = await sb
        .from("eng_fluent_sessions")
        .update({ consumed_at: now })
        .eq("id", id)
        .is("consumed_at", null)
        .select("test, expires_at, candidate_id, engagement_id")
        .maybeSingle<SessionRow>();
    }
    const row = res.data;
    if (res.error || !row || !row.test) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
    return {
      test: row.test,
      startIp: row.start_ip ?? null,
      candidateId: row.candidate_id ?? null,
      engagementId: row.engagement_id ?? null,
    };
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
    const session_id = await createSession(test, { language, candidateId, engagementId, startIp: clientIp(req) });
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
    // Fail closed (audit fix): if the server-side session store is unavailable we
    // must NOT ship the full test - that would leak every correct_index to the
    // browser. Refuse rather than fall back to an answer-key-bearing payload.
    return NextResponse.json(
      { error: "Secure assessment storage is unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  if (body.action === "score") {
    // Resolve the test from the server-held session only. We never grade
    // client-posted items: those would carry a forgeable correct_index, so the
    // answer-key integrity guarantee depends on the test never leaving the
    // server. A session id is therefore mandatory.
    if (!body.sessionId) {
      return NextResponse.json({ error: "a valid session is required" }, { status: 400 });
    }
    const loaded = await loadSession(body.sessionId);
    if (!loaded) {
      return NextResponse.json({ error: "invalid or expired session" }, { status: 400 });
    }
    const test = loaded.test;
    const startIp: string | null = loaded.startIp;
    // Bind the result/credential to the candidate stamped on the SESSION at start
    // time - never to a candidate id supplied in the (untrusted) score body. This
    // closes the candidate-id spoofing vector.
    const sessionCandidateId = loaded.candidateId;
    const sessionEngagementId = loaded.engagementId;
    const reading: ReadingItem[] | null = test.reading;
    const listening: ListeningItem[] = test.listening ?? [];
    const writingTask: WritingTask | null = test.writing;
    const speakingTask: SpeakingTask | null = test.speaking;
    const aiGenerated = test.ai_generated;

    if (!reading || !writingTask) {
      return NextResponse.json(
        { error: "the session is missing required test content" },
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
    // Security: trust a client-posted acoustic score ONLY when Azure Speech is
    // actually configured (the score is produced server-side from the audio). On
    // a deployment without Azure we ignore any posted pronunciation so a forged
    // value cannot inflate the speaking band. blendPronunciation additionally
    // validates + clamps the value into its documented 0-100 range.
    const trustedPronunciation = isAzureSpeechConfigured() ? body.pronunciation ?? null : null;
    const speaking = speakingBase
      ? blendPronunciation(speakingBase, trustedPronunciation)
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
    // FLU-1: server-detected mid-test IP change. Compare the IP captured at
    // start with the IP now; both must be known and differ. Merged into the
    // (PDPL-safe) flags so it rides into the persisted integrity_flags + signal.
    const scoreIp = clientIp(req);
    const ipChanged = !!startIp && !!scoreIp && startIp !== scoreIp;
    // Server-authoritative flags: ipChanged and aiLikelihood are computed here
    // and OVERWRITE anything the (untrusted) client posted under those keys.
    // aiLikelihood is the AI examiner's advisory stylometric estimate for the
    // writing response (integrity pass) - unreliable by nature, so it only
    // nudges the advisory composite above a conservative floor and never
    // auto-fails anything.
    const integrityFlags: IntegrityFlags = {
      ...(body.integrityFlags ?? {}),
      ipChanged,
      aiLikelihood: typeof writing.ai_likelihood === "number" ? writing.ai_likelihood : undefined,
    };
    if (!ipChanged) delete integrityFlags.ipChanged;
    if (integrityFlags.aiLikelihood === undefined) delete integrityFlags.aiLikelihood;
    // Proctoring breadcrumb (integrity pass): when the voucher or its client
    // org REQUIRED camera proctoring, verify a proctoring session was actually
    // recorded for this administration. The consent gate is a browser control -
    // a determined taker can strip it - so its absence is converted here into a
    // server-detected advisory flag rather than trusted silence. Best-effort:
    // tolerant of un-applied migrations.
    if (body.redemptionToken?.trim()) {
      try {
        const sb = createServiceClient();
        const token = body.redemptionToken.trim();
        const { data: redemption } = await sb
          .from("eng_fluent_voucher_redemptions")
          .select("voucher_id")
          .eq("redemption_token", token)
          .maybeSingle<{ voucher_id: string }>();
        if (redemption) {
          const { data: voucher } = await sb
            .from("eng_fluent_vouchers")
            .select("proctor_enabled, organization_id")
            .eq("id", redemption.voucher_id)
            .maybeSingle<{ proctor_enabled: boolean; organization_id: string | null }>();
          let required = voucher?.proctor_enabled ?? false;
          if (!required && voucher?.organization_id) {
            const { getOrgSettings } = await import("@/lib/clients/org-settings");
            required = (await getOrgSettings(voucher.organization_id)).fluent_proctoring_required === true;
          }
          if (required) {
            const { count } = await sb
              .from("proctor_sessions")
              .select("id", { count: "exact", head: true })
              .eq("context", "fluent")
              .eq("ref_id", token);
            if (!count || count === 0) integrityFlags.proctorMissing = true;
          }
        }
      } catch {
        /* proctor tables / policy not migrated - no breadcrumb */
      }
    }
    // CAL-FLU-601 + FLU-1: advisory integrity signal from the flags.
    const integrity = computeIntegritySignal(integrityFlags);

    const result_id = await persistResult(result, {
      language,
      takerName,
      takerEmail,
      aiGenerated,
      integrityFlags,
      integrity,
      candidateId: sessionCandidateId,
      engagementId: sessionEngagementId,
      reliability,
    });

    // Voucher delegate flow: stamp the result with the client org (best-effort).
    if (result_id && body.redemptionToken?.trim()) {
      await linkRedemption(result_id, body.redemptionToken.trim());
    }

    // Audit the AI scoring run for calibration (best-effort).
    if (result_id) {
      await persistScoreRuns(result_id, writing, speaking, samples, { writingResponse, speakingTranscript });
    }

    // Log receptive responses into the item bank (best-effort; CAT groundwork).
    await logItemResponses(reading, listening, body.answers ?? {}, body.sessionId ?? null);

    // Results are not shown to the taker (XP-13: every assessment hides results
    // from the taker; an admin downloads/sends the report). So we no longer email
    // the taker their certificate. Admin views/sends from /ac/fluent/cohort.
    void emailFluentResult;

    // Issue a verifiable CEFR credential (best-effort; VIFM Verify).
    if (result_id) {
      await issueCredential({
        candidateId: sessionCandidateId,
        issuedToName: takerName || "Candidate",
        issuedToEmail: takerEmail,
        type: "fluent_cefr",
        titleEn: `English Placement - CEFR ${result.overall_cefr}`,
        subtitleEn: `Indicative ${result.overall_cefr} placement across reading, listening, writing and speaking`,
        sourceId: result_id,
        metadata: { cefr: result.overall_cefr, language },
      });
    }

    // Staff (admin/consultant/assessor) see results on-screen; takers get a
    // thank-you. result_id is only returned to staff so a taker can never fetch
    // the certificate even by guessing the API shape (XP-13). The advisory
    // AI-likeness output (estimate + markers + its reason string) is also
    // staff-only: returning the detector's own reading to the taker would hand
    // an unsupervised candidate a live oracle to reword against. The persisted
    // result keeps the full detail for the admin surfaces.
    const isStaff = await isStaffCaller();
    const responseResult = isStaff
      ? result
      : {
          ...result,
          writing: { ...result.writing, ai_likelihood: undefined, ai_markers: undefined },
        };
    const responseIntegrity = isStaff
      ? integrity
      : { ...integrity, reasons: integrity.reasons.filter((r) => !r.startsWith("Writing style reads")) };
    return NextResponse.json({
      ...responseResult,
      reliability,
      result_id: isStaff ? result_id : null,
      integrity: responseIntegrity,
      isStaff,
    });
  }

  return NextResponse.json({ error: "action must be 'start' or 'score'" }, { status: 400 });
}
