import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { calculateQuestionScore } from "./scoring";
import type { AraQuestionType } from "@/types/ara";

/**
 * Aggregate workforce-readiness rollup for an org assessment that has
 * include_individual_layer=true. Reads every respondent's answers to
 * the four-factor items and returns the cohort-level mean per factor
 * plus per-respondent breakdown so the consultant can see who's
 * pulling the average up or down.
 *
 * Returns null when there are no completed individual answers yet
 * - caller should render an empty-state placeholder rather than
 * misleading zero-bars.
 */
export type WorkforceFactorAverage = {
  factor_id: AraIndividualFactorId;
  /** Mean score across respondents who answered at least one item in this factor. */
  average: number;
  /** Number of distinct respondents counted in the average. */
  respondent_count: number;
  /**
   * Number of respondents whose factor score is below the target (4).
   * Drives the "% below target" distribution histogram on the workforce
   * rollup card. Excludes respondents with no answers in this factor.
   */
  below_target_count: number;
};

export type WorkforceRespondent = {
  respondent_id: string;
  name: string;
  email: string;
  completed_at: string | null;
  individual_only: boolean;
  per_factor: Record<AraIndividualFactorId, number | null>;
  overall: number | null;
};

export type WorkforceReadinessRollup = {
  cohort_size: number;
  completed_count: number;
  factor_averages: WorkforceFactorAverage[];
  cohort_overall: number | null;
  respondents: WorkforceRespondent[];
  /** Per-factor cohort scores keyed by factor for the recommender. */
  factor_scores_for_recommender: Record<AraIndividualFactorId, number>;
};

export async function computeWorkforceReadiness(
  assessmentId: string
): Promise<WorkforceReadinessRollup | null> {
  const sb = createServiceClient();

  // 1. All respondents on this assessment.
  const { data: respondents } = await sb
    .from("ara_respondents")
    .select("id, name, email, completed_at, individual_only")
    .eq("assessment_id", assessmentId);
  const respondentRows = (respondents ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    completed_at: string | null;
    individual_only: boolean;
  }>;
  if (respondentRows.length === 0) return null;

  // 2. All individual-factor questions on this assessment's version.
  //    We need the factor_id and score_map to interpret answers.
  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("question_bank_version_id")
    .eq("id", assessmentId)
    .maybeSingle<{ question_bank_version_id: string | null }>();
  if (!assessment?.question_bank_version_id) return null;

  const { data: questions } = await sb
    .from("ara_questions")
    .select("id, individual_factor_id, score_map, question_type")
    .eq("version_id", assessment.question_bank_version_id)
    .not("individual_factor_id", "is", null);
  const questionRows = (questions ?? []) as Array<{
    id: string;
    individual_factor_id: AraIndividualFactorId;
    score_map: Record<string, number> | null;
    question_type: AraQuestionType;
  }>;
  if (questionRows.length === 0) return null;
  const questionFactorById = new Map(
    questionRows.map((q) => [
      q.id,
      { factorId: q.individual_factor_id, scoreMap: q.score_map, questionType: q.question_type },
    ])
  );

  // 3. All responses for these respondents to those questions. PAGINATED:
  //    a Mode C cohort's individual answers (respondents x up to 60 items)
  //    can exceed the PostgREST 1000-row cap, which silently dropped the
  //    later respondents from the workforce rollup.
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
    console.error(`[ara] workforce-readiness response load failed for ${assessmentId}:`, e);
    return [];
  })) as Array<{
    respondent_id: string;
    question_id: string;
    answer_value: unknown;
  }>;

  // 4. Roll up per-respondent factor averages.
  type Acc = { sum: number; count: number };
  const perRespondent = new Map<string, Record<AraIndividualFactorId, Acc>>();
  const initFactors = (): Record<AraIndividualFactorId, Acc> => ({
    thinking_sense_check: { sum: 0, count: 0 },
    results_working_practice: { sum: 0, count: 0 },
    people_collaboration: { sum: 0, count: 0 },
    self_adaptive_mindset: { sum: 0, count: 0 },
  });

  for (const r of responseRows) {
    const meta = questionFactorById.get(r.question_id);
    if (!meta) continue;
    // Use the canonical per-answer scorer so this rollup never diverges from the
    // respondent-side scoring (rating -> Number; mc/yes_no/graded -> score_map).
    const numeric = calculateQuestionScore(
      meta.questionType,
      r.answer_value == null ? null : String(r.answer_value),
      meta.scoreMap
    );
    if (typeof numeric !== "number" || !Number.isFinite(numeric)) continue;
    const buckets = perRespondent.get(r.respondent_id) ?? initFactors();
    buckets[meta.factorId].sum += numeric;
    buckets[meta.factorId].count += 1;
    perRespondent.set(r.respondent_id, buckets);
  }

  // 5. Build the per-respondent table + cohort aggregates.
  const cohortAcc = initFactors();
  let completedCount = 0;
  const respondentSummaries: WorkforceRespondent[] = respondentRows.map((r) => {
    const buckets = perRespondent.get(r.id);
    const per_factor = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number | null>>(
      (acc, id) => {
        const b = buckets?.[id];
        const avg = b && b.count > 0 ? b.sum / b.count : null;
        acc[id] = avg;
        // Roll into the cohort accumulator only when the respondent has
        // answered at least one item in that factor - otherwise a
        // not-started respondent would drag the cohort mean to zero.
        if (avg != null) {
          cohortAcc[id].sum += avg;
          cohortAcc[id].count += 1;
        }
        return acc;
      },
      {} as Record<AraIndividualFactorId, number | null>
    );
    const overallVals = Object.values(per_factor).filter((v): v is number => typeof v === "number");
    const overall = overallVals.length > 0
      ? overallVals.reduce((a, b) => a + b, 0) / overallVals.length
      : null;
    if (r.completed_at) completedCount += 1;
    return {
      respondent_id: r.id,
      name: r.name,
      email: r.email,
      completed_at: r.completed_at,
      individual_only: r.individual_only,
      per_factor,
      overall,
    };
  });

  // Below-target tally per factor - counts respondents whose factor
  // score is below 4 (the same target the recommender uses). Powers
  // the "% below target" distribution histogram on the workforce card.
  const TARGET = 4;
  const belowTargetByFactor = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number>>(
    (acc, id) => { acc[id] = 0; return acc; },
    {} as Record<AraIndividualFactorId, number>
  );
  for (const r of respondentSummaries) {
    for (const id of ARA_INDIVIDUAL_FACTOR_IDS) {
      const v = r.per_factor[id];
      if (v != null && v < TARGET) belowTargetByFactor[id] += 1;
    }
  }

  const factor_averages: WorkforceFactorAverage[] = ARA_INDIVIDUAL_FACTOR_IDS.map((id) => {
    const acc = cohortAcc[id];
    return {
      factor_id: id,
      average: acc.count > 0 ? acc.sum / acc.count : 0,
      respondent_count: acc.count,
      below_target_count: belowTargetByFactor[id],
    };
  });

  const cohortMeansForOverall = factor_averages
    .filter((f) => f.respondent_count > 0)
    .map((f) => f.average);
  const cohort_overall =
    cohortMeansForOverall.length > 0
      ? cohortMeansForOverall.reduce((a, b) => a + b, 0) / cohortMeansForOverall.length
      : null;

  // For the recommender - pass cohort means; factors with no responses
  // fall back to target so they don't dominate the rank with zero gaps.
  const factor_scores_for_recommender = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number>>(
    (acc, id) => {
      const f = factor_averages.find((x) => x.factor_id === id);
      acc[id] = f && f.respondent_count > 0 ? f.average : 4;
      return acc;
    },
    {} as Record<AraIndividualFactorId, number>
  );

  return {
    cohort_size: respondentRows.length,
    completed_count: completedCount,
    factor_averages,
    cohort_overall,
    respondents: respondentSummaries,
    factor_scores_for_recommender,
  };
}
