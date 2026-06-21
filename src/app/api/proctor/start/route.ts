/**
 * POST /api/proctor/start - begin a camera-proctoring session after the taker
 * consents. No account (the test taker is anonymous); the unguessable session
 * UUID returned here is the credential the snapshot endpoint validates against.
 *
 * Proctoring must NEVER block the test: on any failure this returns 200 with
 * { ok: false } so the runner simply proceeds unproctored.
 */
import { NextResponse } from "next/server";
import { createProctorSession } from "@/lib/proctor/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const res = await createProctorSession({
    context: str(body.context, 40) ?? "fluent",
    ref_id: str(body.ref_id, 200),
    subject_name: str(body.subject_name, 200),
    subject_email: str(body.subject_email, 200),
    consent_text: str(body.consent_text, 2000),
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error });
  return NextResponse.json({ ok: true, session_id: res.sessionId });
}
