import { NextResponse } from "next/server";
import { findBundleCandidateByToken, setBundleConsent } from "@/lib/bespoke/candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  await setBundleConsent(ctx.candidate.id);
  return NextResponse.json({ ok: true });
}
