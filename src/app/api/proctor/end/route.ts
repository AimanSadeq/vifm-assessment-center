/**
 * POST /api/proctor/end - mark a proctoring session ended (test finished or the
 * page closed). Designed for navigator.sendBeacon, so it accepts a JSON blob and
 * is fire-and-forget. Best-effort: ending only enriches the report with a
 * duration; retention still purges by expires_at regardless.
 */
import { NextResponse } from "next/server";
import { endProctorSession } from "@/lib/proctor/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_RE = /^[0-9a-fA-F-]{36}$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (SESSION_RE.test(sessionId)) await endProctorSession(sessionId);
  return NextResponse.json({ ok: true });
}
