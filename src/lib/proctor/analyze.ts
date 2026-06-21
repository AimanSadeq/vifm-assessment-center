/**
 * Camera proctoring Phase 2 - AI vision review of snapshots.
 *
 * Admin-triggered: samples up to N snapshots evenly across the session, sends
 * each to Claude vision, and records per-frame flags (faces / looking_away /
 * device_or_screen) into proctor_snapshots.flags plus a session-level summary on
 * proctor_sessions.ai_review. "Room movement" is the client-side motion score
 * captured at snapshot time (frame-difference) - the temporal signal a single
 * image can't give - and is summarised here too.
 *
 * Honest by design: with no ANTHROPIC_API_KEY the AI flags are NOT computed
 * (configured:false) - it never fabricates a flag. The output is a review aid for
 * a human, never an automatic pass/fail.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import type { SnapshotFlags, ProctorReviewSummary } from "@/lib/proctor/access";

const BUCKET = "proctor";
const DEFAULT_MAX = 16; // sampled frames sent to the vision model (cost/latency cap)
const HIGH_MOTION = 25; // motion score (0-100) above which a frame counts as "high motion"
const BATCH = 4; // concurrent vision calls

type SnapshotRow = { id: string; sequence: number; storage_path: string; flags: SnapshotFlags | null };

export async function analyzeProctorSession(
  sessionId: string,
  opts?: { max?: number }
): Promise<{ ok: true; summary: ProctorReviewSummary } | { ok: false; error: string }> {
  const max = opts?.max ?? DEFAULT_MAX;
  const sb = createServiceClient();

  const { data: snaps } = await sb
    .from("proctor_snapshots")
    .select("id, sequence, storage_path, flags")
    .eq("session_id", sessionId)
    .order("sequence", { ascending: true });
  const rows = (snaps ?? []) as SnapshotRow[];
  if (rows.length === 0) return { ok: false, error: "No snapshots to review." };

  const client = getAIClient();
  const summary: ProctorReviewSummary = {
    analyzed: 0,
    total: rows.length,
    no_face: 0,
    multiple_faces: 0,
    looking_away: 0,
    device_or_screen: 0,
    high_motion: 0,
    configured: !!client,
  };

  // Motion is already on each frame (client-side) - summarise from all frames.
  for (const r of rows) {
    if (typeof r.flags?.motion === "number" && r.flags.motion >= HIGH_MOTION) summary.high_motion += 1;
  }

  if (client) {
    const sampled = sampleEvenly(rows, max);
    for (let i = 0; i < sampled.length; i += BATCH) {
      const batch = sampled.slice(i, i + BATCH);
      const results = await Promise.all(batch.map((r) => analyzeOne(sb, client, r)));
      for (let j = 0; j < batch.length; j++) {
        const ai = results[j];
        if (!ai) continue;
        const r = batch[j];
        summary.analyzed += 1;
        if (ai.faces === 0) summary.no_face += 1;
        if (ai.faces >= 2) summary.multiple_faces += 1;
        if (ai.looking_away) summary.looking_away += 1;
        if (ai.device_or_screen) summary.device_or_screen += 1;
        const merged: SnapshotFlags = {
          ...(r.flags ?? {}),
          faces: ai.faces,
          looking_away: ai.looking_away,
          device_or_screen: ai.device_or_screen,
          ai_note: ai.note,
        };
        await sb.from("proctor_snapshots").update({ flags: merged }).eq("id", r.id);
      }
    }
  }

  await sb
    .from("proctor_sessions")
    .update({ ai_review: summary, ai_reviewed_at: new Date().toISOString() })
    .eq("id", sessionId);
  return { ok: true, summary };
}

function sampleEvenly<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

type AiClient = NonNullable<ReturnType<typeof getAIClient>>;
type ServiceClient = ReturnType<typeof createServiceClient>;

async function analyzeOne(
  sb: ServiceClient,
  client: AiClient,
  r: SnapshotRow
): Promise<{ faces: number; looking_away: boolean; device_or_screen: boolean; note: string | null } | null> {
  try {
    const dl = await sb.storage.from(BUCKET).download(r.storage_path);
    if (dl.error || !dl.data) return null;
    const buf = Buffer.from(await dl.data.arrayBuffer());
    const b64 = buf.toString("base64");
    const media = r.storage_path.endsWith(".png") ? ("image/png" as const) : ("image/jpeg" as const);
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 300,
      system:
        "You are an exam-proctoring vision reviewer. Report ONLY what is visibly present in the webcam snapshot; do not speculate. Return strict JSON.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image" as const, source: { type: "base64" as const, media_type: media, data: b64 } },
            {
              type: "text" as const,
              text:
                'Count the people whose face is visible. Is the single test-taker clearly looking away from the screen (head/eyes turned away, or no person present)? Is a phone or a second screen visible in frame? Return JSON ONLY: {"faces": <int>, "looking_away": <bool>, "device_or_screen": <bool>, "note": "<<=12 words>"}',
            },
          ],
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const m = block.text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const p = JSON.parse(m[0]) as Record<string, unknown>;
    return {
      faces: Number.isFinite(Number(p.faces)) ? Math.max(0, Math.round(Number(p.faces))) : 0,
      looking_away: !!p.looking_away,
      device_or_screen: !!p.device_or_screen,
      note: typeof p.note === "string" ? p.note.slice(0, 120) : null,
    };
  } catch {
    return null;
  }
}
