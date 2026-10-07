import { NextResponse } from "next/server";
import { findBundleCandidateByToken, rollBundleStatus, HELD_MESSAGE } from "@/lib/bespoke/candidates";
import { submitSjt } from "@/lib/bespoke/sjt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Submit the scenario section: scores are computed server-side and never returned. */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (ctx.held) return NextResponse.json({ error: HELD_MESSAGE }, { status: 403 });
  if (!ctx.stages.includes("sjt")) return NextResponse.json({ error: "This assessment has no scenario section." }, { status: 400 });
  const res = await submitSjt(ctx);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  await rollBundleStatus(ctx, { sjtDone: true });
  return NextResponse.json({ ok: true });
}
