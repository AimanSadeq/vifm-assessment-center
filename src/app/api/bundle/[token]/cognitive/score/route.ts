import { NextResponse } from "next/server";
import { findBundleCandidateByToken } from "@/lib/bespoke/candidates";
import { scoreBundleCognitive } from "@/lib/bespoke/sitting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    answers?: Record<string, number>;
    language?: string;
  };
  if (!body.sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  const lang = body.language === "ar" ? "ar" : "en";
  // Takers never receive score data - the result lands org-tagged in psy_results.
  const res = await scoreBundleCognitive(ctx, body.sessionId, body.answers ?? {}, lang);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
