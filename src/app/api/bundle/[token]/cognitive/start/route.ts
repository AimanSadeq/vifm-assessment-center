import { NextResponse } from "next/server";
import { findBundleCandidateByToken, HELD_MESSAGE } from "@/lib/bespoke/candidates";
import { startBundleCognitive } from "@/lib/bespoke/sitting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (ctx.held) return NextResponse.json({ error: HELD_MESSAGE }, { status: 403 });
  if (!ctx.stages.includes("logica")) return NextResponse.json({ error: "This bundle has no reasoning section." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { language?: string };
  const lang = body.language === "ar" ? "ar" : "en";
  const res = await startBundleCognitive(ctx, lang);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ sessionId: res.sessionId, test: res.test, remainingSeconds: res.remainingSeconds });
}
