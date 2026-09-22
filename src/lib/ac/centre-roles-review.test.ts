/**
 * Unit tests for the centre-roles review (BPS 5.16, 5.17, 5.22, 6.2).
 *
 * node:test + node:assert, matching src/lib/scoring/readiness.test.ts.
 * Run: npx tsx --test src/lib/ac/centre-roles-review.test.ts
 * (tsx rather than node --experimental-strip-types, which cannot resolve the
 * extensionless relative import inside the module under test.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewCentreRoles, competenceIsCurrent } from "./centre-roles-review.ts";

const person = (id: string, name: string) => ({ profile_id: id, profiles: { full_name: name } });
const assign = (roleKey: string, id: string, name: string, external = false) => ({
  role_key: roleKey,
  is_external: external,
  ...person(id, name),
});
const competent = (id: string, roleKey: string, expires_on: string | null = null) => ({
  profile_id: id,
  role_key: roleKey,
  status: "competent",
  expires_on,
});

const FULL_SELECTION = {
  purpose: "selection",
  assignments: [
    assign("centre_manager", "p1", "Sara"),
    assign("centre_administrator", "p2", "Khalid"),
    assign("assessor", "p3", "Mariam"),
  ],
  competence: [competent("p1", "centre_manager"), competent("p2", "centre_administrator"), competent("p3", "assessor")],
};

test("a fully staffed, fully certified selection centre has nothing blocking", () => {
  const r = reviewCentreRoles(FULL_SELECTION);
  assert.deepEqual(r.blocking, []);
  assert.equal(r.unfilled.length, 0);
  assert.equal(r.uncertified.length, 0);
});

test("no centre manager blocks (5.16)", () => {
  const r = reviewCentreRoles({
    ...FULL_SELECTION,
    assignments: FULL_SELECTION.assignments.filter((a) => a.role_key !== "centre_manager"),
  });
  assert.equal(r.unfilled.some((x) => x.key === "centre_manager"), true);
  assert.equal(r.blocking.some((b) => /Centre Manager/.test(b)), true);
});

test("no centre administrator blocks (5.16)", () => {
  const r = reviewCentreRoles({
    ...FULL_SELECTION,
    assignments: FULL_SELECTION.assignments.filter((a) => a.role_key !== "centre_administrator"),
  });
  assert.equal(r.blocking.some((b) => /Centre Administrator/.test(b)), true);
});

test("a person in a role with no competence record blocks (5.22, 6.2)", () => {
  const r = reviewCentreRoles({ ...FULL_SELECTION, competence: [] });
  assert.equal(r.uncertified.length, 3);
  assert.equal(r.blocking.some((b) => /no competence record/.test(b)), true);
});

test("in-training is not competent", () => {
  const r = reviewCentreRoles({
    ...FULL_SELECTION,
    competence: [
      { profile_id: "p1", role_key: "centre_manager", status: "in_training", expires_on: null },
      competent("p2", "centre_administrator"),
      competent("p3", "assessor"),
    ],
  });
  assert.equal(r.uncertified.some((u) => /in training/.test(u.reason)), true);
});

test("lapsed competence blocks, and a future expiry does not", () => {
  const lapsed = reviewCentreRoles({
    ...FULL_SELECTION,
    competence: [
      competent("p1", "centre_manager", "2020-01-01"),
      competent("p2", "centre_administrator"),
      competent("p3", "assessor"),
    ],
  });
  assert.equal(lapsed.uncertified.some((u) => /lapsed/.test(u.reason)), true);

  const current = reviewCentreRoles({
    ...FULL_SELECTION,
    competence: [
      competent("p1", "centre_manager", "2999-01-01"),
      competent("p2", "centre_administrator"),
      competent("p3", "assessor"),
    ],
  });
  assert.deepEqual(current.blocking, []);
});

test("psychometric tests require a Test User (5.17)", () => {
  const r = reviewCentreRoles({ ...FULL_SELECTION, usesPsychometrics: true });
  assert.equal(r.required.some((x) => x.key === "psychometric_test_user"), true);
  assert.equal(r.blocking.some((b) => /Psychometric Test User/.test(b)), true);
});

test("a role-play requires a role-player", () => {
  const r = reviewCentreRoles({ ...FULL_SELECTION, usesRolePlay: true });
  assert.equal(r.blocking.some((b) => /Role-player/.test(b)), true);
});

test("a development centre needs feedback roles, a selection centre does not (4.43)", () => {
  const dev = reviewCentreRoles({ ...FULL_SELECTION, purpose: "development" });
  assert.equal(dev.required.some((x) => x.key === "feedback_generator"), true);
  assert.equal(dev.required.some((x) => x.key === "feedback_meeting_chair"), true);

  const sel = reviewCentreRoles(FULL_SELECTION);
  assert.equal(sel.required.some((x) => x.key === "feedback_generator"), false);
});

test("the designer is recorded but never blocks the day", () => {
  const r = reviewCentreRoles(FULL_SELECTION);
  assert.equal(r.required.some((x) => x.key === "centre_designer"), false);
});

test("holding three roles is a caution, not a block", () => {
  const r = reviewCentreRoles({
    purpose: "selection",
    assignments: [
      assign("centre_manager", "p1", "Sara"),
      assign("centre_administrator", "p1", "Sara"),
      assign("assessor", "p1", "Sara"),
    ],
    competence: [
      competent("p1", "centre_manager"),
      competent("p1", "centre_administrator"),
      competent("p1", "assessor"),
    ],
  });
  assert.deepEqual(r.blocking, []);
  assert.equal(r.cautions.some((c) => /holds 3 roles/.test(c)), true);
});

test("external staff raise a caution about our responsibility for them (3.12)", () => {
  const r = reviewCentreRoles({
    ...FULL_SELECTION,
    assignments: [...FULL_SELECTION.assignments, assign("assessor", "p9", "Client Manager", true)],
    competence: [...FULL_SELECTION.competence, competent("p9", "assessor")],
  });
  assert.equal(r.cautions.some((c) => /outside VIFM/.test(c)), true);
});

test("competenceIsCurrent handles the boundary and the missing record", () => {
  assert.equal(competenceIsCurrent(undefined), false);
  const today = new Date(Date.UTC(2026, 8, 22));
  assert.equal(
    competenceIsCurrent({ profile_id: "p", role_key: "assessor", status: "competent", expires_on: "2026-09-22" }, today),
    true,
    "a record expiring today is still valid today"
  );
  assert.equal(
    competenceIsCurrent({ profile_id: "p", role_key: "assessor", status: "competent", expires_on: "2026-09-21" }, today),
    false
  );
});
