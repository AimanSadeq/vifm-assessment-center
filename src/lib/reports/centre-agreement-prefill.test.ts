/**
 * Unit tests for what the centre agreement pre-fills from an engagement.
 * Run: npx tsx --test src/lib/reports/centre-agreement-prefill.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildAgreementPrefill, type AgreementInput } from "./centre-agreement-prefill.ts";

const base = (engagement: Record<string, unknown> = {}, over: Partial<AgreementInput> = {}): AgreementInput => ({
  engagement: { name: "Senior Manager AC", ...engagement },
  organisationName: "Najm Capital",
  competencies: [{ name: "Strategic Thinking", weight: 3 }, { name: "Communication", weight: null }],
  exercises: [{ name: "In-tray", exerciseType: "in_basket", durationMinutes: 60, competencies: ["Strategic Thinking"] }],
  roles: [],
  participantCount: 6,
  contentApproved: null,
  generatedAt: "28 September 2026",
  ...over,
});

test("a selection centre with no explicit method is calculated", () => {
  const p = buildAgreementPrefill(base({ purpose: "selection" }));
  assert.equal(p.purpose, "selection");
  assert.equal(p.ratingRule, "calculated");
});

test("an explicit method wins over the purpose default", () => {
  assert.equal(buildAgreementPrefill(base({ purpose: "selection", integration_method: "consensus" })).ratingRule, "discussed");
  assert.equal(buildAgreementPrefill(base({ purpose: "succession", integration_method: "weighted_average" })).ratingRule, "calculated");
});

test("with no purpose recorded nothing is ticked", () => {
  const p = buildAgreementPrefill(base());
  assert.equal(p.purpose, null);
  assert.equal(p.ratingRule, null);
  assert.equal(p.fairnessApplies, null);
});

test("an unset weight counts as 1, as the scoring does", () => {
  const p = buildAgreementPrefill(base());
  assert.deepEqual(p.weights, [
    { competency: "Strategic Thinking", weight: "3" },
    { competency: "Communication", weight: "1" },
  ]);
});

test("feedback is mandatory for development and succession, and 'none' reads as No", () => {
  const dev = buildAgreementPrefill(base({ purpose: "development", pack_feedback_offer: "both" }));
  assert.equal(dev.feedback.mandatory, true);
  assert.equal(dev.feedback.provided, "Yes");
  assert.equal(dev.feedback.form, "Written report and oral debrief");
  const sel = buildAgreementPrefill(base({ purpose: "selection", pack_feedback_offer: "none" }));
  assert.equal(sel.feedback.mandatory, false);
  assert.equal(sel.feedback.provided, "No");
  assert.equal(sel.feedback.form, null);
});

test("fairness monitoring is off only for development centres", () => {
  assert.equal(buildAgreementPrefill(base({ purpose: "development" })).fairnessApplies, false);
  assert.equal(buildAgreementPrefill(base({ purpose: "succession" })).fairnessApplies, true);
});

test("a pack published at short notice carries the notice and the reason", () => {
  const p = buildAgreementPrefill(base({
    start_date: "2026-10-10",
    pack_published_at: "2026-10-01T09:00:00Z",
    pack_late_reason: "Client hiring timetable",
  }));
  assert.equal(p.packPublished?.noticeGiven, 9);
  assert.equal(p.packPublished?.lateReason, "Client hiring timetable");
  assert.equal(p.packNoticeDays, 21);
  assert.equal(p.appealWindowDays, 21);
});

test("content status reports partial review honestly", () => {
  const p = buildAgreementPrefill(base({}, { contentApproved: { approved: 12, total: 40 } }));
  assert.match(p.contentStatus ?? "", /12 of 40/);
  assert.match(p.contentStatus ?? "", /indicative/);
  assert.equal(buildAgreementPrefill(base({}, { contentApproved: null })).contentStatus, null);
});

test("people outside VIFM are labelled as such, not as the Client", () => {
  const p = buildAgreementPrefill(base({}, {
    roles: [
      { roleKey: "assessor", name: "A", isExternal: false },
      { roleKey: "assessor", name: "B", isExternal: true },
      { roleKey: "centre_manager", name: "Sara", isExternal: false },
    ],
  }));
  const assessors = p.roleCounts.find((r) => r.count === 2);
  assert.equal(assessors?.providedBy, "Outside VIFM and VIFM");
  assert.equal(p.centreManager, "Sara");
});

test("unknown values stay null so the document shows a fill-in", () => {
  const p = buildAgreementPrefill(base({ pack_report_recipients: "  " }, { organisationName: null, participantCount: 0 }));
  assert.equal(p.recipients, null);
  assert.equal(p.clientName, null);
  assert.equal(p.participants, null);
});
