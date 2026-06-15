/**
 * Unit tests for the succession readiness engine.
 *
 * Written against node:test + node:assert (zero dependencies) so they run
 * with `node --test` (Node 18+; on a TS file, via the repo's TS test setup or
 * `node --experimental-strip-types --test`). Convert to vitest/jest if that is
 * the repo standard — the cases and expectations are the same.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeReadiness, DEFAULT_READINESS_CONFIG } from "./readiness";

const role = [
  { competencyId: "c1", name: "Sound Judgement", weight: 8, priority: "high" as const, target: 4 },
  { competencyId: "c2", name: "Outcome Ownership", weight: 7, priority: "high" as const, target: 4 },
  { competencyId: "c3", name: "Clear Communication", weight: 6, priority: "medium" as const, target: 4 },
  { competencyId: "c4", name: "Coaching & Growth", weight: 5, priority: "medium" as const, target: 4 },
  { competencyId: "c5", name: "Ethical Conduct", weight: 5, priority: "low" as const, target: 4 },
];

test("A: at or above the bar everywhere -> Ready Now, no knockout", () => {
  const r = computeReadiness(
    role,
    [
      { competencyId: "c1", othersMean: 4.2, selfMean: 4.0, othersCount: 5 },
      { competencyId: "c2", othersMean: 4.0, selfMean: 4.5, othersCount: 5 },
      { competencyId: "c3", othersMean: 4.3, selfMean: 4.0, othersCount: 5 },
      { competencyId: "c4", othersMean: 4.1, selfMean: 3.8, othersCount: 5 },
      { competencyId: "c5", othersMean: 4.0, selfMean: 4.0, othersCount: 5 },
    ],
    DEFAULT_READINESS_CONFIG,
  );
  assert.equal(r.tier, "ready_now");
  assert.equal(r.knockoutApplied, false);
});

test("B: small shortfall -> Ready Soon", () => {
  const r = computeReadiness(
    role,
    [
      { competencyId: "c1", othersMean: 3.7, selfMean: 4, othersCount: 5 },
      { competencyId: "c2", othersMean: 3.8, selfMean: 4, othersCount: 5 },
      { competencyId: "c3", othersMean: 3.6, selfMean: 4, othersCount: 5 },
      { competencyId: "c4", othersMean: 3.7, selfMean: 4, othersCount: 5 },
      { competencyId: "c5", othersMean: 3.9, selfMean: 4, othersCount: 5 },
    ],
    DEFAULT_READINESS_CONFIG,
  );
  assert.equal(r.tier, "ready_soon");
});

test("C: high-priority must-have far below caps the tier at Developing + blind spot", () => {
  const r = computeReadiness(
    role,
    [
      { competencyId: "c1", othersMean: 2.8, selfMean: 4.5, othersCount: 5 }, // 1.2 below, high prio
      { competencyId: "c2", othersMean: 4.5, selfMean: 4.5, othersCount: 5 },
      { competencyId: "c3", othersMean: 4.6, selfMean: 4.5, othersCount: 5 },
      { competencyId: "c4", othersMean: 4.5, selfMean: 4.5, othersCount: 5 },
      { competencyId: "c5", othersMean: 4.5, selfMean: 4.5, othersCount: 5 },
    ],
    DEFAULT_READINESS_CONFIG,
  );
  assert.equal(r.knockoutApplied, true);
  assert.equal(r.tier, "developing");
  assert.equal(r.competencies.find((c) => c.competencyId === "c1")?.selfFlag, "blind_spot");
});

test("D: coverage below floor -> Insufficient Data, no tier", () => {
  const r = computeReadiness(
    role,
    [
      { competencyId: "c1", othersMean: 4.2, selfMean: 4, othersCount: 5 },
      { competencyId: "c2", othersMean: 4.0, selfMean: 4, othersCount: 5 },
    ],
    DEFAULT_READINESS_CONFIG,
  );
  assert.equal(r.status, "insufficient_data");
  assert.equal(r.tier, null);
});

test("E: large gap -> Not Ready, year label maps when enabled", () => {
  const r = computeReadiness(
    role,
    [
      { competencyId: "c1", othersMean: 2.0, selfMean: 3, othersCount: 5 },
      { competencyId: "c2", othersMean: 2.2, selfMean: 3, othersCount: 5 },
      { competencyId: "c3", othersMean: 2.1, selfMean: 3, othersCount: 5 },
      { competencyId: "c4", othersMean: 2.3, selfMean: 3, othersCount: 5 },
      { competencyId: "c5", othersMean: 2.0, selfMean: 3, othersCount: 5 },
    ],
    { ...DEFAULT_READINESS_CONFIG, yearLayerEnabled: true },
  );
  assert.equal(r.tier, "not_ready");
  assert.ok(r.yearLabel && r.yearLabel.length > 0);
});
