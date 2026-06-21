/**
 * Camera proctoring (Phase 1) - server-side data access.
 *
 * All writes go through the service-role client: the taker has no account, so
 * the capture endpoints create sessions and store snapshots without a session.
 * Snapshot images live in the private `proctor` Storage bucket (migration 00147);
 * the admin report reads them via short-lived signed URLs. 90-day retention is
 * enforced by `purgeExpiredProctorData` (called from the retention cron).
 *
 * Every function is best-effort/tolerant of the table or bucket not existing yet
 * (mirrors the fluent/academy pattern) so an un-applied 00147 never 500s a test.
 */

import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "proctor";
const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 min - enough to review the report

/** Per-snapshot flags (Phase 2). motion is client-side; the rest are AI-derived. */
export type SnapshotFlags = {
  motion?: number; // 0-100 frame-difference score (client-side)
  faces?: number; // AI: visible face count
  looking_away?: boolean; // AI: gaze/head clearly turned away (or absent)
  device_or_screen?: boolean; // AI: phone / second screen visible
  ai_note?: string | null; // AI: short note
};

/** Session-level AI review summary (Phase 2). */
export type ProctorReviewSummary = {
  analyzed: number; // frames sent to the vision model
  total: number; // total snapshots in the session
  no_face: number;
  multiple_faces: number;
  looking_away: number;
  device_or_screen: number;
  high_motion: number;
  configured: boolean; // false when no AI key (AI flags not computed)
};

export type ProctorSessionRow = {
  id: string;
  context: string;
  ref_id: string | null;
  candidate_id: string | null;
  subject_name: string | null;
  subject_email: string | null;
  consent_at: string | null;
  consent_text: string | null;
  started_at: string;
  ended_at: string | null;
  snapshot_count: number;
  status: string;
  expires_at: string;
  created_at: string;
  ai_review: ProctorReviewSummary | null;
  ai_reviewed_at: string | null;
};

export type ProctorSnapshotView = {
  id: string;
  sequence: number;
  captured_at: string;
  signedUrl: string | null;
  flags: SnapshotFlags | null;
};

export type ProctorSessionView = {
  session: ProctorSessionRow;
  snapshots: ProctorSnapshotView[];
};

/** Create a proctoring session once the taker has consented. Returns the session id. */
export async function createProctorSession(input: {
  context: string;
  ref_id?: string | null;
  candidate_id?: string | null;
  subject_name?: string | null;
  subject_email?: string | null;
  consent_text?: string | null;
}): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("proctor_sessions")
      .insert({
        context: input.context,
        ref_id: input.ref_id ?? null,
        candidate_id: input.candidate_id ?? null,
        subject_name: input.subject_name ?? null,
        subject_email: input.subject_email ?? null,
        consent_at: new Date().toISOString(),
        consent_text: input.consent_text ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not start a proctoring session." };
    return { ok: true, sessionId: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Proctoring unavailable." };
  }
}

/** Store one webcam snapshot for an ACTIVE session. */
export async function recordSnapshot(input: {
  sessionId: string;
  bytes: Buffer;
  contentType: string;
  /** Client-side motion score (0-100) vs the previous frame. */
  motion?: number;
}): Promise<{ ok: true; sequence: number } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient();
    const { data: sess } = await sb
      .from("proctor_sessions")
      .select("id, status, snapshot_count")
      .eq("id", input.sessionId)
      .maybeSingle();
    if (!sess || (sess as { status: string }).status !== "active") {
      return { ok: false, error: "Session is not active." };
    }
    const seq = ((sess as { snapshot_count: number }).snapshot_count ?? 0) + 1;
    const ext = input.contentType.includes("png") ? "png" : "jpg";
    const path = `${input.sessionId}/${String(seq).padStart(4, "0")}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, input.bytes, {
      contentType: input.contentType,
      upsert: false,
    });
    if (up.error) return { ok: false, error: up.error.message };
    await sb.from("proctor_snapshots").insert({
      session_id: input.sessionId,
      storage_path: path,
      sequence: seq,
      captured_at: new Date().toISOString(),
      flags: typeof input.motion === "number" ? { motion: Math.round(input.motion) } : null,
    });
    await sb.from("proctor_sessions").update({ snapshot_count: seq }).eq("id", input.sessionId);
    return { ok: true, sequence: seq };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not store snapshot." };
  }
}

/** Mark a session ended (the test finished or the page closed). Best-effort. */
export async function endProctorSession(sessionId: string): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb
      .from("proctor_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId);
  } catch {
    /* best-effort */
  }
}

/** Admin report: the session + its snapshots with short-lived signed URLs. */
export async function getSessionWithSnapshots(sessionId: string): Promise<ProctorSessionView | null> {
  try {
    const sb = createServiceClient();
    const { data: session } = await sb.from("proctor_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) return null;
    const { data: snaps } = await sb
      .from("proctor_snapshots")
      .select("id, sequence, captured_at, storage_path, flags")
      .eq("session_id", sessionId)
      .order("sequence", { ascending: true });
    const rows = (snaps ?? []) as Array<{
      id: string;
      sequence: number;
      captured_at: string;
      storage_path: string;
      flags: SnapshotFlags | null;
    }>;
    const snapshots: ProctorSnapshotView[] = [];
    for (const s of rows) {
      const signed = await sb.storage.from(BUCKET).createSignedUrl(s.storage_path, SIGNED_URL_TTL_SECONDS);
      snapshots.push({
        id: s.id,
        sequence: s.sequence,
        captured_at: s.captured_at,
        signedUrl: signed.data?.signedUrl ?? null,
        flags: s.flags ?? null,
      });
    }
    return { session: session as ProctorSessionRow, snapshots };
  } catch {
    return null;
  }
}

/** 90-day retention purge: delete expired sessions + their storage objects. */
export async function purgeExpiredProctorData(): Promise<{ sessions: number; objects: number }> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data: expired } = await sb.from("proctor_sessions").select("id").lt("expires_at", nowIso);
  const ids = ((expired ?? []) as Array<{ id: string }>).map((r) => r.id);
  let objects = 0;
  for (const id of ids) {
    const { data: files } = await sb.storage.from(BUCKET).list(id);
    if (files && files.length) {
      const paths = files.map((f) => `${id}/${f.name}`);
      await sb.storage.from(BUCKET).remove(paths);
      objects += paths.length;
    }
  }
  // Cascade on proctor_snapshots clears the metadata rows.
  if (ids.length) await sb.from("proctor_sessions").delete().in("id", ids);
  return { sessions: ids.length, objects };
}
