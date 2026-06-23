import { NextResponse } from "next/server";
import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";
import { startPersonaSection } from "@/lib/role-readiness/sitting";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (ctx.config.competencies.length === 0) {
    return NextResponse.json({ error: "This role has no behavioural competencies configured." }, { status: 400 });
  }
  const { sessionId, items } = await startPersonaSection(ctx.candidate, ctx.config);
  return NextResponse.json({ sessionId, items });
}
