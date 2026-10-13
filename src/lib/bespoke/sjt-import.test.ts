/**
 * Unit tests for the scenario workbook import (port of scripts/sdc-hipo/load-scenarios.py).
 * Run: npx tsx --test src/lib/bespoke/sjt-import.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildXlsx, type XlsxCell } from "../xlsx/write.ts";
import { optionKey, parseScenarioWorkbook, sdcCompetencyRows, withOptionKeys } from "./sjt-import.ts";

const BUNDLE = "3f2a9c1e-7b4d-4e8a-9c2b-1d5e6f7a8b9c";
const SITUATION =
  "You prepare a weekly visitor-feedback summary for your department. Copying comments from three separate systems into one spreadsheet takes most of Thursday, and colleagues often ask you for the same figures in different formats. Nobody has asked you to change the process, and the summary is always delivered on time.";

type Opt = [text: string, level: string, indicator: string];
const VALID_IN_B: Opt[] = [
  ["Build a simple template that combines the three exports, use it for a month and track how much time it saves.", "Proficient", "IN-P3"],
  ["Mention to your manager that the process is slow and suggest that it could probably be simplified.", "Basic", "IN-B1"],
  ["Pilot a small shared dashboard with the colleagues who use the summary, check time saved and accuracy, then offer it to other departments.", "Advanced", "IN-A3"],
  ["Keep the current method, since the summary is always delivered on time and nobody has complained.", "Counter-evidence", "IN-N1"],
];

/** One Scenarios-sheet row in build-template.py's column layout (A to V). */
function row(ref: string, comp: string, level: string, situation: string, opts: Opt[], status: string): XlsxCell[] {
  return [ref, "Core", comp, level, "", situation, ...opts.flat(), "", "", "", status];
}

/** A workbook like Ali's: a 'Read me' sheet first, 'Scenarios' with data from row 5. */
function workbook(rows: XlsxCell[][]): Promise<Buffer> {
  return buildXlsx([
    { name: "Read me", header: ["SDC HiPo assessment: scenario question template"], rows: [] },
    { name: "Scenarios", header: ["SDC HiPo: scenario questions"], rows: [["Fill the yellow cells."], [], ["Scenario ID", "Category", "SDC competency"], ...rows] },
  ]);
}

test("a valid row loads, with the same response keys the Python loader writes", async () => {
  const parsed = await parseScenarioWorkbook(await workbook([row("SDC-IN-B", "Innovation", "Basic", SITUATION, VALID_IN_B, "Approved")]));
  assert.equal(parsed.fatal, null);
  assert.deepEqual(parsed.report, [{ ref: "SDC-IN-B", row: 5, outcome: "loaded", messages: [], errorCount: 0 }]);
  assert.equal(parsed.items.length, 1);
  const [it] = withOptionKeys(BUNDLE, parsed.items);
  assert.equal(it.competency_code, "IN");
  assert.equal(it.target_level, "Basic");
  assert.equal(it.sort_order, 1);
  // From: python3 scripts/sdc-hipo/load-scenarios.py <filled template> --bundle 3f2a9c1e-... --json out.json
  assert.deepEqual(
    it.options.map((o) => o.key),
    ["822777d384", "2b72a7b83b", "3dbd62cf48", "bb0da927cc"],
  );
  assert.deepEqual(it.options.map((o) => [o.level, o.indicator_id]), VALID_IN_B.map(([, l, i]) => [l, i]));
  assert.equal(optionKey(BUNDLE, "SDC-RO-P", "A"), "c4f4e74e98");
  assert.equal(optionKey(BUNDLE, "SDC-LBE-A", "D"), "fe0e80d2e7");
});

test("a level used twice is an error and the row is not loaded", async () => {
  const opts: Opt[] = [
    ["Option one.", "Advanced", "IN-A1"],
    ["Option two.", "Advanced", "IN-A2"],
    ["Option three.", "Basic", "IN-B1"],
    ["Option four.", "Counter-evidence", "IN-N1"],
  ];
  const parsed = await parseScenarioWorkbook(await workbook([row("SDC-IN-A", "Innovation", "Advanced", SITUATION, opts, "Approved")]));
  assert.equal(parsed.items.length, 0);
  assert.equal(parsed.report[0].outcome, "error");
  assert.deepEqual(parsed.report[0].messages, ["each level must be used exactly once (Advanced, Proficient, Basic, Counter-evidence)"]);
});

test("an indicator of another competency is an error", async () => {
  const opts: Opt[] = [
    ["Respond A.", "Advanced", "RO-A1"],
    ["Respond B.", "Proficient", "IN-P1"],
    ["Respond C.", "Basic", "RO-B1"],
    ["Respond D.", "Counter-evidence", "RO-N1"],
  ];
  const parsed = await parseScenarioWorkbook(await workbook([row("SDC-RO-B", "Results Oriented", "Basic", SITUATION, opts, "Approved")]));
  assert.equal(parsed.items.length, 0);
  assert.deepEqual(parsed.report[0], { ref: "SDC-RO-B", row: 5, outcome: "error", messages: ["response B indicator IN-P1 belongs to Innovation"], errorCount: 1 });
});

test("only Approved rows load unless Ready for review is asked for", async () => {
  const buf = await workbook([
    row("SDC-IN-B", "Innovation", "Basic", SITUATION, VALID_IN_B, "Ready for review"),
    row("SDC-IN-P", "Innovation", "Proficient", SITUATION, VALID_IN_B, ""),
  ]);
  const strict = await parseScenarioWorkbook(buf);
  assert.equal(strict.items.length, 0);
  assert.deepEqual(
    strict.report.map((r) => [r.ref, r.outcome, r.messages[0]]),
    [
      ["SDC-IN-B", "skipped", "status is 'Ready for review'"],
      ["SDC-IN-P", "skipped", "status is 'Draft'"],
    ],
  );
  const pilot = await parseScenarioWorkbook(buf, { statuses: ["Approved", "Ready for review"] });
  assert.deepEqual(pilot.items.map((i) => i.ref), ["SDC-IN-B"]);
  assert.equal(pilot.report[1].outcome, "skipped");
});

test("warnings load the row; text is tidied and IDs upper-cased as the script does", async () => {
  const opts: Opt[] = [
    ["  Do the   obvious thing. ", "Advanced", " ro-a2 "],
    ["A much longer response that keeps on going with many many words so that the spread between the shortest and longest is beyond ten words.", "Proficient", "ro-p2"],
    ["Line one\nline two of C.", "Basic", "RO-B2"],
    ["Do nothing.", "Counter-evidence", "RO-N2"],
  ];
  const parsed = await parseScenarioWorkbook(
    await workbook([row("SDC-RO-P", "Results Oriented", "Proficient", "  A short   situation\twith\t\ttabs & quotes.  ", opts, "Approved")]),
  );
  assert.equal(parsed.report[0].outcome, "loaded");
  assert.deepEqual(parsed.report[0].messages, ["situation is 7 words (50 to 100 asked)", "responses range from 2 to 25 words (keep within about 10)"]);
  const [it] = parsed.items;
  assert.equal(it.situation, "A short situation with tabs & quotes.");
  assert.equal(it.options[0].text, "Do the obvious thing.");
  assert.equal(it.options[2].text, "Line one\nline two of C.");
  assert.deepEqual(it.options.map((o) => o.indicator_id), ["RO-A2", "RO-P2", "RO-B2", "RO-N2"]);
});

test("scenarios are ordered by competency, then level, then row", async () => {
  const ro: Opt[] = [
    ["Respond A.", "Advanced", "RO-A1"],
    ["Respond B.", "Proficient", "RO-P1"],
    ["Respond C.", "Basic", "RO-B1"],
    ["Respond D.", "Counter-evidence", "RO-N1"],
  ];
  const parsed = await parseScenarioWorkbook(
    await workbook([
      row("SDC-RO-B", "Results Oriented", "Basic", SITUATION, ro, "Approved"),
      row("SDC-IN-A", "Innovation", "Advanced", SITUATION, VALID_IN_B, "Approved"),
      row("SDC-IN-B", "Innovation", "Basic", SITUATION, VALID_IN_B, "Approved"),
    ]),
  );
  assert.deepEqual(parsed.items.map((i) => [i.ref, i.sort_order]), [["SDC-IN-B", 1], ["SDC-IN-A", 2], ["SDC-RO-B", 3]]);
  assert.deepEqual(parsed.perCompetency, { IN: 2, RO: 1 });
  assert.ok(parsed.short.includes("IN") && parsed.short.includes("LBE"));
});

test("a Scenario ID used twice stops the whole load, and a missing sheet is reported", async () => {
  const dup = await parseScenarioWorkbook(
    await workbook([
      row("SDC-IN-B", "Innovation", "Basic", SITUATION, VALID_IN_B, "Approved"),
      row("SDC-IN-B", "Innovation", "Basic", SITUATION, VALID_IN_B, "Approved"),
    ]),
  );
  assert.equal(dup.fatal, "Scenario IDs used more than once: SDC-IN-B");
  assert.equal(dup.items.length, 0);
  assert.ok(dup.report.every((r) => r.outcome === "error"));

  const none = await parseScenarioWorkbook(await buildXlsx([{ name: "Sheet1", header: ["x"], rows: [] }]));
  assert.equal(none.fatal, "No 'Scenarios' sheet in this workbook.");
  const junk = await parseScenarioWorkbook(Buffer.from("not a zip"));
  assert.match(junk.fatal ?? "", /not an Excel workbook/);
});

test("competencies carry the grade requirements, Grade 4 as Grade 5", () => {
  const rows = sdcCompetencyRows();
  assert.deepEqual(rows.map((c) => c.code), ["IN", "RO", "ECC", "PI", "AO", "SM", "DSP", "EDP", "IM", "LBE"]);
  assert.deepEqual(rows[0].required_levels, { "4": 2, "5": 2, "6": 2, "7": 2, "8": 3 });
  assert.deepEqual(rows[9].required_levels, { "4": 0, "5": 0, "6": 0, "7": 1, "8": 2 });
  for (const c of rows) assert.equal(c.required_levels["4"], c.required_levels["5"]);
  assert.deepEqual(rows.map((c) => c.sort_order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
