import test from "node:test";
import assert from "node:assert/strict";
import { questionRepeatsScenario } from "./technical-item-bank";

// The defect this guards against was found by an SME, not by us: five bank items
// held an Arabic "question" that was a verbatim copy of the Arabic scenario, so an
// Arabic candidate read the case twice and was never asked anything.

test("a question that repeats its scenario verbatim is caught", () => {
  const s = "A company acquires 80% of a subsidiary for 400,000 cash.";
  assert.equal(questionRepeatsScenario(s, s), true);
});

test("surrounding whitespace does not hide it", () => {
  assert.equal(questionRepeatsScenario("  the case  ", "the case\n"), true);
});

test("a real question alongside its scenario passes", () => {
  assert.equal(
    questionRepeatsScenario("What goodwill is recognised?", "A company acquires 80%..."),
    false,
  );
});

test("an item with no scenario passes", () => {
  assert.equal(questionRepeatsScenario("How many steps does IFRS 15 set out?", null), false);
  assert.equal(questionRepeatsScenario("How many steps?", ""), false);
});

test("an empty question is not treated as a repeat", () => {
  // Missing Arabic is a different problem, handled by the backfill. Reporting it
  // here would block saving an item that simply has no Arabic yet.
  assert.equal(questionRepeatsScenario(null, "a scenario"), false);
  assert.equal(questionRepeatsScenario("   ", "   "), false);
});
