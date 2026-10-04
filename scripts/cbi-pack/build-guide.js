// VIFM CBI Interview Guide (sample, Senior Finance Manager) as A4 HTML.
const fs = require("fs");
const path = require("path");
const { ROLE, SCALE, SIX } = require("./data");
const { esc, svg, doc, foot, DOMAIN_ICON, LOGO_DARK, LOGO_WHITE } = require("./html-common");

const F = "VIFM Competency-Based Interview Guide";
let pages = [];

// Cover
pages.push(`
<div class="page">
  <img src="${LOGO_DARK}" style="height:52px" alt="VIFM">
  <div class="band" style="margin-top:28px">
    <div class="eyebrow">VIFM Competency-Based Interview (CBI)</div>
    <h1>Interview Guide</h1>
    <div class="sub">${esc(ROLE.title)}  ·  ${esc(ROLE.sector)}  ·  ${ROLE.duration} minutes  ·  ${SIX.length} competencies</div>
  </div>
  <div class="grid2" style="margin-top:18px">
    <div class="card">
      <div class="eyebrow">${svg("users")} This interview</div>
      <div class="field"><span class="lbl">Candidate</span><span class="val"></span></div>
      <div class="field"><span class="lbl">Date and time</span><span class="val"></span></div>
      <div class="field"><span class="lbl">Lead interviewer</span><span class="val"></span></div>
      <div class="field"><span class="lbl">Second interviewer</span><span class="val"></span></div>
      <div class="field"><span class="lbl">Location / link</span><span class="val"></span></div>
      <div class="field"><span class="lbl">Guide version</span><span class="val">SFM-01 (sample)</span></div>
    </div>
    <div class="card soft">
      <div class="eyebrow">${svg("target")} Competencies in this guide</div>
      <table>
        <tr><th>Competency</th><th>Domain</th><th style="text-align:right">Target</th></tr>
        ${SIX.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td class="muted">${esc(c.domain.charAt(0) + c.domain.slice(1).toLowerCase())}</td><td style="text-align:right"><span class="pill ${c.priority === "High" ? "navy" : "light"}">${c.target.toFixed(1)}</span></td></tr>`).join("")}
      </table>
      <p class="small muted" style="margin:6px 0 0">Target is the level the role requires on the 1 to 5 scale, taken from the role profile. High-priority competencies are shown in navy.</p>
    </div>
  </div>
  <div class="card" style="margin-top:12px">
    <div class="eyebrow">${svg("info")} About this guide</div>
    <p style="margin:0">This guide is generated from the VIFM Competency Framework for one role. It contains, for each competency, the definition, the behavioural indicators used to classify evidence, three standard questions with probes, space for notes, and the anchored rating scale. Every candidate for this role is asked the same questions in the same order. Only the probes vary with the answers. The guide is a confidential assessment instrument and is not shared with candidates.</p>
  </div>
  <div class="card soft" style="margin-top:12px">
    <div class="eyebrow">${svg("clock")} Interview plan (${ROLE.duration} minutes)</div>
    <table>
      <tr><th style="width:70px">Time</th><th>Segment</th><th>Purpose</th></tr>
      <tr><td>0 to 10</td><td><b>Opening</b></td><td>Welcome, purpose, the competencies covered, note-taking and recording explained, consent confirmed, questions about the process.</td></tr>
      <tr><td>10 to 20</td><td><b>Career overview</b></td><td>Recent roles and responsibilities in brief. Settles the candidate and surfaces examples to return to. Not rated.</td></tr>
      <tr><td>20 to 110</td><td><b>Six competencies</b></td><td>About fifteen minutes each in the order of this guide. Ask, probe for the candidate's own actions, record, summarise, move on.</td></tr>
      <tr><td>110 to 120</td><td><b>Close</b></td><td>Anything to add, the candidate's questions, next steps and timing. Thank the candidate.</td></tr>
    </table>
  </div>
  ${foot(F + "  |  " + ROLE.title + "  |  Sample")}
</div>`);

// How to use
pages.push(`
<div class="page">
  <h2>How to use this guide</h2>
  <div class="grid3">
    <div class="card">
      <div class="eyebrow">${svg("doc")} 1. Prepare</div>
      <ul class="ind pos">
        <li>${svg("check")}<span>Read the role profile and this guide in full. Know the indicators for each competency before the day.</span></li>
        <li>${svg("check")}<span>Review the CV and any prior assessment data. Note areas to probe, but ask the standard questions first.</span></li>
        <li>${svg("check")}<span>Agree with the second interviewer who leads and who records for each competency.</span></li>
        <li>${svg("check")}<span>Check the room or the link, water, timing, and that the candidate's joining information was sent.</span></li>
      </ul>
    </div>
    <div class="card">
      <div class="eyebrow">${svg("chat")} 2. Conduct</div>
      <ul class="ind pos">
        <li>${svg("check")}<span>Open with the purpose, the competencies covered and how notes are taken. Put the candidate at ease.</span></li>
        <li>${svg("check")}<span>Ask each question as written. Use the probes to get to the candidate's own actions and the result.</span></li>
        <li>${svg("check")}<span>Redirect answers in the hypothetical or the plural to a specific, personal example.</span></li>
        <li>${svg("check")}<span>Summarise what you heard before moving on. Do not evaluate, agree or disagree in the room.</span></li>
        <li>${svg("check")}<span>Close with the candidate's questions, next steps and thanks.</span></li>
      </ul>
    </div>
    <div class="card">
      <div class="eyebrow">${svg("scale")} 3. Assess</div>
      <ul class="ind pos">
        <li>${svg("check")}<span>Write up notes the same day, before rating.</span></li>
        <li>${svg("check")}<span>Classify each piece of evidence against one competency's positive or negative indicators.</span></li>
        <li>${svg("check")}<span>Rate each competency against its anchors. The rating is the anchor the evidence best fits.</span></li>
        <li>${svg("check")}<span>No evidence means NE, never a 1. Record why.</span></li>
        <li>${svg("check")}<span>Calibrate with the second interviewer with the notes on the table, then complete the summary sheet.</span></li>
      </ul>
    </div>
  </div>

  <div class="grid2" style="margin-top:12px">
    <div class="card soft">
      <div class="eyebrow">${svg("target")} STAR-L: the shape of every answer</div>
      <table>
        <tr><td style="width:26px"><span class="pill accent">S</span></td><td><b>Situation</b> What was the context? When, where, who was involved?</td></tr>
        <tr><td><span class="pill accent">T</span></td><td><b>Task</b> What was the candidate responsible for? What had to be achieved?</td></tr>
        <tr><td><span class="pill navy">A</span></td><td><b>Action</b> What did the candidate, personally, do? Spend most of the time here.</td></tr>
        <tr><td><span class="pill accent">R</span></td><td><b>Result</b> What happened? How do they know? What did it deliver or cost?</td></tr>
        <tr><td><span class="pill accent">L</span></td><td><b>Learning</b> What would they do differently? What did they carry into the next situation?</td></tr>
      </table>
    </div>
    <div class="card soft">
      <div class="eyebrow">${svg("pen")} Note-taking rules</div>
      <ul class="ind pos">
        <li>${svg("check")}<span>Record what the candidate said and did, in their words where possible. Facts, not adjectives.</span></li>
        <li>${svg("check")}<span>Mark each note with the competency it belongs to. One piece of evidence can support only one competency.</span></li>
        <li>${svg("check")}<span>Note the absence of evidence as well: a question answered in generalities, or an example that stayed at "we".</span></li>
        <li>${svg("check")}<span>Keep notes legible and job-related. They form part of the assessment record and may be reviewed.</span></li>
      </ul>
      <div class="eyebrow" style="margin-top:8px">${svg("eye")} Common rating errors to avoid</div>
      <p class="small" style="margin:0">Halo from one strong answer; recency from the last competency; similarity to the interviewer; rating fluency rather than behaviour; and rating a hypothetical answer as if it had happened.</p>
    </div>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="eyebrow">${svg("scale")} The rating scale</div>
    <div class="scale">
      ${SCALE.map((s) => `<div class="pt ${s.point === "NE" ? "ne" : ""}"><b>${s.point}</b><span style="font-weight:700;color:var(--navy)">${esc(s.label)}</span><br>${esc(s.meaning)}</div>`).join("")}
    </div>
    <p class="small muted" style="margin:6px 0 0">Every competency page carries its own anchors for each point. Rate against those anchors, not against these general labels. A 3 means the role requirement is met.</p>
  </div>
  ${foot(F + "  |  " + ROLE.title + "  |  Sample")}
</div>`);

// Competency pages
SIX.forEach((c, i) => {
  pages.push(`
<div class="page comp">
  <div class="band" style="padding:10px 18px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div class="domtag">${svg(DOMAIN_ICON[c.domain], 12)} ${esc(c.domain)}  ·  Competency ${i + 1} of ${SIX.length}</div>
        <h1 style="font-size:19px;margin:3px 0 0">${esc(c.name)}</h1>
      </div>
      <div style="text-align:right"><div class="domtag">Role target</div><div style="font-size:22px;font-weight:700">${c.target.toFixed(1)}</div></div>
    </div>
  </div>
  <div class="grid2" style="margin-top:10px">
    <div class="card soft">
      <div class="eyebrow">${svg("doc")} Definition</div>
      <p style="margin:0">${esc(c.definition)}</p>
      <p class="small" style="margin:6px 0 0;color:var(--mid)"><b>Why it matters in this role.</b> ${esc(c.whyRole)}</p>
    </div>
    <div class="card">
      <div class="eyebrow">${svg("plus")} Positive indicators</div>
      <ul class="ind pos">${c.positive.map((p) => `<li>${svg("check", 12)}<span>${esc(p)}</span></li>`).join("")}</ul>
      <div class="eyebrow" style="margin-top:6px;color:var(--muted)">${svg("minus")} Negative indicators</div>
      <ul class="ind neg">${c.negative.map((p) => `<li>${svg("minus", 12)}<span>${esc(p)}</span></li>`).join("")}</ul>
    </div>
  </div>

  ${c.questions.map((q, qi) => `
  <div class="q">
    <div class="qt">${qi + 1}. ${esc(q.q)}</div>
    <ul class="probes">${q.probes.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
  </div>
  <div class="small muted" style="margin-left:10px">Notes</div>
  <div class="notes ${qi === 0 ? "tall" : ""}"></div>
  <div class="notes"></div>`).join("")}

  <div class="card" style="margin-top:10px;padding:8px 12px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
      <div class="eyebrow" style="margin:0">${svg("scale")} Interview rating</div>
      <div class="rating-row">${[1, 2, 3, 4, 5].map((n) => `<div class="box">${n}</div>`).join("")}<div class="box ne">NE</div></div>
    </div>
    <table class="anchors" style="margin-top:4px">
      ${[5, 4, 3, 2, 1].map((n) => `<tr><td style="width:20px"><b>${n}</b></td><td>${esc(c.anchors[n])}</td></tr>`).join("")}
    </table>
  </div>
  ${foot(F + "  |  " + ROLE.title + "  |  Sample")}
</div>`);
});

// Summary sheet
pages.push(`
<div class="page">
  <h2>Summary rating sheet</h2>
  <p class="muted" style="margin:0 0 10px">Complete after the write-up and the calibration discussion. Ratings must be traceable to the notes on the competency pages.</p>
  <table>
    <tr><th>Competency</th><th style="width:60px">Target</th><th style="width:70px">Lead</th><th style="width:70px">Second</th><th style="width:70px">Agreed</th><th style="width:90px">Evidence</th></tr>
    ${SIX.map((c) => `<tr style="height:38px"><td><b>${esc(c.name)}</b><br><span class="small muted">${esc(c.domain.charAt(0) + c.domain.slice(1).toLowerCase())}</span></td><td>${c.target.toFixed(1)}</td><td></td><td></td><td></td><td class="small muted">Strong / Adequate / Thin</td></tr>`).join("")}
  </table>
  <div class="grid2" style="margin-top:14px">
    <div class="card">
      <div class="eyebrow">${svg("star")} Headline strengths</div>
      <div class="notes"></div><div class="notes"></div><div class="notes"></div>
    </div>
    <div class="card">
      <div class="eyebrow">${svg("trend")} Development areas</div>
      <div class="notes"></div><div class="notes"></div><div class="notes"></div>
    </div>
  </div>
  <div class="card" style="margin-top:12px">
    <div class="eyebrow">${svg("info")} Deviations from the standard set, interruptions, or anything the panel should know</div>
    <div class="notes"></div><div class="notes"></div>
  </div>
  <div class="card soft" style="margin-top:12px">
    <div class="eyebrow">${svg("shield")} Interviewer declaration</div>
    <p style="margin:0 0 8px">We confirm that the standard questions in this guide were asked, that the ratings above are based on the recorded evidence, and that no information outside the interview and the agreed assessment data influenced them.</p>
    <div class="grid2">
      <div><div class="field"><span class="lbl">Lead interviewer</span><span class="val"></span></div><div class="field"><span class="lbl">Signature / date</span><span class="val"></span></div></div>
      <div><div class="field"><span class="lbl">Second interviewer</span><span class="val"></span></div><div class="field"><span class="lbl">Signature / date</span><span class="val"></span></div></div>
    </div>
  </div>
  <p class="small muted" style="margin-top:14px">This guide and the completed notes are part of the assessment record. They are retained in line with the client agreement and VIFM's retention schedule, and may be reviewed in the event of a query or appeal.</p>
  ${foot(F + "  |  " + ROLE.title + "  |  Sample")}
</div>`);

const html = doc(F, pages.join("\n"));
const OUT_DIR = process.env.CBI_OUT || path.join(__dirname, "..", "..", "docs", "samples", "cbi");
fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, "VIFM-CBI-Interview-Guide-Sample-Senior-Finance-Manager.html");
fs.writeFileSync(out, html);
console.log("wrote", out, "pages:", pages.length);
module.exports = { htmlPath: out };
