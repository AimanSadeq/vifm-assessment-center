/**
 * Unit tests for the feedback review (BPS 8.14-8.24).
 * Run: npx tsx --test src/lib/ac/feedback.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewFeedback, FEEDBACK_PROMPT_DAYS } from "./feedback.ts";

const p = (id: string, name: string, rated = true) => ({ candidateId: id, name, rated });
const rec = (id: string, over: Partial<{ form: "written_report" | "oral" | "both"; deliveredAt: string; delivererTrained: boolean; hasSummary: boolean }> = {}) => ({
  candidateId: id,
  form: over.form ?? ("both" as const),
  deliveredAt: over.deliveredAt ?? "2026-06-20T00:00:00Z",
  deliveredByName: "Dr. Sara Al Otaibi",
  delivererTrained: over.delivererTrained ?? true,
  hasSummary: over.hasSummary ?? true,
});

const END = "2026-06-17T00:00:00Z";

test("a development centre owes feedback to anyone with a result", () => {
  const r = reviewFeedback({ purpose: "development", centreEndDate: END, participants: [p("c1", "Abdullah")], records: [] });
  assert.equal(r.mandatory, true);
  assert.deepEqual(r.owed.map((o) => o.name), ["Abdullah"]);
  assert.ok(r.problems.some((x) => /must give feedback/.test(x)));
});

test("nobody is owed feedback before they have a result", () => {
  const r = reviewFeedback({ purpose: "development", centreEndDate: END, participants: [p("c1", "Abdullah", false)], records: [] });
  assert.deepEqual(r.owed, []);
});

test("a selection centre still reports the gap, in softer terms", () => {
  const r = reviewFeedback({ purpose: "selection", centreEndDate: END, participants: [p("c1", "Abdullah")], records: [] });
  assert.equal(r.mandatory, false);
  assert.equal(r.owed.length, 1);
  assert.equal(r.problems.some((x) => /must give feedback/.test(x)), false);
});

test("succession is treated as mandatory too", () => {
  const r = reviewFeedback({ purpose: "succession", centreEndDate: END, participants: [p("c1", "A")], records: [] });
  assert.equal(r.mandatory, true);
});

test("an oral session with no written record is flagged (8.21)", () => {
  const r = reviewFeedback({
    purpose: "development", centreEndDate: END,
    participants: [p("c1", "Abdullah")],
    records: [rec("c1", { form: "oral", hasSummary: false })],
  });
  assert.deepEqual(r.withoutWrittenRecord.map((x) => x.name), ["Abdullah"]);
});

test("a written report alone is not enough for a development centre (8.22)", () => {
  const dev = reviewFeedback({
    purpose: "development", centreEndDate: END,
    participants: [p("c1", "Abdullah")],
    records: [rec("c1", { form: "written_report" })],
  });
  assert.equal(dev.withoutOralElement.length, 1);

  const sel = reviewFeedback({
    purpose: "selection", centreEndDate: END,
    participants: [p("c1", "Abdullah")],
    records: [rec("c1", { form: "written_report" })],
  });
  assert.equal(sel.withoutOralElement.length, 0, "a selection centre may give a report alone");
});

test("late feedback is flagged, and the threshold is named as practice", () => {
  const late = new Date(new Date(END).getTime() + (FEEDBACK_PROMPT_DAYS + 5) * 86_400_000).toISOString();
  const r = reviewFeedback({
    purpose: "development", centreEndDate: END,
    participants: [p("c1", "Abdullah")],
    records: [rec("c1", { deliveredAt: late })],
  });
  assert.equal(r.late[0]?.days, FEEDBACK_PROMPT_DAYS + 5);
  assert.ok(r.problems.some((x) => /not a clause value/.test(x)));
});

test("prompt feedback is not flagged", () => {
  const soon = new Date(new Date(END).getTime() + 3 * 86_400_000).toISOString();
  const r = reviewFeedback({
    purpose: "development", centreEndDate: END,
    participants: [p("c1", "Abdullah")],
    records: [rec("c1", { deliveredAt: soon })],
  });
  assert.deepEqual(r.late, []);
  assert.deepEqual(r.problems, []);
});

test("an untrained deliverer is flagged, not blocked (8.17)", () => {
  const r = reviewFeedback({
    purpose: "development", centreEndDate: END,
    participants: [p("c1", "Abdullah")],
    records: [rec("c1", { delivererTrained: false })],
  });
  assert.equal(r.byUntrained.length, 1);
  assert.ok(r.problems.some((x) => /not recorded as feedback-trained/.test(x)));
});

test("the most recent session is the one judged", () => {
  const r = reviewFeedback({
    purpose: "development", centreEndDate: END,
    participants: [p("c1", "Abdullah")],
    records: [
      rec("c1", { form: "written_report", deliveredAt: "2026-06-18T00:00:00Z" }),
      rec("c1", { form: "both", deliveredAt: "2026-06-19T00:00:00Z" }),
    ],
  });
  assert.deepEqual(r.withoutOralElement, [], "the later session included a conversation");
});
