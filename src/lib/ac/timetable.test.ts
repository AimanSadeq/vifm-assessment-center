/**
 * Unit tests for the timetable review (BPS 5.35).
 * Run: npx tsx --test src/lib/ac/timetable.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewTimetable, MAX_STRETCH_MINUTES } from "./timetable.ts";

const at = (h: number, m = 0) => `2026-06-15T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

const slot = (over: Partial<Parameters<typeof reviewTimetable>[0]["slots"][number]> & { id: string }) => ({
  kind: "exercise" as const,
  startsAt: at(9),
  endsAt: at(10),
  room: "Room 1",
  ...over,
});

const people = {
  participants: [{ id: "p1", name: "Abdullah" }, { id: "p2", name: "Noura" }],
  assessors: [{ id: "a1", name: "Sara" }, { id: "a2", name: "Khalid" }],
};

test("a clean timetable has nothing blocking", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", assessorName: "Sara" }),
      slot({ id: "s2", candidateId: "p2", candidateName: "Noura", assessorId: "a2", assessorName: "Khalid", room: "Room 2" }),
    ],
  });
  assert.deepEqual(r.blocking, []);
});

test("an assessor cannot watch two participants at once", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", assessorName: "Sara" }),
      slot({ id: "s2", candidateId: "p2", candidateName: "Noura", assessorId: "a1", assessorName: "Sara", room: "Room 2" }),
    ],
  });
  assert.equal(r.blocking.length, 1);
  assert.match(r.blocking[0].message, /Sara is booked twice/);
});

test("a participant cannot be in two exercises at once", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", assessorName: "Sara" }),
      slot({ id: "s2", candidateId: "p1", candidateName: "Abdullah", assessorId: "a2", assessorName: "Khalid", room: "Room 2" }),
    ],
  });
  assert.ok(r.blocking.some((p) => /Abdullah is booked twice/.test(p.message)));
});

test("a room cannot hold two things at once", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", assessorName: "Sara" }),
      slot({ id: "s2", candidateId: "p2", candidateName: "Noura", assessorId: "a2", assessorName: "Khalid" }),
    ],
  });
  assert.ok(r.blocking.some((p) => /Room 1 is double-booked/.test(p.message)));
});

test("touching slots do not overlap", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", startsAt: at(9), endsAt: at(10) }),
      slot({ id: "s2", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", startsAt: at(10), endsAt: at(11) }),
    ],
  });
  assert.deepEqual(r.blocking, []);
});

test("a long stretch with no break is a caution, naming the threshold as practice", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", startsAt: at(9), endsAt: at(11) }),
      slot({ id: "s2", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", startsAt: at(11), endsAt: at(14) }),
    ],
  });
  const stretch = r.problems.find((p) => /with no break scheduled/.test(p.message));
  assert.ok(stretch);
  assert.equal(stretch!.severity, "caution");
  assert.match(stretch!.message, /not the clause/);
});

test("a scheduled break resets the stretch", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", startsAt: at(9), endsAt: at(11) }),
      slot({ id: "b1", kind: "break", startsAt: at(11), endsAt: at(11, 20), room: "Atrium" }),
      slot({ id: "s2", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1", startsAt: at(11, 20), endsAt: at(13) }),
    ],
  });
  assert.equal(r.problems.some((p) => /with no break scheduled/.test(p.message)), false);
  assert.ok(MAX_STRETCH_MINUTES > 0);
});

test("an exercise with no assessor and a slot with no room are cautions", () => {
  const r = reviewTimetable({
    ...people,
    slots: [slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", exerciseName: "In-basket", room: null })],
  });
  assert.ok(r.problems.some((p) => /has no assessor scheduled/.test(p.message)));
  assert.ok(r.problems.some((p) => /has no room/.test(p.message)));
  assert.deepEqual(r.blocking, [], "neither stops the centre running");
});

test("exercises in the design with nothing scheduled are reported", () => {
  const r = reviewTimetable({
    ...people,
    slots: [slot({ id: "s1", exerciseId: "e1", candidateId: "p1", assessorId: "a1" })],
    designExercises: [
      { id: "e1", name: "In-basket" },
      { id: "e2", name: "Presentation" },
    ],
  });
  assert.deepEqual(r.unscheduledExercises.map((x) => x.name), ["Presentation"]);
});

test("individual timetables include cohort-wide slots but not other people's exercises", () => {
  const r = reviewTimetable({
    ...people,
    slots: [
      slot({ id: "b1", kind: "briefing", startsAt: at(8, 30), endsAt: at(9) }),
      slot({ id: "s1", candidateId: "p1", candidateName: "Abdullah", assessorId: "a1" }),
      slot({ id: "s2", candidateId: "p2", candidateName: "Noura", assessorId: "a2", room: "Room 2" }),
    ],
  });
  const abdullah = r.individual.find((i) => i.personId === "p1");
  assert.deepEqual(abdullah?.slots.map((s) => s.id), ["b1", "s1"]);
  const sara = r.individual.find((i) => i.personId === "a1");
  assert.ok(sara?.slots.some((s) => s.id === "s1"));
  assert.equal(sara?.slots.some((s) => s.id === "s2"), false);
});
