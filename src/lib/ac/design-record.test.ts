/**
 * Unit tests for the design record review (BPS section 4).
 * Run: npx tsx --test src/lib/ac/design-record.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewDesignRecord, MAX_COMPETENCIES_PER_EXERCISE } from "./design-record.ts";

const comp = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  competencyId: id,
  name,
  rationale: "Derived from the JD requirement for " + name,
  indicatorCount: 6,
  ...extra,
});
// A role play needs a briefed role-player to count as a complete design, so
// the fixture gives one - otherwise "complete" would be a design nobody can run.
const ex = (id: string, name: string, type: string) => ({
  id,
  name,
  exerciseType: type,
  durationMinutes: 60,
  rolePlayerPromptCount: type === "role_play" ? 3 : 0,
});

const FULL_ENGAGEMENT = {
  design_rationale: "Two-day centre matching the role's split between analysis and stakeholder work.",
  alternatives_considered: "A one-day centre was rejected as too thin for six criteria.",
  job_analysis_method: "role_profile",
  work_context: "Corporate banking, matrixed, heavy regulator contact.",
  sme_review_note: "Reviewed by two current Senior Managers.",
  exercise_independence_note: "No exercise reuses another's material or outputs.",
  facilities_note: "Three rooms, one for the role play, plus a private debrief room.",
};

const baseline = {
  engagement: FULL_ENGAGEMENT,
  competencies: [comp("c1", "Strategy"), comp("c2", "Judgement")],
  exercises: [ex("e1", "In-basket", "in_basket"), ex("e2", "Role play", "role_play")],
  matrix: [
    { exerciseId: "e1", competencyId: "c1" },
    { exerciseId: "e2", competencyId: "c1" },
    { exerciseId: "e1", competencyId: "c2" },
    { exerciseId: "e2", competencyId: "c2" },
  ],
};

test("a complete design has nothing missing and nothing to flag", () => {
  const r = reviewDesignRecord(baseline);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.cautions, []);
});

test("every unwritten design field is listed with its clause", () => {
  const r = reviewDesignRecord({ ...baseline, engagement: {} });
  assert.equal(r.missing.length, 7);
  assert.ok(r.missing.every((m) => m.clause.length > 0));
  assert.ok(r.missing.some((m) => m.field === "exercise_independence_note"));
});

test("an overloaded exercise is flagged, and says the number is practice not clause", () => {
  const many = Array.from({ length: MAX_COMPETENCIES_PER_EXERCISE + 1 }, (_, i) => comp(`c${i}`, `Comp ${i}`));
  const r = reviewDesignRecord({
    ...baseline,
    competencies: many,
    exercises: [ex("e1", "In-basket", "in_basket"), ex("e2", "Role play", "role_play")],
    matrix: many.flatMap((c) => [
      { exerciseId: "e1", competencyId: c.competencyId },
      { exerciseId: "e2", competencyId: c.competencyId },
    ]),
  });
  assert.equal(r.exerciseLoad.find((x) => x.id === "e1")?.overloaded, true);
  assert.ok(r.cautions.some((c) => /practice, not the clause/.test(c)));
});

test("a criterion observed once has nothing converging on it", () => {
  const r = reviewDesignRecord({
    ...baseline,
    matrix: [
      { exerciseId: "e1", competencyId: "c1" },
      { exerciseId: "e2", competencyId: "c1" },
      { exerciseId: "e1", competencyId: "c2" },
    ],
  });
  assert.equal(r.thinlyObserved.length, 1);
  assert.ok(r.cautions.some((c) => /only one exercise/.test(c)));
});

test("a criterion with no indicators is flagged (4.20)", () => {
  const r = reviewDesignRecord({
    ...baseline,
    competencies: [comp("c1", "Strategy"), comp("c2", "Judgement", { indicatorCount: 0 })],
  });
  assert.deepEqual(r.withoutIndicators.map((c) => c.name), ["Judgement"]);
});

test("a criterion with no link to the job is flagged (4.4)", () => {
  const r = reviewDesignRecord({
    ...baseline,
    competencies: [comp("c1", "Strategy"), comp("c2", "Judgement", { rationale: "  " })],
  });
  assert.deepEqual(r.withoutRationale.map((c) => c.name), ["Judgement"]);
  assert.ok(r.cautions.some((c) => /no recorded link to the job/.test(c)));
});

test("output modes come from the exercise types, and a single mode is flagged", () => {
  const r = reviewDesignRecord(baseline);
  assert.deepEqual(r.outputModes.sort(), ["spoken, one to one", "written"]);

  const oneMode = reviewDesignRecord({
    ...baseline,
    exercises: [ex("e1", "In-basket", "in_basket"), ex("e2", "Case study", "case_study")],
  });
  assert.ok(oneMode.cautions.some((c) => /same kind of output/.test(c)));
});

test("too many criteria is a caution until someone records why", () => {
  const many = Array.from({ length: 9 }, (_, i) => comp(`c${i}`, `Comp ${i}`));
  const matrix = many.flatMap((c) => [
    { exerciseId: "e1", competencyId: c.competencyId },
    { exerciseId: "e2", competencyId: c.competencyId },
  ]);
  const flagged = reviewDesignRecord({ ...baseline, competencies: many, matrix });
  assert.ok(flagged.cautions.some((c) => /This centre assesses 9 criteria/.test(c)));

  const acked = reviewDesignRecord({
    ...baseline,
    engagement: { ...FULL_ENGAGEMENT, criteria_load_ack: "The client's framework is fixed at nine." },
    competencies: many,
    matrix,
  });
  assert.equal(acked.cautions.some((c) => /This centre assesses 9 criteria/.test(c)), false);
});

test("approval is reported from the plan sign-off", () => {
  assert.equal(reviewDesignRecord(baseline).approved, false);
  assert.equal(
    reviewDesignRecord({
      ...baseline,
      engagement: { ...FULL_ENGAGEMENT, plan_approved_at: "2026-09-22T00:00:00Z" },
    }).approved,
    true
  );
});

test("a role play with no role-player brief is flagged at design time", () => {
  const r = reviewDesignRecord({
    ...baseline,
    exercises: [
      { id: "e1", name: "In-basket", exerciseType: "in_basket", durationMinutes: 60 },
      { id: "e2", name: "Role play", exerciseType: "role_play", durationMinutes: 30, rolePlayerPromptCount: 0 },
    ],
  });
  assert.ok(r.cautions.some((c) => /no role-player brief written/.test(c)));
});

test("a briefed role play is not flagged", () => {
  const r = reviewDesignRecord({
    ...baseline,
    exercises: [
      { id: "e1", name: "In-basket", exerciseType: "in_basket", durationMinutes: 60 },
      { id: "e2", name: "Role play", exerciseType: "role_play", durationMinutes: 30, rolePlayerPromptCount: 4 },
    ],
  });
  assert.equal(r.cautions.some((c) => /role-player brief/.test(c)), false);
});
