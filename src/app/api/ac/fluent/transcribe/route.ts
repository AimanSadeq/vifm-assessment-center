/**
 * Fluent - speaking-audio transcription (Whisper).
 *
 * POST multipart/form-data with field `audio` (a recorded blob from the
 * browser MediaRecorder, typically audio/webm;codecs=opus).
 *   -> { transcript, pronunciation }       on success
 *   -> { error }                            on failure (HTTP 4xx/5xx)
 *
 * The heavy lifting (Whisper subprocess + optional Azure pronunciation) lives
 * in @/lib/integrations/transcription so the Pre-Hire English screen shares the
 * exact same code path. No audio is persisted.
 */

import { NextResponse } from "next/server";
import { transcribeSpeechFile } from "@/lib/integrations/transcription";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function clientIp(req: Request): string {
  // For a rate-limit KEY the IP must be the trusted hop, not a client-supplied
  // one - otherwise a rotating `X-Forwarded-For: <random>` lands every request in
  // a fresh bucket and the cap is bypassed. Caliber sits behind Cloudflare, which
  // overwrites `cf-connecting-ip` with the real client (unspoofable at the edge);
  // prefer it, then Render's `x-real-ip`, then the LAST XFF hop (the one appended
  // by the closest trusted proxy - never the attacker-controlled leftmost entry).
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  return "unknown";
}

export async function POST(req: Request) {
  // This route runs a PAID Whisper transcription and is middleware-public. Two
  // guards against denial-of-wallet: a per-IP rate limit, and a mandatory valid
  // in-progress session - so it can't be hammered anonymously.
  const rl = rateLimit(`fluent-transcribe:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  // Gate on a live sitting: an active (unexpired) eng_fluent_session must back the
  // request, so only a taker mid-test can transcribe - never an anonymous caller.
  const sessionId = form.get("sessionId");
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "a valid session is required" }, { status: 403 });
  }
  try {
    const sb = createServiceClient();
    const { data: sess } = await sb
      .from("eng_fluent_sessions")
      .select("expires_at")
      .eq("id", sessionId)
      .maybeSingle<{ expires_at: string | null }>();
    if (!sess || (sess.expires_at && new Date(sess.expires_at).getTime() < Date.now())) {
      return NextResponse.json({ error: "invalid or expired session" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "session store unavailable" }, { status: 503 });
  }

  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing audio file" }, { status: 400 });
  }

  const r = await transcribeSpeechFile(file);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 422 });
  return NextResponse.json({ transcript: r.transcript, pronunciation: r.pronunciation ?? null });
}
