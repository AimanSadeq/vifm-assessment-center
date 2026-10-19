/**
 * The ARC cohort dashboard stays at the organizational level and covers both
 * layers. Run: npx tsx --test src/lib/reports/arc-cohort-html.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArcCohortReportHtml, cohortReportFilename } from "./arc-cohort-html";
import { FIXTURE_DETAIL, FIXTURE_PERSONAL_COURSES, FIXTURE_PILLAR_COURSES } from "./arc-cohort-fixture";
import { safeFileSegment, cohortZipFilename } from "@/lib/ara/cohort-filenames";
import { aggregateCohortItems } from "@/lib/ara/company-cohort-detail";

const render = (detail = FIXTURE_DETAIL) =>
  buildArcCohortReportHtml({ detail, personalCourses: FIXTURE_PERSONAL_COURSES, pillarCourses: FIXTURE_PILLAR_COURSES, generatedAt: "19 October 2026" });

test("dashboard: both layers, every page, organizational level only", () => {
  const html = render();
  const pages = html.match(/<div class="page">/g)?.length ?? 0;
  assert.equal(pages, 12);
  assert.match(html, /Page 12 of 12/);
  for (const section of [
    "Executive summary", "Participation", "Organizational readiness by pillar", "Where the delegates agree",
    "Organizational strengths and gaps by question", "Workforce readiness by factor", "How the delegates are distributed",
    "Workforce strengths and gaps by question", "Development priorities", "About this report", "Glossary of terms",
  ]) assert.match(html, new RegExp(section), section);
  // The glossary defines the stage, level and band words the report uses.
  for (const term of ["Embedded \\(4.0 to 5.0\\)", "L2 Exploring \\(2.0 to 2.9\\)", "Early Stage \\(2.0 to 2.9\\)", "Consistent, Mixed, Divided", "Percentile"]) assert.match(html, new RegExp(term), term);
  // Pillars and factors are all present.
  for (const p of ["Strategy &amp; Vision", "Data Foundations", "Model Management &amp; Monitoring"]) assert.match(html, new RegExp(p));
  for (const f of ["AI Sense-Check", "AI Working Practice", "AI Collaboration", "AI Adaptive Mindset"]) assert.match(html, new RegExp(f));
  // Programs from both recommenders.
  assert.match(html, /AI-410/);
  assert.match(html, /AI-201/);
  // Divided pillars are named; the priority pillar is the lowest mean.
  assert.match(html, /Divided:<\/b> Data Foundations, Governance, Ethics &amp; Compliance/);
  assert.match(html, /Priority pillar<\/div><div class="v"[^>]*>Model Management &amp; Monitoring/);
  // No names, emails, or per-person rows.
  assert.doesNotMatch(html, /Delegate Secret|itqan\.example|Ahmad Trial|viftraining\.com/);
  // House style: American spelling, no scripts.
  assert.doesNotMatch(html, /\b(programme|organisation|behaviour|practising|colour)\b/i);
  assert.doesNotMatch(html, /<script/);
});

test("dashboard: personal-only cohort drops the organizational pages", () => {
  const html = render({ ...FIXTURE_DETAIL, org: null });
  assert.equal(html.match(/<div class="page">/g)?.length, 9);
  assert.doesNotMatch(html, /Organizational readiness by pillar/);
  assert.match(html, /Workforce readiness by factor/);
});

test("dashboard: no norms, no courses and no completions degrade gracefully", () => {
  const insight = { ...FIXTURE_DETAIL.insight, norms_ready: false, overall_percentile: null, norm_sample_size: 12 };
  const html = buildArcCohortReportHtml({ detail: { ...FIXTURE_DETAIL, insight, org: null, personal_items: { thinking_sense_check: [], results_working_practice: [], people_collaboration: [], self_adaptive_mindset: [] } }, personalCourses: [], pillarCourses: [], generatedAt: "19 October 2026" });
  assert.match(html, /published once 50 snapshots exist/);
  assert.match(html, /No gap wide enough to recommend a program/);
  assert.match(html, /Item-level detail appears once/);
});

test("item aggregation: cohort means per question and per delegate, pillar items only", () => {
  const questions = new Map([
    ["q1", { id: "q1", question_text_en: "Strategy item", pillar_id: "strategy", individual_factor_id: null, agentic_dimension_id: null, question_type: "rating" }],
    ["q2", { id: "q2", question_text_en: "Personal item stored under a pillar", pillar_id: "strategy", individual_factor_id: "thinking_sense_check", agentic_dimension_id: null, question_type: "rating" }],
  ]);
  const out = aggregateCohortItems(
    [
      { respondent_id: "a", question_id: "q1", question_score: 4 },
      { respondent_id: "b", question_id: "q1", question_score: "2.00" },
      { respondent_id: "a", question_id: "q2", question_score: 5 },
      { respondent_id: "c", question_id: "q1", question_score: null },
    ],
    questions,
    (q) => (q.pillar_id && !q.individual_factor_id ? q.pillar_id : null),
  );
  assert.equal(out.size, 1);
  const q1 = out.get("q1")!;
  assert.equal(q1.stats.mean, 3);
  assert.equal(q1.stats.n, 2);
  assert.equal(q1.stats.at_target, 1);
  assert.equal(q1.perRespondent.get("b"), 2);
});

test("file names are safe", () => {
  assert.equal(safeFileSegment("ITQAN / Riyadh  (HQ)"), "ITQAN_Riyadh_HQ");
  assert.equal(safeFileSegment("   "), "cohort");
  assert.equal(cohortReportFilename("ITQAN"), "VIFM_AI_Readiness_Cohort_Report_ITQAN.pdf");
  assert.equal(cohortZipFilename("ITQAN", "en"), "VIFM_AI_Readiness_Reports_ITQAN_en.zip");
});
