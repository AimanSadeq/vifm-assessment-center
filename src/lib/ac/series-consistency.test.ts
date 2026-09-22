/**
 * Unit tests for series consistency (BPS 5.19, 9.13).
 * Run: npx tsx --test src/lib/ac/series-consistency.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewSeriesConsistency } from "./series-consistency.ts";

const centre = (over: Partial<Parameters<typeof reviewSeriesConsistency>[0][number]> & { engagementId: string; name: string }) => ({
  startDate: "2026-06-15",
  purpose: "selection",
  integrationMethod: "weighted_average",
  otherMethodsRule: "context_only",
  externalEvidenceRule: "not_permitted",
  competencies: [
    { id: "c1", name: "Strategy", weight: 2 },
    { id: "c2", name: "Judgement", weight: 1.5 },
  ],
  exerciseIds: ["e1", "e2"],
  exerciseNames: ["In-basket", "Presentation"],
  hasReview: true,
  ...over,
});

test("one centre is not a series", () => {
  const r = reviewSeriesConsistency([centre({ engagementId: "a", name: "March" })]);
  assert.match(r.summary, /at least two centres/);
  assert.deepEqual(r.differences, []);
});

test("identical centres report no differences", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "a", name: "March" }),
    centre({ engagementId: "b", name: "June", startDate: "2026-06-20" }),
  ]);
  assert.deepEqual(r.differences, []);
  assert.match(r.summary, /run to the same design/);
});

test("a changed weight is a difference, reported per centre", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "a", name: "March" }),
    centre({
      engagementId: "b",
      name: "June",
      startDate: "2026-06-20",
      competencies: [
        { id: "c1", name: "Strategy", weight: 3 },
        { id: "c2", name: "Judgement", weight: 1.5 },
      ],
    }),
  ]);
  const diff = r.differences.find((d) => d.field === "competencies");
  assert.ok(diff);
  assert.equal(diff!.values.length, 2);
  assert.match(diff!.values[0].value, /Strategy 2/);
  assert.match(diff!.values[1].value, /Strategy 3/);
});

test("a dropped exercise is a difference", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "a", name: "March" }),
    centre({ engagementId: "b", name: "June", startDate: "2026-06-20", exerciseNames: ["In-basket"] }),
  ]);
  assert.ok(r.differences.some((d) => d.field === "exercises"));
});

test("a changed integration method is caught - the one that changes the score", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "a", name: "March" }),
    centre({ engagementId: "b", name: "June", startDate: "2026-06-20", integrationMethod: "consensus" }),
  ]);
  const diff = r.differences.find((d) => d.field === "integration_method");
  assert.ok(diff);
  assert.equal(diff!.clause, "7.4");
});

test("competency order does not count as a difference", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "a", name: "March" }),
    centre({
      engagementId: "b",
      name: "June",
      startDate: "2026-06-20",
      competencies: [
        { id: "c2", name: "Judgement", weight: 1.5 },
        { id: "c1", name: "Strategy", weight: 2 },
      ],
    }),
  ]);
  assert.equal(r.differences.some((d) => d.field === "competencies"), false);
});

test("the summary refuses to call a difference a fault", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "a", name: "March" }),
    centre({ engagementId: "b", name: "June", startDate: "2026-06-20", purpose: "development" }),
  ]);
  assert.match(r.summary, /not automatically a fault/);
  assert.match(r.summary, /9\.13/);
});

test("centres with no post-centre review are named, because a change there has no recorded reason", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "a", name: "March", hasReview: false }),
    centre({ engagementId: "b", name: "June", startDate: "2026-06-20" }),
  ]);
  assert.deepEqual(r.withoutReview.map((x) => x.name), ["March"]);
});

test("centres are compared in date order, so the story reads forwards", () => {
  const r = reviewSeriesConsistency([
    centre({ engagementId: "b", name: "June", startDate: "2026-06-20", purpose: "development" }),
    centre({ engagementId: "a", name: "March", startDate: "2026-03-01" }),
  ]);
  const diff = r.differences.find((d) => d.field === "purpose");
  assert.deepEqual(diff!.values.map((v) => v.name), ["March", "June"]);
});
