import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import { ARA_PILLARS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { ARA_INDIVIDUAL_FACTOR_IDS, type AraIndividualFactorId } from "@/lib/constants/ara-individual-factors";
import { maturityLevelFromScore, overallBandFromScore } from "@/lib/ara/scoring";
import type { AraPillarId } from "@/types/ara";
import { computeCompanyCohortInsight, type CompanyCohortInsight } from "@/lib/ara/company-cohort";

/**
 * Everything the client-facing cohort dashboard needs beyond the workforce
 * rollup on the insights page:
 *
 *  - the ORGANIZATIONAL layer: when a voucher carried the pillar questions
 *    (department / division / enterprise stage), every delegate also rated
 *    the organization on the pillars in scope. Here those sittings are pooled
 *    into one cohort view per pillar (mean, range, agreement, maturity level)
 *    plus the pillar questions ranked by cohort score.
 *  - the PERSONAL layer at question level: each four-factor item's cohort
 *    average, so the report can name concrete strengths and gaps rather than
 *    four averages.
 *
 * Both are computed from ara_responses so a pooled code (one shared sitting)
 * and per-person codes (one sitting each) come out the same way. Per-person
 * scores never leave this module: everything returned is a cohort aggregate.
 */

export const TARGET = 4;

export type CohortItemStat = {
  question_id: string;
  text_en: string;
  /** Cohort mean of the item score on the 1-5 scale. */
  mean: number;
  /** Delegates who answered this item. */
  n: number;
  /** Delegates at or above the 4.0 target on this item. */
  at_target: number;
};

export type CohortPillarStat = {
  pillar_id: AraPillarId;
  name_en: string;
  description_en: string;
  /** Mean across delegates of each delegate's pillar mean. */
  mean: number;
  min: number;
  max: number;
  /** Population standard deviation of the per-delegate pillar means. */
  sd: number;
  /** Delegates with at least one scored item in this pillar. */
  n: number;
  below_target: number;
  level: ReturnType<typeof maturityLevelFromScore>;
  items: CohortItemStat[];
};

export type CompanyOrgInsight = {
  /** Highest stage among the sittings (enterprise > division > department). */
  stage: "department" | "division" | "enterprise";
  /** Delegates whose sitting carried the pillar layer and who scored at least one pillar item. */
  respondents: number;
  pillars: CohortPillarStat[];
  /** Equal-weight mean of the pillar means. */
  overall: number | null;
  band: ReturnType<typeof overallBandFromScore> | null;
  /** Distribution of per-delegate overall org scores across the five bands (Not Ready .. AI Leader). */
  band_counts: number[];
  /** Per-delegate overall org scores, sorted, anonymous (for the spread chart). */
  overall_scores: number[];
  /** Every delegate rated every pillar in scope. */
  questions_per_pillar: number | null;
  /** Pillars where the delegates disagree most (sd >= 0.9 on a 1-5 scale). */
  divided: AraPillarId[];
};

export type CompanyCohortDetail = {
  insight: CompanyCohortInsight;
  /** Null when no counted sitting carried the organizational pillars. */
  org: CompanyOrgInsight | null;
  /** Four-factor items by factor, each list sorted strongest first. */
  personal_items: Record<AraIndividualFactorId, CohortItemStat[]>;
};

type QRow = {
  id: string;
  question_text_en: string;
  pillar_id: string | null;
  individual_factor_id: string | null;
  agentic_dimension_id: string | null;
  question_type: string;
};
type RRow = { respondent_id: string; question_id: string; question_score: number | string | null };

const STAGE_RANK: Record<string, number> = { department: 1, division: 2, enterprise: 3 };

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / xs.length);
}

/** Pure aggregation, exported for tests. */
export function aggregateCohortItems(
  responses: RRow[],
  questions: Map<string, QRow>,
  pick: (q: QRow) => string | null,
): Map<string, { group: string; stats: CohortItemStat; perRespondent: Map<string, number> }> {
  const acc = new Map<string, { group: string; text: string; sum: number; n: number; at: number; per: Map<string, number[]> }>();
  for (const r of responses) {
    const q = questions.get(r.question_id);
    if (!q) continue;
    const group = pick(q);
    if (!group) continue;
    const score = r.question_score == null ? null : Number(r.question_score);
    if (score == null || !Number.isFinite(score)) continue;
    const a = acc.get(q.id) ?? { group, text: q.question_text_en, sum: 0, n: 0, at: 0, per: new Map() };
    a.sum += score;
    a.n += 1;
    if (score >= TARGET) a.at += 1;
    a.per.set(r.respondent_id, [...(a.per.get(r.respondent_id) ?? []), score]);
    acc.set(q.id, a);
  }
  const out = new Map<string, { group: string; stats: CohortItemStat; perRespondent: Map<string, number> }>();
  for (const [qid, a] of acc) {
    out.set(qid, {
      group: a.group,
      stats: { question_id: qid, text_en: a.text, mean: a.sum / a.n, n: a.n, at_target: a.at },
      perRespondent: new Map(Array.from(a.per, ([rid, xs]) => [rid, mean(xs)])),
    });
  }
  return out;
}

export async function computeCompanyCohortDetail(companyName: string): Promise<CompanyCohortDetail | null> {
  const insight = await computeCompanyCohortInsight(companyName);
  if (!insight) return null;

  const sb = createServiceClient();
  const completed = insight.respondents.filter((r) => r.completed_at);
  const personal_items = emptyPersonalItems();
  if (completed.length === 0) return { insight, org: null, personal_items };

  // Every scored answer of every completed, counted delegate.
  const responses: RRow[] = [];
  for (const ids of chunkIds(completed.map((r) => r.respondent_id))) {
    responses.push(
      ...(await fetchAllPages<RRow>((from, to) =>
        sb
          .from("ara_responses")
          .select("respondent_id, question_id, question_score")
          .in("respondent_id", ids)
          .not("question_score", "is", null)
          .order("id")
          .range(from, to),
      )),
    );
  }
  const qids = Array.from(new Set(responses.map((r) => r.question_id)));
  const questions = new Map<string, QRow>();
  for (const ids of chunkIds(qids)) {
    const rows = await fetchAllPages<QRow>((from, to) =>
      sb
        .from("ara_questions")
        .select("id, question_text_en, pillar_id, individual_factor_id, agentic_dimension_id, question_type")
        .in("id", ids)
        .order("id")
        .range(from, to),
    );
    for (const q of rows) questions.set(q.id, q);
  }

  // Personal layer, item level.
  const personal = aggregateCohortItems(responses, questions, (q) =>
    q.individual_factor_id && ARA_INDIVIDUAL_FACTOR_IDS.includes(q.individual_factor_id as AraIndividualFactorId)
      ? q.individual_factor_id
      : null,
  );
  for (const { group, stats } of personal.values()) {
    personal_items[group as AraIndividualFactorId].push(stats);
  }
  for (const id of ARA_INDIVIDUAL_FACTOR_IDS) personal_items[id].sort((a, b) => b.mean - a.mean);

  // Organizational layer: pillar items only (personal and agentic items reuse
  // a pillar_id for storage and must not count here, same rule as scoring).
  const orgSittings = completed.filter((r) => r.engagement_stage && r.engagement_stage !== "individual");
  if (orgSittings.length === 0) return { insight, org: null, personal_items };
  const orgRespondentIds = new Set(orgSittings.map((r) => r.respondent_id));
  const org = aggregateCohortItems(
    responses.filter((r) => orgRespondentIds.has(r.respondent_id)),
    questions,
    (q) => (q.pillar_id && !q.individual_factor_id && !q.agentic_dimension_id ? q.pillar_id : null),
  );
  if (org.size === 0) return { insight, org: null, personal_items };

  // Per delegate, per pillar: the mean of their scored items in that pillar.
  const perDelegate = new Map<string, Map<AraPillarId, number[]>>();
  for (const { group, perRespondent } of org.values()) {
    for (const [rid, score] of perRespondent) {
      const m = perDelegate.get(rid) ?? new Map<AraPillarId, number[]>();
      m.set(group as AraPillarId, [...(m.get(group as AraPillarId) ?? []), score]);
      perDelegate.set(rid, m);
    }
  }

  const pillars: CohortPillarStat[] = [];
  const divided: AraPillarId[] = [];
  for (const p of ARA_PILLARS) {
    const delegateMeans: number[] = [];
    for (const m of perDelegate.values()) {
      const xs = m.get(p.id);
      if (xs && xs.length > 0) delegateMeans.push(mean(xs));
    }
    if (delegateMeans.length === 0) continue;
    const items = Array.from(org.values())
      .filter((x) => x.group === p.id)
      .map((x) => x.stats)
      .sort((a, b) => b.mean - a.mean);
    const pm = mean(delegateMeans);
    const s = sd(delegateMeans);
    if (s >= 0.9 && delegateMeans.length >= 3) divided.push(p.id);
    pillars.push({
      pillar_id: p.id,
      name_en: p.name_en,
      description_en: p.description_en,
      mean: pm,
      min: Math.min(...delegateMeans),
      max: Math.max(...delegateMeans),
      sd: s,
      n: delegateMeans.length,
      below_target: delegateMeans.filter((x) => x < TARGET).length,
      level: maturityLevelFromScore(pm),
      items,
    });
  }

  const overall_scores = Array.from(perDelegate.values())
    .map((m) => {
      const pm = Array.from(m.values()).filter((xs) => xs.length > 0).map(mean);
      return pm.length > 0 ? mean(pm) : null;
    })
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);
  const overall = pillars.length > 0 ? mean(pillars.map((p) => p.mean)) : null;
  const band_counts = ARA_OVERALL_BANDS.map(() => 0);
  for (const x of overall_scores) {
    let i = 0;
    ARA_OVERALL_BANDS.forEach((b, k) => {
      if (x >= b.min) i = k;
    });
    band_counts[i] += 1;
  }

  let stage: CompanyOrgInsight["stage"] = "department";
  for (const r of orgSittings) {
    const st = r.engagement_stage ?? "";
    if ((STAGE_RANK[st] ?? 0) > STAGE_RANK[stage]) stage = st as CompanyOrgInsight["stage"];
  }
  const qpp = pillars.length > 0 ? Math.max(...pillars.map((p) => p.items.length)) : null;

  return {
    insight,
    org: {
      stage,
      respondents: perDelegate.size,
      pillars,
      overall,
      band: overall != null ? overallBandFromScore(overall) : null,
      band_counts,
      overall_scores,
      questions_per_pillar: qpp,
      divided,
    },
    personal_items,
  };
}

function emptyPersonalItems(): Record<AraIndividualFactorId, CohortItemStat[]> {
  return { thinking_sense_check: [], results_working_practice: [], people_collaboration: [], self_adaptive_mindset: [] };
}
