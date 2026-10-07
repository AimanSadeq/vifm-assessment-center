import { NextResponse } from "next/server";
import { findBundleCandidateByToken, HELD_MESSAGE } from "@/lib/bespoke/candidates";
import { submitBundlePersona } from "@/lib/bespoke/sitting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (ctx.held) return NextResponse.json({ error: HELD_MESSAGE }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { answers?: Array<{ itemKey: string; rawScore: number }> } | null;
  const answers = Array.isArray(body?.answers) ? body!.answers : [];
  const res = await submitBundlePersona(ctx, answers);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
