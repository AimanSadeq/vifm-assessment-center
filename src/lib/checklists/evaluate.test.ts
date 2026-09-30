/**
 * Unit tests for checklist evaluation.
 * Run: npx tsx --test src/lib/checklists/evaluate.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChecklist } from "./evaluate.ts";
import { AC_CHECKLIST, ARC_CHECKLIST } from "./definitions.ts";

test("an automatic item ticks itself from the facts", () => {
  const s = evaluateChecklist(AC_CHECKLIST, { "ac.purpose": { done: true, detail: "selection" } }, []);
  const it = s.phases.flatMap((p) => p.items).find((i) => i.key === "ac.purpose");
  assert.equal(it?.done, true);
  assert.equal(it?.source, "auto");
  assert.equal(it?.detail, "selection");
});

test("a manual tick counts and is shown as manual", () => {
  const s = evaluateChecklist(AC_CHECKLIST, {}, [{ item_key: "ac.agreement", done_at: "2026-09-30T10:00:00Z", done_by_name: "Aiman", note: "Signed copy on file" }]);
  const it = s.phases.flatMap((p) => p.items).find((i) => i.key === "ac.agreement");
  assert.equal(it?.done, true);
  assert.equal(it?.source, "manual");
  assert.equal(it?.doneBy, "Aiman");
  assert.equal(it?.note, "Signed copy on file");
});

test("a person may tick an automatic item the record cannot see, shown as manual", () => {
  const s = evaluateChecklist(AC_CHECKLIST, { "ac.proposal": { done: false } }, [{ item_key: "ac.proposal", done_at: "2026-09-30T10:00:00Z", done_by_name: "Sara", note: null }]);
  const it = s.phases.flatMap((p) => p.items).find((i) => i.key === "ac.proposal");
  assert.equal(it?.done, true);
  assert.equal(it?.source, "manual");
});

test("the weights item appears only for selection centres", () => {
  const sel = evaluateChecklist(AC_CHECKLIST, { "ac.purpose": { done: true, detail: "selection" } }, []);
  const dev = evaluateChecklist(AC_CHECKLIST, { "ac.purpose": { done: true, detail: "development" } }, []);
  assert.ok(sel.phases.flatMap((p) => p.items).some((i) => i.key === "ac.weights"));
  assert.ok(!dev.phases.flatMap((p) => p.items).some((i) => i.key === "ac.weights"));
});

test("Phase 2 items appear only above Department stage", () => {
  const dept = evaluateChecklist(ARC_CHECKLIST, { "arc.stage": { done: true, detail: "department" } }, []);
  const ent = evaluateChecklist(ARC_CHECKLIST, { "arc.stage": { done: true, detail: "enterprise" } }, []);
  assert.ok(!dept.phases.flatMap((p) => p.items).some((i) => i.key === "arc.phase2"));
  assert.ok(ent.phases.flatMap((p) => p.items).some((i) => i.key === "arc.phase2"));
});

test("the current phase is the first with an open item, and null when all done", () => {
  const facts = Object.fromEntries(AC_CHECKLIST.items.filter((i) => i.auto).map((i) => [i.auto as string, { done: true, detail: i.key === "ac.purpose" ? "development" : undefined }]));
  const manual = AC_CHECKLIST.items.filter((i) => !i.auto).map((i) => ({ item_key: i.key, done_at: "2026-09-30T00:00:00Z", done_by_name: "X", note: null }));
  const all = evaluateChecklist(AC_CHECKLIST, facts, manual);
  assert.equal(all.currentPhase, null);
  assert.equal(all.done, all.total);
  const partial = evaluateChecklist(AC_CHECKLIST, facts, manual.filter((m) => m.item_key !== "ac.invoice"));
  assert.equal(partial.currentPhase, "close");
});

test("every item key is unique within a service", () => {
  for (const def of [AC_CHECKLIST, ARC_CHECKLIST]) {
    const keys = def.items.map((i) => i.key);
    assert.equal(new Set(keys).size, keys.length, def.service);
  }
});
