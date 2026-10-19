/**
 * The ARC cohort report stays at the organizational level and reads correctly
 * from the insight it is given. Run: npx tsx --test src/lib/reports/arc-cohort-html.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArcCohortReportHtml, cohortReportFilename } from "./arc-cohort-html";
import { safeFileSegment, cohortZipFilename } from "@/lib/ara/cohort-filenames";
import type { CompanyCohortInsight } from "@/lib/ara/company-cohort";
import type { RecommendedCourse } from "@/lib/recommender/courses";

const factor = (id: CompanyCohortInsight["factor_averages"][number]["factor_id"], average: number, below: number) => ({
  factor_id: id,
  average,
  respondent_count: 11,
  below_target_count: below,
});

const insight: CompanyCohortInsight = {
  company_key: "itqan",
  company_label: "ITQAN",
  redeemed: 11,
  started: 11,
  completed: 11,
  purged: 0,
  excluded: [
    { redemption_id: "x1", name: "Ahmad Trial", email: "ahmad@viftraining.com", completed_at: "2026-10-14T08:00:00Z", excluded_at: "2026-10-19T08:00:00Z" },
  ],
  factor_averages: [
    factor("thinking_sense_check", 3.4, 7),
    factor("results_working_practice", 4.2, 2),
    factor("people_collaboration", 2.8, 9),
    factor("self_adaptive_mindset", 3.9, 5),
  ],
  cohort_overall: 3.6,
  respondents: Array.from({ length: 11 }, (_, i) => ({
    respondent_id: `r${i}`,
    redemption_id: `d${i}`,
    name: `Delegate Secret ${i}`,
    email: `secret${i}@itqan.example`,
    completed_at: "2026-10-15T08:00:00Z",
    individual_only: true,
    per_factor: { thinking_sense_check: 3, results_working_practice: 4, people_collaboration: 3, self_adaptive_mindset: 4 },
    overall: 3.5,
  })),
  factor_scores_for_recommender: { thinking_sense_check: 3.4, results_working_practice: 4.2, people_collaboration: 2.8, self_adaptive_mindset: 3.9 },
  band_distribution: { emerging: 2, practising: 6, embedded: 3 },
  tier_counts: { snapshot: 11, deep_dive: 0 },
  is_practice_only: false,
  norms_ready: true,
  norm_sample_size: 240,
  overall_percentile: 58,
};

const course: RecommendedCourse = {
  course_id: "c1",
  course_code: "AI-201",
  title_en: "Working with AI: Collaboration and Judgment",
  title_ar: null,
  vertical: "ai" as RecommendedCourse["vertical"],
  level: "intermediate" as RecommendedCourse["level"],
  default_duration_days: 2,
  min_duration_days: 1,
  max_duration_days: 3,
  total_score: 6,
  drivers: [{ label: "People collaboration", label_ar: null, kind: "pillar", gap: 1.2, relevance: 3, contribution: 3.6 }],
};

test("cohort report: organizational level only, every section present", () => {
  const html = buildArcCohortReportHtml({ insight, courses: [course], generatedAt: "19 October 2026" });
  assert.match(html, /ITQAN/);
  assert.match(html, /3\.6<\/span>/);
  assert.match(html, /58th percentile/);
  assert.match(html, /Practicing/);
  assert.match(html, /AI-201/);
  assert.match(html, /Readiness by factor/);
  assert.match(html, /Maturity spread/);
  assert.match(html, /9 of 11 below target/);
  // No names, no emails, no per-person rows.
  assert.doesNotMatch(html, /Delegate Secret/);
  assert.doesNotMatch(html, /itqan\.example/);
  // Excluded test runs are not mentioned either.
  assert.doesNotMatch(html, /Ahmad Trial|viftraining\.com/);
  // The reading names the weakest factor as the main opportunity.
  assert.match(html, /main opportunity/);
  // House style: American spelling.
  assert.doesNotMatch(html, /\b(programme|organisation|behaviour|practising)\b/i);
});

test("cohort report: no norms and no courses degrade gracefully", () => {
  const html = buildArcCohortReportHtml({
    insight: { ...insight, norms_ready: false, overall_percentile: null, norm_sample_size: 12 },
    courses: [],
    generatedAt: "19 October 2026",
  });
  assert.match(html, /Population percentiles are reported once/);
  assert.match(html, /No training gap to close/);
});

test("file names are safe", () => {
  assert.equal(safeFileSegment("ITQAN / Riyadh  (HQ)"), "ITQAN_Riyadh_HQ");
  assert.equal(safeFileSegment("   "), "cohort");
  assert.equal(cohortReportFilename("ITQAN"), "VIFM_AI_Readiness_Cohort_Report_ITQAN.pdf");
  assert.equal(cohortZipFilename("ITQAN", "en"), "VIFM_AI_Readiness_Reports_ITQAN_en.zip");
});
