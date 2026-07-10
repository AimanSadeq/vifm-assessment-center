import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import type { ReflectRaterRole } from "./validations";

// ──────────────────────────────────────────────────────────────
// Scoring types
// ──────────────────────────────────────────────────────────────

export type RaterGroupScore = {
  rater_role: ReflectRaterRole;
  rater_count: number;
  response_count: number;
  mean: number | null;
  /** True when the rater group has fewer raters than the anonymity threshold. */
  hidden_by_anonymity: boolean;
  /**
   * Within-group spread (max - min). Used by the P1 consensus flag - when
   * this is >= 3 on a 5-point scale, the raters meaningfully disagree and
   * the reader should treat the mean with care. null when fewer than 2
   * responses contributed (a single response can't disagree with itself).
   */
  spread: number | null;
};

export type CompetencyScore = {
  competency_id: string;
  name_en: string;
  name_ar: string | null;
  display_order: number;
  self_mean: number | null;
  others_mean: number | null;
  gap: number | null;
  by_group: RaterGroupScore[];
  /**
   * P2 reassessment: this competency's Others-mean from the prior
   * engagement. Resolved by matching on name (frameworks may have
   * been edited between runs). Null when no prior link or no match.
   */
  prior_others_mean: number | null;
};

export type BehaviorScore = {
  behavior_id: string;
  competency_id: string;
  text_en: string;
  text_ar: string | null;
  self_score: number | null;
  others_mean: number | null;
  others_count: number;
  gap: number | null;
  /**
   * Per-rater-group means for this behaviour - surfaces the item-level
   * detail page (P0 parity pass). Anonymity is applied identically to
   * CompetencyScore.by_group: peer/direct_report/skip_level/other are
   * nulled out when rater_count < anonymity_min_n.
   */
  by_group: RaterGroupScore[];
  /**
   * P4.2 per-behavior verbatim comments. The form collects an optional
   * comment alongside each behaviour rating. Comments are anonymity-
   * filtered the same way verbatims are: peer/direct_report/etc. only
   * shown when the group meets the anonymity threshold.
   */
  comments: Array<{ rater_role: ReflectRaterRole; text: string }>;
};

export type ReflectRaterTenure =
  | "less_than_6mo"
  | "six_mo_to_2yr"
  | "two_to_5yr"
  | "over_5yr";

export type OpenVerbatim = {
  /** SSC (start/stop/continue) + the five open-ended questions (00101) */
  kind:
    | "start" | "stop" | "continue"
    | "strengths" | "development" | "example" | "advice" | "other";
  rater_role: ReflectRaterRole;
  text: string;
  /** P2: how long this rater has worked with the participant. NULL when not provided. */
  tenure: ReflectRaterTenure | null;
};

export type TenureBreakdown = {
  /** Per-bucket count across all responding raters (excluding Self). */
  counts: Record<ReflectRaterTenure, number>;
  /** Number of raters who answered the tenure question. */
  answered: number;
  /** Number of raters who didn't answer. */
  unanswered: number;
};

export type ParticipantScoring = {
  participant_id: string;
  participant_name: string;
  participant_name_ar: string | null;
  participant_role_title: string | null;
  engagement_id: string;
  engagement_name: string;
  organization_name: string;
  organization_name_ar: string | null;
  anonymity_min_n: number;
  overall_mean: number | null;
  overall_self: number | null;
  overall_others: number | null;
  overall_gap: number | null;
  by_group: RaterGroupScore[];
  competencies: CompetencyScore[];
  behaviors: BehaviorScore[];
  strengths: BehaviorScore[];
  development_areas: BehaviorScore[];
  blind_spots: BehaviorScore[];
  hidden_strengths: BehaviorScore[];
  /**
   * Start / Stop / Continue verbatims. Self answers are always shown;
   * other rater-group answers are hidden when that group has fewer
   * raters than anonymity_min_n, matching the numeric-score policy.
   */
  open_responses: OpenVerbatim[];
  /**
   * P1 critical-competency alignment between Self and Manager picks.
   * Renders as the central coaching anchor on the report. When either
   * side hasn't picked yet, alignment_pct is null and the report shows
   * "not yet picked" instead of a misleading 0%.
   */
  critical_alignment: {
    self_picks: string[];
    manager_picks: string[];
    both_picks: string[];
    /** |both| / |union| × 100. null when both sides are empty. */
    alignment_pct: number | null;
    /** Whether each side has submitted any picks. */
    self_picked: boolean;
    manager_picked: boolean;
  };
  /** P2 tenure breakdown across all non-self raters. */
  tenure_breakdown: TenureBreakdown;
  /**
   * P2 reassessment: prior-run overall Others-mean if this participant
   * was carried over from a prior engagement. Null when not a
   * reassessment OR no link found.
   */
  prior_overall_others: number | null;
  /** Display name of the prior engagement, for the report subtitle. */
  prior_engagement_name: string | null;
  generated_at: string;
};

export type CohortScoring = {
  engagement_id: string;
  engagement_name: string;
  organization_name: string;
  participant_count: number;
  rater_count: number;
  response_count: number;
  overall_mean: number | null;
  /**
   * P4.3 cohort prior-delta. Populated when this engagement has a
   * prior_engagement_id and the prior has scored data. The per-
   * competency `prior_mean` lets the report show "↑+0.4 vs prior".
   */
  prior_overall_mean: number | null;
  prior_engagement_name: string | null;
  competencies: Array<{
    competency_id: string;
    name_en: string;
    name_ar: string | null;
    display_order: number;
    mean: number | null;
    /** Per-participant means in display_order - used to render the heatmap. */
    per_participant_means: Array<{ participant_id: string; mean: number | null }>;
    /**
     * P1 cohort distribution: counts of participants whose Others-mean for
     * THIS competency falls below the favorable zone (<3.5), within it
     * (3.5–4.25 inclusive), or above (>4.25). Participants with no others
     * data are excluded from all three. Used by the "% below / within /
     * above" stacked-bar on the cohort PDF - the exec-summary slide every
     * competitor uses to anchor org-level training decisions.
     */
    distribution: {
      below: number;
      within: number;
      above: number;
      counted: number;
    };
    /** Prior cohort mean for this competency, matched by name. Null otherwise. */
    prior_mean: number | null;
  }>;
  participants: Array<{
    participant_id: string;
    participant_name: string;
    overall_mean: number | null;
    completion_pct: number;
  }>;
  /** Top-3 highest-rated competencies across the cohort. */
  top_strengths: Array<{ competency_id: string; name_en: string; name_ar: string | null; mean: number | null }>;
  /** Bottom-3 lowest-rated competencies across the cohort. */
  top_development_areas: Array<{ competency_id: string; name_en: string; name_ar: string | null; mean: number | null }>;
  generated_at: string;
};


// ──────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────

const RATER_GROUPS_FOR_OTHERS: ReflectRaterRole[] = [
  "manager",
  "peer",
  "direct_report",
  "skip_level",
  "other",
];

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round2(v: number | null): number | null {
  if (v === null) return null;
  return Math.round(v * 100) / 100;
}

/**
 * Within-group spread = max - min on the 5-point scale. The P1 consensus
 * flag fires at spread >= 3. Returns null when fewer than 2 values
 * contributed (one rater can't disagree with itself).
 */
function spreadOf(values: number[]): number | null {
  if (values.length < 2) return null;
  return Math.max(...values) - Math.min(...values);
}

/** Threshold above which a within-group spread counts as "raters disagree". */
export const CONSENSUS_FLAG_SPREAD = 3;


// ──────────────────────────────────────────────────────────────
// Participant scoring
//
// One DB read for the raw data, then pure aggregations. Anonymity
// threshold is applied at the per-group level: a group's mean is
// nulled out when rater_count < anonymity_min_n EXCEPT for the
// 'self' and 'manager' groups which are never anonymised (you
// always know what you said about yourself, and a participant
// can usually deduce a single-line-manager rating from context).
// ──────────────────────────────────────────────────────────────

export async function computeParticipantScoring(
  participantId: string,
  /** Internal: cycle-guard for prior_participant_id chains. */
  _visited: Set<string> = new Set<string>()
): Promise<ParticipantScoring | null> {
  if (_visited.has(participantId)) return null;
  _visited.add(participantId);
  const sb = createServiceClient();

  const { data: participant } = await sb
    .from("reflect_participants")
    .select("id, full_name, full_name_ar, role_title, engagement_id, prior_participant_id")
    .eq("id", participantId)
    .maybeSingle<{
      id: string;
      full_name: string;
      full_name_ar: string | null;
      role_title: string | null;
      engagement_id: string;
      prior_participant_id: string | null;
    }>();
  if (!participant) return null;

  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select(
      "id, name, anonymity_min_n, ara_organizations(name, name_ar)"
    )
    .eq("id", participant.engagement_id)
    .maybeSingle<{
      id: string;
      name: string;
      anonymity_min_n: number;
      ara_organizations: { name: string; name_ar: string | null } | null;
    }>();
  if (!engagement) return null;

  // Pull the framework for this engagement
  const { data: framework } = await sb
    .from("reflect_frameworks")
    .select("id")
    .eq("engagement_id", participant.engagement_id)
    .maybeSingle<{ id: string }>();
  if (!framework) return null;

  const { data: comps } = await sb
    .from("reflect_competencies")
    .select("id, name_en, name_ar, display_order")
    .eq("framework_id", framework.id)
    .order("display_order");

  const compIds = (comps ?? []).map((c) => c.id);
  const { data: behs } =
    compIds.length === 0
      ? { data: [] as Array<{ id: string; competency_id: string; text_en: string; text_ar: string | null }> }
      : await sb
          .from("reflect_behaviors")
          .select("id, competency_id, text_en, text_ar")
          .in("competency_id", compIds);

  // Raters for this participant. open_* and critical_competency_ids columns
  // power the verbatim section + critical-competency alignment respectively.
  // Both are added by P0/P1 migrations (00036/00037) - until those run in
  // prod, fall back to the older shape and the relevant features render empty.
  type RaterMiniRow = {
    id: string;
    rater_role: ReflectRaterRole;
    status: string;
    open_start: string | null;
    open_stop: string | null;
    open_continue: string | null;
    open_strengths: string | null;
    open_development: string | null;
    open_example: string | null;
    open_advice: string | null;
    open_other: string | null;
    critical_competency_ids: string[];
    tenure: ReflectRaterTenure | null;
  };
  let raters: RaterMiniRow[] | null = null;
  {
    const full = await sb
      .from("reflect_raters")
      .select(
        "id, rater_role, status, open_start, open_stop, open_continue, open_strengths, open_development, open_example, open_advice, open_other, critical_competency_ids, tenure"
      )
      .eq("participant_id", participantId);
    if (full.error) {
      // Columns probably missing - re-query without them so the rest of the
      // pipeline still works.
      const fallback = await sb
        .from("reflect_raters")
        .select("id, rater_role, status")
        .eq("participant_id", participantId);
      raters = (fallback.data ?? []).map((r) => ({
        ...(r as { id: string; rater_role: ReflectRaterRole; status: string }),
        open_start: null,
        open_stop: null,
        open_continue: null,
        open_strengths: null,
        open_development: null,
        open_example: null,
        open_advice: null,
        open_other: null,
        critical_competency_ids: [],
        tenure: null,
      }));
    } else {
      raters = (full.data ?? []).map((r) => {
        const row = r as Partial<RaterMiniRow> & {
          id: string;
          rater_role: ReflectRaterRole;
          status: string;
        };
        return {
          id: row.id,
          rater_role: row.rater_role,
          status: row.status,
          open_start: row.open_start ?? null,
          open_stop: row.open_stop ?? null,
          open_continue: row.open_continue ?? null,
          open_strengths: row.open_strengths ?? null,
          open_development: row.open_development ?? null,
          open_example: row.open_example ?? null,
          open_advice: row.open_advice ?? null,
          open_other: row.open_other ?? null,
          critical_competency_ids: row.critical_competency_ids ?? [],
          tenure: row.tenure ?? null,
        };
      });
    }
  }

  // Responses across all raters. comment_text powers the P4.2 per-behavior
  // verbatim section in the report.
  // PAGINATED (1000-row PostgREST cap): one participant's responses are
  // raters x behaviours - the shipped 38-competency framework serves 152
  // observer behaviours, so a standard panel of 7-8 raters is 1064-1216 rows
  // and an unpaginated read silently dropped rows, corrupting every mean,
  // gap, ranking AND the anonymity contributor counts computed from them.
  const raterIds = (raters ?? []).map((r) => r.id);
  type RespRow = { rater_id: string; behavior_id: string; score: number | null; is_na: boolean; comment_text: string | null };
  const responses: RespRow[] = [];
  for (const ids of chunkIds(raterIds)) {
    responses.push(
      ...(await fetchAllPages<RespRow>((from, to) =>
        sb
          .from("reflect_responses")
          .select("rater_id, behavior_id, score, is_na, comment_text")
          .in("rater_id", ids)
          .order("id")
          .range(from, to)
      ).catch((e): RespRow[] => {
        console.error(`[reflect] response load failed for participant ${participantId}:`, e);
        return [];
      }))
    );
  }

  // Index raters by id and by role
  const raterById = new Map<string, { role: ReflectRaterRole; status: string }>();
  const ratersByRole = new Map<ReflectRaterRole, string[]>();
  for (const r of raters) {
    raterById.set(r.id, { role: r.rater_role, status: r.status });
    const arr = ratersByRole.get(r.rater_role) ?? [];
    arr.push(r.id);
    ratersByRole.set(r.rater_role, arr);
  }

  // Index responses by rater + behavior. Drop is_na (excluded from means).
  const responsesByRater = new Map<string, Map<string, number>>();
  // Separate comment map - comments are independent of score: a rater can
  // mark N/A and still leave a comment about why.
  const commentsByBehavior = new Map<string, Array<{ raterId: string; text: string }>>();
  for (const r of responses) {
    if (r.score !== null && !r.is_na) {
      if (!responsesByRater.has(r.rater_id)) responsesByRater.set(r.rater_id, new Map());
      responsesByRater.get(r.rater_id)!.set(r.behavior_id, r.score);
    }
    if (r.comment_text && r.comment_text.trim().length > 0) {
      const arr = commentsByBehavior.get(r.behavior_id) ?? [];
      arr.push({ raterId: r.rater_id, text: r.comment_text.trim() });
      commentsByBehavior.set(r.behavior_id, arr);
    }
  }

  const min_n = engagement.anonymity_min_n;

  // ── Anonymity floor for POOLED aggregates ──
  // The SENSITIVE groups (peer/direct_report/skip_level/other) must never be
  // de-anonymised. Self + manager are exempt (their identity is known by design).
  // A pooled mean / comment / ranking is WITHHELD whenever it is carried by
  // 1..min_n-1 distinct SENSITIVE contributors - mirroring the per-group + verbatim
  // rules so the report can never publish a number that reduces to a single
  // anonymous voice (the per-group table already hides it; the pool must too).
  const SENSITIVE = new Set<ReflectRaterRole>(["peer", "direct_report", "skip_level", "other"]);
  const sensitiveCount = (ids: string[]): number =>
    ids.filter((id) => { const m = raterById.get(id); return !!m && SENSITIVE.has(m.role); }).length;
  const belowFloor = (n: number): boolean => n >= 1 && n < min_n;

  // Distinct COMMENTERS per role (raters who left any comment), so a behaviour's
  // comments are gated on who actually COMMENTED, not who merely scored - a rater
  // can score without commenting, so the scorer count over-counts the denominator.
  const commentersByRole = new Map<ReflectRaterRole, Set<string>>();
  for (const arr of Array.from(commentsByBehavior.values())) {
    for (const c of arr) {
      const m = raterById.get(c.raterId);
      if (!m) continue;
      if (!commentersByRole.has(m.role)) commentersByRole.set(m.role, new Set());
      commentersByRole.get(m.role)!.add(c.raterId);
    }
  }

  // ── Per-rater-group rollup at the overall level ──
  const allRoles: ReflectRaterRole[] = [
    "self",
    "manager",
    "peer",
    "direct_report",
    "skip_level",
    "other",
  ];
  const by_group: RaterGroupScore[] = allRoles.map((role) => {
    const ids = ratersByRole.get(role) ?? [];
    const respondedIds = ids.filter((id) => responsesByRater.has(id));
    const allScores: number[] = [];
    for (const id of respondedIds) {
      const map = responsesByRater.get(id)!;
      for (const v of Array.from(map.values())) allScores.push(v);
    }
    const groupMean = mean(allScores);
    // Anonymity: hide peer / direct_report / skip_level / other below the
    // threshold. Self and manager are never anonymised.
    const sensitive = role !== "self" && role !== "manager";
    const hidden = sensitive && respondedIds.length < min_n;
    return {
      rater_role: role,
      rater_count: respondedIds.length,
      response_count: allScores.length,
      mean: hidden ? null : round2(groupMean),
      hidden_by_anonymity: hidden,
      spread: hidden ? null : spreadOf(allScores),
    };
  });

  // ── Pooled "Others" view (non-self) ──
  const othersRaterIds: string[] = [];
  for (const role of RATER_GROUPS_FOR_OTHERS) {
    othersRaterIds.push(...(ratersByRole.get(role) ?? []));
  }
  const othersResponded = othersRaterIds.filter((id) => responsesByRater.has(id));
  const overallOthersScores: number[] = [];
  for (const id of othersResponded) {
    const map = responsesByRater.get(id)!;
    for (const v of Array.from(map.values())) overallOthersScores.push(v);
  }
  const overallOthersHidden = belowFloor(sensitiveCount(othersResponded));
  const overallOthers = overallOthersHidden ? null : mean(overallOthersScores);

  // ── Self view ──
  const selfRaterIds = ratersByRole.get("self") ?? [];
  const selfRespondedIds = selfRaterIds.filter((id) => responsesByRater.has(id));
  const overallSelfScores: number[] = [];
  for (const id of selfRespondedIds) {
    const map = responsesByRater.get(id)!;
    for (const v of Array.from(map.values())) overallSelfScores.push(v);
  }
  const overallSelf = mean(overallSelfScores);

  // Combined overall = average of self + others if both present, else whichever
  // is available. When the pooled Others is withheld for anonymity, the combined
  // is withheld too: otherwise a reader could recover the hidden others mean from
  // combined + self + the published rater counts (self is separately shown).
  const overallAll: number[] = [...overallSelfScores, ...overallOthersScores];
  const overallMean = overallOthersHidden ? null : mean(overallAll);

  // ── Per-competency ──
  const behaviorsByComp = new Map<string, Array<{ id: string; text_en: string; text_ar: string | null }>>();
  for (const b of behs ?? []) {
    if (!behaviorsByComp.has(b.competency_id)) behaviorsByComp.set(b.competency_id, []);
    behaviorsByComp.get(b.competency_id)!.push({ id: b.id, text_en: b.text_en, text_ar: b.text_ar });
  }

  const competencies: CompetencyScore[] = (comps ?? []).map((c) => {
    const bs = behaviorsByComp.get(c.id) ?? [];
    const compBehIds = new Set(bs.map((b) => b.id));

    const selfScores: number[] = [];
    for (const id of selfRespondedIds) {
      const map = responsesByRater.get(id)!;
      for (const [bid, v] of Array.from(map.entries())) {
        if (compBehIds.has(bid)) selfScores.push(v);
      }
    }
    const othersScores: number[] = [];
    for (const id of othersResponded) {
      const map = responsesByRater.get(id)!;
      for (const [bid, v] of Array.from(map.entries())) {
        if (compBehIds.has(bid)) othersScores.push(v);
      }
    }
    const sMean = mean(selfScores);
    // Withhold the pooled Others mean for this competency when it is carried by
    // fewer than min_n distinct SENSITIVE contributors (mirrors the overall floor).
    const compOthersContribs = othersResponded.filter((id) => {
      const map = responsesByRater.get(id);
      return !!map && Array.from(map.keys()).some((bid) => compBehIds.has(bid));
    });
    const oMean = belowFloor(sensitiveCount(compOthersContribs)) ? null : mean(othersScores);

    const compByGroup: RaterGroupScore[] = allRoles.map((role) => {
      const ids = ratersByRole.get(role) ?? [];
      const respondedIds = ids.filter((id) => responsesByRater.has(id));
      // Anonymity gates on the raters who contributed to THIS competency, not
      // on whole-instrument responders: with per-item N/A, a cell's mean can be
      // carried by a single sensitive rater even when min_n raters answered the
      // instrument - publishing that mean de-anonymises them.
      const contributorIds = respondedIds.filter((id) => {
        const map = responsesByRater.get(id)!;
        return Array.from(map.keys()).some((bid) => compBehIds.has(bid));
      });
      const scores: number[] = [];
      for (const id of contributorIds) {
        const map = responsesByRater.get(id)!;
        for (const [bid, v] of Array.from(map.entries())) {
          if (compBehIds.has(bid)) scores.push(v);
        }
      }
      const sensitive = role !== "self" && role !== "manager";
      const hidden = sensitive && contributorIds.length < min_n;
      return {
        rater_role: role,
        rater_count: contributorIds.length,
        response_count: scores.length,
        mean: hidden ? null : round2(mean(scores)),
        hidden_by_anonymity: hidden,
        spread: hidden ? null : spreadOf(scores),
      };
    });

    return {
      competency_id: c.id,
      name_en: c.name_en,
      name_ar: c.name_ar,
      display_order: c.display_order,
      self_mean: round2(sMean),
      others_mean: round2(oMean),
      gap: sMean !== null && oMean !== null ? round2(sMean - oMean) : null,
      by_group: compByGroup,
      prior_others_mean: null,
    };
  });

  // ── Per-behavior (used for strength / dev / blind / hidden rankings
  //    AND the new item-level detail table) ──
  const behaviors: BehaviorScore[] = (behs ?? []).map((b) => {
    let selfScore: number | null = null;
    for (const id of selfRespondedIds) {
      const map = responsesByRater.get(id)!;
      if (map.has(b.id)) {
        selfScore = map.get(b.id) ?? null;
        break;
      }
    }
    const behOthersContribs: string[] = [];
    const othersScores: number[] = [];
    for (const id of othersResponded) {
      const map = responsesByRater.get(id)!;
      if (map.has(b.id)) {
        othersScores.push(map.get(b.id)!);
        behOthersContribs.push(id);
      }
    }
    // Withhold this behaviour's pooled Others mean below the sensitive floor - this
    // also removes it from the strength/dev/blind/hidden rankings (they require a
    // non-null others_mean) so a sub-threshold behaviour can never be printed.
    const oMean = belowFloor(sensitiveCount(behOthersContribs)) ? null : mean(othersScores);

    // Per-rater-group means for THIS behaviour. Anonymity threshold
    // mirrors the competency-level policy: hide peer/direct_report/
    // skip_level/other groups when rater_count < min_n.
    const behByGroup: RaterGroupScore[] = allRoles.map((role) => {
      const ids = ratersByRole.get(role) ?? [];
      const respondedIds = ids.filter((id) => responsesByRater.has(id));
      // Gate on contributors to THIS behaviour (see compByGroup): per-item N/A
      // means a whole-instrument responder count can mask a single-rater cell.
      const contributorIds = respondedIds.filter((id) => responsesByRater.get(id)!.has(b.id));
      const scores: number[] = contributorIds.map((id) => responsesByRater.get(id)!.get(b.id)!);
      const sensitive = role !== "self" && role !== "manager";
      const hidden = sensitive && contributorIds.length < min_n;
      return {
        rater_role: role,
        rater_count: contributorIds.length,
        response_count: scores.length,
        mean: hidden ? null : round2(mean(scores)),
        hidden_by_anonymity: hidden,
        spread: hidden ? null : spreadOf(scores),
      };
    });

    // P4.2: per-behavior comments. Anonymity: only show a comment when
    // its rater's group meets the min_n threshold for RESPONDED raters
    // (not invited). Audit fix: was previously using total invited count
    // which could de-anonymise a single peer when 4 others were invited
    // but never responded. Self + manager are always shown.
    const rawComments = commentsByBehavior.get(b.id) ?? [];
    const visibleComments: Array<{ rater_role: ReflectRaterRole; text: string }> = [];
    for (const c of rawComments) {
      const meta = raterById.get(c.raterId);
      if (!meta) continue;
      const sensitive = meta.role !== "self" && meta.role !== "manager";
      // Gate on the number of distinct raters in this role who actually COMMENTED
      // (not merely scored): a single peer comment among 3 scoring peers is still
      // fully attributable, so the scorer count was the wrong denominator.
      const commenterCount = commentersByRole.get(meta.role)?.size ?? 0;
      if (sensitive && commenterCount < min_n) continue;
      visibleComments.push({ rater_role: meta.role, text: c.text });
    }

    return {
      behavior_id: b.id,
      competency_id: b.competency_id,
      text_en: b.text_en,
      text_ar: b.text_ar,
      self_score: selfScore,
      others_mean: round2(oMean),
      others_count: othersScores.length,
      gap: selfScore !== null && oMean !== null ? round2(selfScore - oMean) : null,
      by_group: behByGroup,
      comments: visibleComments,
    };
  });

  // Rankings - only behaviours with a non-withheld Others view AND at least min_n
  // responses qualify for strength / development / blind-spot / hidden-strength
  // lists (the others_mean is already null-gated below the sensitive floor).
  const ranked = behaviors.filter((b) => b.others_mean !== null && b.others_count >= min_n);

  const strengths = [...ranked]
    .sort((a, b) => (b.others_mean! - a.others_mean!))
    .slice(0, 5);

  const development_areas = [...ranked]
    .sort((a, b) => (a.others_mean! - b.others_mean!))
    .slice(0, 5);

  const withGap = behaviors.filter((b) => b.gap !== null);
  const blind_spots = [...withGap]
    .sort((a, b) => b.gap! - a.gap!) // largest positive gap = self ≫ others
    .slice(0, 5)
    .filter((b) => b.gap! > 0);

  const hidden_strengths = [...withGap]
    .sort((a, b) => a.gap! - b.gap!) // most negative gap = others ≫ self
    .slice(0, 5)
    .filter((b) => b.gap! < 0);

  // ── Verbatim Start/Stop/Continue answers ──
  // Self answers always show. For all other roles we apply the same
  // anonymity threshold as the numeric scores: when a group has fewer
  // raters than anonymity_min_n, drop EVERY verbatim from that group
  // entirely. We don't try to mask individual contributors within an
  // above-threshold group - the consultant + participant know how many
  // people contributed; trying to randomise speaker order while keeping
  // the count "anonymous enough" creates more risk than value.
  // P3-audit fix (CRITICAL anonymity): the threshold must be measured against
  // raters who actually CONTRIBUTED a verbatim, not against everyone invited.
  // Previously this counted all invited raters in the group, so inviting 4
  // peers and receiving a single verbatim still cleared min_n=3 and surfaced
  // that lone peer's words verbatim - a direct de-anonymisation. We now count
  // distinct contributors per group (the tightest correct bound; mirrors the
  // responded-count pattern used for per-behaviour comments above).
  const verbatimContributorsByRole = new Map<ReflectRaterRole, number>();
  for (const r of raters) {
    const hasVerbatim = !!(
      r.open_start || r.open_stop || r.open_continue || r.open_strengths ||
      r.open_development || r.open_example || r.open_advice || r.open_other
    );
    if (hasVerbatim) {
      verbatimContributorsByRole.set(
        r.rater_role,
        (verbatimContributorsByRole.get(r.rater_role) ?? 0) + 1
      );
    }
  }

  const open_responses: OpenVerbatim[] = [];
  for (const r of raters) {
    const sensitive = r.rater_role !== "self" && r.rater_role !== "manager";
    if (sensitive && (verbatimContributorsByRole.get(r.rater_role) ?? 0) < min_n) continue;
    if (r.open_start) {
      open_responses.push({ kind: "start", rater_role: r.rater_role, text: r.open_start, tenure: r.tenure });
    }
    if (r.open_stop) {
      open_responses.push({ kind: "stop", rater_role: r.rater_role, text: r.open_stop, tenure: r.tenure });
    }
    if (r.open_continue) {
      open_responses.push({ kind: "continue", rater_role: r.rater_role, text: r.open_continue, tenure: r.tenure });
    }
    if (r.open_strengths) {
      open_responses.push({ kind: "strengths", rater_role: r.rater_role, text: r.open_strengths, tenure: r.tenure });
    }
    if (r.open_development) {
      open_responses.push({ kind: "development", rater_role: r.rater_role, text: r.open_development, tenure: r.tenure });
    }
    if (r.open_example) {
      open_responses.push({ kind: "example", rater_role: r.rater_role, text: r.open_example, tenure: r.tenure });
    }
    if (r.open_advice) {
      open_responses.push({ kind: "advice", rater_role: r.rater_role, text: r.open_advice, tenure: r.tenure });
    }
    if (r.open_other) {
      open_responses.push({ kind: "other", rater_role: r.rater_role, text: r.open_other, tenure: r.tenure });
    }
  }

  // ── P2 tenure breakdown ──
  // Self raters are excluded (they're rating themselves; tenure makes no
  // sense). NULL tenures land in unanswered. Used by the report Summary
  // card to give a 1-line read on "how deep is the bench behind this
  // feedback".
  const tenure_breakdown: TenureBreakdown = {
    counts: { less_than_6mo: 0, six_mo_to_2yr: 0, two_to_5yr: 0, over_5yr: 0 },
    answered: 0,
    unanswered: 0,
  };
  for (const r of raters) {
    if (r.rater_role === "self") continue;
    if (r.tenure === null) {
      tenure_breakdown.unanswered += 1;
    } else {
      tenure_breakdown.counts[r.tenure] += 1;
      tenure_breakdown.answered += 1;
    }
  }

  // ── P1 critical-competency alignment ──
  // Picks come from the FIRST Self / Manager rater respectively. If
  // multiple Self/Manager raters somehow exist (data quirk), we still
  // pick one - the unique-self DB constraint already guarantees this
  // for self, and a participant typically only ever has one manager.
  const selfRater = raters.find((r) => r.rater_role === "self");
  const managerRater = raters.find((r) => r.rater_role === "manager");
  const selfPicks = selfRater?.critical_competency_ids ?? [];
  const managerPicks = managerRater?.critical_competency_ids ?? [];
  const selfSet = new Set(selfPicks);
  const managerSet = new Set(managerPicks);
  const both: string[] = [];
  const unionSet = new Set<string>();
  for (const id of Array.from(selfSet)) unionSet.add(id);
  for (const id of Array.from(managerSet)) {
    unionSet.add(id);
    if (selfSet.has(id)) both.push(id);
  }
  const alignment_pct =
    unionSet.size === 0
      ? null
      : Math.round((both.length / unionSet.size) * 100);
  const critical_alignment = {
    self_picks: selfPicks,
    manager_picks: managerPicks,
    both_picks: both,
    alignment_pct,
    self_picked: selfPicks.length > 0,
    manager_picked: managerPicks.length > 0,
  };

  // ── P2 reassessment: pull the prior participant's overall +
  //    per-competency Others-mean if linked. Re-uses this same scoring
  //    function (one extra DB read pass; small participants). When the
  //    framework was edited between runs, competencies are matched by
  //    case-insensitive name so renames don't lose the link entirely.
  let prior_overall_others: number | null = null;
  let prior_engagement_name: string | null = null;
  if (participant.prior_participant_id) {
    const priorScoring = await computeParticipantScoring(
      participant.prior_participant_id,
      _visited
    );
    if (priorScoring) {
      prior_overall_others = priorScoring.overall_others;
      prior_engagement_name = priorScoring.engagement_name;
      const priorByName = new Map<string, number | null>();
      for (const pc of priorScoring.competencies) {
        priorByName.set(pc.name_en.trim().toLowerCase(), pc.others_mean);
      }
      for (const c of competencies) {
        const m = priorByName.get(c.name_en.trim().toLowerCase());
        if (m !== undefined) c.prior_others_mean = m;
      }
    }
  }

  return {
    participant_id: participant.id,
    participant_name: participant.full_name,
    participant_name_ar: participant.full_name_ar,
    participant_role_title: participant.role_title,
    engagement_id: engagement.id,
    engagement_name: engagement.name,
    organization_name: engagement.ara_organizations?.name ?? "",
    organization_name_ar: engagement.ara_organizations?.name_ar ?? null,
    anonymity_min_n: min_n,
    overall_mean: round2(overallMean),
    overall_self: round2(overallSelf),
    overall_others: round2(overallOthers),
    overall_gap:
      overallSelf !== null && overallOthers !== null
        ? round2(overallSelf - overallOthers)
        : null,
    by_group,
    competencies,
    behaviors,
    strengths,
    development_areas,
    blind_spots,
    hidden_strengths,
    open_responses,
    critical_alignment,
    tenure_breakdown,
    prior_overall_others,
    prior_engagement_name,
    generated_at: new Date().toISOString(),
  };
}


// ──────────────────────────────────────────────────────────────
// Cohort scoring - overlay every participant's mean per competency
// for the heatmap, plus aggregate strengths and development areas.
// ──────────────────────────────────────────────────────────────

export async function computeCohortScoring(
  engagementId: string,
  /** Internal: cycle-guard for prior_engagement_id chains. */
  _visited: Set<string> = new Set<string>()
): Promise<CohortScoring | null> {
  if (_visited.has(engagementId)) return null;
  _visited.add(engagementId);
  const sb = createServiceClient();

  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select("id, name, prior_engagement_id, ara_organizations(name)")
    .eq("id", engagementId)
    .maybeSingle<{
      id: string;
      name: string;
      prior_engagement_id: string | null;
      ara_organizations: { name: string } | null;
    }>();
  if (!engagement) return null;

  const { data: participants } = await sb
    .from("reflect_participants")
    .select("id, full_name")
    .eq("engagement_id", engagementId)
    .order("full_name");

  if (!participants || participants.length === 0) {
    return {
      engagement_id: engagement.id,
      engagement_name: engagement.name,
      organization_name: engagement.ara_organizations?.name ?? "",
      participant_count: 0,
      rater_count: 0,
      response_count: 0,
      overall_mean: null,
      prior_overall_mean: null,
      prior_engagement_name: null,
      competencies: [],
      participants: [],
      top_strengths: [],
      top_development_areas: [],
      generated_at: new Date().toISOString(),
    };
  }

  // P3-audit fix (completion-pct tautology): completion % must be
  // completed-raters / INVITED-raters per participant. The rollup below used
  // to divide totalRespondedRaters by itself (always 100%). Pull the real
  // invited + completed counts per participant once, up front.
  const raterCounts = new Map<string, { invited: number; completed: number }>();
  {
    // PAGINATED + chunked (1000-row cap): an engagement's rater count scales
    // as participants x raters-per-participant (112 x 9 already exceeds the
    // cap), and truncation silently zeroed later participants' completion %.
    type RaterRow = { participant_id: string; status: string };
    for (const ids of chunkIds(participants.map((p) => p.id))) {
      const raterRows = await fetchAllPages<RaterRow>((from, to) =>
        sb
          .from("reflect_raters")
          .select("participant_id, status")
          .in("participant_id", ids)
          .order("id")
          .range(from, to)
      ).catch((e): RaterRow[] => {
        console.error("[reflect] cohort rater-count load failed:", e);
        return [];
      });
      for (const r of raterRows) {
        const e = raterCounts.get(r.participant_id) ?? { invited: 0, completed: 0 };
        e.invited += 1;
        if (r.status === "completed") e.completed += 1;
        raterCounts.set(r.participant_id, e);
      }
    }
  }

  // Reuse per-participant scoring (computing 117 participants serially
  // is slow; for v1 we accept the latency and revisit with parallelism
  // / materialised views in a later iteration).
  const scorings: ParticipantScoring[] = [];
  for (const p of participants) {
    const s = await computeParticipantScoring(p.id);
    if (s) scorings.push(s);
  }

  // Aggregate per-competency means across the cohort
  const compMap = new Map<
    string,
    {
      name_en: string;
      name_ar: string | null;
      display_order: number;
      sumOfMeans: number;
      participantsCounted: number;
      perParticipant: Map<string, number | null>;
    }
  >();

  for (const s of scorings) {
    for (const c of s.competencies) {
      if (!compMap.has(c.competency_id)) {
        compMap.set(c.competency_id, {
          name_en: c.name_en,
          name_ar: c.name_ar,
          display_order: c.display_order,
          sumOfMeans: 0,
          participantsCounted: 0,
          perParticipant: new Map(),
        });
      }
      const entry = compMap.get(c.competency_id)!;
      // P4.1 anonymity: cohort heatmap uses Others-mean ONLY. We
      // deliberately do NOT fall back to self_mean - surfacing a
      // self-only score in the cohort view would let the CHRO infer
      // who hasn't yet gathered a real 360 dataset, which leaks the
      // wrong signal (rater turnout) into the cohort capability view.
      const m = c.others_mean;
      entry.perParticipant.set(s.participant_id, m);
      if (m !== null) {
        entry.sumOfMeans += m;
        entry.participantsCounted += 1;
      }
    }
  }

  // Favorable Zone bounds (industry standard).
  const ZONE_LOW = 3.5;
  const ZONE_HIGH = 4.25;

  const competencies = Array.from(compMap.entries())
    .map(([id, e]) => {
      const perParticipantArr = participants.map((p) => ({
        participant_id: p.id,
        mean: e.perParticipant.get(p.id) ?? null,
      }));
      const distribution = { below: 0, within: 0, above: 0, counted: 0 };
      for (const pp of perParticipantArr) {
        if (pp.mean === null) continue;
        distribution.counted += 1;
        if (pp.mean < ZONE_LOW) distribution.below += 1;
        else if (pp.mean > ZONE_HIGH) distribution.above += 1;
        else distribution.within += 1;
      }
      return {
        competency_id: id,
        name_en: e.name_en,
        name_ar: e.name_ar,
        display_order: e.display_order,
        mean:
          e.participantsCounted > 0
            ? round2(e.sumOfMeans / e.participantsCounted)
            : null,
        per_participant_means: perParticipantArr,
        distribution,
        prior_mean: null as number | null,
      };
    })
    .sort((a, b) => a.display_order - b.display_order);

  const participantsRollup = participants.map((p) => {
    const s = scorings.find((x) => x.participant_id === p.id);
    const overall = s?.overall_others ?? s?.overall_mean ?? null;
    // Completion %: completed raters over INVITED raters (P3-audit fix - was a
    // tautology that always reported 100%).
    const counts = raterCounts.get(p.id) ?? { invited: 0, completed: 0 };
    return {
      participant_id: p.id,
      participant_name: p.full_name,
      overall_mean: overall,
      completion_pct:
        counts.invited === 0 ? 0 : Math.round((counts.completed / counts.invited) * 100),
    };
  });

  const overallMean = mean(
    competencies.map((c) => c.mean).filter((v): v is number => v !== null)
  );

  const top_strengths = [...competencies]
    .filter((c) => c.mean !== null)
    .sort((a, b) => b.mean! - a.mean!)
    .slice(0, 3)
    .map((c) => ({ competency_id: c.competency_id, name_en: c.name_en, name_ar: c.name_ar, mean: c.mean }));

  const top_development_areas = [...competencies]
    .filter((c) => c.mean !== null)
    .sort((a, b) => a.mean! - b.mean!)
    .slice(0, 3)
    .map((c) => ({ competency_id: c.competency_id, name_en: c.name_en, name_ar: c.name_ar, mean: c.mean }));

  // Rough rater + response counters
  const { count: raterCount } = await sb
    .from("reflect_raters")
    .select("id, reflect_participants!inner(engagement_id)", { count: "exact", head: true })
    .eq("reflect_participants.engagement_id", engagementId);
  const { count: responseCount } = await sb
    .from("reflect_responses")
    .select(
      "id, reflect_raters!inner(reflect_participants!inner(engagement_id))",
      { count: "exact", head: true }
    )
    .eq("reflect_raters.reflect_participants.engagement_id", engagementId);

  // P4.3 cohort prior-delta: pull the prior cohort, overlay per-
  // competency means by name match. Same shape as the per-participant
  // prior overlay so the report can render identical visuals.
  let prior_overall_mean: number | null = null;
  let prior_engagement_name: string | null = null;
  if (engagement.prior_engagement_id) {
    const priorCohort = await computeCohortScoring(
      engagement.prior_engagement_id,
      _visited
    );
    if (priorCohort) {
      prior_overall_mean = priorCohort.overall_mean;
      prior_engagement_name = priorCohort.engagement_name;
      const priorByName = new Map<string, number | null>();
      for (const pc of priorCohort.competencies) {
        priorByName.set(pc.name_en.trim().toLowerCase(), pc.mean);
      }
      for (const c of competencies) {
        const m = priorByName.get(c.name_en.trim().toLowerCase());
        if (m !== undefined) c.prior_mean = m;
      }
    }
  }

  return {
    engagement_id: engagement.id,
    engagement_name: engagement.name,
    organization_name: engagement.ara_organizations?.name ?? "",
    participant_count: participants.length,
    rater_count: raterCount ?? 0,
    response_count: responseCount ?? 0,
    overall_mean: round2(overallMean),
    prior_overall_mean,
    prior_engagement_name,
    competencies,
    participants: participantsRollup,
    top_strengths,
    top_development_areas,
    generated_at: new Date().toISOString(),
  };
}
