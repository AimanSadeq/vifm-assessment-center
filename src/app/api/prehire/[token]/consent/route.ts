import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const svc = createServiceClient();
  const { error } = await svc
    .from("prehire_candidates")
    .update({
      consent_at: new Date().toISOString(),
      status: ctx.candidate.status === "invited" ? "in_progress" : ctx.candidate.status,
    })
    .eq("id", ctx.candidate.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
