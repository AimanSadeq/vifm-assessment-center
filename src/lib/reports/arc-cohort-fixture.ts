/**
 * Fixture cohort for the dashboard's unit test and the local render check:
 * eleven delegates with made-up names and emails (which must never reach the
 * PDF), an enterprise-stage organizational layer and item-level detail.
 * Not ITQAN's real numbers.
 */
import type { CompanyCohortDetail, CohortItemStat, CohortPillarStat } from "@/lib/ara/company-cohort-detail";
import type { CompanyCohortInsight } from "@/lib/ara/company-cohort";
import type { RecommendedCourse } from "@/lib/recommender/courses";
import { ARA_PILLARS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { maturityLevelFromScore, overallBandFromScore } from "@/lib/ara/scoring";
import type { AraIndividualFactorId } from "@/lib/constants/ara-individual-factors";

const N = 11;
const perFactor: Record<AraIndividualFactorId, number>[] = Array.from({ length: N }, (_, i) => ({
  thinking_sense_check: 2.4 + (i % 5) * 0.5,
  results_working_practice: 3.3 + (i % 4) * 0.45,
  people_collaboration: 1.9 + (i % 6) * 0.4,
  self_adaptive_mindset: 3.0 + (i % 3) * 0.6,
}));
const avg = (id: AraIndividualFactorId) => perFactor.reduce((s, p) => s + p[id], 0) / N;
const below = (id: AraIndividualFactorId) => perFactor.filter((p) => p[id] < 4).length;
const overallOf = (p: Record<AraIndividualFactorId, number>) => (p.thinking_sense_check + p.results_working_practice + p.people_collaboration + p.self_adaptive_mindset) / 4;

const items = (prefix: string, n: number, base: number): CohortItemStat[] =>
  Array.from({ length: n }, (_, i) => {
    const mean = Math.max(1, Math.min(5, base + ((i * 7) % 5) * 0.45 - 0.9));
    return { question_id: `${prefix}${i}`, text_en: `${prefix} question ${i + 1}: a concrete practice the delegates were asked to rate for the organization`, mean, n: N, at_target: Math.round(((mean - 1) / 4) * N) };
  });

const pillarBases = [3.6, 2.4, 3.1, 3.9, 2.9, 2.2, 3.4, 2.0];
const pillars: CohortPillarStat[] = ARA_PILLARS.map((p, i) => {
  const mean = pillarBases[i];
  const sd = i === 1 || i === 5 ? 1.1 : 0.5;
  return {
    pillar_id: p.id, name_en: p.name_en, description_en: p.description_en,
    mean, min: Math.max(1, mean - sd * 1.6), max: Math.min(5, mean + sd * 1.4), sd, n: N,
    below_target: mean >= 4 ? 3 : 9, level: maturityLevelFromScore(mean), items: items(p.name_en.split(" ")[0], 5, mean),
  };
});
const orgOverall = pillars.reduce((s, p) => s + p.mean, 0) / pillars.length;
const orgScores = Array.from({ length: N }, (_, i) => 1.9 + i * 0.3).sort((a, b) => a - b);

export const FIXTURE_INSIGHT: CompanyCohortInsight = {
  company_key: "itqan", company_label: "ITQAN", redeemed: 14, started: 13, completed: N, purged: 0,
  excluded: [{ redemption_id: "x1", name: "Ahmad Trial", email: "ahmad@viftraining.com", completed_at: "2026-10-14T08:00:00Z", excluded_at: "2026-10-19T08:00:00Z" }],
  factor_averages: (["thinking_sense_check", "results_working_practice", "people_collaboration", "self_adaptive_mindset"] as AraIndividualFactorId[]).map((id) => ({ factor_id: id, average: avg(id), respondent_count: N, below_target_count: below(id) })),
  cohort_overall: perFactor.reduce((s, p) => s + overallOf(p), 0) / N,
  respondents: perFactor.map((p, i) => ({
    respondent_id: `r${i}`, redemption_id: `d${i}`, assessment_id: `a${i}`, engagement_stage: "enterprise",
    name: `Delegate Secret ${i}`, email: `secret${i}@itqan.example`,
    completed_at: `2026-10-${String(8 + (i % 6)).padStart(2, "0")}T09:00:00Z`, individual_only: false,
    per_factor: p, overall: overallOf(p),
  })),
  factor_scores_for_recommender: { thinking_sense_check: avg("thinking_sense_check"), results_working_practice: avg("results_working_practice"), people_collaboration: avg("people_collaboration"), self_adaptive_mindset: avg("self_adaptive_mindset") },
  band_distribution: {
    emerging: perFactor.filter((p) => overallOf(p) < 3).length,
    practising: perFactor.filter((p) => overallOf(p) >= 3 && overallOf(p) < 4).length,
    embedded: perFactor.filter((p) => overallOf(p) >= 4).length,
  },
  tier_counts: { snapshot: 0, deep_dive: N },
  is_practice_only: false, norms_ready: true, norm_sample_size: 240, overall_percentile: 58,
  factor_percentiles: { thinking_sense_check: 44, results_working_practice: 71, people_collaboration: 23, self_adaptive_mindset: 60 },
  norm_factor_means: { thinking_sense_check: 3.3, results_working_practice: 3.6, people_collaboration: 3.1, self_adaptive_mindset: 3.5 },
  norm_overall_mean: 3.4,
};

export const FIXTURE_DETAIL: CompanyCohortDetail = {
  insight: FIXTURE_INSIGHT,
  org: {
    stage: "enterprise", respondents: N, pillars, overall: orgOverall, band: overallBandFromScore(orgOverall),
    band_counts: ARA_OVERALL_BANDS.map((b, i, arr) => orgScores.filter((x) => x >= b.min && (i === arr.length - 1 || x < arr[i + 1].min)).length),
    overall_scores: orgScores, questions_per_pillar: 5, divided: ["data", "governance"],
  },
  personal_items: {
    thinking_sense_check: items("Sense-check", 12, 3.2),
    results_working_practice: items("Working practice", 12, 3.9),
    people_collaboration: items("Collaboration", 12, 2.7),
    self_adaptive_mindset: items("Mindset", 12, 3.5),
  },
};

const mk = (code: string, title: string, level: string, days: number, drivers: string[]): RecommendedCourse => ({
  course_id: code, course_code: code, title_en: title, title_ar: null,
  vertical: "artificial_intelligence" as RecommendedCourse["vertical"], level: level as RecommendedCourse["level"],
  default_duration_days: days, min_duration_days: 1, max_duration_days: 5, total_score: 6,
  drivers: drivers.map((d, i) => ({ label: d, label_ar: null, kind: "pillar" as const, gap: 1.2, relevance: 3, contribution: 3.6 - i })),
});
export const FIXTURE_PERSONAL_COURSES: RecommendedCourse[] = [
  mk("AI-201", "Working with AI: Collaboration and Judgment", "intermediate", 2, ["People collaboration", "Thinking and sense-check"]),
  mk("AI-110", "AI Fundamentals for Professionals", "foundation", 1, ["Thinking and sense-check"]),
  mk("AI-220", "Prompting and Verification Practice", "intermediate", 2, ["Thinking and sense-check", "Results and working practice"]),
];
export const FIXTURE_PILLAR_COURSES: RecommendedCourse[] = [
  mk("AI-410", "AI Governance and Responsible Use", "advanced", 2, ["Governance", "Model Management"]),
  mk("AI-320", "Data Foundations for AI", "intermediate", 3, ["Data"]),
  mk("AI-305", "Leading AI Adoption in Teams", "advanced", 3, ["Culture", "Talent"]),
  mk("AI-330", "Building an AI Use Case Portfolio", "intermediate", 2, ["Operations", "Strategy"]),
];
