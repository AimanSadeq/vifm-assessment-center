/**
 * Norm-group + percentile computation for the Personal AI Readiness Snapshot.
 *
 * A respondent's overall and per-factor scores (1-5 means) are ranked against
 * the distribution of every *completed* personal respondent to date - Mode A
 * snapshots plus Mode B deep-dives and Mode C individual-layer respondents,
 * all of whom answer the same four-factor items on the same 1-5 scale, so the
 * means are directly comparable regardless of tier or item count.
 *
 * Percentiles are only surfaced once the pool reaches MIN_NORM_SAMPLE; below
 * that the caller shows an "accruing" state instead of an unstable rank. The
 * pool grows passively as people take the free snapshot, so the same code
 * starts producing live percentiles automatically once volume arrives.
 *
 * Scores are recomputed from raw ara_responses against a global map of the
 * individual-factor questions, so it works across question-bank versions
 * (different respondents may sit different versions). Service-client only;
 * no-ops to an empty (not-ready) norm set if the ARA tables are absent.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import type { AraQuestionType } from "@/types/ara";
import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";

// Pool size below which percentiles are withheld. Stable norms ultimately
// want ~200-500 respondents; 50 is the floor at which a provisional rank is
// worth showing. Tunable without touching callers.
export const MIN_NORM_SAMPLE = 50;

export type PersonalNorms = {
  sampleSize: number;
  ready: boolean;
  /** Sorted-ascending overall-score distribution. */
  overall: number[];
  /** Sorted-ascending per-factor distributions. */
  perFactor: Record<AraIndividualFactorId, number[]>;
};

const emptyNorms = (): PersonalNorms => ({
  sampleSize: 0,
  ready: false,
  overall: [],
  perFactor: {
    thinking_sense_check: [],
    results_working_practice: [],
    people_collaboration: [],
    self_adaptive_mindset: [],
  },
});

type QMeta = {
  factorId: AraIndividualFactorId;
  questionType: AraQuestionType;
  scoreMap: Record<string, number> | null;
};

/** Split an id list into chunks so the PostgREST `in(...)` URL stays sane. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function computePersonalNorms(): Promise<PersonalNorms> {
  try {
    const sb = createServiceClient();

    // 1. Personal-eligible assessments (individual stage OR layer enabled).
    const { data: assess } = (await sb
      .from("ara_assessments")
      .select("id, engagement_stage, include_individual_layer")) as {
      data: { id: string; engagement_stage: string; include_individual_layer: boolean | null }[] | null;
    };
    const eligibleAssessments = (assess ?? [])
      .filter((a) => a.engagement_stage === "individual" || a.include_individual_layer)
      .map((a) => a.id);
    if (eligibleAssessments.length === 0) return emptyNorms();

    // 2. Completed respondents on those assessments.
    const { data: resp } = (await sb
      .from("ara_respondents")
      .select("id, assessment_id, completed_at")
      .in("assessment_id", eligibleAssessments)) as {
      data: { id: string; assessment_id: string; completed_at: string | null }[] | null;
    };
    const respondentIds = (resp ?? []).filter((r) => r.completed_at).map((r) => r.id);
    if (respondentIds.length === 0) return emptyNorms();

    // 3. Global map of individual-factor questions (all versions).
    const { data: qs } = (await sb
      .from("ara_questions")
      .select("id, individual_factor_id, question_type, score_map")
      .not("individual_factor_id", "is", null)) as {
      data: { id: string; individual_factor_id: string; question_type: string; score_map: unknown }[] | null;
    };
    const qmeta = new Map<string, QMeta>();
    for (const q of qs ?? []) {
      qmeta.set(q.id, {
        factorId: q.individual_factor_id as AraIndividualFactorId,
        questionType: q.question_type as AraQuestionType,
        scoreMap: (q.score_map ?? null) as Record<string, number> | null,
      });
    }
    if (qmeta.size === 0) return emptyNorms();

    // 4. Responses for the completed respondents (chunked).
    type RespRow = { respondent_id: string; question_id: string; answer_value: string | null };
    const responses: RespRow[] = [];
    for (const ids of chunk(respondentIds, 200)) {
      const { data } = (await sb
        .from("ara_responses")
        .select("respondent_id, question_id, answer_value")
        .in("respondent_id", ids)) as { data: RespRow[] | null };
      if (data) responses.push(...data);
    }

    // 5. Per-respondent factor means.
    type Acc = Record<AraIndividualFactorId, { sum: number; count: number }>;
    const byRespondent = new Map<string, Acc>();
    const freshAcc = (): Acc => ({
      thinking_sense_check: { sum: 0, count: 0 },
      results_working_practice: { sum: 0, count: 0 },
      people_collaboration: { sum: 0, count: 0 },
      self_adaptive_mindset: { sum: 0, count: 0 },
    });
    for (const r of responses) {
      const meta = qmeta.get(r.question_id);
      if (!meta) continue;
      const numeric = calculateQuestionScore(meta.questionType, r.answer_value ?? null, meta.scoreMap);
      if (numeric == null) continue;
      let acc = byRespondent.get(r.respondent_id);
      if (!acc) {
        acc = freshAcc();
        byRespondent.set(r.respondent_id, acc);
      }
      acc[meta.factorId].sum += numeric;
      acc[meta.factorId].count += 1;
    }

    // 6. Build distributions. A respondent only counts toward the overall
    //    norm once they have at least one scored item in every factor, so an
    //    abandoned/partial response set never skews the pool.
    const norms = emptyNorms();
    for (const acc of Array.from(byRespondent.values())) {
      const factorMeans: Partial<Record<AraIndividualFactorId, number>> = {};
      let complete = true;
      for (const id of ARA_INDIVIDUAL_FACTOR_IDS) {
        if (acc[id].count === 0) {
          complete = false;
          break;
        }
        factorMeans[id] = acc[id].sum / acc[id].count;
      }
      if (!complete) continue;
      for (const id of ARA_INDIVIDUAL_FACTOR_IDS) norms.perFactor[id].push(factorMeans[id]!);
      const overall =
        ARA_INDIVIDUAL_FACTOR_IDS.reduce((s, id) => s + factorMeans[id]!, 0) /
        ARA_INDIVIDUAL_FACTOR_IDS.length;
      norms.overall.push(overall);
    }

    norms.overall.sort((a, b) => a - b);
    for (const id of ARA_INDIVIDUAL_FACTOR_IDS) norms.perFactor[id].sort((a, b) => a - b);
    norms.sampleSize = norms.overall.length;
    norms.ready = norms.sampleSize >= MIN_NORM_SAMPLE;
    return norms;
  } catch (e) {
    console.error("[ara] personal norms error:", e);
    return emptyNorms();
  }
}

/**
 * Percentile rank (1-99) of a value within a sorted-ascending distribution,
 * using the midpoint method for ties. Clamped to [1, 99] so the UI never
 * claims "0th" or "100th". Returns null for an empty distribution.
 */
export function percentileRank(value: number, sortedAsc: number[]): number | null {
  const n = sortedAsc.length;
  if (n === 0) return null;
  let below = 0;
  let equal = 0;
  for (const v of sortedAsc) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  const pct = ((below + equal / 2) / n) * 100;
  return Math.min(99, Math.max(1, Math.round(pct)));
}

/** "73rd", "1st", "22nd" - ordinal suffix for display. */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
