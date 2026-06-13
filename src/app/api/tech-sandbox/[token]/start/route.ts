import { NextResponse } from "next/server";
import { startSession } from "@/lib/technical-sandbox/service";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const session = await startSession(params.token);
    return NextResponse.json({ ok: true, expiresAt: session.expires_at, status: session.status });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
