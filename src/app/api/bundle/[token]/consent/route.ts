import { NextResponse } from "next/server";
import { findBundleCandidateByToken, setBundleConsent, validateDemographics, HELD_MESSAGE } from "@/lib/bespoke/candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (ctx.held) return NextResponse.json({ error: HELD_MESSAGE }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { demographics?: unknown };
  const demo = validateDemographics(ctx.settings.demographicFields, body.demographics);
  if (!demo.ok) return NextResponse.json({ error: demo.error }, { status: 400 });
  await setBundleConsent(ctx.candidate.id, demo.values);
  return NextResponse.json({ ok: true });
}
