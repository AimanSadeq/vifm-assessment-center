import { NextResponse } from "next/server";
import { findBundleCandidateByToken } from "@/lib/bespoke/candidates";
import { startBundlePersona } from "@/lib/bespoke/sitting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (!ctx.stages.includes("persona")) return NextResponse.json({ error: "This bundle has no Persona section." }, { status: 400 });
  const { sessionId, items } = await startBundlePersona(ctx);
  return NextResponse.json({ sessionId, items });
}
