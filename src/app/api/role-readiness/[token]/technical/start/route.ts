import { NextResponse } from "next/server";
import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";
import { technicalForCandidate } from "@/lib/role-readiness/sitting";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  // Answer keys are stripped inside technicalForCandidate.
  return NextResponse.json({ areas: technicalForCandidate(ctx.config) });
}
