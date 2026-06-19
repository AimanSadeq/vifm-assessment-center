/**
 * Pre-Hire Fluent - neural TTS for listening items (Azure).
 *
 * GET ?item=<listeningItemId> -> audio/mpeg of that item's script.
 *
 * The listening script lives only server-side (in detail.fullTest); voicing it
 * here means the candidate hears it without ever seeing the text - it stays a
 * listening test, not a reading one. 503 when Azure isn't configured (the
 * client then falls back to browser speech synthesis or shows the script).
 */

import { NextResponse } from "next/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { createServiceClient } from "@/lib/supabase/server";
import { isAzureSpeechConfigured, synthesizeSpeech } from "@/lib/integrations/speech";
import type { FluentTest } from "@/lib/ai/fluent-english";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoredDetail = { fullTest?: FluentTest } | null;

export async function GET(req: Request, { params }: { params: { token: string } }) {
  if (!isAzureSpeechConfigured()) {
    return NextResponse.json({ error: "audio not available" }, { status: 503 });
  }
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const itemId = new URL(req.url).searchParams.get("item");
  if (!itemId) return NextResponse.json({ error: "missing item" }, { status: 400 });

  const svc = createServiceClient();
  const { data: stage } = await svc
    .from("prehire_stage_results")
    .select("detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "fluent")
    .maybeSingle();

  const item = (stage?.detail as StoredDetail)?.fullTest?.listening?.find((l) => l.id === itemId);
  if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

  const audio = await synthesizeSpeech(item.script);
  if (!audio) return NextResponse.json({ error: "synthesis failed" }, { status: 502 });

  return new NextResponse(new Uint8Array(audio), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
