import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const svc = createServiceClient();
  await svc
    .from("rr_candidates")
    .update({ consent_at: new Date().toISOString(), status: "in_progress" })
    .eq("id", ctx.candidate.id);
  return NextResponse.json({ ok: true });
}
