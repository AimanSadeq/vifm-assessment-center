import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePsyTest, stripAnswerKey, BankUnavailableError } from "@/lib/psychometrics/generate";
import { computePsyResult, type PsyTest, type CognitiveItem } from "@/lib/psychometrics/scoring";
import { applyNorms, type ScaleNorm } from "@/lib/psychometrics/calibration";
import { COGNITIVE_INSTRUMENT, sanitizeSubtests } from "@/lib/psychometrics/framework";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Backstop grace for the server-side time-limit check. The client countdown
// auto-submits at the deadline; this only rejects a grossly-late submission from
// a manipulated client. Absorbs latency + clock skew, so an on-time taker is
// never rejected.
const TIMER_GRACE_MS = 1000 * 60 * 2;

/**
 * Psychometrics runner API (Tier 1 indicative). Mirrors the Fluent/Technical
 * secure model: the full keyed test is held in psy_sessions (never sent to the
 * browser), grading happens here, the session is single-use, and writes go
 * through the service role. Needs migration 00065.
 *
 *   { action:"start", language, candidateId?, engagementId?, takerEmail? }
 *     → { session_id, kind, instrument, test }   (cognitive ability; answer-key-stripped)
 *   (Personality/OCEAN was retired - the behavioural instrument is now Persona,
 *    the 41-competency self-assessment under /candidate/behavioral.)
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
    // SD-4: optional subtest selection (numerical/verbal/inductive/deductive).
    // Sanitized server-side; empty/invalid defaults to all four.
    let subtests = sanitizeSubtests(body.subtests);
    // Voucher subtest scope (00170): a delegate session is locked to the set the
    // voucher was issued for - resolved server-side from the redemption token so
    // a tampered client can never widen the scope. Tolerant of the migration
    // not being applied (falls back to the requested set).
    if (typeof body.redemptionToken === "string" && body.redemptionToken.trim()) {
      try {
        const { data: redemption } = await svc
          .from("cognitive_voucher_redemptions")
          .select("voucher_id")
          .eq("redemption_token", body.redemptionToken.trim())
          .maybeSingle<{ voucher_id: string | null }>();
        if (redemption?.voucher_id) {
          const { data: v } = await svc
            .from("cognitive_vouchers")
            .select("subtests")
            .eq("id", redemption.voucher_id)
            .maybeSingle<{ subtests: string[] | null }>();
          if (v?.subtests && v.subtests.length > 0) subtests = sanitizeSubtests(v.subtests);
        }
      } catch {
        /* 00170 not applied - keep the requested set */
      }
    }
    // A real / candidate- / voucher-bound sitting MUST be served from the reviewed
    // bank (never live-AI or a short static deck). Anonymous, tokenless self-serve
    // (marketing/dev) stays best-effort so the free demo never hard-fails.
    const requireBank =
      process.env.PSY_REQUIRE_BANK === "1" ||
      Boolean(
        body.candidateId ||
        body.engagementId ||
        (typeof body.redemptionToken === "string" && body.redemptionToken.trim())
      );

    // Retake exposure control (best-effort, candidate-bound only): de-prefer items
    // this candidate has already seen. Anonymous / per-token retakes share no stable
    // identity, so they are not excluded (documented limit) - depth + rotation carry it.
    const UUID_RE = /^[0-9a-f-]{36}$/i;
    let exclusionIds: string[] | undefined;
    if (typeof body.candidateId === "string" && body.candidateId) {
      try {
        const { data: priorResults } = await svc
          .from("psy_results").select("id").eq("candidate_id", body.candidateId).eq("kind", "cognitive").limit(50);
        const rids = (priorResults ?? []).map((r) => (r as { id: string }).id);
        if (rids.length) {
          const { data: seen } = await svc
            .from("psy_item_responses").select("item_ref").in("result_id", rids).limit(5000);
          exclusionIds = Array.from(
            new Set((seen ?? []).map((s) => (s as { item_ref: string | null }).item_ref).filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))
          );
        }
      } catch {
        /* response log unavailable - no exclusion */
      }
    }

    let test;
    try {
      test = await generatePsyTest(kind, lang, subtests, { requireBank, exclusionIds });
    } catch (e) {
      if (e instanceof BankUnavailableError) {
        return NextResponse.json(
          { error: "This assessment is being finalised in this language and cannot be started right now. Please try again shortly." },
          { status: 503 }
        );
      }
      throw e;
    }
    const servedSource = (test as { served_source?: "bank" | "ai" | "static" }).served_source ?? null;

    // Server-side time-limit backstop: resolve the cognitive limit ourselves
    // (never trust the client) and stamp a deadline into the session, so a
    // grossly-late score can be rejected even if the client timer is bypassed.
    const limitMinutes = await getTimerMinutes("cognitive", TIMER_DEFAULTS.cognitive);
    const storedTest =
      limitMinutes && limitMinutes > 0
        ? { ...test, deadline_at: new Date(Date.now() + limitMinutes * 60_000 + TIMER_GRACE_MS).toISOString() }
        : test;
    const { data, error } = await svc
      .from("psy_sessions")
      .insert({
        kind,
        test: storedTest,
        served_source: servedSource,
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

    // Exposure counter: bump times_administered for the served bank items so the
    // assembler's least-administered-first rotation actually rotates. Best-effort
    // (needs migration 00179's psy_increment_administered); no-ops otherwise.
    if (servedSource === "bank" && test.kind === "cognitive") {
      const ids = test.items.map((i) => i.id).filter((id) => UUID_RE.test(id));
      if (ids.length) {
        try { await svc.rpc("psy_increment_administered", { ids }); } catch { /* 00179 not applied */ }
      }
    }

    const instrument = COGNITIVE_INSTRUMENT;
    return NextResponse.json({ session_id: data.id, kind, instrument, test: stripAnswerKey(test) });
  }

  if (action === "score") {
    const sessionId = body.session_id as string | undefined;
    if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });

    const { data: session } = await svc.from("psy_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    // Enforce the ~3h TTL server-side (mirrors the Fluent route) so an expired
    // session can't be graded long after it was issued.
    if (session.expires_at && new Date(session.expires_at as string).getTime() < Date.now()) {
      return NextResponse.json({ error: "This assessment session has expired. Please start again." }, { status: 410 });
    }
    // Time-limit backstop: reject a grossly-late submission (the client
    // auto-submits at the limit; the grace baked into deadline_at absorbs
    // latency, so an on-time taker never trips this). Only when a limit was set.
    {
      const t = session.test as { deadline_at?: string };
      if (t.deadline_at && Date.now() > Date.parse(t.deadline_at)) {
        return NextResponse.json(
          { error: "The time limit for this assessment has passed, so it can no longer be submitted." },
          { status: 410 }
        );
      }
    }
    // Atomic single-use claim BEFORE scoring: the first caller flips consumed
    // false->true; a concurrent or double submit gets no row and is rejected, so
    // a session can never be scored twice (no replay, no duplicate psy_results).
    const { data: claimed } = await svc
      .from("psy_sessions")
      .update({ consumed: true })
      .eq("id", sessionId)
      .eq("consumed", false)
      .select("id")
      .maybeSingle();
    if (!claimed) return NextResponse.json({ error: "This assessment has already been submitted." }, { status: 409 });

    const test = session.test as PsyTest;
    const answers = (body.answers ?? {}) as Record<string, number>;
    const result = computePsyResult(test, answers, lang);

    // Tier 2: norm-reference the scores when a norm group exists for this kind
    // (tolerant - no psy_norms table / no rows ⇒ result stays Tier-1 indicative).
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
      /* psy_norms not migrated yet - stays Tier-1 indicative */
    }

    const { data: resRow } = await svc
      .from("psy_results")
      .insert({
        instrument_id: null,
        kind: test.kind,
        served_source: (session as { served_source?: string | null }).served_source ?? null,
        candidate_id: session.candidate_id,
        engagement_id: session.engagement_id,
        taker_name: (body.takerName as string) ?? null,
        taker_email: (body.takerEmail as string) ?? session.taker_email ?? null,
        scales: finalResult.scales,
        overall: finalResult.overall ?? null,
        validity: null,
        result: finalResult,
      })
      .select("id")
      .single();

    // Per-item response log (best-effort). Shuffled cognitive items carry an
    // `orig` permutation map; the chosen index is remapped into the AUTHORED
    // frame so the logged response stays coherent with the bank row's option
    // order across differently-shuffled sittings (integrity pass).
    if (resRow) {
      const rows = test.items.map((it) => {
        const raw = typeof answers[it.id] === "number" ? answers[it.id] : null;
        const orig = (it as CognitiveItem).orig;
        const response =
          raw !== null && Array.isArray(orig) && typeof orig[raw] === "number" ? orig[raw] : raw;
        return {
          result_id: resRow.id,
          item_ref: it.id,
          scale_key: it.scale,
          response,
          correct: test.kind === "cognitive" ? answers[it.id] === (it as CognitiveItem).correct : null,
        };
      });
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

    // (the session was already consumed atomically before scoring, above)
    // XP-13: staff see results + can download; takers get a thank-you. Only staff
    // receive the result body + result_id - a non-staff taker's network response
    // must NOT carry the detailed scales/bands/percentiles (UI-hiding alone left
    // the data inspectable in the JSON).
    const isStaff = await isStaffCaller();
    return NextResponse.json({
      result: isStaff ? finalResult : null,
      result_id: isStaff ? resRow?.id ?? null : null,
      isStaff,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
