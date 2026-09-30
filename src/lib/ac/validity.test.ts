/**
 * Unit tests for the validity evidence module (BPS 3.20, 4.6, 9.6-9.10).
 * Run: npx tsx --test src/lib/ac/validity.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  criterionValidity,
  criteriaOverlap,
  evaluationCalendar,
  followupDueDates,
  pearson,
  summariseFollowups,
} from "./validity.ts";

test("follow-ups fall due six and twelve months after the centre, clamped to month end", () => {
  assert.deepEqual(followupDueDates("2026-06-17"), [
    { wave: "6m", dueOn: "2026-12-17" },
    { wave: "12m", dueOn: "2027-06-17" },
  ]);
  assert.equal(followupDueDates("2026-08-31")[0].dueOn, "2027-02-28");
});

test("pearson handles perfect, inverse and degenerate cases", () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  assert.equal(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1);
  assert.equal(pearson([3, 3, 3], [1, 2, 3]), null);
  assert.equal(pearson([1, 2], [1, 2]), null);
});

test("criterion validity states power honestly at every sample size", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ centreScore: 1 + (i % 5), performance: 1 + ((i + (i % 3 === 0 ? 1 : 0)) % 5) }));
  assert.equal(criterionValidity({ pairs: [], inRole: 0 }).power, "none");
  const five = criterionValidity({ pairs: mk(5), inRole: 5 });
  assert.equal(five.power, "too_small");
  assert.equal(five.r, null);
  const twelve = criterionValidity({ pairs: mk(12), inRole: 12 });
  assert.equal(twelve.power, "too_small");
  assert.notEqual(twelve.r, null);
  assert.match(twelve.statement, /early indication only/);
  assert.equal(criterionValidity({ pairs: mk(40), inRole: 40 }).power, "early");
  const big = criterionValidity({ pairs: mk(120), inRole: 120 });
  assert.equal(big.power, "adequate");
  assert.match(big.statement, /reasonable power/);
});

test("criteria overlap flags pairs above 0.7 and ignores thin pairs", () => {
  const ratings: { candidateId: string; competencyId: string; score: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const base = 1 + (i % 5);
    ratings.push({ candidateId: `c${i}`, competencyId: "A", score: base });
    ratings.push({ candidateId: `c${i}`, competencyId: "B", score: base });           // identical to A
    ratings.push({ candidateId: `c${i}`, competencyId: "C", score: 1 + ((i * 7) % 5) }); // unrelated
  }
  for (let i = 0; i < 4; i++) ratings.push({ candidateId: `c${i}`, competencyId: "D", score: 3 }); // too few
  const out = criteriaOverlap(ratings, { A: "Analysis", B: "Judgement", C: "Communication" });
  const ab = out.find((p) => p.a === "Analysis" && p.b === "Judgement");
  assert.equal(ab?.merge, true);
  assert.equal(ab?.n, 12);
  assert.ok(out.every((p) => p.a !== "D" && p.b !== "D"));
});

test("follow-up summary separates due, overdue, collected and not available", () => {
  const s = summariseFollowups([
    { status: "due", due_on: "2026-12-01" },
    { status: "due", due_on: "2026-01-01" },
    { status: "collected", due_on: "2026-01-01", in_role: true },
    { status: "not_available", due_on: "2026-01-01", in_role: false },
  ], "2026-09-30");
  assert.deepEqual(s, { total: 4, due: 1, overdue: 1, collected: 1, notAvailable: 1, inRole: 1 });
});

test("the evaluation calendar runs annually from the last evaluation, or from the first centre", () => {
  const fresh = evaluationCalendar({ firstCentreOn: "2025-06-01", lastEvaluationOn: null, lastMajorOn: null, today: "2026-09-30" });
  assert.equal(fresh.annualDueOn, "2026-06-01");
  assert.equal(fresh.annualOverdue, true);
  assert.equal(fresh.majorDueOn, "2028-06-01");
  const done = evaluationCalendar({ firstCentreOn: "2025-06-01", lastEvaluationOn: "2026-07-01", lastMajorOn: null, today: "2026-09-30" });
  assert.equal(done.annualDueOn, "2027-07-01");
  assert.equal(done.annualOverdue, false);
  assert.equal(evaluationCalendar({ firstCentreOn: null, lastEvaluationOn: null, lastMajorOn: null, today: "2026-09-30" }).annualDueOn, null);
});
