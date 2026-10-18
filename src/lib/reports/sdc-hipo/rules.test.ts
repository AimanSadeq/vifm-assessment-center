/**
 * Unit tests for the SDC High-Potential report rules, the row assembly and the
 * HTML text. Run: npx tsx --test src/lib/reports/sdc-hipo/rules.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  isSdcFramework, SDC_CODES, compRows, fit, reasoning, reasoningTestsPhrase, selectIdp, idpItems, gapsOf,
  strengthsOf, compareCohort, rankCohort, gapRates, requiredLevel, IDP_MAX_GAPS, MODULE, type CompRow, type CohortPerson,
} from "./rules.ts";
import idpContent from "./idp-content.json";
import { assembleCandidate, assembleCohort, formatAssessed, scenarioCounts } from "./assemble.ts";
import { renderSdcSummaryHtml, renderSdcIdpHtml, renderSdcGroupHtml } from "./html.ts";
import {
  FIXTURE_COMPETENCIES as COMPS, FIXTURE_CANDIDATES, FIXTURE_ROSTER, FIXTURE_SJT, FIXTURE_PSY, FIXTURE_SESSIONS, FIXTURE_ORG,
} from "./fixture.ts";
import { reportKindLabel, buildReportStoragePath } from "../../bespoke/report-filing-paths.ts";

const lv = (o: Partial<Record<(typeof SDC_CODES)[number], number>>, base = 2) =>
  Object.fromEntries(SDC_CODES.map((c) => [c, o[c] ?? base]));

// ---------------------------------------------------------------- framework

test("isSdcFramework: exactly the ten SDC codes, in any order", () => {
  assert.equal(isSdcFramework([...SDC_CODES]), true);
  assert.equal(isSdcFramework([...SDC_CODES].reverse()), true);
  assert.equal(isSdcFramework(SDC_CODES.slice(0, 9)), false);
  assert.equal(isSdcFramework([...SDC_CODES, "XX"]), false);
  assert.equal(isSdcFramework([...SDC_CODES.slice(0, 9), "IN"]), false);
  assert.equal(isSdcFramework([]), false);
});

test("Grades 4 to 6 require the five core competencies only; Grade 4 carries Grade 5 levels", () => {
  for (const g of [4, 5, 6]) {
    const req = COMPS.filter((c) => requiredLevel(c, g) > 0);
    assert.equal(req.length, 5, `grade ${g}`);
    assert.ok(req.every((c) => c.category === "Core"));
  }
  assert.deepEqual(COMPS.map((c) => requiredLevel(c, 4)), COMPS.map((c) => requiredLevel(c, 5)));
  assert.equal(COMPS.filter((c) => requiredLevel(c, 7) > 0).length, 10);
  assert.equal(COMPS.filter((c) => requiredLevel(c, 8) > 0).length, 10);
});

// ---------------------------------------------------------------- fit

test("fit: Above needs every required competency met AND at least two exceeded", () => {
  // Grade 5: IN, RO, ECC, PI, AO at Proficient (2).
  const allMetTwoAbove = fit(compRows(COMPS, 5, lv({ IN: 3, RO: 3 })));
  assert.deepEqual([allMetTwoAbove.met, allMetTwoAbove.total, allMetTwoAbove.above, allMetTwoAbove.band], [5, 5, 2, 2]);
  assert.equal(allMetTwoAbove.label, "Above requirement");
  // All met but only one exceeded: Meets, not Above.
  assert.equal(fit(compRows(COMPS, 5, lv({ IN: 3 }))).band, 1);
  // Three exceeded but one below: not every requirement met, so Meets (4/5 = 80%).
  const oneBelow = fit(compRows(COMPS, 5, lv({ IN: 3, RO: 3, ECC: 3, PI: 1 })));
  assert.deepEqual([oneBelow.met, oneBelow.above, oneBelow.band], [4, 3, 1]);
});

test("fit: Meets is 80% or more of required competencies met, Below under 80%", () => {
  // Grade 7: all ten required. 8/10 = 80% -> Meets; 7/10 -> Below.
  const g7 = { IN: 2, RO: 3, ECC: 2, PI: 3, AO: 3, SM: 1, DSP: 1, EDP: 1, IM: 1, LBE: 1 };
  assert.equal(fit(compRows(COMPS, 7, { ...g7, IM: 0, LBE: 0 })).band, 1);
  const seven = fit(compRows(COMPS, 7, { ...g7, IM: 0, LBE: 0, DSP: 0 }));
  assert.deepEqual([seven.met, seven.total, seven.band, seven.label], [7, 10, 0, "Below requirement"]);
  // Grade 5: 4/5 met -> Meets; 3/5 -> Below.
  assert.equal(fit(compRows(COMPS, 5, lv({ AO: 1 }))).band, 1);
  assert.equal(fit(compRows(COMPS, 5, lv({ AO: 1, PI: 1 }))).band, 0);
});

test("fit: leadership results do not count below Grade 7 (development only)", () => {
  const rows = compRows(COMPS, 6, lv({ SM: 0, DSP: 0, EDP: 0, IM: 0, LBE: 0, RO: 3, PI: 3 }));
  assert.ok(rows.filter((r) => r.category === "Leadership").every((r) => r.req === 0));
  assert.equal(fit(rows).total, 5);
  assert.equal(fit(rows).met, 5);
});

// ---------------------------------------------------------------- reasoning

test("reasoning: mean of the tests actually sat, Strong >= 70, Solid 50 to 69, Developing < 50", () => {
  const r = reasoning([{ key: "inductive", raw: 89 }, { key: "numerical", raw: 100 }])!;
  assert.deepEqual(r.tests.map((t) => t.name), ["Numerical", "Inductive"]);
  assert.equal(r.mean, 95);
  assert.equal(r.label, "Strong");
  assert.equal(reasoningTestsPhrase(r), "two timed Logica reasoning tests (Numerical and Inductive)");
  assert.equal(reasoning([{ key: "numerical", raw: 70 }, { key: "inductive", raw: 70 }])!.band, 2);
  assert.equal(reasoning([{ key: "numerical", raw: 69 }, { key: "inductive", raw: 69 }])!.band, 1);
  assert.equal(reasoning([{ key: "numerical", raw: 50 }, { key: "inductive", raw: 50 }])!.band, 1);
  assert.equal(reasoning([{ key: "numerical", raw: 49 }, { key: "inductive", raw: 49 }])!.label, "Developing");
  assert.equal(reasoningTestsPhrase(reasoning([{ key: "numerical", raw: 60 }])!), "one timed Logica reasoning test (Numerical)");
  assert.equal(reasoning([]), null);
  assert.equal(reasoning(null), null);
  assert.equal(reasoning([{ key: "numerical", raw: "x" }]), null);
});

// ---------------------------------------------------------------- strengths, gaps, IDP

const fixtureRows = () => {
  const c = FIXTURE_CANDIDATES[0];
  const s = FIXTURE_SJT.find((x) => x.bundle_candidate_id === c.id)!;
  const levels = Object.fromEntries(Object.entries(s.scores as Record<string, { level: number }>).map(([k, v]) => [k, v.level]));
  return compRows(COMPS, 7, levels);
};

test("IDP: top three gaps by shortfall, then higher required level, then framework order; one strength below Advanced", () => {
  const sel = selectIdp(fixtureRows());
  assert.equal(IDP_MAX_GAPS, 3);
  // PI is two below; RO and AO (required Advanced) beat DSP and IM (required Basic) on the tie.
  assert.deepEqual(sel.gaps.map((g) => g.code), ["PI", "RO", "AO"]);
  assert.deepEqual(sel.later.map((g) => g.code), ["DSP", "IM"]);
  // Strengths IN, ECC (Advanced) and SM, EDP (Proficient over Basic): SM is first below Advanced.
  assert.deepEqual(strengthsOf(fixtureRows()).map((s) => s.code), ["IN", "ECC", "SM", "EDP"]);
  assert.equal(sel.strength?.code, "SM");
});

test("IDP: framework order breaks a full tie; no strength when every strength is Advanced", () => {
  const row = (code: string, sortOrder: number, res: number, req: number): CompRow => ({ code, name: code, category: "Core", sortOrder, res, req });
  const rows = [row("B", 2, 1, 2), row("A", 1, 1, 2), row("C", 3, 2, 3), row("D", 4, 3, 2)];
  assert.deepEqual(gapsOf(rows).map((r) => r.code), ["C", "A", "B"]);
  assert.equal(selectIdp(rows).strength, null);
  assert.deepEqual(selectIdp(rows, 2).later.map((r) => r.code), ["B"]);
});

test("IDP items: gaps target the required level, the strength one level up, with content for each", () => {
  const items = idpItems(selectIdp(fixtureRows()));
  assert.deepEqual(items.map((i) => [i.row.code, i.type, i.target]), [
    ["PI", "gap", "Advanced"], ["RO", "gap", "Advanced"], ["AO", "gap", "Advanced"], ["SM", "strength", "Advanced"],
  ]);
  for (const i of items) {
    assert.equal(i.goals.length, 2);
    assert.ok(i.actions?.job && i.plan?.smart && i.plan.day90, `${i.row.code} has content`);
  }
});

test("IDP content: every Learning line follows the approved shape", () => {
  // Ali, 17 Oct 2026: a final automated check on every Learning line. Learn (the
  // competency's module first), apply, and something measurable or evidenced;
  // American spelling (Caliber standard, Aiman 18 Oct 2026); readable length. His own 16 Oct lines set the shape, so a
  // single sentence with a measure in it (RO Basic) is accepted.
  const actions = (idpContent as unknown as { actions: Record<string, Record<string, { learning: string }>> }).actions;
  const EVIDENCE =
    /\b(record|recording|document|documenting|gather|gathering|note|show|demonstrate|reflect|present|review|complete|share|track|measurable|measure|test|evaluate|compare)\b/i;
  const UK_SPELLING = /\b(practised|anonymised|recognising|organisational|behaviours?|judgement|centre|programme|prioritis\w+|analys(e|ed|ing)|colour|labelled|whilst)\b/i; // keep-british
  for (const code of SDC_CODES) {
    const want = MODULE[code].match(/^M(\d)/)![1];
    for (const [level, a] of Object.entries(actions[code])) {
      const id = `${code} ${level}`;
      const line = a.learning;
      assert.match(line, new RegExp(`^Apply Module ${want}\\b`), `${id}: should open with "Apply Module ${want}"`);
      assert.match(line, EVIDENCE, `${id}: needs an evidence or measure word (record, document, gather feedback, track...)`);
      const words = line.split(/\s+/).length;
      assert.ok(words >= 15 && words <= 45, `${id}: ${words} words, expected 15 to 45`);
      assert.doesNotMatch(line, UK_SPELLING, `${id}: American spelling`);
      assert.ok(line.endsWith("."), `${id}: ends with a full stop`);
    }
  }
});

test("IDP content: every Learning action starts with the competency's program module", () => {
  // Ali, 14 Oct 2026: the card header (MODULE) and the Learning line must name the same module.
  const actions = (idpContent as unknown as { actions: Record<string, Record<string, { learning: string }>> }).actions;
  for (const code of SDC_CODES) {
    const want = MODULE[code].match(/^M(\d)/)![1];
    for (const [level, a] of Object.entries(actions[code])) {
      assert.equal(a.learning.match(/Module (\d)/)?.[1], want, `${code} ${level}: "${a.learning}" should start with Module ${want}`);
    }
  }
});

// ---------------------------------------------------------------- ranking

const person = (name: string, grade: number, fitBand: 0 | 1 | 2, met: number, total: number, above: number, mean: number): CohortPerson => ({
  id: name, name, grade, unit: null, rows: [],
  fit: { met, total, above, band: fitBand, label: "" },
  reasoning: { tests: [], mean, band: mean >= 70 ? 2 : mean >= 50 ? 1 : 0, label: "" },
});

test("ranking: grid position, then fit band, share met, number exceeded, reasoning, name", () => {
  const people = [
    person("Grid low", 7, 0, 5, 10, 0, 90), // 0 + 2 = 2
    person("Fit wins tie", 7, 2, 10, 10, 2, 55), // 2 + 1 = 3
    person("Reasoning tie", 7, 1, 9, 10, 0, 80), // 1 + 2 = 3, lower fit band
    person("Top", 8, 2, 10, 10, 3, 75), // 4
    person("Share", 7, 1, 8, 10, 1, 85), // 3, fit 1, lower share than "Reasoning tie"
    person("Above", 7, 1, 9, 10, 1, 72), // 3, fit 1, same share as "Reasoning tie", more exceeded
  ];
  assert.deepEqual([...people].sort(compareCohort).map((p) => p.name), ["Top", "Fit wins tie", "Above", "Reasoning tie", "Share", "Grid low"]);
  const a = person("Amal", 5, 1, 4, 5, 0, 60);
  const b = person("Basma", 5, 1, 4, 5, 0, 60);
  assert.deepEqual([b, a].sort(compareCohort).map((p) => p.name), ["Amal", "Basma"]);
  assert.ok(compareCohort(person("x", 5, 1, 4, 5, 0, 61), person("y", 5, 1, 4, 5, 0, 60)) < 0);
});

test("ranking: Managerial (Grades 7 and 8) and Professional (Grades 4 to 6) bands with M and P codes", () => {
  const cohort = assembleCohort({ cands: FIXTURE_CANDIDATES, roster: FIXTURE_ROSTER, sjt: FIXTURE_SJT, psy: FIXTURE_PSY, comps: COMPS, orgName: FIXTURE_ORG });
  const [m, p] = rankCohort(cohort.people, COMPS);
  assert.equal(m.label, "Managerial: Grades 7 and 8 (all 10 competencies required)");
  assert.equal(p.label, "Professional: Grades 4 to 6 (5 core competencies required)");
  assert.deepEqual(m.people.map((x) => `${x.code} ${x.name}`), ["M1 Tariq Al-Ghamdi", "M2 Faisal Al-Dosari", "M3 Hind Al-Mutairi", "M4 Huda Al-Zahrani"]);
  assert.deepEqual(p.people.map((x) => x.code), ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
  assert.equal(p.people[0].name, "Nasser Al-Harbi");
  assert.equal(m.people[3].place, "Untapped ability");
  const rates = gapRates(cohort.people, COMPS);
  assert.equal(rates[0].code, "RO");
  assert.equal(rates.find((r) => r.code === "SM")!.n, 4); // leadership counts only where required (Grades 7 and 8)
});

// ---------------------------------------------------------------- assembly

test("cohort: completed and scored people on the roster, testers and unfinished people left out", () => {
  const c = assembleCohort({ cands: FIXTURE_CANDIDATES, roster: FIXTURE_ROSTER, sjt: FIXTURE_SJT, psy: FIXTURE_PSY, comps: COMPS, orgName: FIXTURE_ORG });
  assert.equal(c.people.length, 12);
  assert.ok(!c.people.some((p) => p.name === "Test Account" || p.name === "Omar Al-Qahtani"));
  assert.equal(c.rosterCount, 15); // 16 roster rows, one tester
  assert.equal(c.incomplete, 0);
  // A completed person whose reasoning result is missing is counted, not shown.
  const noPsy = assembleCohort({ cands: FIXTURE_CANDIDATES, roster: FIXTURE_ROSTER, sjt: FIXTURE_SJT, psy: FIXTURE_PSY.slice(1), comps: COMPS, orgName: null });
  assert.equal(noPsy.people.length, 11);
  assert.equal(noPsy.incomplete, 1);
});

test("candidate: clear errors for a missing grade, unfinished sitting, scenario or reasoning result", () => {
  const cand = FIXTURE_CANDIDATES[0];
  const roster = FIXTURE_ROSTER[0];
  const sjt = FIXTURE_SJT[0];
  const psy = FIXTURE_PSY[0];
  const base = { cand, roster, sjt, psy, comps: COMPS, orgName: FIXTURE_ORG };
  const ok = assembleCandidate(base);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.data.assessedOn, "11 October 2026");
    assert.deepEqual(ok.data.scenarios, { total: 30, perCompetency: 3 });
  }
  const err = (r: ReturnType<typeof assembleCandidate>) => (r.ok ? "" : `${r.status} ${r.error}`);
  assert.equal(err(assembleCandidate({ ...base, roster: { ...roster, grade: null } })), "400 No grade on the roster for this person.");
  assert.equal(err(assembleCandidate({ ...base, roster: null })), "400 No grade on the roster for this person.");
  assert.match(err(assembleCandidate({ ...base, cand: { ...cand, status: "in_progress" } })), /^400 .*not completed/);
  assert.match(err(assembleCandidate({ ...base, sjt: { ...sjt, submitted_at: null } })), /^400 The scenario section/);
  assert.match(err(assembleCandidate({ ...base, psy: null })), /^400 No Logica reasoning/);
});

test("formatAssessed uses Saudi time; scenario counts need every competency", () => {
  assert.equal(formatAssessed("2026-10-21T22:30:00Z"), "22 October 2026");
  assert.equal(formatAssessed(null), null);
  assert.equal(scenarioCounts({ IN: { items: 3 } }, ["IN", "RO"]), null);
  assert.deepEqual(scenarioCounts({ IN: { items: 3 }, RO: { items: 4 } }, ["IN", "RO"]), { total: 7, perCompetency: null });
});

// ---------------------------------------------------------------- HTML text

test("reports: VIFM branding, no sample wording, no em dashes, two named reasoning tests", () => {
  const built = assembleCandidate({ cand: FIXTURE_CANDIDATES[0], roster: FIXTURE_ROSTER[0], sjt: FIXTURE_SJT[0], psy: FIXTURE_PSY[0], comps: COMPS, orgName: FIXTURE_ORG });
  assert.ok(built.ok);
  if (!built.ok) return;
  const summary = renderSdcSummaryHtml(built.data);
  const idp = renderSdcIdpHtml(built.data);
  const group = renderSdcGroupHtml(assembleCohort({ cands: FIXTURE_CANDIDATES, roster: FIXTURE_ROSTER, sjt: FIXTURE_SJT, psy: FIXTURE_PSY, comps: COMPS, orgName: FIXTURE_ORG }));
  for (const html of [summary, idp, group]) {
    assert.ok(!/sample|illustrative/i.test(html), "no sample wording");
    assert.ok(!/\u2014/.test(html), "no em dashes");
    assert.match(html, /Prepared for Soudah Development Company/);
    assert.match(html, /Virginia Institute of Finance and Management {2}\| {2}Confidential/);
  }
  assert.match(summary, /mean of two Logica tests/);
  assert.match(summary, /two timed Logica reasoning tests \(Numerical and Inductive\)/);
  assert.ok(!/(three|3) (timed )?Logica|Deductive/i.test(summary), "no third Logica test");
  assert.match(summary, /30 scenario questions/);
  assert.match(summary, /Assessed 11 October 2026/);
  assert.match(idp, /Also below the requirement, to plan after day 90:<\/b> Drives Sustainable Performance and Inspires &amp; Motivates\./);
  assert.match(idp, />3 \+ 1</);
  assert.match(group, /12 \/ 15/);
});

test("reports: a Grade 5 summary shows leadership as development only", () => {
  const i = FIXTURE_CANDIDATES.findIndex((c) => c.full_name === "Rawan Al-Malki");
  const built = assembleCandidate({ cand: FIXTURE_CANDIDATES[i], roster: FIXTURE_ROSTER[i], sjt: FIXTURE_SJT[i], psy: FIXTURE_PSY[i], comps: COMPS, orgName: null });
  assert.ok(built.ok);
  if (!built.ok) return;
  const html = renderSdcSummaryHtml(built.data);
  assert.equal(html.match(/Development only/g)?.length, 5);
  assert.match(html, /Leadership competencies are not required below Grade 7/);
  assert.ok(!html.includes("Prepared for"), "no organization line without an organization");
});

test("Ali's review, 14 Oct: top three priorities, direction not a promise, baseline, target and owner, a rushed sitting flagged", () => {
  const i = FIXTURE_CANDIDATES.findIndex((c) => c.full_name === "Joud Al-Balawi");
  const built = assembleCandidate({
    cand: FIXTURE_CANDIDATES[i], roster: FIXTURE_ROSTER[i], sjt: FIXTURE_SJT[i], psy: FIXTURE_PSY[i],
    session: FIXTURE_SESSIONS.find((s) => s.id === FIXTURE_CANDIDATES[i].cognitive_session_id) ?? null, comps: COMPS, orgName: FIXTURE_ORG,
  });
  assert.ok(built.ok);
  if (!built.ok) return;
  assert.equal(built.data.reasoning.check?.rushed, true);
  const summary = renderSdcSummaryHtml(built.data);
  assert.match(summary, /Check before use\.<\/b> Finished in 2 minutes \(about 7 seconds a question\), with 2 of 18 questions unanswered/);
  assert.ok(!/class="pill gray cnt"/.test(summary), "no count when every gap is listed");
  assert.equal(summary.match(/<li><svg[^>]*>.*?<\/svg><span><b>[^<]+<\/b>: [A-Za-z ]+, required/g)?.length, 3, "three priorities (no strengths at this level)");

  const idp = renderSdcIdpHtml(built.data);
  assert.match(idp, /Development direction \(Proficient behaviors\)/);
  assert.ok(!/Goal behaviors \(/.test(idp), "no 'goal behaviors' label");
  assert.match(idp, /Below Basic now, developing towards Basic, the level required for Grade 5|Basic now, developing towards Proficient, the level required for Grade 5/);
  assert.match(idp, /Baseline<\/div>(Below Basic|Basic) on the Caliber scenarios, 1[0-8] October 2026/);
  assert.match(idp, /90-day target<\/div>By day 90/);
  assert.match(idp, /Evidence owner<\/div>Line manager confirms; VIFM coach records/);
  assert.match(idp, /a change of level is confirmed only by the post-program reassessment/);
  assert.match(idp, /Check before use/);

  // A normal sitting carries no note; the group report marks only the rushed one.
  const huda = assembleCandidate({
    cand: FIXTURE_CANDIDATES[0], roster: FIXTURE_ROSTER[0], sjt: FIXTURE_SJT[0], psy: FIXTURE_PSY[0],
    session: FIXTURE_SESSIONS[0], comps: COMPS, orgName: FIXTURE_ORG,
  });
  assert.ok(huda.ok && huda.data.reasoning.check?.note === null);
  if (huda.ok) {
    const hs = renderSdcSummaryHtml(huda.data);
    assert.match(hs, />Top 3 of 5</);
    assert.ok(!/Check before use/.test(hs));
  }
  const group = renderSdcGroupHtml(assembleCohort({
    cands: FIXTURE_CANDIDATES, roster: FIXTURE_ROSTER, sjt: FIXTURE_SJT, psy: FIXTURE_PSY, sessions: FIXTURE_SESSIONS, comps: COMPS, orgName: FIXTURE_ORG,
  }));
  assert.equal(group.match(/class="chk">check</g)?.length, 1);
  assert.match(group, /Reasoning finished in 2 minutes; check before use/);
  assert.match(group, /"check" marks a reasoning section finished at under 10 seconds a question on average/);
});

test("filed report kinds for the SDC reports", () => {
  assert.equal(reportKindLabel("sdc_summary"), "SDC Executive Summary");
  assert.equal(reportKindLabel("sdc_idp"), "SDC Individual Development Plan");
  assert.match(
    buildReportStoragePath({ orgId: "x", orgName: "Soudah", bundleId: "b", bundleName: "HiPo", candidateId: "0e9d8c7b-0000", candidateName: "Huda", kind: "sdc_idp" }),
    /\/sdc_idp\.pdf$/,
  );
});
