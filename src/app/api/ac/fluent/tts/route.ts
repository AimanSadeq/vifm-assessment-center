/**
 * Fluent - listening audio (Azure neural TTS).
 *
 * GET /api/ac/fluent/tts?session=<id>&item=<listeningItemId>
 *   -> audio/mpeg of the listening item's script, synthesised on demand.
 *
 * The script is loaded from the server-side session (eng_fluent_sessions) and
 * never sent to the browser as text, so it can't be read instead of heard.
 * 503 when Azure isn't configured (client falls back to browser TTS), 404 if
 * the session/item is missing.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { isAzureSpeechConfigured, synthesizeSpeech } from "@/lib/integrations/speech";
import type { FluentTest } from "@/lib/ai/fluent-english";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isAzureSpeechConfigured()) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session");
  const itemId = url.searchParams.get("item");
  if (!sessionId || !itemId) {
    return NextResponse.json({ error: "session and item are required" }, { status: 400 });
  }

  // Defense-in-depth: the unguessable session id alone must NOT serve audio. A
  // voucher taker presents their redemption token (validated against the
  // redemptions table); the admin-run /ac/fluent flow carries no token but is
  // staff-authenticated. Reject anyone who is neither - so a leaked/guessed
  // session id is useless without the caller's own credential.
  const token = url.searchParams.get("token");
  if (token) {
    const sbAuth = createServiceClient();
    const { data: redemption } = await sbAuth
      .from("eng_fluent_voucher_redemptions")
      .select("id")
      .eq("redemption_token", token)
      .maybeSingle<{ id: string }>();
    if (!redemption) return NextResponse.json({ error: "Invalid link" }, { status: 403 });
  } else if (!(await isStaffCaller())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let script: string | null = null;
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("eng_fluent_sessions").select("test").eq("id", sessionId).single();
    const test = data?.test as FluentTest | undefined;
    script = test?.listening?.find((l) => l.id === itemId)?.script ?? null;
  } catch {
    script = null;
  }
  if (!script) return NextResponse.json({ error: "item not found" }, { status: 404 });

  const audio = await synthesizeSpeech(script);
  if (!audio) return NextResponse.json({ error: "synthesis failed" }, { status: 502 });

  return new NextResponse(new Uint8Array(audio), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
  });
}
