/**
 * POST /api/proctor/snapshot - store one webcam snapshot for an active proctoring
 * session. Body: { session_id, image } where image is a data URL or raw base64
 * (JPEG/PNG). No account; the session UUID is the credential. Best-effort: a
 * failure returns 200 { ok: false } so a dropped frame never breaks the test.
 */
import { NextResponse } from "next/server";
import { recordSnapshot } from "@/lib/proctor/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_RE = /^[0-9a-fA-F-]{36}$/;
const MAX_BYTES = 2_000_000; // 2 MB per snapshot

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  const image = typeof body.image === "string" ? body.image : "";
  if (!SESSION_RE.test(sessionId) || !image) {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const comma = image.indexOf(",");
  const header = comma >= 0 ? image.slice(0, comma) : "";
  const b64 = comma >= 0 ? image.slice(comma + 1) : image;
  const contentType = /png/i.test(header) ? "image/png" : "image/jpeg";

  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return NextResponse.json({ ok: false, error: "bad image" }, { status: 400 });
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "image size" }, { status: 400 });
  }

  const motion =
    typeof body.motion === "number" && Number.isFinite(body.motion)
      ? Math.max(0, Math.min(100, body.motion))
      : undefined;

  const res = await recordSnapshot({ sessionId, bytes, contentType, motion });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error });
  return NextResponse.json({ ok: true, sequence: res.sequence });
}
