import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { logPrehireEvent } from "@/lib/prehire/audit";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  // Idempotency: consent_at is the legal record of when consent was first given.
  // Re-submission must not overwrite it (would lose the precise first-consent
  // timestamp required for UAE PDPL / GDPR compliance evidence).
  if (ctx.candidate.consent_at) return NextResponse.json({ ok: true });

  const svc = createServiceClient();
  const { error } = await svc
    .from("prehire_candidates")
    .update({
      consent_at: new Date().toISOString(),
      status: ctx.candidate.status === "invited" ? "in_progress" : ctx.candidate.status,
    })
    .eq("id", ctx.candidate.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPrehireEvent({
    action: "consent_given",
    requisitionId: ctx.requisition.id,
    candidateId: ctx.candidate.id,
    actorLabel: "candidate",
  });

  return NextResponse.json({ ok: true });
}
