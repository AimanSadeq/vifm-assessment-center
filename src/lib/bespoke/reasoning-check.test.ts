/**
 * Unit tests for the reasoning sitting check.
 * Run: npx tsx --test src/lib/bespoke/reasoning-check.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reasoningCheck, durationText, RUSHED_SECONDS_PER_QUESTION } from "./reasoning-check.ts";

const at = (secs: number) => new Date(Date.parse("2026-10-13T16:20:43Z") + secs * 1000).toISOString();
const START = at(0);

test("Ali's 13 Oct sitting: 18 questions in 59 seconds, 4 blank, is rushed", () => {
  const c = reasoningCheck({ startedAt: START, submittedAt: at(59), answered: 14, total: 18 });
  assert.equal(c.rushed, true);
  assert.equal(c.seconds, 59);
  assert.equal(c.unanswered, 4);
  assert.equal(c.note, "Finished in under a minute (about 3 seconds a question), with 4 of 18 questions unanswered. The reasoning score may not reflect ability; check with the candidate before using it.");
  assert.equal(c.short, "Rushed: under a minute");
  assert.doesNotMatch(c.note!, /—/);
});

test("the threshold is an average of 10 seconds a question", () => {
  assert.equal(RUSHED_SECONDS_PER_QUESTION, 10);
  assert.equal(reasoningCheck({ startedAt: START, submittedAt: at(179), answered: 18, total: 18 }).rushed, true);
  assert.equal(reasoningCheck({ startedAt: START, submittedAt: at(180), answered: 18, total: 18 }).rushed, false);
});

test("a normal sitting has nothing to say; blanks alone are noted plainly", () => {
  const ok = reasoningCheck({ startedAt: START, submittedAt: at(22 * 60), answered: 18, total: 18 });
  assert.equal(ok.rushed, false);
  assert.equal(ok.note, null);
  assert.equal(ok.short, null);
  const blank = reasoningCheck({ startedAt: START, submittedAt: at(40 * 60), answered: 15, total: 18 });
  assert.equal(blank.rushed, false);
  assert.equal(blank.note, "3 of 18 questions unanswered (counted as incorrect).");
  assert.equal(blank.short, "3 of 18 blank");
});

test("unknown times never flag a sitting as rushed", () => {
  const c = reasoningCheck({ startedAt: null, submittedAt: at(10), answered: 18, total: 18 });
  assert.equal(c.seconds, null);
  assert.equal(c.rushed, false);
  assert.equal(reasoningCheck({ startedAt: at(10), submittedAt: START, answered: 18, total: 18 }).seconds, null);
  assert.equal(reasoningCheck({ startedAt: START, submittedAt: at(30), answered: null, total: undefined }).rushed, false);
});

test("durations read naturally", () => {
  assert.equal(durationText(59), "under a minute");
  assert.equal(durationText(80), "1 minute");
  assert.equal(durationText(130), "2 minutes");
});
