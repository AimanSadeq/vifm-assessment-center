/**
 * Unit tests for the AC fairness view (BPS 3.19, 4.22, 9.9).
 * Run: npx tsx --test src/lib/ac/fairness.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeAcFairness } from "./fairness.ts";

const p = (
  gender: string | null,
  recommendation: string | null,
  extra: Partial<{ age_band: string; nationality_group: string }> = {}
) => ({ gender, recommendation, ...extra });

test("a development centre is refused the analysis, with the reason given", () => {
  const v = computeAcFairness([p("male", "ready_now")], { purpose: "development" });
  assert.equal(v.report, null);
  assert.match(v.reason ?? "", /no one is selected/);
});

test("no finalised ratings means nothing to analyse", () => {
  const v = computeAcFairness([p("male", null), p("female", null)], { purpose: "selection" });
  assert.equal(v.report, null);
  assert.match(v.reason ?? "", /finalised overall rating/);
});

test("everyone declining is a legitimate outcome, not an error", () => {
  const v = computeAcFairness(
    [p("prefer_not_to_say", "ready_now"), p(null, "not_ready")],
    { purpose: "selection" }
  );
  assert.equal(v.report, null);
  assert.match(v.reason ?? "", /voluntary/);
});

test("a clean split produces no adverse impact flag", () => {
  const rows = [
    ...Array.from({ length: 10 }, () => p("male", "ready_now")),
    ...Array.from({ length: 10 }, () => p("female", "ready_now")),
    ...Array.from({ length: 10 }, () => p("male", "not_ready")),
    ...Array.from({ length: 10 }, () => p("female", "not_ready")),
  ];
  const v = computeAcFairness(rows, { purpose: "selection" });
  const gender = v.report?.dimensions.find((d) => d.dimension === "gender");
  assert.equal(gender?.anyAdverseImpact, false);
});

test("a real disparity is flagged", () => {
  const rows = [
    ...Array.from({ length: 18 }, () => p("male", "ready_now")),
    ...Array.from({ length: 2 }, () => p("male", "not_ready")),
    ...Array.from({ length: 4 }, () => p("female", "ready_now")),
    ...Array.from({ length: 16 }, () => p("female", "not_ready")),
  ];
  const v = computeAcFairness(rows, { purpose: "selection" });
  const gender = v.report?.dimensions.find((d) => d.dimension === "gender");
  assert.equal(gender?.anyAdverseImpact, true);
  const female = gender?.groups.find((g) => g.group === "female");
  // 0.20 / 0.90 = 0.22, far below the 0.8 threshold.
  assert.ok((female?.impactRatio ?? 1) < 0.8);
});

test("the favourable-outcome reading changes the answer, which is why it is a choice", () => {
  // Women are rated Ready with Development; men Ready Now. On the strict
  // reading that is a disparity; on the shortlist reading it is not.
  const rows = [
    ...Array.from({ length: 15 }, () => p("male", "ready_now")),
    ...Array.from({ length: 15 }, () => p("female", "ready_with_development")),
  ];
  const strict = computeAcFairness(rows, { purpose: "selection", favourable: "ready_now" });
  const wide = computeAcFairness(rows, { purpose: "selection", favourable: "ready_now_or_development" });
  assert.equal(strict.report?.dimensions.find((d) => d.dimension === "gender")?.anyAdverseImpact, true);
  assert.equal(wide.report?.dimensions.find((d) => d.dimension === "gender")?.anyAdverseImpact, false);
});

test("undisclosed participants are excluded, never imputed", () => {
  const rows = [
    ...Array.from({ length: 10 }, () => p("male", "ready_now")),
    ...Array.from({ length: 10 }, () => p("female", "not_ready")),
    ...Array.from({ length: 10 }, () => p("prefer_not_to_say", "ready_now")),
  ];
  const v = computeAcFairness(rows, { purpose: "selection" });
  const gender = v.report?.dimensions.find((d) => d.dimension === "gender");
  assert.equal(gender?.notDisclosed, 10);
  const total = (gender?.groups ?? []).reduce((sum, g) => sum + g.n, 0);
  assert.equal(total, 20, "the undisclosed ten are in no group");
});

test("a small centre is reported as underpowered rather than precise", () => {
  const rows = [p("male", "ready_now"), p("female", "not_ready")];
  const v = computeAcFairness(rows, { purpose: "selection" });
  assert.equal(v.report?.dimensions.every((d) => d.underpowered || d.groups.length === 0), true);
});

test("counts describe the centre, not just the pool", () => {
  const rows = [p("male", "ready_now"), p("female", null), p("prefer_not_to_say", "not_ready")];
  const v = computeAcFairness(rows, { purpose: "selection" });
  assert.equal(v.participants, 3);
  assert.equal(v.rated, 2);
  assert.equal(v.disclosed, 2, "prefer_not_to_say is not a disclosure");
});
