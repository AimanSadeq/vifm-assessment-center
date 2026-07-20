/**
 * Pre-Hire Fluent - neural TTS for listening items (Azure).
 *
 * GET ?item=<listeningItemId> -> audio/mpeg of that item's script.
 *
 * The listening script lives only server-side (in detail.fullTest); voicing it
 * here means the candidate hears it without ever seeing the text - it stays a
 * listening test, not a reading one. 503 when Azure isn't configured (the
 * client then falls back to browser speech synthesis or shows the script).
 *
 * Serve cap: the client player enforces the "up to twice" replay promise, but
 * client state can always be reset (incognito, another browser). The server
 * therefore also caps how many times each item's AUDIO CONTENT is delivered
 * per candidate. Plays of already-delivered (cached) audio can't be counted
 * from here - the cap bounds fresh deliveries, which is what an
 * incognito-cycling candidate needs. Only full-content requests count (a
 * mid-file Range continuation of one play must not burn the budget), and the
 * allowance is MAX_PLAYS + a margin so a device switch or a failed fetch
 * never locks a legitimate candidate out.
 */

import { NextResponse } from "next/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { createServiceClient } from "@/lib/supabase/server";
import { isAzureSpeechConfigured, synthesizeSpeech } from "@/lib/integrations/speech";
import type { FluentTest } from "@/lib/ai/fluent-english";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoredDetail = { fullTest?: FluentTest; ttsServes?: Record<string, number> } | null;

// Client promise is 2 plays; +2 covers a device switch / errored fetch retry.
const MAX_SERVES_PER_ITEM = 4;

/** A request is a fresh delivery when it asks for the file from the start;
 *  mid-file Range continuations belong to a play already counted. */
function isFullContentRequest(req: Request): boolean {
  const range = req.headers.get("range");
  if (!range) return true;
  return /^bytes=0-/.test(range.trim());
}

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
    .select("id, detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "fluent")
    .maybeSingle();

  const detail = (stage?.detail ?? null) as StoredDetail;
  const item = detail?.fullTest?.listening?.find((l) => l.id === itemId);
  if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

  if (isFullContentRequest(req)) {
    const serves = detail?.ttsServes?.[itemId] ?? 0;
    if (serves >= MAX_SERVES_PER_ITEM) {
      return NextResponse.json(
        { error: "This clip has reached its replay limit." },
        { status: 403 },
      );
    }
    // Best-effort count persist (single candidate, low concurrency - a lost
    // increment under-counts, which errs in the candidate's favour).
    if (stage?.id) {
      const nextDetail = {
        ...(detail ?? {}),
        ttsServes: { ...(detail?.ttsServes ?? {}), [itemId]: serves + 1 },
      };
      await svc
        .from("prehire_stage_results")
        .update({ detail: nextDetail })
        .eq("id", stage.id)
        .then(undefined, () => {});
    }
  }

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
