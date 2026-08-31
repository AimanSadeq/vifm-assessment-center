import { createServiceClient } from "@/lib/supabase/server";
import { ARA_PILLARS, ARA_MATURITY_LEVELS } from "@/lib/constants/ara-pillars";
import { getPillarsForAssessment } from "@/lib/constants/ara-stages";
import { overallBandFromScore } from "@/lib/ara/scoring";
import type { AraPillarId, AraEngagementStage } from "@/types/ara";

/**
 * Cross-unit rollup: what a Division or Enterprise engagement knows that a
 * single unit cannot.
 *
 * A Division is composed of departments (HR = Learning & Development +
 * Training + Compensation); an Enterprise is composed of divisions. Each unit
 * is assessed on its own and gets its own complete report. This module reads
 * the units linked to a parent (migration 00200) and produces the layer that
 * only exists once there is more than one child: how they COMPARE.
 *
 * The headline finding here is variance, not the average. A division whose
 * units score 4.1 and 2.2 on Culture has a 3.15 mean that describes neither
 * of them and hides the only fact worth acting on.
 *
 * Everything is derived from the already-computed per-unit pillar scores, so
 * this adds no new measurement and cannot disagree with a unit's own report.
 */

/** How a unit's cohort size is used to weight it into the parent score. */
export type RollupWeighting = "respondents" | "equal";

export type RollupUnit = {
  assessment_id: string;
  /** The unit's own name - scope_label, falling back to the stage label. */
  label: string;
  engagement_stage: AraEngagementStage;
  status: string;
  /** Respondents who completed - the weight, and the credibility of the score. */
  completed_respondents: number;
  /** Mean across this unit's in-scope pillars, or null if nothing scored. */
  overall: number | null;
  /** Pillar id -> raw score, only for pillars in this unit's scope. */
  byPillar: Map<AraPillarId, number>;
};

export type PillarSpread = {
  pillar_id: AraPillarId;
  /** Units that actually scored this pillar (a unit may not have it in scope). */
  unitsScored: number;
  mean: number;
  min: number;
  max: number;
  /** max - min. The divisional story lives here. */
  spread: number;
  strongest: string | null;
  weakest: string | null;
  /** True when every scoring unit is below the 4.00 AI Ready target. */
  sharedGap: boolean;
};

export type UnitRollup = {
  /** Units linked to this parent, ranked strongest first. */
  units: RollupUnit[];
  /** Union of every pillar in scope across the units, in canonical order. */
  pillars: AraPillarId[];
  /** Per-pillar comparison across units. */
  spreads: PillarSpread[];
  /** Weighted parent score, or null when no unit has scored. */
  overall: number | null;
  overallBand: ReturnType<typeof overallBandFromScore> | null;
  weighting: RollupWeighting;
  /** Total completed respondents across all units. */
  totalRespondents: number;
  /**
   * Pillars where every unit is below target - fix once, centrally.
   * Ordered weakest mean first.
   */
  sharedGaps: PillarSpread[];
  /**
   * Pillars where units disagree most (spread >= UNEVEN_THRESHOLD) - the
   * candidates for unit-to-unit knowledge transfer rather than central spend.
   */
  unevenPillars: PillarSpread[];
  /**
   * Pillars in the PARENT's scope that no unit beneath it actually assessed.
   * A division scoped to 6 pillars whose departments each cover 4 has two
   * pillars with no evidence at all - silence that would otherwise read as
   * "not a problem" when it means "never asked".
   */
  uncoveredPillars: AraPillarId[];
};

/** A spread this wide means the units are not describable by one number. */
export const UNEVEN_THRESHOLD = 1.0;

/** The AI Ready benchmark, same value the single-unit report targets. */
const TARGET = 4.0;

type PillarRow = { assessment_id: string; pillar_id: string; raw_score: number | null };

export async function computeUnitRollup(
  parentAssessmentId: string,
  weighting: RollupWeighting = "respondents"
): Promise<UnitRollup> {
  const sb = createServiceClient();
  const empty: UnitRollup = {
    units: [], pillars: [], spreads: [], overall: null, overallBand: null,
    weighting, totalRespondents: 0, sharedGaps: [], unevenPillars: [],
    uncoveredPillars: [],
  };

  type ChildRow = {
    id: string; scope_label: string | null; engagement_stage: string;
    status: string; pillars_in_scope: string[] | null;
  };
  const { data: childRows, error } = await sb
    .from("ara_assessments")
    .select("id, scope_label, engagement_stage, status, pillars_in_scope")
    .eq("parent_assessment_id", parentAssessmentId)
    .returns<ChildRow[]>();
  // Tolerant of migration 00200 not being applied: no column, no rollup.
  if (error || !childRows || childRows.length === 0) return empty;

  const ids = childRows.map((c) => c.id);

  const [{ data: pillarRows }, { data: respondentRows }] = await Promise.all([
    sb.from("ara_pillar_scores").select("assessment_id, pillar_id, raw_score").in("assessment_id", ids),
    sb.from("ara_respondents").select("assessment_id, completed_at").in("assessment_id", ids),
  ]);

  const completedByAssessment = new Map<string, number>();
  for (const r of respondentRows ?? []) {
    if (!r.completed_at) continue;
    completedByAssessment.set(r.assessment_id, (completedByAssessment.get(r.assessment_id) ?? 0) + 1);
  }

  const scoresByAssessment = new Map<string, Map<AraPillarId, number>>();
  for (const row of (pillarRows ?? []) as PillarRow[]) {
    if (row.raw_score == null) continue;
    const m = scoresByAssessment.get(row.assessment_id) ?? new Map<AraPillarId, number>();
    m.set(row.pillar_id as AraPillarId, Number(row.raw_score));
    scoresByAssessment.set(row.assessment_id, m);
  }

  const units: RollupUnit[] = childRows.map((c) => {
    const byPillar = scoresByAssessment.get(c.id) ?? new Map<AraPillarId, number>();
    // Restrict to the unit's OWN scope so a pillar it was never asked about
    // cannot drag its average down.
    const inScope = new Set(
      getPillarsForAssessment({
        engagement_stage: c.engagement_stage as AraEngagementStage,
        pillars_in_scope: (c.pillars_in_scope as AraPillarId[] | null) ?? null,
      })
    );
    const scoped = new Map<AraPillarId, number>();
    for (const [p, v] of byPillar) if (inScope.has(p)) scoped.set(p, v);
    const values = [...scoped.values()];
    return {
      assessment_id: c.id,
      label: c.scope_label?.trim() || `${c.engagement_stage} unit`,
      engagement_stage: c.engagement_stage as AraEngagementStage,
      status: c.status as string,
      completed_respondents: completedByAssessment.get(c.id) ?? 0,
      overall: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      byPillar: scoped,
    };
  });

  units.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));

  // Pillars in canonical order, limited to those some unit actually scored.
  const seen = new Set<AraPillarId>();
  for (const u of units) for (const p of u.byPillar.keys()) seen.add(p);
  const pillars = ARA_PILLARS.map((p) => p.id).filter((p) => seen.has(p));

  const spreads: PillarSpread[] = pillars.map((pillarId) => {
    const scoring = units.filter((u) => u.byPillar.has(pillarId));
    const values = scoring.map((u) => u.byPillar.get(pillarId)!);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const strongest = scoring.find((u) => u.byPillar.get(pillarId) === max)?.label ?? null;
    const weakest = scoring.find((u) => u.byPillar.get(pillarId) === min)?.label ?? null;
    return {
      pillar_id: pillarId,
      unitsScored: scoring.length,
      mean, min, max,
      spread: max - min,
      strongest,
      weakest,
      sharedGap: max < TARGET,
    };
  });

  // Parent score: weight each unit by the people who answered, so a 40-person
  // department is not outvoted by a 3-person one. "equal" treats each unit as
  // one vote, which is the right choice when units differ wildly in size and
  // the question is about units rather than people.
  const scored = units.filter((u) => u.overall != null);
  let overall: number | null = null;
  if (scored.length > 0) {
    if (weighting === "equal") {
      overall = scored.reduce((s, u) => s + u.overall!, 0) / scored.length;
    } else {
      const totalW = scored.reduce((s, u) => s + Math.max(1, u.completed_respondents), 0);
      overall = scored.reduce(
        (s, u) => s + u.overall! * Math.max(1, u.completed_respondents), 0
      ) / totalW;
    }
  }

  // What the parent claims to cover, minus what its units actually measured.
  const { data: parentRow } = await sb
    .from("ara_assessments")
    .select("engagement_stage, pillars_in_scope")
    .eq("id", parentAssessmentId)
    .maybeSingle<{ engagement_stage: string; pillars_in_scope: string[] | null }>();
  const parentScope = parentRow
    ? getPillarsForAssessment({
        engagement_stage: parentRow.engagement_stage as AraEngagementStage,
        pillars_in_scope: (parentRow.pillars_in_scope as AraPillarId[] | null) ?? null,
      })
    : [];
  const covered = new Set(pillars);
  const uncoveredPillars = parentScope.filter((p) => !covered.has(p));

  return {
    units,
    pillars,
    spreads,
    uncoveredPillars,
    overall,
    overallBand: overall != null ? overallBandFromScore(overall) : null,
    weighting,
    totalRespondents: [...completedByAssessment.values()].reduce((a, b) => a + b, 0),
    sharedGaps: spreads.filter((s) => s.sharedGap).sort((a, b) => a.mean - b.mean),
    unevenPillars: spreads
      .filter((s) => s.unitsScored > 1 && s.spread >= UNEVEN_THRESHOLD)
      .sort((a, b) => b.spread - a.spread),
  };
}

/** Maturity level for a score, using the canonical lower-threshold rule. */
export function levelForScore(score: number): number {
  let level = ARA_MATURITY_LEVELS[0].level;
  for (const l of ARA_MATURITY_LEVELS) if (score >= l.min) level = l.level;
  return level;
}
