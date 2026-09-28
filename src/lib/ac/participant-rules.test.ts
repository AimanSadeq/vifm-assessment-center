/**
 * Unit tests for the appeal window and joining-pack notice rules.
 * Run: npx tsx --test src/lib/ac/participant-rules.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  APPEAL_WINDOW_DAYS,
  PACK_NOTICE_DAYS,
  appealDeadline,
  appealTiming,
  packNoticeDays,
  packNoticeShort,
} from "./participant-rules.ts";

test("the house rules are three weeks each", () => {
  assert.equal(APPEAL_WINDOW_DAYS, 21);
  assert.equal(PACK_NOTICE_DAYS, 21);
});

test("the appeal window has not started before a result is released", () => {
  assert.equal(appealDeadline(null), null);
  assert.equal(appealTiming("2026-10-01T09:00:00Z", null), "before_result");
});

test("the deadline is 21 calendar days after release, whatever the time of day", () => {
  assert.equal(appealDeadline("2026-10-01T23:59:00Z")?.toISOString().slice(0, 10), "2026-10-22");
  assert.equal(appealDeadline("2026-10-01T00:01:00Z")?.toISOString().slice(0, 10), "2026-10-22");
});

test("an appeal on the last day is in time; the day after is late", () => {
  assert.equal(appealTiming("2026-10-22T20:00:00Z", "2026-10-01T08:00:00Z"), "in_time");
  assert.equal(appealTiming("2026-10-23T00:30:00Z", "2026-10-01T08:00:00Z"), "late");
});

test("notice is counted in whole days to the start date", () => {
  assert.equal(packNoticeDays("2026-10-22", "2026-10-01T15:00:00Z"), 21);
  assert.equal(packNoticeDays("2026-10-21", "2026-10-01T15:00:00Z"), 20);
  assert.equal(packNoticeDays(null, "2026-10-01T15:00:00Z"), null);
});

test("exactly three weeks is enough; one day less is short", () => {
  assert.equal(packNoticeShort("2026-10-22", "2026-10-01T15:00:00Z"), false);
  assert.equal(packNoticeShort("2026-10-21", "2026-10-01T15:00:00Z"), true);
});

test("a centre that has already started is short notice; no start date is not", () => {
  assert.equal(packNoticeShort("2026-09-30", "2026-10-01T15:00:00Z"), true);
  assert.equal(packNoticeShort(null, "2026-10-01T15:00:00Z"), false);
});
