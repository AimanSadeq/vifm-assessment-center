import { createServiceClient } from "@/lib/supabase/server";
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
   * Within-group spread (max - min). Used by the P1 consensus flag — when
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
   * Per-rater-group means for this behaviour — surfaces the item-level
   * detail page (P0 parity pass). Anonymity is applied identically to
   * CompetencyScore.by_group: peer/direct_report/skip_level/other are
   * nulled out when rater_count < anonymity_min_n.
   */
  by_group: RaterGroupScore[];
};

export type OpenVerbatim = {
  /** "start" | "stop" | "continue" */
  kind: "start" | "stop" | "continue";
  rater_role: ReflectRaterRole;
  text: string;
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
  competencies: Array<{
    competency_id: string;
    name_en: string;
    name_ar: string | null;
    display_order: number;
    mean: number | null;
    /** Per-participant means in display_order — used to render the heatmap. */
    per_participant_means: Array<{ participant_id: string; mean: number | null }>;
    /**
     * P1 cohort distribution: counts of participants whose Others-mean for
     * THIS competency falls below the favorable zone (<3.5), within it
     * (3.5–4.25 inclusive), or above (>4.25). Participants with no others
     * data are excluded from all three. Used by the "% below / within /
     * above" stacked-bar on the cohort PDF — the exec-summary slide every
     * competitor uses to anchor org-level training decisions.
     */
    distribution: {
      below: number;
      within: number;
      above: number;
      counted: number;
    };
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
  participantId: string
): Promise<ParticipantScoring | null> {
  const sb = createServiceClient();

  const { data: participant } = await sb
    .from("reflect_participants")
    .select("id, full_name, full_name_ar, role_title, engagement_id")
    .eq("id", participantId)
    .maybeSingle<{
      id: string;
      full_name: string;
      full_name_ar: string | null;
      role_title: string | null;
      engagement_id: string;
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
  // Both are added by P0/P1 migrations (00036/00037) — until those run in
  // prod, fall back to the older shape and the relevant features render empty.
  type RaterMiniRow = {
    id: string;
    rater_role: ReflectRaterRole;
    status: string;
    open_start: string | null;
    open_stop: string | null;
    open_continue: string | null;
    critical_competency_ids: string[];
  };
  let raters: RaterMiniRow[] | null = null;
  {
    const full = await sb
      .from("reflect_raters")
      .select(
        "id, rater_role, status, open_start, open_stop, open_continue, critical_competency_ids"
      )
      .eq("participant_id", participantId);
    if (full.error) {
      // Columns probably missing — re-query without them so the rest of the
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
        critical_competency_ids: [],
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
          critical_competency_ids: row.critical_competency_ids ?? [],
        };
      });
    }
  }

  // Responses across all raters
  const raterIds = (raters ?? []).map((r) => r.id);
  const { data: responses } =
    raterIds.length === 0
      ? { data: [] as Array<{ rater_id: string; behavior_id: string; score: number | null; is_na: boolean }> }
      : await sb
          .from("reflect_responses")
          .select("rater_id, behavior_id, score, is_na")
          .in("rater_id", raterIds);

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
  for (const r of responses ?? []) {
    if (r.score === null || r.is_na) continue;
    if (!responsesByRater.has(r.rater_id)) responsesByRater.set(r.rater_id, new Map());
    responsesByRater.get(r.rater_id)!.set(r.behavior_id, r.score);
  }

  const min_n = engagement.anonymity_min_n;

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
  const overallOthers = mean(overallOthersScores);

  // ── Self view ──
  const selfRaterIds = ratersByRole.get("self") ?? [];
  const selfRespondedIds = selfRaterIds.filter((id) => responsesByRater.has(id));
  const overallSelfScores: number[] = [];
  for (const id of selfRespondedIds) {
    const map = responsesByRater.get(id)!;
    for (const v of Array.from(map.values())) overallSelfScores.push(v);
  }
  const overallSelf = mean(overallSelfScores);

  // Combined overall = average of self + others if both present, else
  // whichever is available.
  const overallAll: number[] = [...overallSelfScores, ...overallOthersScores];
  const overallMean = mean(overallAll);

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
    const oMean = mean(othersScores);

    const compByGroup: RaterGroupScore[] = allRoles.map((role) => {
      const ids = ratersByRole.get(role) ?? [];
      const respondedIds = ids.filter((id) => responsesByRater.has(id));
      const scores: number[] = [];
      for (const id of respondedIds) {
        const map = responsesByRater.get(id)!;
        for (const [bid, v] of Array.from(map.entries())) {
          if (compBehIds.has(bid)) scores.push(v);
        }
      }
      const sensitive = role !== "self" && role !== "manager";
      const hidden = sensitive && respondedIds.length < min_n;
      return {
        rater_role: role,
        rater_count: respondedIds.length,
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
    const othersScores: number[] = [];
    for (const id of othersResponded) {
      const map = responsesByRater.get(id)!;
      if (map.has(b.id)) othersScores.push(map.get(b.id)!);
    }
    const oMean = mean(othersScores);

    // Per-rater-group means for THIS behaviour. Anonymity threshold
    // mirrors the competency-level policy: hide peer/direct_report/
    // skip_level/other groups when rater_count < min_n.
    const behByGroup: RaterGroupScore[] = allRoles.map((role) => {
      const ids = ratersByRole.get(role) ?? [];
      const respondedIds = ids.filter((id) => responsesByRater.has(id));
      const scores: number[] = [];
      for (const id of respondedIds) {
        const map = responsesByRater.get(id)!;
        if (map.has(b.id)) scores.push(map.get(b.id)!);
      }
      const sensitive = role !== "self" && role !== "manager";
      const hidden = sensitive && respondedIds.length < min_n;
      return {
        rater_role: role,
        rater_count: respondedIds.length,
        response_count: scores.length,
        mean: hidden ? null : round2(mean(scores)),
        hidden_by_anonymity: hidden,
        spread: hidden ? null : spreadOf(scores),
      };
    });

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
    };
  });

  // Rankings — only behaviors that have a meaningful Others view (>=2 responses)
  // qualify for strength / development / blind-spot / hidden-strength lists.
  const ranked = behaviors.filter((b) => b.others_mean !== null && b.others_count >= 2);

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
  // above-threshold group — the consultant + participant know how many
  // people contributed; trying to randomise speaker order while keeping
  // the count "anonymous enough" creates more risk than value.
  const groupRaterCount = (role: ReflectRaterRole): number =>
    (ratersByRole.get(role) ?? []).length;

  const open_responses: OpenVerbatim[] = [];
  for (const r of raters) {
    const sensitive = r.rater_role !== "self" && r.rater_role !== "manager";
    if (sensitive && groupRaterCount(r.rater_role) < min_n) continue;
    if (r.open_start) {
      open_responses.push({ kind: "start", rater_role: r.rater_role, text: r.open_start });
    }
    if (r.open_stop) {
      open_responses.push({ kind: "stop", rater_role: r.rater_role, text: r.open_stop });
    }
    if (r.open_continue) {
      open_responses.push({ kind: "continue", rater_role: r.rater_role, text: r.open_continue });
    }
  }

  // ── P1 critical-competency alignment ──
  // Picks come from the FIRST Self / Manager rater respectively. If
  // multiple Self/Manager raters somehow exist (data quirk), we still
  // pick one — the unique-self DB constraint already guarantees this
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
    generated_at: new Date().toISOString(),
  };
}


// ──────────────────────────────────────────────────────────────
// Cohort scoring — overlay every participant's mean per competency
// for the heatmap, plus aggregate strengths and development areas.
// ──────────────────────────────────────────────────────────────

export async function computeCohortScoring(
  engagementId: string
): Promise<CohortScoring | null> {
  const sb = createServiceClient();

  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select("id, name, ara_organizations(name)")
    .eq("id", engagementId)
    .maybeSingle<{
      id: string;
      name: string;
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
      competencies: [],
      participants: [],
      top_strengths: [],
      top_development_areas: [],
      generated_at: new Date().toISOString(),
    };
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
      // Use others_mean for the cohort view (excludes self bias)
      const m = c.others_mean ?? c.self_mean;
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
      };
    })
    .sort((a, b) => a.display_order - b.display_order);

  const participantsRollup = participants.map((p) => {
    const s = scorings.find((x) => x.participant_id === p.id);
    const overall = s?.overall_others ?? s?.overall_mean ?? null;
    // Completion %: how many of this participant's raters reached "completed"
    const groupRaters = s?.by_group ?? [];
    const totalRaters = groupRaters.reduce((sum, g) => sum + g.rater_count, 0);
    return {
      participant_id: p.id,
      participant_name: p.full_name,
      overall_mean: overall,
      completion_pct: totalRaters === 0 ? 0 : Math.round((totalRaters / Math.max(totalRaters, 1)) * 100),
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

  return {
    engagement_id: engagement.id,
    engagement_name: engagement.name,
    organization_name: engagement.ara_organizations?.name ?? "",
    participant_count: participants.length,
    rater_count: raterCount ?? 0,
    response_count: responseCount ?? 0,
    overall_mean: round2(overallMean),
    competencies,
    participants: participantsRollup,
    top_strengths,
    top_development_areas,
    generated_at: new Date().toISOString(),
  };
}
