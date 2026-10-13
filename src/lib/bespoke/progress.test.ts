/**
 * Unit tests for the follow-up rule, the reminder text and the Excel writer.
 * Run: npx tsx --test src/lib/bespoke/progress.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { followUpReason, reminderMessage, daysSince, firstWord } from "./progress-shared.ts";
import { buildXlsx } from "../xlsx/write.ts";

const DAY = 86_400_000;
const now = Date.parse("2026-10-25T09:00:00Z");
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
const ctx = { held: false, openSince: iso(5), followupDays: 2, completeBy: null as string | null };
const person = (over: Partial<Parameters<typeof followUpReason>[0]>) => ({
  status: "in_progress" as const, isTester: false, lastActivityAt: iso(0), lastContactAt: null, ...over,
});

test("nobody is flagged while the assessment is on hold", () => {
  assert.equal(followUpReason(person({ status: "not_started", lastActivityAt: null }), { ...ctx, held: true }, now), null);
});

test("testers and people who finished are never flagged", () => {
  assert.equal(followUpReason(person({ isTester: true, lastActivityAt: iso(9) }), ctx, now), null);
  assert.equal(followUpReason(person({ status: "completed", lastActivityAt: iso(9) }), ctx, now), null);
  assert.equal(followUpReason(person({ status: "scored", lastActivityAt: iso(9) }), ctx, now), null);
});

test("not started is flagged once the link has been open for the threshold", () => {
  assert.equal(followUpReason(person({ status: "not_started", lastActivityAt: null }), ctx, now), "not_started");
  assert.equal(followUpReason(person({ status: "not_started", lastActivityAt: null }), { ...ctx, openSince: iso(1) }, now), null);
  assert.equal(followUpReason(person({ status: "not_started", lastActivityAt: null }), { ...ctx, openSince: null }, now), null);
});

test("a started person is flagged after the threshold without progress", () => {
  assert.equal(followUpReason(person({ lastActivityAt: iso(1) }), ctx, now), null);
  assert.equal(followUpReason(person({ lastActivityAt: iso(3) }), ctx, now), "no_progress");
  assert.equal(followUpReason(person({ status: "signed_in", lastActivityAt: iso(2) }), ctx, now), "no_progress");
});

test("a recent chase resets the clock", () => {
  assert.equal(followUpReason(person({ lastActivityAt: iso(4), lastContactAt: iso(1) }), ctx, now), null);
  assert.equal(followUpReason(person({ lastActivityAt: iso(4), lastContactAt: iso(3) }), ctx, now), "no_progress");
});

test("anyone unfinished within two days of the deadline is flagged", () => {
  const due = new Date(now + 1.5 * DAY).toISOString();
  assert.equal(followUpReason(person({ lastActivityAt: iso(0) }), { ...ctx, completeBy: due }, now), "deadline_near");
  const later = new Date(now + 5 * DAY).toISOString();
  assert.equal(followUpReason(person({ lastActivityAt: iso(0) }), { ...ctx, completeBy: later }, now), null);
  const past = new Date(now - DAY).toISOString();
  assert.equal(followUpReason(person({ lastActivityAt: iso(0) }), { ...ctx, completeBy: past }, now), null);
});

test("reminder text uses the first name, the date and the link", () => {
  const t = reminderMessage({ firstName: firstWord("Sarah Abdullah Alfakeeh"), assessmentName: "SDC HiPo Assessment", link: "https://x/y", completeBy: "Sunday 1 November 2026", started: true });
  assert.match(t, /^Dear Sarah,/);
  assert.match(t, /by Sunday 1 November 2026/);
  assert.match(t, /https:\/\/x\/y/);
  assert.match(t, /continue where you stopped/);
  assert.doesNotMatch(t, /—/);
  const generic = reminderMessage({ firstName: "", assessmentName: "A", link: "L", completeBy: null, started: false });
  assert.match(generic, /^Dear colleague,/);
  assert.doesNotMatch(generic, / by /);
});

test("daysSince floors and never goes negative", () => {
  assert.equal(daysSince(iso(2.9), now), 2);
  assert.equal(daysSince(new Date(now + DAY).toISOString(), now), 0);
  assert.equal(daysSince(null, now), null);
});

test("the Excel writer produces a valid workbook with escaped text", async () => {
  const buf = await buildXlsx([
    { name: "Progress", header: ["Name", "Score"], rows: [["A & B <x>", 3], ["سارة", null], ["bad\u0001char", 1.5]] },
    { name: "Progress", header: ["Item"], rows: [] },
  ]);
  const zip = await JSZip.loadAsync(buf);
  for (const f of ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
    assert.ok(zip.file(f), f);
  }
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  assert.match(wb, /name="Progress"/);
  assert.match(wb, /name="Progress \(2\)"/);
  const s1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(s1, /A &amp; B &lt;x&gt;/);
  assert.match(s1, /سارة/);
  assert.match(s1, /<c r="B2"><v>3<\/v><\/c>/);
  assert.doesNotMatch(s1, /\u0001/);
  assert.match(s1, /autoFilter ref="A1:B4"/);
});
