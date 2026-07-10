/**
 * Per-company cohort insights for ARC voucher delegates.
 *
 * Every voucher redemption provisions its OWN individual-stage ara_assessments
 * row (a Personal AI Readiness Snapshot scoring the four VIFM factors) and an
 * ara_voucher_redemptions row carrying the delegate-typed `company_name`. So a
 * "company" here is the set of redemptions sharing the same (normalized)
 * company_name - exactly the grouping the /ara/admin/vouchers "Redemptions by
 * company" table already uses. This module rolls those delegates up into a
 * cohort: completion funnel + per-factor cohort means + band distribution +
 * a population percentile + the inputs for course recommendations.
 *
 * Why this is a NEW module and not computeWorkforceReadiness: that helper is
 * single-assessment + single-bank-version (it loads questions only for one
 * assessment's pinned version). A company's delegates span MANY assessments and
 * may sit different bank versions, so we must score against the cross-version
 * global question map (individual_factor_id IS NOT NULL, no version filter) the
 * way personal-norms.ts does. The per-respondent rollup math below deliberately
 * mirrors computeWorkforceReadiness so the two surfaces stay consistent.
 *
 * Service-client only (ara_voucher_* tables are admin-only under RLS); the
 * calling page is admin-gated by the /ara/admin layout. Best-effort + tolerant:
 * any missing table / empty cohort yields a null insight (caller renders an
 * empty state) rather than throwing.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import {
  computePersonalNorms,
  percentileRank,
  MIN_NORM_SAMPLE,
} from "@/lib/ara/personal-norms";
import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import type {
  WorkforceFactorAverage,
  WorkforceRespondent,
} from "@/lib/ara/workforce-readiness";
import type { AraQuestionType } from "@/types/ara";

const TARGET = 4;

/**
 * Canonical grouping key for a free-typed company name: trim, lowercase, and
 * collapse internal whitespace so "ADNOC", "adnoc", and "ADNOC " all group
 * together. The display label keeps the original casing of the first sighting.
 */
export function normalizeCompanyKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export type CompanyCohortSummary = {
  company_key: string;
  company_label: string;
  redeemed: number;
  started: number;
  completed: number;
  last_redeemed: string | null;
  /** True when every redemption's run is a sandbox/practice run. */
  is_practice_only: boolean;
};

export type CompanyCohortInsight = {
  company_key: string;
  company_label: string;
  // Completion funnel.
  redeemed: number;
  started: number;
  completed: number;
  /** Redemptions whose run was purged (assessment/respondent FK set null). */
  purged: number;
  // Factor rollup (shapes shared with the Mode C workforce rollup).
  factor_averages: WorkforceFactorAverage[];
  cohort_overall: number | null;
  respondents: WorkforceRespondent[];
  factor_scores_for_recommender: Record<AraIndividualFactorId, number>;
  /** Overall-maturity histogram across scored delegates. */
  band_distribution: { emerging: number; practising: number; embedded: number };
  /** Tier composition - a company can mix snapshot + deep_dive vouchers. */
  tier_counts: { snapshot: number; deep_dive: number };
  is_practice_only: boolean;
  // Population percentile (vs the global personal-snapshot norm pool).
  norms_ready: boolean;
  norm_sample_size: number;
  overall_percentile: number | null;
};

// ── Shared redemption-row shape (PostgREST embeds FKs as arrays) ──
type RedemptionJoinRow = {
  company_name: string | null;
  redeemed_at: string | null;
  ara_respondent_id: string | null;
  ara_assessment_id: string | null;
  respondent:
    | {
        id: string;
        name: string;
        email: string;
        completed_at: string | null;
        first_opened_at: string | null;
        individual_only: boolean | null;
      }[]
    | {
        id: string;
        name: string;
        email: string;
        completed_at: string | null;
        first_opened_at: string | null;
        individual_only: boolean | null;
      }
    | null;
  assessment:
    | { assessment_tier: string | null; is_sandbox: boolean | null }[]
    | { assessment_tier: string | null; is_sandbox: boolean | null }
    | null;
};

function firstOf<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const REDEMPTION_SELECT =
  "company_name, redeemed_at, ara_respondent_id, ara_assessment_id, " +
  "respondent:ara_respondents(id, name, email, completed_at, first_opened_at, individual_only), " +
  "assessment:ara_assessments(assessment_tier, is_sandbox)";

/**
 * Enumerate every company that has at least one voucher redemption, with a
 * lightweight completion funnel (no per-factor scoring). Powers the cohort
 * picker on the insights page.
 */
export async function listCompanyCohorts(): Promise<CompanyCohortSummary[]> {
  try {
    const sb = createServiceClient();
    // PAGINATED: a .limit(10000) above the server max-rows setting is clamped
    // to 1000, so companies whose redemptions fell outside the newest 1000
    // rows silently vanished from the cohort picker and funnel.
    const data = await fetchAllPages<unknown>((from, to) =>
      sb
        .from("ara_voucher_redemptions")
        .select(REDEMPTION_SELECT)
        .order("redeemed_at", { ascending: false })
        .order("id")
        .range(from, to)
    );

    const byKey = new Map<string, CompanyCohortSummary & { _allPractice: boolean }>();
    for (const r of data as unknown as RedemptionJoinRow[]) {
      const key = normalizeCompanyKey(r.company_name);
      if (!key) continue;
      const resp = firstOf(r.respondent);
      const assess = firstOf(r.assessment);
      const existing =
        byKey.get(key) ??
        {
          company_key: key,
          company_label: (r.company_name ?? "").trim() || key,
          redeemed: 0,
          started: 0,
          completed: 0,
          last_redeemed: null as string | null,
          is_practice_only: true,
          _allPractice: true,
        };
      existing.redeemed += 1;
      if (resp?.first_opened_at) existing.started += 1;
      if (resp?.completed_at) existing.completed += 1;
      if (r.redeemed_at && (!existing.last_redeemed || r.redeemed_at > existing.last_redeemed)) {
        existing.last_redeemed = r.redeemed_at;
      }
      // A single non-sandbox run flips the cohort off "practice only".
      if (assess && assess.is_sandbox === false) existing._allPractice = false;
      byKey.set(key, existing);
    }

    return Array.from(byKey.values())
      .map(({ _allPractice, ...rest }) => ({ ...rest, is_practice_only: _allPractice }))
      .sort((a, b) => b.redeemed - a.redeemed);
  } catch (e) {
    console.error("[ara] listCompanyCohorts error:", e);
    return [];
  }
}

type QMeta = {
  factorId: AraIndividualFactorId;
  questionType: AraQuestionType;
  scoreMap: Record<string, number> | null;
};

const freshAcc = (): Record<AraIndividualFactorId, { sum: number; count: number }> => ({
  thinking_sense_check: { sum: 0, count: 0 },
  results_working_practice: { sum: 0, count: 0 },
  people_collaboration: { sum: 0, count: 0 },
  self_adaptive_mindset: { sum: 0, count: 0 },
});

/**
 * Roll a company's voucher delegates up into a cohort insight. `companyName`
 * is the original free-typed value (e.g. from the redemptions table); matching
 * is done on the normalized key, so any casing/spacing variant resolves here.
 * Returns null when the company has no redemptions or no scorable answers yet.
 */
export async function computeCompanyCohortInsight(
  companyName: string
): Promise<CompanyCohortInsight | null> {
  const wantKey = normalizeCompanyKey(companyName);
  if (!wantKey) return null;

  try {
    const sb = createServiceClient();

    // 1. All redemptions, filtered in code on the normalized company key
    //    (the company_name index is on the raw value and we need ws/case
    //    folding, so a server-side equality filter would miss variants).
    //    PAGINATED - see listCompanyCohorts.
    const allRedemptions = await fetchAllPages<unknown>((from, to) =>
      sb
        .from("ara_voucher_redemptions")
        .select(REDEMPTION_SELECT)
        .order("redeemed_at", { ascending: false })
        .order("id")
        .range(from, to)
    );

    const rows = (allRedemptions as unknown as RedemptionJoinRow[]).filter(
      (r) => normalizeCompanyKey(r.company_name) === wantKey
    );
    if (rows.length === 0) return null;

    const companyLabel =
      (rows.find((r) => (r.company_name ?? "").trim())?.company_name ?? "").trim() || wantKey;

    // 2. Funnel + the scorable (non-purged) respondent set.
    let redeemed = 0;
    let started = 0;
    let completed = 0;
    let purged = 0;
    let allPractice = true;
    const tier_counts = { snapshot: 0, deep_dive: 0 };

    type ScorableRespondent = {
      id: string;
      name: string;
      email: string;
      completed_at: string | null;
      individual_only: boolean;
    };
    const scorable = new Map<string, ScorableRespondent>();

    for (const r of rows) {
      redeemed += 1;
      const resp = firstOf(r.respondent);
      const assess = firstOf(r.assessment);
      if (assess && assess.is_sandbox === false) allPractice = false;
      if (assess?.assessment_tier === "deep_dive") tier_counts.deep_dive += 1;
      else tier_counts.snapshot += 1;

      if (!resp) {
        purged += 1;
        continue;
      }
      if (resp.first_opened_at) started += 1;
      if (resp.completed_at) completed += 1;
      // Dedup on respondent id (a multi-use voucher could in principle map a
      // delegate to one respondent across rows; keep one entry).
      if (!scorable.has(resp.id)) {
        scorable.set(resp.id, {
          id: resp.id,
          name: resp.name,
          email: resp.email,
          completed_at: resp.completed_at,
          individual_only: !!resp.individual_only,
        });
      }
    }

    const respondentRows = Array.from(scorable.values());
    if (respondentRows.length === 0) {
      // Everyone purged - report the funnel but no scores.
      return emptyScoredInsight(wantKey, companyLabel, {
        redeemed,
        started,
        completed,
        purged,
        tier_counts,
        is_practice_only: allPractice,
      });
    }

    // 3. Cross-version map of the four-factor questions (no version filter).
    const qs = await fetchAllPages<unknown>((from, to) =>
      sb
        .from("ara_questions")
        .select("id, individual_factor_id, question_type, score_map")
        .not("individual_factor_id", "is", null)
        .order("id")
        .range(from, to)
    );
    const qmeta = new Map<string, QMeta>();
    for (const q of qs as Array<{
      id: string;
      individual_factor_id: string;
      question_type: string;
      score_map: unknown;
    }>) {
      qmeta.set(q.id, {
        factorId: q.individual_factor_id as AraIndividualFactorId,
        questionType: q.question_type as AraQuestionType,
        scoreMap: (q.score_map ?? null) as Record<string, number> | null,
      });
    }
    if (qmeta.size === 0) {
      return emptyScoredInsight(wantKey, companyLabel, {
        redeemed,
        started,
        completed,
        purged,
        tier_counts,
        is_practice_only: allPractice,
      });
    }

    // 4. Responses for the cohort's respondents (chunked ids + PAGINATED:
    //    200 respondents x 24-48 answers each is 4800-9600 rows per chunk,
    //    far beyond the single-request 1000-row cap).
    type RespRow = { respondent_id: string; question_id: string; answer_value: string | null };
    const responses: RespRow[] = [];
    for (const ids of chunkIds(respondentRows.map((r) => r.id))) {
      responses.push(
        ...(await fetchAllPages<RespRow>((from, to) =>
          sb
            .from("ara_responses")
            .select("respondent_id, question_id, answer_value")
            .in("respondent_id", ids)
            .order("id")
            .range(from, to)
        ))
      );
    }

    // 5. Per-respondent factor accumulators (mirrors computeWorkforceReadiness).
    const perRespondent = new Map<string, ReturnType<typeof freshAcc>>();
    for (const r of responses) {
      const meta = qmeta.get(r.question_id);
      if (!meta) continue;
      const numeric = calculateQuestionScore(
        meta.questionType,
        r.answer_value == null ? null : String(r.answer_value),
        meta.scoreMap
      );
      if (typeof numeric !== "number" || !Number.isFinite(numeric)) continue;
      const buckets = perRespondent.get(r.respondent_id) ?? freshAcc();
      buckets[meta.factorId].sum += numeric;
      buckets[meta.factorId].count += 1;
      perRespondent.set(r.respondent_id, buckets);
    }

    // 6. Per-respondent summaries + cohort accumulators.
    const cohortAcc = freshAcc();
    const respondents: WorkforceRespondent[] = respondentRows.map((r) => {
      const buckets = perRespondent.get(r.id);
      const per_factor = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number | null>>(
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
        {} as Record<AraIndividualFactorId, number | null>
      );
      const vals = Object.values(per_factor).filter((v): v is number => typeof v === "number");
      const overall = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
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

    // Below-target tally per factor (drives the "% below target" bars).
    const belowTarget = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number>>(
      (acc, id) => {
        acc[id] = 0;
        return acc;
      },
      {} as Record<AraIndividualFactorId, number>
    );
    for (const r of respondents) {
      for (const id of ARA_INDIVIDUAL_FACTOR_IDS) {
        const v = r.per_factor[id];
        if (v != null && v < TARGET) belowTarget[id] += 1;
      }
    }

    const factor_averages: WorkforceFactorAverage[] = ARA_INDIVIDUAL_FACTOR_IDS.map((id) => {
      const acc = cohortAcc[id];
      return {
        factor_id: id,
        average: acc.count > 0 ? acc.sum / acc.count : 0,
        respondent_count: acc.count,
        below_target_count: belowTarget[id],
      };
    });

    const overallMeans = factor_averages.filter((f) => f.respondent_count > 0).map((f) => f.average);
    const cohort_overall =
      overallMeans.length > 0 ? overallMeans.reduce((a, b) => a + b, 0) / overallMeans.length : null;

    const factor_scores_for_recommender = ARA_INDIVIDUAL_FACTOR_IDS.reduce<
      Record<AraIndividualFactorId, number>
    >((acc, id) => {
      const f = factor_averages.find((x) => x.factor_id === id);
      acc[id] = f && f.respondent_count > 0 ? f.average : TARGET;
      return acc;
    }, {} as Record<AraIndividualFactorId, number>);

    // 7. Overall-maturity band histogram (only delegates with a real overall).
    const band_distribution = { emerging: 0, practising: 0, embedded: 0 };
    for (const r of respondents) {
      if (r.overall == null) continue;
      const stage = getIndividualMaturityStage(r.overall).id;
      if (stage === "embedded") band_distribution.embedded += 1;
      else if (stage === "practising") band_distribution.practising += 1;
      else band_distribution.emerging += 1;
    }

    // 8. Population percentile vs the global personal-snapshot norm pool.
    let norms_ready = false;
    let norm_sample_size = 0;
    let overall_percentile: number | null = null;
    try {
      const norms = await computePersonalNorms();
      norm_sample_size = norms.sampleSize;
      norms_ready = norms.ready && norms.sampleSize >= MIN_NORM_SAMPLE;
      if (norms_ready && cohort_overall != null) {
        overall_percentile = percentileRank(cohort_overall, norms.overall);
      }
    } catch {
      // Norms are a best-effort enrichment; ignore failures.
    }

    return {
      company_key: wantKey,
      company_label: companyLabel,
      redeemed,
      started,
      completed,
      purged,
      factor_averages,
      cohort_overall,
      respondents,
      factor_scores_for_recommender,
      band_distribution,
      tier_counts,
      is_practice_only: allPractice,
      norms_ready,
      norm_sample_size,
      overall_percentile,
    };
  } catch (e) {
    console.error("[ara] computeCompanyCohortInsight error:", e);
    return null;
  }
}

/** Insight with the funnel populated but no scorable answers (purged / no seed). */
function emptyScoredInsight(
  company_key: string,
  company_label: string,
  funnel: {
    redeemed: number;
    started: number;
    completed: number;
    purged: number;
    tier_counts: { snapshot: number; deep_dive: number };
    is_practice_only: boolean;
  }
): CompanyCohortInsight {
  return {
    company_key,
    company_label,
    redeemed: funnel.redeemed,
    started: funnel.started,
    completed: funnel.completed,
    purged: funnel.purged,
    factor_averages: ARA_INDIVIDUAL_FACTOR_IDS.map((id) => ({
      factor_id: id,
      average: 0,
      respondent_count: 0,
      below_target_count: 0,
    })),
    cohort_overall: null,
    respondents: [],
    factor_scores_for_recommender: ARA_INDIVIDUAL_FACTOR_IDS.reduce<
      Record<AraIndividualFactorId, number>
    >((acc, id) => {
      acc[id] = TARGET;
      return acc;
    }, {} as Record<AraIndividualFactorId, number>),
    band_distribution: { emerging: 0, practising: 0, embedded: 0 },
    tier_counts: funnel.tier_counts,
    is_practice_only: funnel.is_practice_only,
    norms_ready: false,
    norm_sample_size: 0,
    overall_percentile: null,
  };
}
