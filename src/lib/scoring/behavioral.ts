// ─────────────────────────────────────────────────────────────
// Behavioral self-assessment — server lib (Slice 4).
//
// Sessions + item responses + per-competency self rollup. The rollup
// (behavioral_competency_scores) is what the readiness engine reads in
// combined mode (readiness-data.ts step 6). Reverse items are mapped 6 − raw.
//
// Writes go through the service-role client (same model as the quiz / academy /
// prehire candidate flows); the candidate identity is enforced at the route/
// page layer (dev trusts the candidateId; under auth=on gate via profile_id).
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";

export type BehavioralStatus = "not_started" | "in_progress" | "submitted";

export type BehavioralSession = { id: string; status: BehavioralStatus };

/** Resolve (or create) the one session per candidate per engagement. */
export async function getOrCreateBehavioralSession(
  engagementId: string,
  candidateId: string,
): Promise<BehavioralSession> {
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("behavioral_assessment_sessions")
    .select("id, status")
    .eq("engagement_id", engagementId)
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (existing) return { id: existing.id as string, status: existing.status as BehavioralStatus };

  const { data, error } = await sb
    .from("behavioral_assessment_sessions")
    .insert({
      engagement_id: engagementId,
      candidate_id: candidateId,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();
  if (error || !data) throw error ?? new Error("Could not create behavioral session");
  return { id: data.id as string, status: data.status as BehavioralStatus };
}

/**
 * Create an anonymous Persona session - no candidate, no engagement, just a
 * name label (migration 00098). Used by the standalone runner at /ac/persona.
 * Throws if 00098 isn't applied (candidate_id/engagement_id still NOT NULL);
 * the calling server action catches and surfaces a friendly message.
 */
export async function createAnonymousBehavioralSession(
  takerName: string | null,
): Promise<BehavioralSession> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("behavioral_assessment_sessions")
    .insert({
      taker_name: takerName,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();
  if (error || !data) throw error ?? new Error("Could not create Persona session");
  return { id: data.id as string, status: data.status as BehavioralStatus };
}

export type BehavioralProfileRow = {
  competencyId: string;
  selfScore: number; // 1-5, reverse already applied
  itemCount: number;
};

/**
 * Finalize an anonymous session: compute per-competency self scores (reverse
 * mapped 6 - raw), mark the session submitted, and RETURN the profile. Unlike
 * the candidate path it does NOT write behavioral_competency_scores - an
 * anonymous run has no candidate/engagement to feed the readiness engine.
 */
export async function submitAnonymousBehavioral(
  sessionId: string,
): Promise<{ ok: boolean; profile?: BehavioralProfileRow[]; error?: string }> {
  const sb = createServiceClient();
  const { data: session } = await sb
    .from("behavioral_assessment_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "No session" };

  const { data: responses } = await sb
    .from("behavioral_assessment_responses")
    .select("competency_id, raw_score, is_reverse")
    .eq("session_id", sessionId);

  const byComp = new Map<string, number[]>();
  for (const r of responses ?? []) {
    const raw = Number(r.raw_score);
    const scored = r.is_reverse ? 6 - raw : raw; // reverse mapping
    const cid = r.competency_id as string;
    if (!byComp.has(cid)) byComp.set(cid, []);
    byComp.get(cid)!.push(scored);
  }

  const profile: BehavioralProfileRow[] = Array.from(byComp.entries()).map(([competencyId, vals]) => ({
    competencyId,
    selfScore: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
    itemCount: vals.length,
  }));

  await sb
    .from("behavioral_assessment_sessions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", sessionId);

  return { ok: true, profile };
}

/** Map of item_key -> raw_score for resume. */
export async function loadBehavioralResponses(sessionId: string): Promise<Record<string, number>> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("behavioral_assessment_responses")
    .select("item_key, raw_score")
    .eq("session_id", sessionId);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.item_key as string] = Number(r.raw_score);
  return out;
}

export type BehavioralAnswer = {
  itemKey: string;
  competencyId: string; // AC catalogue competency id
  rawScore: number; // 1-5
  isReverse: boolean;
};

/** Upsert a batch of answers (autosave). Refuses once the session is submitted. */
export async function saveBehavioralAnswers(
  sessionId: string,
  answers: BehavioralAnswer[],
): Promise<{ ok: boolean; error?: string }> {
  if (answers.length === 0) return { ok: true };
  const sb = createServiceClient();
  const { data: session } = await sb
    .from("behavioral_assessment_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "Invalid session" };
  if (session.status === "submitted") return { ok: false, error: "Session already submitted" };

  const rows = answers
    .filter((a) => Number.isInteger(a.rawScore) && a.rawScore >= 1 && a.rawScore <= 5)
    .map((a) => ({
      session_id: sessionId,
      item_key: a.itemKey,
      competency_id: a.competencyId,
      raw_score: a.rawScore,
      is_reverse: a.isReverse,
      answered_at: new Date().toISOString(),
    }));
  const { error } = await sb
    .from("behavioral_assessment_responses")
    .upsert(rows, { onConflict: "session_id,item_key" });
  if (error) return { ok: false, error: error.message };
  await sb
    .from("behavioral_assessment_sessions")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  return { ok: true };
}

/**
 * Finalize: compute per-competency self scores (reverse mapped 6 − raw),
 * upsert behavioral_competency_scores, and mark the session submitted.
 */
export async function submitBehavioralAssessment(
  engagementId: string,
  candidateId: string,
): Promise<{ ok: boolean; scored?: number; error?: string }> {
  const sb = createServiceClient();
  const { data: session } = await sb
    .from("behavioral_assessment_sessions")
    .select("id, status")
    .eq("engagement_id", engagementId)
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (!session) return { ok: false, error: "No session" };

  const { data: responses } = await sb
    .from("behavioral_assessment_responses")
    .select("competency_id, raw_score, is_reverse")
    .eq("session_id", session.id);

  const byComp = new Map<string, number[]>();
  for (const r of responses ?? []) {
    const raw = Number(r.raw_score);
    const scored = r.is_reverse ? 6 - raw : raw; // reverse mapping
    const cid = r.competency_id as string;
    if (!byComp.has(cid)) byComp.set(cid, []);
    byComp.get(cid)!.push(scored);
  }

  const rows = Array.from(byComp.entries()).map(([competencyId, vals]) => ({
    engagement_id: engagementId,
    candidate_id: candidateId,
    competency_id: competencyId,
    self_score: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
    item_count: vals.length,
    computed_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await sb
      .from("behavioral_competency_scores")
      .upsert(rows, { onConflict: "engagement_id,candidate_id,competency_id" });
    if (error) return { ok: false, error: error.message };
  }

  await sb
    .from("behavioral_assessment_sessions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", session.id);

  return { ok: true, scored: rows.length };
}
