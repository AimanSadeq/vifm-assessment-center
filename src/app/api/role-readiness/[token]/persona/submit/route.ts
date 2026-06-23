import { NextResponse } from "next/server";
import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";
import { startPersonaSection, submitPersonaSection } from "@/lib/role-readiness/sitting";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { answers?: Array<{ itemKey: string; rawScore: number }> } | null;
  const answers = Array.isArray(body?.answers) ? body!.answers : [];

  // Resolve the session (create on the fly if the candidate jumped straight to submit).
  let sessionId = ctx.candidate.persona_session_id;
  if (!sessionId) {
    const started = await startPersonaSection(ctx.candidate, ctx.config);
    sessionId = started.sessionId;
  }

  const res = await submitPersonaSection(ctx.candidate.id, sessionId, ctx.config, answers);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
