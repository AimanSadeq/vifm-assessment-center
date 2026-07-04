// ─────────────────────────────────────────────────────────────
// Behavioral self-assessment - server lib (Slice 4).
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
 * True for an "undefined column" error from either path: Postgres raises 42703
 * on a SELECT of a missing column; PostgREST raises PGRST204 ("Could not find
 * the 'X' column ... in the schema cache") on a write. Used to drive the
 * strip-and-retry fallbacks when a migration (00110 / 00123) isn't applied -
 * a message regex misses the write-path shape, so key on the codes.
 */
function isMissingColumnError(err: { code?: string } | null): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

/**
 * Create an anonymous Persona session - no candidate, no engagement, just a
 * name label (migration 00098). Used by the standalone runner at /ac/persona.
 * Throws if 00098 isn't applied (candidate_id/engagement_id still NOT NULL);
 * the calling server action catches and surfaces a friendly message.
 */
export async function createAnonymousBehavioralSession(
  takerName: string | null,
  opts?: {
    organizationId?: string | null;
    voucherRedemptionId?: string | null;
    /** Taker email (migration 00129); lead capture + results delivery. */
    takerEmail?: string | null;
    /** 'development' (narrative + suggestions) or 'hiring' (fit vs a target role). */
    purpose?: "development" | "hiring";
    /** Target role profile for a hiring fit read (migration 00110). */
    targetRoleProfileId?: string | null;
    /** Seed for the reproducible item layout (migration 00110). */
    seed?: number | null;
    /** Competency scope actually served (migration 00123); null/empty = full bank. */
    scopedCompetencyIds?: string[] | null;
    /** Project/cohort label (migration 00137); groups Persona + Cognitive runs. */
    projectLabel?: string | null;
    /** Item format (migration 00140, SD-9): 'normative' / 'ipsative' / 'both'. */
    itemFormat?: "normative" | "ipsative" | "both";
  },
): Promise<BehavioralSession> {
  const sb = createServiceClient();
  // Build the insert payload in MIGRATION ORDER so the tolerant strip-and-retry
  // can peel the NEWEST migration's columns FIRST. Each layer is a strict
  // superset of the previous, so on a missing-column error we drop exactly the
  // column group tied to the un-applied migration and never an older, present
  // one (e.g. a DB at 00110+00123 but not 00129 must still keep purpose/scope).
  const baseCore: Record<string, unknown> = {
    taker_name: takerName,
    status: "in_progress",
    started_at: new Date().toISOString(),
    // Voucher delegate flow: stamp the client org + redemption (columns land
    // with migration 00106; only included when provided so the non-voucher
    // path keeps working before the migration).
    ...(opts?.organizationId ? { organization_id: opts.organizationId } : {}),
    ...(opts?.voucherRedemptionId ? { voucher_redemption_id: opts.voucherRedemptionId } : {}),
  };
  // 00110: purpose/target/seed.
  const with110: Record<string, unknown> = {
    ...baseCore,
    ...(opts?.purpose ? { purpose: opts.purpose } : {}),
    ...(opts?.targetRoleProfileId ? { target_role_profile_id: opts.targetRoleProfileId } : {}),
    ...(opts?.seed != null ? { randomization_seed: opts.seed } : {}),
  };
  // 00123: competency scope.
  const scoped = (opts?.scopedCompetencyIds ?? []).filter(Boolean);
  const with123: Record<string, unknown> = {
    ...with110,
    ...(scoped.length > 0 ? { scoped_competency_ids: scoped } : {}),
  };
  // 00129: taker_email.
  const with129: Record<string, unknown> = {
    ...with123,
    ...(opts?.takerEmail ? { taker_email: opts.takerEmail } : {}),
  };
  // 00137: project/cohort label.
  const with137: Record<string, unknown> = {
    ...with129,
    ...(opts?.projectLabel ? { project_label: opts.projectLabel } : {}),
  };
  // 00140 (newest): item format. Only carried when narrowed - 'both' is the
  // column DEFAULT, so omitting it preserves today's behaviour.
  const with140: Record<string, unknown> = {
    ...with137,
    ...(opts?.itemFormat === "normative" || opts?.itemFormat === "ipsative"
      ? { item_format: opts.itemFormat }
      : {}),
  };

  // Peel the newest migration's columns first on each missing-column error:
  // 00140 item_format -> 00137 project_label -> 00129 taker_email -> 00123 scope -> 00110 -> core.
  const attempts = [with140, with137, with129, with123, with110, baseCore];
  let data: { id: string; status: string } | null = null;
  let error: unknown = null;
  for (const payload of attempts) {
    const res = await sb
      .from("behavioral_assessment_sessions")
      .insert(payload)
      .select("id, status")
      .single();
    data = res.data as { id: string; status: string } | null;
    error = res.error;
    if (!error) break;
    if (!isMissingColumnError(res.error)) break;
  }
  if (error || !data) throw (error as Error) ?? new Error("Could not create Persona session");
  return { id: data.id as string, status: data.status as BehavioralStatus };
}

export type BehavioralProfileRow = {
  competencyId: string;
  selfScore: number; // 1-5, reverse already applied
  itemCount: number;
};

export type ScoreRow = {
  competency_id: string;
  raw_score: number | string;
  is_reverse: boolean;
  item_type?: string | null;
  answer_data?: { choice?: string } | null;
};
/** Public alias for the shape report/list scorers should select + pass. */
export type PersonaScoreRow = ScoreRow;

/**
 * Per-competency self-score rollup shared by the anonymous + candidate paths.
 *
 * - Normative (Likert) rows: averaged, reverse-mapped (6 - raw).
 * - Ipsative (forced-choice) rows: collapsed to ONE value per competency =
 *   3 (neutral) + (#most - #least), clamped 1-5. One value regardless of how
 *   many blocks the competency appears in, so PER-10's extra blocks SHARPEN the
 *   preference signal instead of diluting the average toward the mid (which a
 *   naive per-statement average of most=5/least=1/mid=3 would do). Unpicked
 *   ("mid") statements carry no signal; a competency that appears in blocks but
 *   is never picked stays neutral (3), so coverage is never lost.
 * The single ipsative value is averaged together with the normative values.
 */
export function rollupSelfScores(responses: ScoreRow[]): BehavioralProfileRow[] {
  const normByComp = new Map<string, number[]>();
  const ipsByComp = new Map<string, { most: number; least: number; seen: boolean }>();
  const order: string[] = [];
  const seenComp = new Set<string>();
  for (const r of responses) {
    const cid = r.competency_id;
    if (!seenComp.has(cid)) { seenComp.add(cid); order.push(cid); }
    if (r.item_type === "ipsative") {
      const agg = ipsByComp.get(cid) ?? { most: 0, least: 0, seen: true };
      agg.seen = true;
      const choice = r.answer_data?.choice;
      if (choice === "most") agg.most += 1;
      else if (choice === "least") agg.least += 1;
      ipsByComp.set(cid, agg);
    } else {
      const raw = Number(r.raw_score);
      const scored = r.is_reverse ? 6 - raw : raw;
      const arr = normByComp.get(cid) ?? [];
      arr.push(scored);
      normByComp.set(cid, arr);
    }
  }
  const profile: BehavioralProfileRow[] = [];
  for (const cid of order) {
    const vals = [...(normByComp.get(cid) ?? [])];
    const ips = ipsByComp.get(cid);
    if (ips?.seen) {
      vals.push(Math.max(1, Math.min(5, 3 + (ips.most - ips.least))));
    }
    if (vals.length === 0) continue;
    profile.push({
      competencyId: cid,
      selfScore: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
      itemCount: vals.length,
    });
  }
  return profile;
}

/**
 * Ipsative-aware per-competency self-score map for ONE session's response rows.
 * Wraps rollupSelfScores so every report/list surface collapses forced-choice
 * rows the same way the taker's on-screen result did, instead of averaging the
 * raw 5/1/3 ipsative rows as if they were Likert. Callers MUST select
 * `item_type` and `answer_data` alongside competency_id/raw_score/is_reverse.
 */
export function selfScoreByCompetency(rows: ScoreRow[]): Map<string, number> {
  return new Map(rollupSelfScores(rows).map((r) => [r.competencyId, r.selfScore]));
}

/**
 * Ipsative-aware overall self-rating (1-5) for ONE session = the mean of its
 * per-competency self-scores (each competency collapsed correctly first), NOT a
 * flat mean of every raw response row. Returns null when the session has no
 * scorable rows. For multi-session surfaces, group rows by session_id and call
 * this per session.
 */
export function overallSelfScore(rows: ScoreRow[]): number | null {
  const profile = rollupSelfScores(rows);
  if (profile.length === 0) return null;
  const mean = profile.reduce((a, r) => a + r.selfScore, 0) / profile.length;
  return Math.round(mean * 100) / 100;
}

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
    .select("competency_id, raw_score, is_reverse, item_type, answer_data")
    .eq("session_id", sessionId);

  const profile = rollupSelfScores((responses ?? []) as ScoreRow[]);

  // Idempotent: scoring is deterministic from the (now-immutable) responses, so a
  // repeat submit recomputes the same profile - but only stamp submitted_at once.
  if (session.status !== "submitted") {
    await sb
      .from("behavioral_assessment_sessions")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

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
  /** 'normative' (Likert) or 'ipsative' (forced-choice). Optional; defaults to normative. */
  itemType?: "normative" | "ipsative";
  /** Forced-choice block context for ipsative rows (migration 00110). */
  answerData?: Record<string, unknown> | null;
};

/** Upsert a batch of answers (autosave). Refuses once the session is submitted. */
export async function saveBehavioralAnswers(
  sessionId: string,
  answers: BehavioralAnswer[],
): Promise<{ ok: boolean; error?: string }> {
  if (answers.length === 0) return { ok: true };
  const sb = createServiceClient();
  // Read the session WITH its pinned scope (00123). Tolerant of the column
  // being absent - fall back to the basic select.
  type SessionScopeRow = { id: string; status: string; scoped_competency_ids?: string[] | null };
  let session: SessionScopeRow | null = null;
  {
    const wide = await sb
      .from("behavioral_assessment_sessions")
      .select("id, status, scoped_competency_ids")
      .eq("id", sessionId)
      .maybeSingle();
    if (wide.error && isMissingColumnError(wide.error)) {
      const basic = await sb
        .from("behavioral_assessment_sessions")
        .select("id, status")
        .eq("id", sessionId)
        .maybeSingle();
      session = (basic.data as SessionScopeRow) ?? null;
    } else {
      session = (wide.data as SessionScopeRow) ?? null;
    }
  }
  if (!session) return { ok: false, error: "Invalid session" };
  if (session.status === "submitted") return { ok: false, error: "Session already submitted" };

  // Enforce the admin-pinned competency scope at the PERSISTENCE layer, not just
  // at render. The take page is auth-bypassed and the save action is keyed only
  // by sessionId, so a crafted call could otherwise inject out-of-scope answers
  // and widen a pinned assessment. Empty/null scope = full bank (no filtering).
  const scopeSet =
    Array.isArray(session.scoped_competency_ids) && session.scoped_competency_ids.length > 0
      ? new Set(session.scoped_competency_ids)
      : null;
  const inScope = scopeSet ? answers.filter((a) => scopeSet.has(a.competencyId)) : answers;

  const valid = inScope.filter((a) => Number.isInteger(a.rawScore) && a.rawScore >= 1 && a.rawScore <= 5);
  const baseRow = (a: BehavioralAnswer) => ({
    session_id: sessionId,
    item_key: a.itemKey,
    competency_id: a.competencyId,
    raw_score: a.rawScore,
    is_reverse: a.isReverse,
    answered_at: new Date().toISOString(),
  });
  // item_type / answer_data land with migration 00110. EVERY row must carry
  // item_type: a mixed normative+ipsative batch (e.g. the demo "fill all answers"
  // or a fast Submit that flushes both at once) makes PostgREST union the columns
  // and insert NULL item_type for the rows that omitted it, violating the NOT NULL
  // constraint and failing the WHOLE upsert (the "report came back zero" bug).
  // Setting it explicitly ("normative" by default) keeps the batch column-uniform.
  const rowsExtended = valid.map((a) => ({
    ...baseRow(a),
    item_type: a.itemType ?? "normative",
    answer_data: a.answerData ?? null,
  }));

  let { error } = await sb
    .from("behavioral_assessment_responses")
    .upsert(rowsExtended, { onConflict: "session_id,item_key" });
  // Tolerant of migration 00110 not applied (item_type / answer_data absent).
  if (error && isMissingColumnError(error)) {
    ({ error } = await sb
      .from("behavioral_assessment_responses")
      .upsert(valid.map(baseRow), { onConflict: "session_id,item_key" }));
  }
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
    .select("competency_id, raw_score, is_reverse, item_type, answer_data")
    .eq("session_id", session.id);

  const rows = rollupSelfScores((responses ?? []) as ScoreRow[]).map((p) => ({
    engagement_id: engagementId,
    candidate_id: candidateId,
    competency_id: p.competencyId,
    self_score: p.selfScore,
    item_count: p.itemCount,
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
