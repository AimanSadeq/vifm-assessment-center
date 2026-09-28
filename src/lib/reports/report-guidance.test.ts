/**
 * Unit tests for the decision makers' guidance note (BPS 8.4).
 * Run: npx tsx --test src/lib/reports/report-guidance.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildAgreementPrefill } from "./centre-agreement-prefill.ts";
import { guidanceSections, buildReportGuidanceHtml } from "./report-guidance.ts";

const prefill = (engagement: Record<string, unknown>) =>
  buildAgreementPrefill({
    engagement: { name: "Senior Manager AC", target_role: "Senior Manager", ...engagement },
    organisationName: "Najm Capital",
    competencies: [{ name: "Strategic Thinking", weight: 2 }],
    exercises: [],
    roles: [],
    participantCount: 4,
    contentApproved: { approved: 0, total: 120 },
    generatedAt: "28 September 2026",
  });

const text = (engagement: Record<string, unknown>) =>
  JSON.stringify(guidanceSections(prefill(engagement)));

test("a development centre warns against selection, promotion or redundancy use", () => {
  assert.match(text({ purpose: "development" }), /Do not use these results for selection, promotion or redundancy/);
  assert.doesNotMatch(text({ purpose: "selection" }), /Do not use these results/);
});

test("with no purpose recorded the note says so rather than guessing", () => {
  assert.match(text({}), /purpose of this centre has not been recorded/);
});

test("a calculated centre explains the rule and lists the weights", () => {
  const t = text({ purpose: "selection" });
  assert.match(t, /overall rating was calculated/);
  assert.match(t, /Strategic Thinking/);
  assert.doesNotMatch(text({ purpose: "development" }), /overall rating was calculated/);
});

test("scale and recommendation wording come from the shared constants", () => {
  const t = text({ purpose: "selection" });
  for (const w of ["Significant Development Needed", "Competent", "Significant Strength", "Ready Now", "Ready with Development", "Not Ready"]) {
    assert.ok(t.includes(w), w);
  }
});

test("fairness monitoring is mentioned only where it applies", () => {
  assert.match(text({ purpose: "succession" }), /unfair effects/);
  assert.doesNotMatch(text({ purpose: "development" }), /unfair effects/);
});

test("the house appeal window, retention and content status are stated", () => {
  const t = text({ purpose: "selection", retention_months: 24 });
  assert.match(t, /within 21 days/);
  assert.match(t, /kept for 24 months/);
  assert.match(t, /0 of 120/);
});

test("the HTML escapes values from the engagement", () => {
  const html = buildReportGuidanceHtml(prefill({ purpose: "selection", name: "<script>x</script>" }), "28 September 2026");
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /&lt;script&gt;x/);
});
