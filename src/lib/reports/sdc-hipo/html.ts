// SDC High-Potential reports as A4 HTML (executive summary, individual
// development plan, group report), ported from the samples SDC approved on
// 8 Oct 2026 (scripts/sdc-hipo/build-reports.js). Pure string building: the
// route renders the HTML to PDF with the shared Chromium launcher.

import { esc, svg, vifmLogoDark, FONT_LINKS, BASE_CSS } from "./brand";
import {
  GRID, GRADE_LABEL, MODULE, levelName, fit as fitOf, strengthsOf, gapsOf, selectIdp, idpItems,
  reasoningTestsPhrase, numberWord, rankCohort, compareCodes, gapRates, leadershipFromGrade, gradeSpan, joinAnd,
  type CompRow, type Reasoning, type SdcCompetency, type CohortPerson, type RankedPerson, type IdpItem,
} from "./rules";

export type SdcCandidateReport = {
  orgName: string | null;
  name: string;
  grade: number;
  position: string | null;
  unit: string | null;
  /** completed_at as "22 October 2026" (Asia/Riyadh), or null. */
  assessedOn: string | null;
  comps: SdcCompetency[];
  rows: CompRow[];
  reasoning: Reasoning;
  /** Scenario questions answered in total and per competency, when known. */
  scenarios: { total: number; perCompetency: number | null } | null;
};

export type SdcCohortReport = {
  orgName: string | null;
  comps: SdcCompetency[];
  people: CohortPerson[];
  /** People on the approved list who are not testers. */
  rosterCount: number;
  /** Completed people left out because a result is missing. */
  incomplete: number;
};

const FOOT_RIGHT = "Virginia Institute of Finance and Management  |  Confidential";
const PROGRAMME = "SDC High-Potential Assessment";

const EXTRA_CSS = `
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; min-height:38px; }
.top .tag { font-size:8.5px; letter-spacing:2px; text-transform:uppercase; color:var(--accent); font-weight:700; text-align:right; }
.band { padding:14px 18px; } .band h1 { font-size:21px; margin:4px 0 2px; }
.lvl { display:inline-flex; gap:3px; vertical-align:middle; }
.lvl i { width:9px; height:9px; border-radius:2px; background:var(--gray); display:inline-block; }
.lvl i.on { background:var(--accent); } .lvl i.req { outline:1.5px solid var(--navy); outline-offset:1px; }
.gp { font-weight:700; font-size:9px; padding:1px 7px; border-radius:999px; white-space:nowrap; }
.gp.up { background:var(--greenbg); color:var(--green); } .gp.eq { background:var(--pale); color:var(--navy); }
.gp.dn { background:var(--amberbg); color:var(--amber); } .gp.na { background:var(--gray); color:var(--muted); }
.grid9 { display:grid; grid-template-columns:18px repeat(3,1fr); grid-template-rows:repeat(3,1fr) 16px; gap:3px; }
.grid9 .cell { border-radius:5px; padding:4px 5px; font-size:7.6px; line-height:1.25; color:var(--mid); background:var(--off); border:1px solid var(--gray); min-height:44px; position:relative; }
.grid9 .cell b { display:block; font-size:8.2px; color:var(--navy); }
.grid9 .cell.z0 { background:#F8FAFC; } .grid9 .cell.z1 { background:#EEF4FB; } .grid9 .cell.z2 { background:#DCE9F7; }
.grid9 .cell.me { border:2px solid var(--navy); background:#fff; box-shadow:0 0 0 2px var(--pale); }
.grid9 .ax { font-size:7px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; justify-content:center; }
.grid9 .ay { writing-mode:vertical-rl; transform:rotate(180deg); }
.dot { position:absolute; bottom:4px; right:5px; width:10px; height:10px; border-radius:50%; background:var(--navy); }
.kpi { border:1px solid var(--line); border-radius:8px; padding:8px 10px; }
.kpi .v { font-size:18px; font-weight:700; color:var(--navy); line-height:1.15; }
.kpi .l { font-size:8.5px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-weight:700; }
table.t td, table.t th { padding:4px 6px; } table.t td { font-size:9.6px; }
table.t.cp td { padding:3px 6px; }
ul.ind.cp li { margin:0 0 1px; font-size:9.8px; line-height:1.4; }
table.t tr.cat td { background:var(--off); font-size:8px; letter-spacing:1.5px; text-transform:uppercase; color:var(--mid); font-weight:700; padding:3px 6px; }
table.rk { table-layout:fixed; }
.cogrow { display:grid; grid-template-columns:78px 1fr 34px; gap:6px; align-items:center; margin:3px 0; font-size:9.5px; }
.note { font-size:8px; color:var(--muted); line-height:1.4; }
.act { margin-top:1px; } .act td { font-size:8.3px; padding:1px 5px; line-height:1.3; } .act td.h { font-weight:700; color:var(--navy); width:70px; }
.ms { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-top:3px; }
.ms div { border:1px solid var(--line); border-radius:5px; padding:2px 5px; font-size:8px; line-height:1.3; }
.ms b { font-size:7.2px; letter-spacing:1px; text-transform:uppercase; color:var(--accent); margin-right:3px; }
.idp { margin-top:5px; padding:5px 10px; }
.idp .small { font-size:8.5px; line-height:1.36; }
.idpk .kpi { padding:5px 10px; } .idpk .kpi .v { font-size:15px; }
.sig { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:4px; }
.sig div { border-top:1px solid var(--text); padding-top:3px; font-size:8.5px; color:var(--muted); }
.initials { display:flex; flex-wrap:wrap; gap:2px; margin-top:3px; }
.initials span { font-size:7px; font-weight:700; background:var(--navy); color:#fff; border-radius:3px; padding:0 3px; }
.hbar { display:grid; grid-template-columns:150px 1fr 40px; gap:6px; align-items:center; font-size:8.8px; margin:2px 0; }
`;

function doc(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>${FONT_LINKS}<style>${BASE_CSS}${EXTRA_CSS}</style></head><body>${body}</body></html>`;
}

const pfoot = (left: string) => `<div class="pfoot"><span>${esc(left)}</span><span>${esc(FOOT_RIGHT)}</span></div>`;

function topBar(orgName: string | null): string {
  const logo = vifmLogoDark();
  return `<div class="top">${logo ? `<img src="${logo}" style="height:38px" alt="VIFM">` : `<b style="color:var(--navy);font-size:16px">VIFM</b>`}<div class="tag">Caliber  |  ${esc(PROGRAMME)}${orgName ? `<br><span style="color:var(--muted);letter-spacing:1px">Prepared for ${esc(orgName)}</span>` : ""}</div></div>`;
}

const lvlBar = (res: number, req: number) =>
  `<span class="lvl">${[1, 2, 3].map((n) => `<i class="${n <= res ? "on" : ""} ${n === req ? "req" : ""}"></i>`).join("")}</span>`;

function gapPill(res: number, req: number): string {
  if (!req) return `<span class="gp na">Development only</span>`;
  const d = res - req;
  if (d > 0) return `<span class="gp up">Above +${d}</span>`;
  if (d === 0) return `<span class="gp eq">Meets</span>`;
  return `<span class="gp dn">Gap ${d}</span>`;
}

const GRID_RULES = `<b>Placement rules.</b> Competency fit: <b>Above</b> = every required competency met and at least two exceeded; <b>Meets</b> = at least 80% of required competencies met, which includes candidates who meet all of them but exceed fewer than two; <b>Below</b> = fewer than 80% met. Reasoning performance: <b>Strong</b> = 70% or more; <b>Solid</b> = 50% to 69%; <b>Developing</b> = below 50%.`;

function grid9(cogBand: number, fitBand: number, opts: { people?: RankedPerson[]; rules?: boolean } = {}): string {
  let h = `<div class="grid9">`;
  for (let r = 2; r >= 0; r--) {
    h += `<div class="ax ay">${["Developing", "Solid", "Strong"][r]}</div>`;
    for (let c = 0; c <= 2; c++) {
      const g = GRID[r][c];
      const me = r === cogBand && c === fitBand;
      const zone = r + c >= 4 ? 2 : r + c >= 2 ? 1 : 0;
      let inner: string;
      if (opts.people) {
        const here = opts.people.filter((p) => p.reasoning.band === r && p.fit.band === c).sort((x, y) => compareCodes(x.code, y.code));
        inner = `<span class="muted">${here.length} candidate${here.length === 1 ? "" : "s"}</span><div class="initials">${here.map((p) => `<span>${esc(p.code)}</span>`).join("")}</div>`;
      } else {
        inner = esc(g.d);
      }
      h += `<div class="cell z${zone} ${me ? "me" : ""}"><b>${esc(g.t)}</b>${inner}${me ? `<span class="dot"></span>` : ""}</div>`;
    }
  }
  h += `<div></div>${["Below", "Meets", "Above"].map((x) => `<div class="ax">${x}</div>`).join("")}</div>`;
  h += `<div style="display:flex;justify-content:space-between" class="note"><span>Vertical: reasoning performance (Logica)</span><span>Horizontal: competency fit against the required level for the grade</span></div>`;
  if (opts.rules) h += `<p class="note" style="margin:4px 0 0">${GRID_RULES}</p>`;
  return h;
}

function gradeText(grade: number): string {
  return `Grade ${grade}${GRADE_LABEL[grade] ? ` ${GRADE_LABEL[grade]}` : ""}`;
}

function header(r: SdcCandidateReport, title: string): string {
  const sub = [gradeText(r.grade), r.position, r.unit, r.assessedOn ? `Assessed ${r.assessedOn}` : null].filter(Boolean) as string[];
  return `${topBar(r.orgName)}
<div class="band"><div class="eyebrow">${esc(title)}</div><h1>${esc(r.name)}</h1>
<div class="sub">${sub.map(esc).join("  |  ")}</div></div>`;
}

// ---------------------------------------------------------------- 1. Executive summary

export function renderSdcSummaryHtml(r: SdcCandidateReport): string {
  const F = fitOf(r.rows);
  const G = r.reasoning;
  const P = GRID[G.band][F.band];
  const strengths = strengthsOf(r.rows).slice(0, 3);
  const gaps = gapsOf(r.rows);
  const testsPhrase = reasoningTestsPhrase(G);

  let comp = "";
  for (const cat of ["Core", "Leadership"]) {
    const rows = r.rows.filter((x) => x.category === cat);
    if (!rows.length) continue;
    comp += `<tr class="cat"><td colspan="5">${cat} competencies</td></tr>`;
    for (const x of rows) {
      comp += `<tr><td><b>${esc(x.name)}</b></td><td>${x.req ? levelName(x.req) : '<span class="muted">Not required</span>'}</td><td>${lvlBar(x.res, x.req)} <span style="margin-left:4px">${levelName(x.res)}</span></td><td>${gapPill(x.res, x.req)}</td><td class="small muted" style="white-space:nowrap;font-size:8.4px">${esc(MODULE[x.code] ?? "")}</td></tr>`;
    }
  }
  const li = (s: CompRow, icon: "check" | "target") =>
    `<li>${svg(icon, 12)}<span><b>${esc(s.name)}</b>: ${levelName(s.res)}, required ${levelName(s.req)}</span></li>`;
  const scen = r.scenarios;
  const scenText = scen && scen.total > 0
    ? `${scen.total} scenario questions${scen.perCompetency ? ` (${scen.perCompetency === 3 ? "three" : scen.perCompetency} per competency)` : ""}`
    : "scenario questions";
  const leadFrom = leadershipFromGrade(r.comps);

  const body = `<div class="page">${header(r, "Executive summary")}
<div style="display:grid;grid-template-columns:1.15fr 1fr;gap:12px;margin-top:10px">
  <div class="card"><div class="eyebrow">${svg("target")} Potential placement</div>${grid9(G.band, F.band, { rules: true })}</div>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div class="card soft"><div class="eyebrow">${svg("star")} Headline</div>
      <div style="font-size:16px;font-weight:700;color:var(--navy)">${esc(P.t)}</div>
      <p style="margin:3px 0 0">${esc(P.d)} Meets ${F.met} of ${F.total} competencies required for Grade ${r.grade}, exceeding ${F.above}, with ${esc(G.label.toLowerCase())} reasoning.</p></div>
    <div class="grid2">
      <div class="kpi"><div class="l">Competency fit</div><div class="v">${F.met} / ${F.total}</div><div class="small muted">required competencies met, ${F.above} above</div></div>
      <div class="kpi"><div class="l">Reasoning performance</div><div class="v">${G.mean}%</div><div class="small muted">${esc(G.label)} (mean of ${numberWord(G.tests.length)} Logica test${G.tests.length === 1 ? "" : "s"})</div></div>
    </div>
    <div class="card"><div class="eyebrow">${svg("brain")} Reasoning tests</div>
      ${G.tests.map((t) => `<div class="cogrow"><span>${esc(t.name)}</span><div class="bar"><div class="fill" style="width:${t.pct}%"></div></div><b>${t.pct}%</b></div>`).join("")}
    </div>
  </div>
</div>
<h2 style="margin-top:12px">Competency results against the Grade ${r.grade} requirement</h2>
<table class="t cp"><tr><th>Competency</th><th style="width:78px">Required</th><th style="width:120px">Result</th><th style="width:90px">Required vs result</th><th style="width:118px">Programme module</th></tr>${comp}</table>
<div class="grid2" style="margin-top:10px">
  <div class="card"><div class="eyebrow">${svg("plus")} Strengths to build on</div>${strengths.length ? `<ul class="ind pos cp">${strengths.map((s) => li(s, "check")).join("")}</ul>` : `<p class="small muted" style="margin:0">No required competency is above the level for Grade ${r.grade} yet.</p>`}</div>
  <div class="card"><div class="eyebrow">${svg("trend")} Development priorities</div>${gaps.length ? `<ul class="ind neg cp">${gaps.map((s) => li(s, "target")).join("")}</ul>` : `<p class="small muted" style="margin:0">Every required competency is at or above the level for Grade ${r.grade}.</p>`}</div>
</div>
<p class="note" style="margin-top:8px"><b>How to read this.</b> Competency results come from ${esc(scenText)} that measure judgement in realistic SDC work situations; they are not observations of behaviour at work. Reasoning performance is the mean accuracy on ${esc(testsPhrase)}. Bands are indicative until an SDC cohort norm is available. This summary is one input to talent decisions, not a decision on its own.${leadFrom != null ? ` Leadership competencies are not required below Grade ${leadFrom} and are then shown for development only.` : ""}</p>
${pfoot(`${PROGRAMME}  |  Executive summary`)}</div>`;
  return doc(`${r.name}: SDC executive summary`, body);
}

// ---------------------------------------------------------------- 2. Individual development plan

function idpCard(p: IdpItem, i: number): string {
  const isGap = p.type === "gap";
  const label = isGap ? "Close the gap" : "Build on a strength";
  const parts: string[] = [];
  if (p.goals.length) parts.push(`<div class="small" style="margin:2px 0 1px"><b>Goal behaviours (${p.target}):</b> ${p.goals.map(esc).join("; ")}.</div>`);
  if (p.plan) parts.push(`<div class="small" style="margin:0 0 2px"><b>SMART goal:</b> ${esc(p.plan.smart)}</div>`);
  if (p.actions) {
    parts.push(`<table class="act"><tr><td class="h">On the job</td><td>${esc(p.actions.job)}</td></tr><tr><td class="h">Coaching</td><td>${esc(p.actions.coaching)}</td></tr><tr><td class="h">Learning</td><td>${esc(p.actions.learning)}</td></tr></table>`);
  }
  if (p.plan) {
    parts.push(`<div class="ms"><div><b>Day 30</b>${esc(p.plan.day30)}</div><div><b>Day 60</b>${esc(p.plan.day60)}</div><div><b>Day 90</b>${esc(p.plan.day90)}</div></div>`);
    parts.push(`<div class="small" style="margin-top:2px"><b>Evidence of progress:</b> ${esc(p.plan.evidence)}</div>`);
  }
  if (!p.plan && !p.actions) parts.push(`<div class="small muted">Actions and milestones for this level are agreed with the participant at the Module 1 debrief.</div>`);
  return `<div class="card idp">
  <div style="display:flex;justify-content:space-between;align-items:center"><div><span class="pill ${isGap ? "amber" : "green"}">${i + 1}. ${label}</span> <b style="font-size:12px;color:var(--navy);margin-left:4px">${esc(p.row.name)}</b></div>
  <div class="small muted">${levelName(p.row.res)} now, target ${p.target}  |  ${esc(MODULE[p.row.code] ?? "")}</div></div>
  ${parts.join("\n  ")}</div>`;
}

export function renderSdcIdpHtml(r: SdcCandidateReport): string {
  const F = fitOf(r.rows);
  const G = r.reasoning;
  const P = GRID[G.band][F.band];
  const sel = selectIdp(r.rows);
  const items = idpItems(sel);
  const strengths = strengthsOf(r.rows).slice(0, 3);
  const nGaps = sel.gaps.length;
  const prioV = sel.strength ? (nGaps ? `${nGaps} + 1` : "1") : String(nGaps);
  const prioSub = nGaps && sel.strength
    ? `gap${nGaps === 1 ? "" : "s"} to close, plus one strength to build`
    : nGaps
      ? `gap${nGaps === 1 ? "" : "s"} to close`
      : sel.strength ? "strength to build" : "no gaps against the grade";

  const later = sel.later.length
    ? `<p class="small" style="margin:4px 0 0"><b>Also below the requirement, to plan after day 90:</b> ${esc(joinAnd(sel.later.map((x) => x.name)))}.</p>`
    : "";
  const empty = items.length === 0
    ? `<div class="card soft" style="margin-top:8px"><p style="margin:0">Every required competency meets the level for Grade ${r.grade}. Agree stretch goals with the participant at the Module 1 debrief.</p></div>`
    : "";

  const body = `<div class="page">${header(r, "Individual development plan")}
<div class="grid3 idpk" style="margin-top:8px">
  <div class="kpi"><div class="l">Placement</div><div class="v">${esc(P.t)}</div><div class="small muted">${esc(F.label)}, ${esc(G.label.toLowerCase())} reasoning</div></div>
  <div class="kpi"><div class="l">Priorities</div><div class="v">${prioV}</div><div class="small muted">${prioSub}</div></div>
  <div class="kpi"><div class="l">Review points</div><div class="v">Day 30, 60, 90</div><div class="small muted">milestones, then post-programme reassessment</div></div>
</div>
${items.map(idpCard).join("")}${empty}
${later}
${strengths.length ? `<div class="card soft" style="margin-top:5px;padding:5px 10px;display:flex;gap:6px;align-items:baseline"><span style="color:var(--accent)">${svg("star", 12)}</span>
<p class="small" style="margin:0"><b>Strengths to use while developing:</b> ${strengths.map((s) => `<b>${esc(s.name)}</b> (${levelName(s.res)})`).join(", ")}. Look for roles in team projects that use these.</p></div>` : ""}
<div class="sig" style="margin-top:18px"><div>Participant</div><div>VIFM coach</div><div>SDC Talent Development</div></div>
<p class="note" style="margin-top:4px;font-size:7.6px">Goal behaviours are taken from the SDC behavioural indicators for the target level. Goals follow the SMART format (Doran, 1981). The mix of on-the-job, coaching and learning actions follows the programme's 70-20-10 development approach (Lombardo and Eichinger, 1996; Center for Creative Leadership); it guides the balance of activities and is not a scoring formula. The plan is agreed with the participant at the Module 1 debrief and reviewed at each milestone; progress is measured again in the post-programme assessment.</p>
${pfoot(`${PROGRAMME}  |  Individual development plan`)}</div>`;
  return doc(`${r.name}: SDC individual development plan`, body);
}

// ---------------------------------------------------------------- 3. Group report

/**
 * Splits the ranking table across pages once fonts are loaded, measuring the
 * real row heights (names and business units may wrap): rows that run into a
 * page's footer move to a continuation page, a band's heading is repeated
 * there ("continued"), and the closing note goes after the table or on a page
 * of its own. The PDF renderer calls window.__sdcLayout() before printing.
 */
const GROUP_LAYOUT_JS = `
window.__sdcLayout = function () {
  var tpl = document.getElementById("rk-cont");
  var page = document.querySelector(".page.rk-first");
  if (!tpl || !page) return 0;
  var note = document.getElementById("rk-note");
  var GAP = 6;
  function limit(pg) { return pg.querySelector(".pfoot").getBoundingClientRect().top - GAP; }
  function bottom(el) { return el.getBoundingClientRect().bottom; }
  function fresh(withTable) {
    var pg = tpl.content.firstElementChild.cloneNode(true);
    if (!withTable) { var t = pg.querySelector("table.rk"); t.parentNode.removeChild(t); var h = pg.querySelector("h2"); h.parentNode.removeChild(h); }
    return pg;
  }
  var guard = 0;
  while (guard++ < 200) {
    var body = page.querySelector("table.rk tbody");
    if (bottom(body) <= limit(page)) break;
    var next = fresh(true);
    page.parentNode.insertBefore(next, page.nextSibling);
    var nbody = next.querySelector("table.rk tbody");
    while (body.rows.length > 1 && bottom(body) > limit(page)) nbody.insertBefore(body.rows[body.rows.length - 1], nbody.firstChild);
    // A band heading never stays alone at the foot of a page.
    var last = body.rows[body.rows.length - 1];
    if (last && last.classList.contains("cat") && body.rows.length > 1) nbody.insertBefore(last, nbody.firstChild);
    var head = nbody.rows[0];
    if (head && !head.classList.contains("cat")) {
      var cat = document.createElement("tr");
      cat.className = "cat";
      cat.innerHTML = '<td colspan="7"></td>';
      cat.firstChild.textContent = head.getAttribute("data-band") + " (continued)";
      nbody.insertBefore(cat, head);
    }
    page = next;
  }
  if (note) {
    page.querySelector(".rk-wrap").appendChild(note);
    if (bottom(note) > limit(page)) {
      var own = fresh(false);
      page.parentNode.insertBefore(own, page.nextSibling);
      own.querySelector(".rk-wrap").appendChild(note);
      page = own;
    }
  }
  var nums = document.querySelectorAll(".page .pno");
  for (var i = 0; i < nums.length; i++) nums[i].textContent = nums.length > 1 ? "  |  Page " + (i + 1) + " of " + nums.length : "";
  return nums.length;
};`;

export function renderSdcGroupHtml(c: SdcCohortReport): string {
  const bands = rankCohort(c.people, c.comps);
  const ranked = bands.flatMap((b) => b.people);
  const rates = gapRates(c.people, c.comps).filter((g) => g.n > 0).slice(0, 6);
  const hi = ranked.filter((p) => p.reasoning.band === 2 && p.fit.band === 2).length;
  const grades = c.people.map((p) => p.grade);

  const pill = (p: RankedPerson) => (p.reasoning.band + p.fit.band >= 4 ? "navy" : p.reasoning.band + p.fit.band >= 2 ? "light" : "gray");
  let rows = "";
  for (const b of bands) {
    if (!b.people.length) continue;
    rows += `<tr class="cat"><td colspan="7">${esc(b.label)}</td></tr>`;
    for (const p of b.people) {
      rows += `<tr data-band="${esc(b.label)}"><td><b>${esc(p.code)}</b></td><td><b>${esc(p.name)}</b></td><td>G${p.grade}</td><td class="small">${esc(p.unit ?? "")}</td><td>${p.fit.met}/${p.fit.total}${p.fit.above ? ` <span class="small muted">(+${p.fit.above})</span>` : ""}</td><td>${p.reasoning.mean}%</td><td><span class="pill ${pill(p)}" style="font-size:8.5px;white-space:nowrap">${esc(p.place)}</span></td></tr>`;
    }
  }
  const table = (body: string) =>
    `<table class="t rk"><colgroup><col style="width:36px"><col><col style="width:42px"><col style="width:178px"><col style="width:66px"><col style="width:64px"><col style="width:130px"></colgroup><thead><tr><th>Rank</th><th>Candidate</th><th>Grade</th><th>Business unit</th><th>Required met</th><th>Reasoning</th><th>Placement</th></tr></thead><tbody>${body}</tbody></table>`;
  // The page number is filled in by the layout script once the page count is known.
  const foot = `<div class="pfoot"><span>${esc(`${PROGRAMME}  |  Group report`)}<span class="pno"></span></span><span>${esc(FOOT_RIGHT)}</span></div>`;

  const note = `<p class="note" id="rk-note" style="margin-top:8px"><b>How the ranking works.</b> Candidates are ranked within their grade band, because required levels differ by grade: first by position on the grid (competency fit plus reasoning performance), then by competency fit, share of required competencies met and number exceeded, then by reasoning accuracy. "(+n)" is the number of required competencies exceeded. Rankings support the cohort selection discussion with SDC; they are not a selection decision on their own.${c.incomplete ? ` ${c.incomplete} completed ${c.incomplete === 1 ? "person is" : "people are"} not shown because a scenario or reasoning result is missing.` : ""}</p>`;

  const first = `<div class="page rk-first">${topBar(c.orgName)}
<div class="band"><div class="eyebrow">Group report</div><h1>HiPo cohort overview</h1><div class="sub">${c.people.length} candidate${c.people.length === 1 ? "" : "s"} assessed${grades.length ? `  |  ${esc(gradeSpan(grades))}` : ""}  |  Ranked within grade band</div></div>
<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:12px;margin-top:10px">
  <div class="card"><div class="eyebrow">${svg("users")} Cohort placement</div>${grid9(-1, -1, { people: ranked, rules: true })}<p class="note" style="margin:4px 0 0">Codes match the ranking table below: M = Managerial (Grades 7 and 8), P = Professional (Grades 4 to 6), numbered by rank within the band.</p></div>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div class="grid2">
      <div class="kpi"><div class="l">Completed</div><div class="v">${c.people.length} / ${c.rosterCount}</div><div class="small muted">of the approved list, testers excluded</div></div>
      <div class="kpi"><div class="l">High potential</div><div class="v">${hi}</div><div class="small muted">above requirement and strong reasoning</div></div>
    </div>
    <div class="card"><div class="eyebrow">${svg("trend")} Where the cohort falls below the requirement</div>
      ${rates.map((g) => `<div class="hbar"><span>${esc(g.name)}</span><div class="bar"><div class="fill" style="width:${g.pct}%;background:var(--amber)"></div></div><b>${g.pct}%</b></div>`).join("")}
      <p class="note" style="margin:4px 0 0">Share of candidates for whom the competency is required who are below their grade's level. Use it to set group learning priorities.</p></div>
  </div>
</div>
<div class="rk-wrap"><h2 style="margin-top:12px">Ranking</h2>
${table(rows)}
${note}</div>
${foot}</div>`;
  const cont = `<template id="rk-cont"><div class="page">${topBar(c.orgName)}<div class="rk-wrap"><h2>Ranking (continued)</h2>${table("")}</div>${foot}</div></template>`;
  return doc("SDC group report", `${first}${cont}<script>${GROUP_LAYOUT_JS}</script>`);
}
