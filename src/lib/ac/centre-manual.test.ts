/**
 * Unit tests for the centre manual (BPS 4.39, 4.40, 5.25, 5.33).
 * Run: npx tsx --test src/lib/ac/centre-manual.test.ts
 *
 * The audience rules are the part worth testing hardest: a role-player brief
 * reaching an assessor, or an exercise brief reaching anyone before the day,
 * costs the exercise its value permanently.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildCentreManual, sectionsFor, isConfidential } from "./centre-manual.ts";

const input = {
  engagement: {
    target_role: "Senior Manager",
    purpose: "selection",
    integration_method: "weighted_average",
    other_methods_rule: "context_only",
    external_evidence_rule: "not_permitted",
    pack_purpose_statement: "Promotion into the senior manager population.",
    participant_contact_name: "Engagement Lead",
    retention_months: 24,
    manual_version: 3,
  },
  organisationName: "Najm Capital",
  exercises: [
    {
      name: "Leadership Role Play",
      exerciseType: "role_play",
      durationMinutes: 30,
      meetingMinutes: 20,
      participantBrief: "You are meeting a direct report about missed deadlines.",
      assessorNotes: "Probe whether they separate the behaviour from the person.",
      rolePlayerPrompts: [
        { prompt: "Open defensively; do not volunteer that the deadline was missed.", triggerBehaviours: "Opening question" },
        { prompt: "Soften once the participant acknowledges your workload.", triggerBehaviours: "If they listen before advising" },
      ],
      competencies: ["Coaching & Talent Growth"],
    },
  ],
  roles: [
    { roleKey: "centre_manager", name: "Sara", isExternal: false },
    { roleKey: "assessor", name: "Khalid", isExternal: false },
    { roleKey: "role_player", name: "Mariam", isExternal: true },
  ],
  participants: [
    { name: "Abdullah", adjustment: "Extra time and a separate quiet room", extraMinutes: 10 },
    { name: "Noura", adjustment: null, extraMinutes: null },
  ],
  competencies: [{ name: "Coaching & Talent Growth", weight: 2 }],
};

test("the full manual contains everything (4.39)", () => {
  const { sections } = buildCentreManual(input);
  const full = sectionsFor(sections, "full");
  assert.equal(full.length, sections.length);
  assert.ok(full.some((s) => s.id.endsWith("roleplayer")));
  assert.ok(full.some((s) => s.id.endsWith("assessor")));
});

test("an assessor does NOT get the role-player's objectives", () => {
  const { sections } = buildCentreManual(input);
  const forAssessor = sectionsFor(sections, "assessor");
  assert.equal(forAssessor.some((s) => s.id.endsWith("roleplayer")), false);
  assert.ok(forAssessor.some((s) => s.id.endsWith("assessor")), "but does get assessor guidance");
});

test("a role-player does NOT get assessor guidance or the criteria weighting", () => {
  const { sections } = buildCentreManual(input);
  const forRolePlayer = sectionsFor(sections, "role_player");
  assert.equal(forRolePlayer.some((s) => s.id.endsWith("assessor")), false);
  assert.equal(forRolePlayer.some((s) => s.id === "rules"), false);
  assert.ok(forRolePlayer.some((s) => s.id.endsWith("roleplayer")));
});

test("nobody outside the day's staff sees participant adjustments", () => {
  const { sections } = buildCentreManual(input);
  for (const v of ["psychometric_test_user", "feedback_generator", "feedback_meeting_chair"] as const) {
    assert.equal(
      sectionsFor(sections, v).some((s) => s.id === "participants"),
      false,
      `${v} should not see participant adjustments`
    );
  }
  assert.ok(sectionsFor(sections, "centre_administrator").some((s) => s.id === "participants"));
});

test("every variant gets the purpose, the staff list and the security rules", () => {
  const { sections } = buildCentreManual(input);
  for (const v of ["assessor", "role_player", "centre_administrator", "psychometric_test_user"] as const) {
    const ids = sectionsFor(sections, v).map((s) => s.id);
    assert.ok(ids.includes("purpose"), `${v} needs the purpose`);
    assert.ok(ids.includes("security"), `${v} needs the security rules`);
    assert.ok(ids.includes("procedures"), `${v} needs the on-the-day procedures`);
  }
});

test("confidentiality is reported per variant", () => {
  const { sections } = buildCentreManual(input);
  assert.equal(isConfidential(sections, "full"), true);
  assert.equal(isConfidential(sections, "assessor"), true);
  assert.equal(isConfidential(sections, "psychometric_test_user"), false, "gets only non-confidential sections");
});

test("the materials checklist covers every part of 5.25", () => {
  const { checklist } = buildCentreManual(input);
  const clauses = checklist.map((c) => c.clause);
  for (const c of ["5.25.1", "5.25.2", "5.25.3", "5.25.4", "5.25.5", "5.25.6", "5.25.7"]) {
    assert.ok(clauses.includes(c), `missing ${c}`);
  }
});

test("agreed adjustments become equipment lines (5.25.7)", () => {
  const { checklist } = buildCentreManual(input);
  const adj = checklist.find((c) => c.clause === "5.25.7");
  assert.equal(adj?.items.length, 1);
  assert.match(adj!.items[0].label, /quiet room/);
  assert.match(adj!.items[0].detail ?? "", /Abdullah/);
});

test("no adjustments prompts the question rather than showing nothing", () => {
  const { checklist } = buildCentreManual({
    ...input,
    participants: [{ name: "Noura", adjustment: null, extraMinutes: null }],
  });
  const adj = checklist.find((c) => c.clause === "5.25.7");
  assert.match(adj!.items[0].label, /Check that every participant was asked/);
});

test("the version travels with the manual", () => {
  assert.equal(buildCentreManual(input).version, 3);
  assert.equal(buildCentreManual({ ...input, engagement: {} }).version, 1);
});
