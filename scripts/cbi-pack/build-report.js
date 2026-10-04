// VIFM CBI sample report (anonymised candidate, Senior Finance Manager) as A4 HTML.
const fs = require("fs");
const path = require("path");
const { ROLE, SCALE, SIX, SAMPLE } = require("./data");
const { esc, svg, doc, foot, DOMAIN_ICON, LOGO_DARK } = require("./html-common");

const F = "VIFM Competency-Based Interview Report";
const R = SAMPLE.ratings;
const label = (n) => SCALE.find((s) => s.point === n).label;
function status(rating, target) {
  const d = rating - target;
  if (d >= 0.5) return ["Above target", "green"];
  if (d > -0.5) return ["At target", "light"];
  if (d > -1.0) return ["Below target", "amber"];
  return ["Clear gap", "amber"];
}
const mean = SIX.reduce((a, c) => a + R[c.key].rating, 0) / SIX.length;
const strengths = SIX.filter((c) => R[c.key].rating >= 4);
const devs = SIX.filter((c) => R[c.key].rating < c.target - 0.25).sort((a, b) => (R[a.key].rating - a.target) - (R[b.key].rating - b.target));

let pages = [];

// Page 1: cover band, about, summary
pages.push(`
<div class="page">
  <img src="${LOGO_DARK}" style="height:48px" alt="VIFM">
  <div class="band" style="margin-top:16px">
    <div class="eyebrow">VIFM Competency-Based Interview (CBI)  ·  Report</div>
    <h1>${esc(SAMPLE.candidate)}</h1>
    <div class="sub">${esc(ROLE.title)}  ·  ${esc(ROLE.client)}  ·  Interviewed ${esc(SAMPLE.interviewDate)}</div>
  </div>

  <div class="callout blue" style="margin-top:12px">
    <b>What this report is.</b> Evidence from a structured, two-hour behavioural interview on six competencies from the VIFM Competency Framework, rated against anchored scales by two trained interviewers and calibrated. <b>What it is not.</b> A hiring decision, a measure of technical knowledge, or a prediction on its own. Read it alongside the other evidence the panel holds.
  </div>

  <h2 style="margin-top:14px">Summary</h2>
  <table>
    <tr><th>Competency</th><th style="width:52px">Rating</th><th style="width:52px">Target</th><th style="width:150px">Rating against target</th><th style="width:92px">Read</th></tr>
    ${SIX.map((c) => {
      const r = R[c.key].rating; const [st, cls] = status(r, c.target);
      return `<tr>
        <td><b>${esc(c.name)}</b><br><span class="small muted">${esc(c.domain.charAt(0) + c.domain.slice(1).toLowerCase())}  ·  ${esc(label(r))}</span></td>
        <td><span class="pill navy">${r}</span></td>
        <td class="muted">${c.target.toFixed(1)}</td>
        <td><div class="bar" style="margin-top:6px"><div class="fill" style="width:${(r / 5) * 100}%"></div><div class="tgt" style="left:${(c.target / 5) * 100}%"></div></div></td>
        <td><span class="pill ${cls}">${st}</span></td></tr>`;
    }).join("")}
  </table>
  <p class="small muted" style="margin:4px 0 0">Bar shows the rating on the 1 to 5 scale; the dark marker is the role target from the role profile. Ratings are the agreed ratings after calibration.</p>

  <div class="grid3" style="margin-top:12px">
    <div class="card soft">
      <div class="eyebrow">${svg("scale")} Indicative overall read</div>
      <div style="font-size:22px;font-weight:700;color:var(--navy)">${mean.toFixed(1)} <span style="font-size:11px;color:var(--muted);font-weight:400">mean of six</span></div>
      <p class="small" style="margin:4px 0 0">Meets the role requirement overall, with clear strength in delivery and composure and one competency well below target. The mean is a convenience; the panel should weigh the high-priority competencies.</p>
    </div>
    <div class="card">
      <div class="eyebrow">${svg("star")} Headline strengths</div>
      <ul class="ind pos">${strengths.map((c) => `<li>${svg("check", 12)}<span><b>${esc(c.name)}</b></span></li>`).join("")}</ul>
    </div>
    <div class="card">
      <div class="eyebrow">${svg("trend")} Development areas</div>
      <ul class="ind neg">${devs.map((c) => `<li>${svg("minus", 12)}<span><b>${esc(c.name)}</b> <span class="small muted">(${R[c.key].rating} against ${c.target.toFixed(1)})</span></span></li>`).join("")}</ul>
    </div>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="eyebrow">${svg("users")} Interview record</div>
    <div class="grid2">
      <div>
        <div class="field"><span class="lbl">Date</span><span class="val">${esc(SAMPLE.interviewDate)}</span></div>
        <div class="field"><span class="lbl">Duration</span><span class="val">${ROLE.duration} minutes, as planned</span></div>
        <div class="field"><span class="lbl">Guide</span><span class="val">${esc(ROLE.title)}, version SFM-01, standard question set</span></div>
      </div>
      <div>
        ${SAMPLE.interviewers.map((n) => `<div class="field"><span class="lbl">Interviewer</span><span class="val">${esc(n)}</span></div>`).join("")}
        <div class="field"><span class="lbl">Calibration</span><span class="val">${esc(SAMPLE.calibrated)}</span></div>
      </div>
    </div>
  </div>
  ${foot(F + "  |  " + SAMPLE.candidate + "  |  Sample")}
</div>`);

// Competency pages, two per page
for (let i = 0; i < SIX.length; i += 2) {
  const pair = SIX.slice(i, i + 2);
  pages.push(`
<div class="page">
  ${pair.map((c) => {
    const r = R[c.key]; const [st, cls] = status(r.rating, c.target);
    const tips = r.rating >= 4 ? c.devTips.slice(0, 1) : c.devTips.slice(0, 2);
    return `
  <div class="card" style="margin-bottom:12px;padding:0;overflow:hidden">
    <div style="background:var(--navy);color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div class="domtag">${svg(DOMAIN_ICON[c.domain], 12)} ${esc(c.domain)}</div>
        <div style="font-size:15px;font-weight:700">${esc(c.name)}</div>
      </div>
      <div style="display:flex;gap:16px;align-items:center">
        <div style="text-align:center"><div class="domtag">Rating</div><div style="font-size:24px;font-weight:700;line-height:1.1">${r.rating}</div><div class="small" style="color:var(--pale)">${esc(label(r.rating))}</div></div>
        <div style="text-align:center"><div class="domtag">Target</div><div style="font-size:24px;font-weight:700;line-height:1.1">${c.target.toFixed(1)}</div><div class="small"><span class="pill ${cls}">${st}</span></div></div>
      </div>
    </div>
    <div style="padding:10px 14px">
      <div class="small" style="color:var(--mid);margin-bottom:6px"><b>Anchor for a ${r.rating}.</b> ${esc(c.anchors[r.rating])}</div>
      <div class="eyebrow">${svg("chat")} What the candidate described</div>
      <p style="margin:0 0 8px">${esc(r.summary)}</p>
      <div class="grid2">
        <div>
          <div class="eyebrow">${svg("plus")} Indicators observed</div>
          <ul class="ind pos">${r.observed.map((p) => `<li>${svg("check", 12)}<span>${esc(p)}</span></li>`).join("")}</ul>
        </div>
        <div>
          <div class="eyebrow" style="color:var(--muted)">${svg("minus")} Gaps in the evidence</div>
          ${r.gaps.length ? `<ul class="ind neg">${r.gaps.map((p) => `<li>${svg("minus", 12)}<span>${esc(p)}</span></li>`).join("")}</ul>` : `<p class="small muted" style="margin:0">None of note. Evidence was specific, personal and consistent across the three questions.</p>`}
        </div>
      </div>
      <div class="eyebrow" style="margin-top:8px">${svg("trend")} ${r.rating >= 4 ? "To build on" : "Suggested development"}</div>
      <ul class="ind pos">${tips.map((t) => `<li>${svg("target", 12)}<span>${esc(t)}</span></li>`).join("")}</ul>
    </div>
  </div>`;
  }).join("")}
  ${foot(F + "  |  " + SAMPLE.candidate + "  |  Sample")}
</div>`);
}

// Decision integration and using this report
pages.push(`
<div class="page">
  <h2>Decision integration</h2>
  <p class="muted" style="margin:0 0 10px">The panel completes this section. The interview provides one line of evidence; the recommendation is the panel's, not the report's.</p>
  <div class="card">
    <table>
      <tr><th style="width:170px">Source</th><th>Signal</th></tr>
      <tr><td><b>Competency-based interview</b></td><td>Mean ${mean.toFixed(1)} of 5. Above target on Resilience &amp; Composure; at target on Critical Analysis &amp; Judgement and Delivery &amp; Accountability; below target on Strategic &amp; Commercial Insight and Influence &amp; Agreement; clear gap on Coaching &amp; Talent Growth.</td></tr>
      <tr style="height:34px"><td><b>Technical assessment</b></td><td class="muted small">Enter the result of the technical or knowledge assessment, if used.</td></tr>
      <tr style="height:34px"><td><b>Other evidence</b></td><td class="muted small">References, work samples, prior assessment data, self-report instruments.</td></tr>
      <tr style="height:34px"><td><b>Panel notes</b></td><td></td></tr>
      <tr><td><b>Overall recommendation</b></td><td style="font-size:12px"><span class="pill gray">Advance</span> &nbsp; <span class="pill gray">Hold</span> &nbsp; <span class="pill gray">Decline</span> &nbsp; <span class="pill gray">Advance with development plan</span></td></tr>
    </table>
  </div>

  <h2 style="margin-top:16px">Suggested development plan, if appointed</h2>
  <table>
    <tr><th>Priority</th><th>Competency</th><th>First actions</th></tr>
    ${devs.map((c, i) => `<tr><td><span class="pill ${i === 0 ? "navy" : "light"}">${i + 1}</span></td><td><b>${esc(c.name)}</b><br><span class="small muted">${R[c.key].rating} against ${c.target.toFixed(1)}</span></td><td><ul class="ind pos" style="margin:0">${c.devTips.slice(0, 2).map((t) => `<li>${svg("target", 12)}<span>${esc(t)}</span></li>`).join("")}</ul></td></tr>`).join("")}
  </table>

  <h2 style="margin-top:16px">Using this report</h2>
  <div class="grid2">
    <div class="card soft">
      <div class="eyebrow">${svg("shield")} How the ratings were produced</div>
      <p class="small" style="margin:0">Two trained interviewers asked the standard question set for the role, recorded the candidate's examples, classified the evidence against the framework's behavioural indicators after the interview, rated each competency against its anchors, and agreed the ratings in a calibration discussion. Structured interviews of this kind are among the better predictors of job performance (Schmidt and Hunter, 1998), and roughly twice as predictive as unstructured interviews.</p>
    </div>
    <div class="card soft">
      <div class="eyebrow">${svg("info")} Limits and candidate rights</div>
      <p class="small" style="margin:0">The interview measures behaviour the candidate chose to describe; it does not measure technical knowledge, reasoning ability or how the candidate performs when observed, which other instruments cover. Ratings relate to this role's targets and should not be reused for another role without review. The candidate is entitled to a summary of strengths and development areas, and may raise a query about the process within 21 days of receiving the outcome. The report is confidential to the client and is retained under the client agreement.</p>
    </div>
  </div>
  <p class="small muted" style="margin-top:14px">This is an illustrative sample. The candidate, client and evidence are fictional. Framework content: VIFM Competency Framework v2.</p>
  ${foot(F + "  |  " + SAMPLE.candidate + "  |  Sample")}
</div>`);

const html = doc(F, pages.join("\n"));
const OUT_DIR = process.env.CBI_OUT || path.join(__dirname, "..", "..", "docs", "samples", "cbi");
fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, "VIFM-CBI-Sample-Report-Senior-Finance-Manager.html");
fs.writeFileSync(out, html);
console.log("wrote", out, "pages:", pages.length);
module.exports = { htmlPath: out };
