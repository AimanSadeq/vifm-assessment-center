import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import {
  ARA_AGENTIC_DIMENSION_IDS,
  type AraAgenticDimensionId,
} from "@/lib/constants/ara-agentic-dimensions";
import { calculateQuestionScore } from "./scoring";
import type { AraQuestionType } from "@/types/ara";

/**
 * Aggregate Agentic-AI Readiness rollup for an org assessment that has
 * include_agentic_layer=true. Reads every respondent's answers to the
 * six agentic-dimension items and returns the cohort-level mean per
 * dimension plus per-respondent breakdown.
 *
 * Mirrors computeWorkforceReadiness (the individual-layer rollup): six
 * dimensions instead of four factors. Returns null when there are no
 * agentic answers yet so callers render an empty state rather than
 * misleading zero-bars.
 */
export type AgenticDimensionAverage = {
  dimension_id: AraAgenticDimensionId;
  /** Mean across respondents who answered at least one item in this dimension. */
  average: number;
  respondent_count: number;
  /** Respondents whose dimension score is below the target (4). */
  below_target_count: number;
};

export type AgenticRespondent = {
  respondent_id: string;
  name: string;
  email: string;
  completed_at: string | null;
  per_dimension: Record<AraAgenticDimensionId, number | null>;
  overall: number | null;
};

export type AgenticReadinessRollup = {
  cohort_size: number;
  completed_count: number;
  dimension_averages: AgenticDimensionAverage[];
  cohort_overall: number | null;
  respondents: AgenticRespondent[];
};

const TARGET = 4;

function initDimensions(): Record<AraAgenticDimensionId, { sum: number; count: number }> {
  return {
    agent_governance: { sum: 0, count: 0 },
    human_oversight: { sum: 0, count: 0 },
    risk_failure: { sum: 0, count: 0 },
    access_control: { sum: 0, count: 0 },
    autonomy_calibration: { sum: 0, count: 0 },
    auditability: { sum: 0, count: 0 },
  };
}

export async function computeAgenticReadiness(
  assessmentId: string
): Promise<AgenticReadinessRollup | null> {
  const sb = createServiceClient();

  // 1. All respondents on this assessment.
  const { data: respondents } = await sb
    .from("ara_respondents")
    .select("id, name, email, completed_at")
    .eq("assessment_id", assessmentId);
  const respondentRows = (respondents ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    completed_at: string | null;
  }>;
  if (respondentRows.length === 0) return null;

  // 2. Agentic-dimension questions on this assessment's version.
  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("question_bank_version_id")
    .eq("id", assessmentId)
    .maybeSingle<{ question_bank_version_id: string | null }>();
  if (!assessment?.question_bank_version_id) return null;

  const { data: questions } = await sb
    .from("ara_questions")
    .select("id, agentic_dimension_id, score_map, question_type")
    .eq("version_id", assessment.question_bank_version_id)
    .not("agentic_dimension_id", "is", null);
  const questionRows = (questions ?? []) as Array<{
    id: string;
    agentic_dimension_id: AraAgenticDimensionId;
    score_map: Record<string, number> | null;
    question_type: AraQuestionType;
  }>;
  if (questionRows.length === 0) return null;
  const questionDimById = new Map(
    questionRows.map((q) => [
      q.id,
      { dimensionId: q.agentic_dimension_id, scoreMap: q.score_map, questionType: q.question_type },
    ])
  );

  // 3. Responses for these respondents to those questions. PAGINATED so a
  //    large cohort's agentic answers never truncate at the 1000-row cap.
  const respondentIds = respondentRows.map((r) => r.id);
  const questionIds = questionRows.map((q) => q.id);
  const responseRows = (await fetchAllPages<unknown>((from, to) =>
    sb
      .from("ara_responses")
      .select("respondent_id, question_id, answer_value")
      .in("respondent_id", respondentIds)
      .in("question_id", questionIds)
      .order("id")
      .range(from, to)
  ).catch((e): unknown[] => {
    console.error(`[ara] agentic-readiness response load failed for ${assessmentId}:`, e);
    return [];
  })) as Array<{
    respondent_id: string;
    question_id: string;
    answer_value: unknown;
  }>;

  // 4. Roll up per-respondent dimension averages.
  const perRespondent = new Map<string, Record<AraAgenticDimensionId, { sum: number; count: number }>>();
  for (const r of responseRows) {
    const meta = questionDimById.get(r.question_id);
    if (!meta) continue;
    // Canonical per-answer scorer (rating -> Number; mc/yes_no/graded -> score_map),
    // so this rollup matches respondent-side scoring instead of dropping rating items.
    const numeric = calculateQuestionScore(
      meta.questionType,
      r.answer_value == null ? null : String(r.answer_value),
      meta.scoreMap
    );
    if (typeof numeric !== "number" || !Number.isFinite(numeric)) continue;
    const buckets = perRespondent.get(r.respondent_id) ?? initDimensions();
    buckets[meta.dimensionId].sum += numeric;
    buckets[meta.dimensionId].count += 1;
    perRespondent.set(r.respondent_id, buckets);
  }

  // 5. Per-respondent table + cohort aggregates.
  const cohortAcc = initDimensions();
  let completedCount = 0;
  const respondentSummaries: AgenticRespondent[] = respondentRows.map((r) => {
    const buckets = perRespondent.get(r.id);
    const per_dimension = ARA_AGENTIC_DIMENSION_IDS.reduce<Record<AraAgenticDimensionId, number | null>>(
      (acc, id) => {
        const b = buckets?.[id];
        const avg = b && b.count > 0 ? b.sum / b.count : null;
        acc[id] = avg;
        if (avg != null) {
          cohortAcc[id].sum += avg;
          cohortAcc[id].count += 1;
        }
        return acc;
      },
      {} as Record<AraAgenticDimensionId, number | null>
    );
    const vals = Object.values(per_dimension).filter((v): v is number => typeof v === "number");
    const overall = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    // Count completion only among respondents who actually answered agentic items.
    if (r.completed_at && vals.length > 0) completedCount += 1;
    return {
      respondent_id: r.id,
      name: r.name,
      email: r.email,
      completed_at: r.completed_at,
      per_dimension,
      overall,
    };
  });

  const belowTarget = ARA_AGENTIC_DIMENSION_IDS.reduce<Record<AraAgenticDimensionId, number>>(
    (acc, id) => { acc[id] = 0; return acc; },
    {} as Record<AraAgenticDimensionId, number>
  );
  for (const r of respondentSummaries) {
    for (const id of ARA_AGENTIC_DIMENSION_IDS) {
      const v = r.per_dimension[id];
      if (v != null && v < TARGET) belowTarget[id] += 1;
    }
  }

  const dimension_averages: AgenticDimensionAverage[] = ARA_AGENTIC_DIMENSION_IDS.map((id) => {
    const acc = cohortAcc[id];
    return {
      dimension_id: id,
      average: acc.count > 0 ? acc.sum / acc.count : 0,
      respondent_count: acc.count,
      below_target_count: belowTarget[id],
    };
  });

  const means = dimension_averages.filter((d) => d.respondent_count > 0).map((d) => d.average);
  const cohort_overall = means.length > 0 ? means.reduce((a, b) => a + b, 0) / means.length : null;

  return {
    cohort_size: respondentRows.length,
    completed_count: completedCount,
    dimension_averages,
    cohort_overall,
    respondents: respondentSummaries,
  };
}
