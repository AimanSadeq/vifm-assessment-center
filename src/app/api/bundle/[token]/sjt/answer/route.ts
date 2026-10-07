import { NextResponse } from "next/server";
import { findBundleCandidateByToken, HELD_MESSAGE } from "@/lib/bespoke/candidates";
import { saveSjtAnswer } from "@/lib/bespoke/sjt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save one scenario's MOST / LEAST choice (autosave as the candidate goes). */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (ctx.held) return NextResponse.json({ error: HELD_MESSAGE }, { status: 403 });
  if (!ctx.stages.includes("sjt")) return NextResponse.json({ error: "This assessment has no scenario section." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { itemId?: string; most?: string; least?: string };
  const res = await saveSjtAnswer(ctx, String(body.itemId ?? ""), String(body.most ?? ""), String(body.least ?? ""));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
