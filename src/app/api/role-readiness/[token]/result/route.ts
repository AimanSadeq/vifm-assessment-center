import { NextResponse } from "next/server";
import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";
import { loadReadinessReportData } from "@/lib/role-readiness/report-data";

// On-screen result for the candidate (Role Readiness is developmental - the
// taker sees their verdict + development plan, unlike Pre-Hire screening).
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const data = await loadReadinessReportData(ctx.candidate.id);
  if (!data) return NextResponse.json({ error: "No result yet" }, { status: 404 });
  return NextResponse.json({ data });
}
