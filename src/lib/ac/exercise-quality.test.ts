/**
 * Unit tests for exercise quality checks (BPS 4.36, 4.37).
 * Run: npx tsx --test src/lib/ac/exercise-quality.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewExerciseQuality, EXERCISE_CHECKS } from "./exercise-quality.ts";

const allPass = EXERCISE_CHECKS.map((c) => ({
  checkKey: c.key,
  status: "pass" as const,
  note: "Checked against the role profile.",
}));

test("an unchecked exercise names every missing check", () => {
  const r = reviewExerciseQuality({ exerciseName: "In-basket", checks: [], trials: [], usedLive: true });
  assert.equal(r.unchecked.length, EXERCISE_CHECKS.length);
  assert.equal(r.complete, false);
  assert.match(r.problems[0], /8 of 8 checks have not been made/);
});

test("a fully checked exercise that has run live is complete", () => {
  const r = reviewExerciseQuality({ exerciseName: "In-basket", checks: allPass, trials: [], usedLive: true });
  assert.deepEqual(r.problems, []);
  assert.equal(r.complete, true);
});

test("a concern keeps it incomplete and repeats the note", () => {
  const checks = allPass.map((c) =>
    c.checkKey === "timings" ? { ...c, status: "concern" as const, note: "45 minutes is too tight" } : c
  );
  const r = reviewExerciseQuality({ exerciseName: "In-basket", checks, trials: [], usedLive: true });
  assert.equal(r.complete, false);
  assert.equal(r.concerns.length, 1);
  assert.match(r.problems[0], /45 minutes is too tight/);
});

test("not_applicable is an answer, not a gap", () => {
  const checks = allPass.map((c) =>
    c.checkKey === "materials" ? { ...c, status: "not_applicable" as const } : c
  );
  const r = reviewExerciseQuality({ exerciseName: "Interview", checks, trials: [], usedLive: true });
  assert.equal(r.unchecked.length, 0);
  assert.equal(r.complete, true);
});

test("a new exercise with no trial is flagged (4.37)", () => {
  const r = reviewExerciseQuality({ exerciseName: "New case", checks: allPass, trials: [], usedLive: false });
  assert.equal(r.needsTrial, true);
  assert.match(r.problems[0], /representative of the intended participants/);
});

test("a trial clears it, and a pilot is reported separately (4.38)", () => {
  const r = reviewExerciseQuality({
    exerciseName: "New case",
    checks: allPass,
    trials: [{ trialledOn: "2026-05-01", participantCount: 6, representativeNote: "Six senior managers from another division", wasPilot: false }],
    usedLive: false,
  });
  assert.equal(r.needsTrial, false);
  assert.equal(r.trials, 1);
  assert.equal(r.piloted, false);
  assert.equal(r.complete, true);

  const piloted = reviewExerciseQuality({
    exerciseName: "New case",
    checks: allPass,
    trials: [{ trialledOn: "2026-05-01", wasPilot: true }],
    usedLive: false,
  });
  assert.equal(piloted.piloted, true);
});

test("an exercise already used live is not asked to be trialled retrospectively", () => {
  const r = reviewExerciseQuality({ exerciseName: "Old favourite", checks: allPass, trials: [], usedLive: true });
  assert.equal(r.needsTrial, false);
});

test("every check carries a question, not just a label", () => {
  for (const c of EXERCISE_CHECKS) {
    assert.ok(c.question.length > 30, `${c.key} needs a real question`);
    assert.ok(c.clause.startsWith("4."));
  }
});

test("the evidence-sufficiency check is present - the one most often skipped", () => {
  assert.ok(EXERCISE_CHECKS.some((c) => c.key === "evidence_sufficiency"));
});
