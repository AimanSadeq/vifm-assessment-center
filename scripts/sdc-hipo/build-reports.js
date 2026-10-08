// SDC HiPo sample reports: executive summary, IDP, group report (A4 HTML -> PDF).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const REPO = path.join(__dirname, "..", "..");
const { esc, svg, doc, LOGO_DARK } = require(path.join(REPO, "scripts", "cbi-pack", "html-common.js"));
const D = require("./data");
// IDP content is single-sourced from idp_actions.py (the sheet Ali reviews), so samples and Caliber match.
const IDP = JSON.parse(execFileSync("python3", ["-c", "import json, idp_actions as a; print(json.dumps({'actions': a.ACTIONS, 'plan': a.PLAN}))"], { cwd: __dirname }).toString());
const OUT = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const SAMPLE = "Illustrative sample: fictional candidates and results";
const EXTRA_CSS = `
<style>
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
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
table.t tr.cat td { background:var(--off); font-size:8px; letter-spacing:1.5px; text-transform:uppercase; color:var(--mid); font-weight:700; padding:3px 6px; }
.cogrow { display:grid; grid-template-columns:78px 1fr 34px; gap:6px; align-items:center; margin:3px 0; font-size:9.5px; }
.note { font-size:8px; color:var(--muted); line-height:1.4; }
.chip { display:inline-block; font-size:7.6px; padding:0 5px; border-radius:4px; background:var(--gray); color:var(--mid); font-weight:600; }
.act td { font-size:8.6px; padding:2px 5px; } .act td.h { font-weight:700; color:var(--navy); width:74px; }
.ms { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-top:4px; }
.ms div { border:1px solid var(--line); border-radius:5px; padding:3px 5px; font-size:8.2px; line-height:1.3; }
.ms b { display:block; font-size:7.4px; letter-spacing:1px; text-transform:uppercase; color:var(--accent); }
.sig { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:6px; }
.sig div { border-top:1px solid var(--text); padding-top:3px; font-size:8.5px; color:var(--muted); }
.initials { display:flex; flex-wrap:wrap; gap:2px; margin-top:3px; }
.initials span { font-size:7px; font-weight:700; background:var(--navy); color:#fff; border-radius:3px; padding:0 3px; }
.hbar { display:grid; grid-template-columns:150px 1fr 40px; gap:6px; align-items:center; font-size:8.8px; margin:2px 0; }
</style>`;

const levelName = (n) => D.LEVELS[n];
const lvlBar = (res, req) => `<span class="lvl">${[1, 2, 3].map((n) => `<i class="${n <= res ? "on" : ""} ${n === req ? "req" : ""}"></i>`).join("")}</span>`;
function gapPill(res, req, grade, cat) {
  if (!req) return `<span class="gp na">Development only</span>`;
  const d = res - req;
  if (d > 0) return `<span class="gp up">Above +${d}</span>`;
  if (d === 0) return `<span class="gp eq">Meets</span>`;
  return `<span class="gp dn">Gap ${d}</span>`;
}
const pfoot = (left) => `<div class="pfoot"><span>${esc(left)}</span><span>Virginia Institute of Finance and Management  |  Confidential</span></div>`;
function topBar(tag) {
  return `<div class="top"><img src="${LOGO_DARK}" style="height:38px" alt="VIFM"><div class="tag">${esc(tag)}<br><span style="color:var(--muted);letter-spacing:1px">Prepared for Soudah Development Company</span></div></div>`;
}
const GRID_RULES = `<b>Placement rules.</b> Competency fit: <b>Above</b> = every required competency met and at least two exceeded; <b>Meets</b> = at least 80% of required competencies met, which includes candidates who meet all of them but exceed fewer than two; <b>Below</b> = fewer than 80% met. Reasoning performance: <b>Strong</b> = 70% or more; <b>Solid</b> = 50% to 69%; <b>Developing</b> = below 50%.`;
function grid9(cogBand, fitBand, opts = {}) {
  let h = `<div class="grid9">`;
  for (let r = 2; r >= 0; r--) {
    h += `<div class="ax ay">${["Developing", "Solid", "Strong"][r]}</div>`;
    for (let c = 0; c <= 2; c++) {
      const g = D.GRID[r][c]; const me = r === cogBand && c === fitBand;
      const zone = r + c >= 4 ? 2 : r + c >= 2 ? 1 : 0;
      const people = opts.people ? opts.people.filter((p) => p.cb === r && p.fb === c).sort((x, y) => x.ini[0] === y.ini[0] ? parseInt(x.ini.slice(1)) - parseInt(y.ini.slice(1)) : (x.ini < y.ini ? -1 : 1)) : [];
      h += `<div class="cell z${zone} ${me ? "me" : ""}"><b>${esc(g.t)}</b>${opts.people ? `<span class="muted">${people.length} candidate${people.length === 1 ? "" : "s"}</span><div class="initials">${people.map((p) => `<span>${esc(p.ini)}</span>`).join("")}</div>` : esc(g.d)}${me ? `<span class="dot"></span>` : ""}</div>`;
    }
  }
  h += `<div></div>${["Below", "Meets", "Above"].map((x) => `<div class="ax">${x}</div>`).join("")}</div>`;
  h += `<div style="display:flex;justify-content:space-between" class="note"><span>Vertical: reasoning performance (Logica)</span><span>Horizontal: competency fit against the required level for the grade</span></div>`;
  if (opts.rules) h += `<p class="note" style="margin:4px 0 0">${GRID_RULES}</p>`;
  return h;
}
function render(name, html) {
  const htmlPath = path.join(OUT, name + ".html"); const pdfPath = path.join(OUT, name + ".pdf");
  fs.writeFileSync(htmlPath, html);
  execFileSync(process.execPath, [path.join(REPO, "scripts", "cbi-pack", "render-pdf.js"), htmlPath, pdfPath], { stdio: "inherit", cwd: REPO });
  fs.unlinkSync(htmlPath);
}

// ---------------- Candidate computations ----------------
const C = D.CANDIDATE;
const REQ = D.REQ[C.grade];
const F = D.fit(C.grade, C.res); const G = D.cog(C.cog); const P = D.GRID[G.band][F.band];
const rows = D.COMPS.map((c) => ({ ...c, res: C.res[c.code], req: REQ[c.code] }));
const strengths = rows.filter((r) => r.req && r.res > r.req).sort((a, b) => (b.res - b.req) - (a.res - a.req) || b.res - a.res).slice(0, 3);
const gaps = rows.filter((r) => r.req && r.res < r.req).sort((a, b) => (a.res - a.req) - (b.res - b.req));
const header = (title) => `${topBar("Caliber  |  SDC High-Potential Assessment")}
<div class="band"><div class="eyebrow">${esc(title)}</div><h1>${esc(C.name)}</h1>
<div class="sub">Grade ${C.grade} ${esc(D.GRADE_LABEL[C.grade])}  |  ${esc(C.position)}  |  ${esc(C.unit)}  |  Assessed ${esc(C.date)}</div></div>`;

// ---------------- 1. Executive summary ----------------
let comp = "";
for (const cat of ["Core", "Leadership"]) {
  comp += `<tr class="cat"><td colspan="5">${cat} competencies</td></tr>`;
  for (const r of rows.filter((x) => x.category === cat)) {
    comp += `<tr><td><b>${esc(r.name)}</b></td><td>${r.req ? levelName(r.req) : '<span class="muted">Not required</span>'}</td><td>${lvlBar(r.res, r.req)} <span style="margin-left:4px">${levelName(r.res)}</span></td><td>${gapPill(r.res, r.req)}</td><td class="small muted" style="white-space:nowrap;font-size:8.4px">${esc(D.MODULE[r.code])}</td></tr>`;
  }
}
const exec = `<div class="page">${header("Executive summary")}
<div style="display:grid;grid-template-columns:1.15fr 1fr;gap:12px;margin-top:10px">
  <div class="card"><div class="eyebrow">${svg("target")} Potential placement</div>${grid9(G.band, F.band, { rules: true })}</div>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div class="card soft"><div class="eyebrow">${svg("star")} Headline</div>
      <div style="font-size:16px;font-weight:700;color:var(--navy)">${esc(P.t)}</div>
      <p style="margin:3px 0 0">${esc(P.d)} Meets ${F.met} of ${F.total} competencies required for Grade ${C.grade}, exceeding ${F.above}, with ${esc(G.label.toLowerCase())} reasoning.</p></div>
    <div class="grid2">
      <div class="kpi"><div class="l">Competency fit</div><div class="v">${F.met} / ${F.total}</div><div class="small muted">required competencies met, ${F.above} above</div></div>
      <div class="kpi"><div class="l">Reasoning performance</div><div class="v">${G.mean}%</div><div class="small muted">${esc(G.label)} (mean of 3 Logica tests)</div></div>
    </div>
    <div class="card"><div class="eyebrow">${svg("brain")} Reasoning tests</div>
      ${[["Inductive", C.cog.inductive], ["Numerical", C.cog.numerical], ["Deductive", C.cog.deductive]].map(([n, v]) => `<div class="cogrow"><span>${n}</span><div class="bar"><div class="fill" style="width:${v}%"></div></div><b>${v}%</b></div>`).join("")}
    </div>
  </div>
</div>
<h2 style="margin-top:12px">Competency results against the Grade ${C.grade} requirement</h2>
<table class="t"><tr><th>Competency</th><th style="width:78px">Required</th><th style="width:120px">Result</th><th style="width:90px">Required vs result</th><th style="width:118px">Programme module</th></tr>${comp}</table>
<div class="grid2" style="margin-top:10px">
  <div class="card"><div class="eyebrow">${svg("plus")} Strengths to build on</div><ul class="ind pos">${strengths.map((s) => `<li>${svg("check", 12)}<span><b>${esc(s.name)}</b>: ${levelName(s.res)}, required ${levelName(s.req)}</span></li>`).join("")}</ul></div>
  <div class="card"><div class="eyebrow">${svg("trend")} Development priorities</div><ul class="ind neg">${gaps.map((s) => `<li>${svg("target", 12)}<span><b>${esc(s.name)}</b>: ${levelName(s.res)}, required ${levelName(s.req)}</span></li>`).join("")}</ul></div>
</div>
<p class="note" style="margin-top:8px"><b>How to read this.</b> Competency results come from 30 scenario questions (three per competency) that measure judgement in realistic SDC work situations; they are not observations of behaviour at work. Reasoning performance is the mean accuracy on three timed Logica reasoning tests. Bands are indicative until an SDC cohort norm is available. This summary is one input to talent decisions, not a decision on its own. Leadership competencies are not required below Grade 7 and are then shown for development only.</p>
${pfoot("SDC High-Potential Assessment  |  Executive summary  |  " + SAMPLE)}</div>`;
render("SDC-HiPo-Sample-1-Executive-Summary", doc("SDC HiPo executive summary (sample)", EXTRA_CSS + exec));

// ---------------- 2. IDP ----------------
const ind = (r, lvl, n) => (r.ind[lvl] || []).slice(0, n).map((x) => x.text.replace(/\.$/, ""));
const plan = [...gaps.map((g) => ({ ...g, type: "Close the gap" })), ...strengths.filter((s) => s.res < 3).slice(0, 1).map((s) => ({ ...s, type: "Build on a strength" }))];
const planRows = plan.map((p, i) => {
  const target = p.type === "Close the gap" ? levelName(p.req) : levelName(Math.min(3, p.res + 1));
  const [job, coach, learn] = IDP.actions[p.code][target];
  const [smart, d30, d60, d90, evidence] = IDP.plan[p.code][target];
  const goals = ind(p, target, 2);
  return `<div class="card" style="margin-top:8px;padding:8px 10px">
  <div style="display:flex;justify-content:space-between;align-items:center"><div><span class="pill ${p.type === "Close the gap" ? "amber" : "green"}">${i + 1}. ${esc(p.type)}</span> <b style="font-size:12px;color:var(--navy);margin-left:4px">${esc(p.name)}</b></div>
  <div class="small muted">${levelName(p.res)} now, target ${target}  |  ${esc(D.MODULE[p.code])}</div></div>
  <div class="small" style="margin:3px 0 2px"><b>Goal behaviours (${target}):</b> ${goals.map((g) => esc(g)).join("; ")}.</div>
  <div class="small" style="margin:0 0 3px"><b>SMART goal:</b> ${esc(smart)}</div>
  <table class="act"><tr><td class="h">On the job</td><td>${esc(job)}</td></tr><tr><td class="h">Coaching</td><td>${esc(coach)}</td></tr><tr><td class="h">Learning</td><td>${esc(learn)}</td></tr></table>
  <div class="ms"><div><b>By day 30</b>${esc(d30)}</div><div><b>By day 60</b>${esc(d60)}</div><div><b>By day 90</b>${esc(d90)}</div></div>
  <div class="small" style="margin-top:3px"><b>Evidence of progress:</b> ${esc(evidence)}</div></div>`;
}).join("");
const idp = `<div class="page">${header("Individual development plan")}
<div class="grid3" style="margin-top:10px">
  <div class="kpi"><div class="l">Placement</div><div class="v" style="font-size:15px">${esc(P.t)}</div><div class="small muted">${esc(F.label)}, ${esc(G.label.toLowerCase())} reasoning</div></div>
  <div class="kpi"><div class="l">Priorities</div><div class="v">${gaps.length} + 1</div><div class="small muted">gaps to close, plus one strength to build</div></div>
  <div class="kpi"><div class="l">Review points</div><div class="v" style="font-size:15px">Day 30, 60, 90</div><div class="small muted">milestones, then post-programme reassessment</div></div>
</div>
${planRows}
<div class="card soft" style="margin-top:8px"><div class="eyebrow">${svg("star")} Strengths to use while developing</div>
<p style="margin:0">${strengths.map((s) => `<b>${esc(s.name)}</b> (${levelName(s.res)})`).join(", ")}. Look for roles in team projects that use these, for example leading idea generation or stakeholder alignment.</p></div>
<div class="sig"><div>Participant</div><div>VIFM coach</div><div>SDC Talent Development</div></div>
<p class="note" style="margin-top:6px">Goal behaviours are taken from the SDC behavioural indicators for the target level. Goals follow the SMART format (Doran, 1981). The mix of on-the-job, coaching and learning actions follows the programme's 70-20-10 development approach (Lombardo and Eichinger, 1996; Center for Creative Leadership); it guides the balance of activities and is not a scoring formula. The plan is agreed with the participant at the Module 1 debrief and reviewed at each milestone; progress is measured again in the post-programme assessment.</p>
${pfoot("SDC High-Potential Assessment  |  Individual development plan  |  " + SAMPLE)}</div>`;
render("SDC-HiPo-Sample-2-IDP", doc("SDC HiPo IDP (sample)", EXTRA_CSS + idp));

// ---------------- 3. Group report ----------------
const people = D.COHORT.map((p) => {
  const f = D.fit(p.grade, p.res); const c = D.cog(p.cog);
  const ini = p.name.split(/[\s-]+/).filter((w) => !/^Al$/i.test(w)).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return { ...p, f, c, fb: f.band, cb: c.band, ini, place: D.GRID[c.band][f.band].t };
});
const rank = (a, b) => (b.f.band + b.c.band) - (a.f.band + a.c.band) || b.f.band - a.f.band || b.f.met / b.f.total - a.f.met / a.f.total || b.f.above - a.f.above || b.c.mean - a.c.mean;
const bands = [["Managerial: Grades 7 and 8 (all 10 competencies required)", (p) => p.grade >= 7, "M"], ["Professional: Grades 4 to 6 (5 core competencies required)", (p) => p.grade <= 6, "P"]];
let rt = "";
for (const [label, f, pre] of bands) {
  rt += `<tr class="cat"><td colspan="7">${esc(label)}</td></tr>`;
  people.filter(f).sort(rank).forEach((p, i) => {
    p.ini = pre + (i + 1);
    const pill = p.c.band + p.f.band >= 4 ? "navy" : p.c.band + p.f.band >= 2 ? "light" : "gray";
    rt += `<tr><td><b>${esc(p.ini)}</b></td><td><b>${esc(p.name)}</b></td><td>G${p.grade}</td><td class="small">${esc(p.unit)}</td><td>${p.f.met}/${p.f.total}${p.f.above ? ` <span class="small muted">(+${p.f.above})</span>` : ""}</td><td>${p.c.mean}%</td><td><span class="pill ${pill}" style="font-size:8.5px">${esc(p.place)}</span></td></tr>`;
  });
}
const gapRate = D.COMPS.map((c) => {
  const req = people.filter((p) => D.REQ[p.grade][c.code] > 0);
  const below = req.filter((p) => p.res[c.code] < D.REQ[p.grade][c.code]).length;
  return { name: c.name, n: req.length, below, pct: req.length ? Math.round((100 * below) / req.length) : 0 };
}).sort((a, b) => b.pct - a.pct);
const hi = people.filter((p) => p.cb === 2 && p.fb === 2).length;
const group = `<div class="page">${topBar("Caliber  |  SDC High-Potential Assessment")}
<div class="band"><div class="eyebrow">Group report</div><h1>HiPo cohort overview</h1><div class="sub">${people.length} candidates assessed  |  Grades 4 to 8  |  Ranked within grade band</div></div>
<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:12px;margin-top:10px">
  <div class="card"><div class="eyebrow">${svg("users")} Cohort placement</div>${grid9(-1, -1, { people, rules: true })}<p class="note" style="margin:4px 0 0">Codes match the ranking table below: M = Managerial (Grades 7 and 8), P = Professional (Grades 4 to 6), numbered by rank within the band.</p></div>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div class="grid2">
      <div class="kpi"><div class="l">Completed</div><div class="v">${people.length} / ${people.length}</div><div class="small muted">sample cohort</div></div>
      <div class="kpi"><div class="l">High potential</div><div class="v">${hi}</div><div class="small muted">above requirement and strong reasoning</div></div>
    </div>
    <div class="card"><div class="eyebrow">${svg("trend")} Where the cohort falls below the requirement</div>
      ${gapRate.slice(0, 6).map((g) => `<div class="hbar"><span>${esc(g.name)}</span><div class="bar"><div class="fill" style="width:${g.pct}%;background:var(--amber)"></div></div><b>${g.pct}%</b></div>`).join("")}
      <p class="note" style="margin:4px 0 0">Share of candidates for whom the competency is required who are below their grade's level. Use it to set group learning priorities.</p></div>
  </div>
</div>
<h2 style="margin-top:12px">Ranking</h2>
<table class="t"><tr><th style="width:30px">Rank</th><th>Candidate</th><th style="width:36px">Grade</th><th>Business unit</th><th style="width:70px">Required met</th><th style="width:56px">Reasoning</th><th style="width:130px">Placement</th></tr>${rt}</table>
<p class="note" style="margin-top:8px"><b>How the ranking works.</b> Candidates are ranked within their grade band, because required levels differ by grade: first by position on the grid (competency fit plus reasoning performance), then by competency fit, share of required competencies met and number exceeded, then by reasoning accuracy. "(+n)" is the number of required competencies exceeded. Rankings support the cohort selection discussion with SDC; they are not a selection decision on their own.</p>
${pfoot("SDC High-Potential Assessment  |  Group report  |  " + SAMPLE)}</div>`;
render("SDC-HiPo-Sample-3-Group-Report", doc("SDC HiPo group report (sample)", EXTRA_CSS + group));
console.log("done", OUT);
