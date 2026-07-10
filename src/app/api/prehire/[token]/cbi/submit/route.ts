import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken, rescoreCandidate } from "@/lib/prehire/candidate-access";
import { logPrehireEvent } from "@/lib/prehire/audit";
import { scoreCbiInterview, type CbiMessage } from "@/lib/ai/cbi-interviewer";
import { computeIntegritySignal, type IntegrityFlags } from "@/lib/scoring/integrity";

type CbiDetail = { history?: CbiMessage[] } | null;

export async function POST(_req: Request, { params }: { params: { token: string } }) {
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

  // Fail closed in production without a model key. Without ANTHROPIC_API_KEY,
  // scoreCbiInterview takes the no-key placeholder path (a fabricated BARS 3, no
  // scoring_failed flag) - which on this commercial hiring surface would silently
  // feed the composite + shortlist + adverse-impact math with a non-score. The
  // standalone /ac/ai-interview prototype keeps the dev-friendly placeholder; the
  // hiring route does not.
  if (process.env.NODE_ENV === "production" && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Scoring is temporarily unavailable. Please submit again in a moment.", retry: true },
      { status: 503 },
    );
  }

  const svc = createServiceClient();
  const { data: stage } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "cbi")
    .maybeSingle();

  const history = (stage?.detail as CbiDetail)?.history;
  if (!stage || !history || history.length === 0) {
    return NextResponse.json({ error: "Start the interview first." }, { status: 400 });
  }
  if (stage.status === "completed") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  const score = await scoreCbiInterview({
    competency: {
      id: "prehire-cbi",
      name: `${ctx.requisition.title} - behavioural competency`,
      description: `Behavioural competency for the ${ctx.requisition.title} role.`,
      positiveIndicators: [],
      negativeIndicators: [],
    },
    history,
    language: "en",
  });

  // Automated scoring genuinely FAILED (API/parse error with a key present) -
  // scoreCbiInterview returns a fabricated placeholder BARS 3. Do NOT complete
  // the stage with it: that would silently feed a real hiring composite + shortlist
  // + adverse-impact math with a non-score. The transcript is already persisted, so
  // leave the stage retryable (uncompleted, no normalized_score => excluded from the
  // composite) and ask the candidate to resubmit. (A missing ANTHROPIC_API_KEY takes
  // the placeholder path WITHOUT scoring_failed, so a dev/demo run still completes.)
  if (score.scoring_failed) {
    return NextResponse.json(
      { error: "Scoring is temporarily unavailable. Please submit again in a moment.", retry: true },
      { status: 503 },
    );
  }

  // BARS 1–5 → 0–100 for the composite. Clamp defensively before persisting:
  // scoreCbiInterview is AI-derived and could return an out-of-range value on
  // a prompt-injection or hallucination; clamping here keeps the stored row
  // consistent with what computeComposite would produce.
  const safeBars = Math.max(1, Math.min(5, score.bars_rating));
  const normalized = Math.round(((safeBars - 1) / 4) * 100);
  const cut = ctx.requisition.stage_config.find((s) => s.kind === "cbi")?.cut_score ?? null;
  const passed = cut == null ? true : normalized >= cut;

  // Integrity pass: the AI examiner's advisory AI-likeness estimate on the
  // candidate's typed answers rides into the stage flags (same pattern as the
  // fluent stage) so the recruiter view can show it. Advisory only - it never
  // caps or fails the stage.
  const integrityFlags: IntegrityFlags | null =
    typeof score.ai_likelihood === "number" ? { aiLikelihood: score.ai_likelihood } : null;

  const { error } = await svc
    .from("prehire_stage_results")
    .update({
      status: "completed",
      raw_score: safeBars,
      normalized_score: normalized,
      passed,
      detail: { history, score },
      ...(integrityFlags
        ? { flags: { ...integrityFlags, signal: computeIntegritySignal(integrityFlags) } }
        : {}),
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
    detail: { kind: "cbi", normalized, passed },
  });

  return NextResponse.json({ normalized, bars: score.bars_rating });
}
