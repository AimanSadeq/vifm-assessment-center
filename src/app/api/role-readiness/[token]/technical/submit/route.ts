import { NextResponse } from "next/server";
import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";
import { submitTechnicalSection } from "@/lib/role-readiness/sitting";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { answers?: Record<string, number> } | null;
  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
  const res = await submitTechnicalSection(ctx.candidate.id, ctx.config, answers);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
