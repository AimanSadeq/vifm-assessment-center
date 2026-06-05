import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePsyTest, stripAnswerKey } from "@/lib/psychometrics/generate";
import { computePsyResult, type PsyTest, type CognitiveItem } from "@/lib/psychometrics/scoring";
import { COGNITIVE_INSTRUMENT, PERSONALITY_INSTRUMENT } from "@/lib/psychometrics/framework";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Psychometrics runner API (Tier 1 indicative). Mirrors the Fluent/Technical
 * secure model: the full keyed test is held in psy_sessions (never sent to the
 * browser), grading happens here, the session is single-use, and writes go
 * through the service role. Needs migration 00065.
 *
 *   { action:"start", kind:"cognitive"|"personality", language, candidateId?, engagementId?, takerEmail? }
 *     → { session_id, kind, instrument, test }   (test is answer-key-stripped)
 *   { action:"score", session_id, answers, takerName?, takerEmail? }
 *     → { result, result_id }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;
  const lang: "en" | "ar" = body.language === "ar" ? "ar" : "en";
  const svc = createServiceClient();

  if (action === "start") {
    const kind: "cognitive" | "personality" = body.kind === "personality" ? "personality" : "cognitive";
    const test = await generatePsyTest(kind, lang);
    const { data, error } = await svc
      .from("psy_sessions")
      .insert({
        kind,
        test,
        candidate_id: (body.candidateId as string) ?? null,
        engagement_id: (body.engagementId as string) ?? null,
        taker_email: (body.takerEmail as string) ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "Could not start the assessment. Apply migration 00065 (psychometrics), then retry." },
        { status: 500 }
      );
    }
    const instrument = kind === "cognitive" ? COGNITIVE_INSTRUMENT : PERSONALITY_INSTRUMENT;
    return NextResponse.json({ session_id: data.id, kind, instrument, test: stripAnswerKey(test, lang) });
  }

  if (action === "score") {
    const sessionId = body.session_id as string | undefined;
    if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });

    const { data: session } = await svc.from("psy_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.consumed) return NextResponse.json({ error: "This assessment has already been submitted." }, { status: 409 });

    const test = session.test as PsyTest;
    const answers = (body.answers ?? {}) as Record<string, number>;
    const result = computePsyResult(test, answers, lang);

    const { data: resRow } = await svc
      .from("psy_results")
      .insert({
        instrument_id: null,
        kind: test.kind,
        candidate_id: session.candidate_id,
        engagement_id: session.engagement_id,
        taker_name: (body.takerName as string) ?? null,
        taker_email: (body.takerEmail as string) ?? session.taker_email ?? null,
        scales: result.scales,
        overall: result.overall ?? null,
        validity: result.validity ?? null,
        result,
      })
      .select("id")
      .single();

    // Per-item response log (best-effort).
    if (resRow) {
      const rows = test.items.map((it) => ({
        result_id: resRow.id,
        item_ref: it.id,
        scale_key: it.scale,
        response: typeof answers[it.id] === "number" ? answers[it.id] : null,
        correct: test.kind === "cognitive" ? answers[it.id] === (it as CognitiveItem).correct : null,
      }));
      await svc.from("psy_item_responses").insert(rows);
    }

    await svc.from("psy_sessions").update({ consumed: true }).eq("id", sessionId);
    return NextResponse.json({ result, result_id: resRow?.id ?? null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
