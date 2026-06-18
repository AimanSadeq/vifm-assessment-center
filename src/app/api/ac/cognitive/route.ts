import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePsyTest, stripAnswerKey } from "@/lib/psychometrics/generate";
import { computePsyResult, type PsyTest, type CognitiveItem } from "@/lib/psychometrics/scoring";
import { applyNorms, type ScaleNorm } from "@/lib/psychometrics/calibration";
import { COGNITIVE_INSTRUMENT } from "@/lib/psychometrics/framework";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Psychometrics runner API (Tier 1 indicative). Mirrors the Fluent/Technical
 * secure model: the full keyed test is held in psy_sessions (never sent to the
 * browser), grading happens here, the session is single-use, and writes go
 * through the service role. Needs migration 00065.
 *
 *   { action:"start", language, candidateId?, engagementId?, takerEmail? }
 *     → { session_id, kind, instrument, test }   (cognitive ability; answer-key-stripped)
 *   (Personality/OCEAN was retired - the behavioural instrument is now Persona,
 *    the 38-competency self-assessment under /candidate/behavioral.)
 *   { action:"score", session_id, answers, takerName?, takerEmail? }
 *     → { result, result_id }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;
  const lang: "en" | "ar" = body.language === "ar" ? "ar" : "en";
  const svc = createServiceClient();

  if (action === "start") {
    // Cognitive ability only - personality/OCEAN retired in favour of Persona.
    const kind = "cognitive" as const;
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
    const instrument = COGNITIVE_INSTRUMENT;
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

    // Tier 2: norm-reference the scores when a norm group exists for this kind
    // (tolerant — no psy_norms table / no rows ⇒ result stays Tier-1 indicative).
    let finalResult = result;
    try {
      const { data: norms } = await svc.from("psy_norms").select("scale_key, n, mean, sd").eq("kind", test.kind);
      if (norms && norms.length) {
        const map: Record<string, ScaleNorm> = {};
        for (const nm of norms as Array<{ scale_key: string; n: number; mean: number; sd: number }>) {
          map[nm.scale_key] = { mean: Number(nm.mean), sd: Number(nm.sd), n: Number(nm.n) };
        }
        finalResult = applyNorms(result, map);
      }
    } catch {
      /* psy_norms not migrated yet — stays Tier-1 indicative */
    }

    const { data: resRow } = await svc
      .from("psy_results")
      .insert({
        instrument_id: null,
        kind: test.kind,
        candidate_id: session.candidate_id,
        engagement_id: session.engagement_id,
        taker_name: (body.takerName as string) ?? null,
        taker_email: (body.takerEmail as string) ?? session.taker_email ?? null,
        scales: finalResult.scales,
        overall: finalResult.overall ?? null,
        validity: finalResult.validity ?? null,
        result: finalResult,
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

    // Voucher delegate flow: stamp the result with the client org + the
    // redemption (best-effort; no-ops until migration 00105 is applied).
    if (resRow && typeof body.redemptionToken === "string" && body.redemptionToken.trim()) {
      try {
        const token = body.redemptionToken.trim();
        // Org-only SELECT first: it must NOT reference project_label, or a
        // pending 00137 (column absent on cognitive_voucher_redemptions) would
        // error this read, null `redemption`, and drop the org linkage entirely.
        const { data: redemption } = await svc
          .from("cognitive_voucher_redemptions")
          .select("id, organization_id")
          .eq("redemption_token", token)
          .maybeSingle<{ id: string; organization_id: string | null }>();
        if (redemption) {
          // Org linkage on its own, so a pending 00137 can never drop it.
          await svc
            .from("psy_results")
            .update({ organization_id: redemption.organization_id, voucher_redemption_id: redemption.id })
            .eq("id", resRow.id);
          // Project label (00137) ride-along - read + write separately, both
          // best-effort. A missing column on either side just no-ops.
          const { data: pl } = await svc
            .from("cognitive_voucher_redemptions")
            .select("project_label")
            .eq("id", redemption.id)
            .maybeSingle<{ project_label: string | null }>();
          if (pl?.project_label) {
            await svc
              .from("psy_results")
              .update({ project_label: pl.project_label })
              .eq("id", resRow.id);
          }
          await svc.from("cognitive_voucher_redemptions").update({ result_id: resRow.id }).eq("id", redemption.id);
        }
      } catch {
        /* voucher tables not migrated - ignore */
      }
    }

    await svc.from("psy_sessions").update({ consumed: true }).eq("id", sessionId);
    return NextResponse.json({ result: finalResult, result_id: resRow?.id ?? null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
