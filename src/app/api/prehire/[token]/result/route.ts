import { NextResponse } from "next/server";
import { findCandidateByToken, DEMO_REQ_TITLE } from "@/lib/prehire/candidate-access";
import { computeComposite } from "@/lib/prehire/scoring";

export const dynamic = "force-dynamic";

/**
 * GET /api/prehire/[token]/result
 *
 * DEMO ONLY. Returns the candidate's composite + per-stage scores so the demo
 * completion screen can show results immediately (mirroring the Techno demo). A
 * real screening returns 403 - candidates never see their own screening result;
 * the report is delivered to the hiring team.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (ctx.requisition.title !== DEMO_REQ_TITLE) {
    return NextResponse.json({ ok: false, error: "Results are reviewed by the hiring team." }, { status: 403 });
  }

  const result = computeComposite(
    ctx.requisition.stage_config,
    ctx.stages.map((s) => ({ kind: s.kind, normalized_score: s.normalized_score }))
  );

  return NextResponse.json({
    ok: true,
    candidateName: ctx.candidate.full_name,
    requisitionTitle: ctx.requisition.title,
    composite: result.composite,
    recommendation: result.recommendation,
    perStage: result.perStage.map((s) => ({
      kind: s.kind,
      normalized: s.normalized,
      passed: s.passed,
      required: s.required,
      cutScore: s.cutScore,
    })),
  });
}
