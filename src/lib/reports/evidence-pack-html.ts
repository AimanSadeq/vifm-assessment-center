/**
 * The evidence pack (BPS 3.10): what VIFM can show a client about whether a
 * centre works, under the five headings of 9.9 plus the design evidence the
 * criteria rest on. Generated from the engagement and the same computed
 * numbers the engagement panel shows, so the pack never says more than the
 * data does: every figure carries its sample, and an empty section says why.
 */

import type { EngagementEvidence } from "@/lib/ac/evidence-data";
import { acPurposeLabel } from "@/lib/constants/ac-purpose";
import { getICCInterpretation } from "@/lib/scoring/icc";
import { VALIDATION_ADEQUATE_N } from "@/lib/ac/validity";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (v: unknown): string => {
  if (!v) return "not set";
  const raw = String(v);
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

const gap = (text: string) => `<p class="gap">${esc(text)}</p>`;

export function buildEvidencePackHtml(ev: EngagementEvidence, generatedAt: string): string {
  const e = ev.engagement as Record<string, string | number | null>;
  const purpose = e.purpose ? acPurposeLabel(String(e.purpose)) : null;

  // 1. Content validity: where the criteria came from.
  const withRationale = ev.competencies.filter((c) => c.rationale).length;
  const content = `
    <p>${e.job_analysis_method
      ? `The criteria were derived from the job: ${esc(e.job_analysis_method)}${e.job_analysis_note ? `. ${esc(e.job_analysis_note)}` : "."}`
      : '<span class="gap">How the criteria were derived from the job is not recorded (4.2, 4.4).</span>'}</p>
    <table><thead><tr><th>Criterion</th><th>Link to the job</th><th class="num">Behavioural indicators</th></tr></thead><tbody>
    ${ev.competencies.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.rationale ? esc(c.rationale) : '<span class="gap">Not recorded</span>'}</td><td class="num">${c.indicators}</td></tr>`).join("")}
    </tbody></table>
    <p class="muted">${withRationale} of ${ev.competencies.length} criteria carry a written link to the job. Each is observed in at least two exercises by design.</p>`;

  // 2. Reliability.
  const reliability = ev.icc && ev.icc.value !== null
    ? `<p>Assessor agreement (ICC, two-way random, single measure) is <strong>${ev.icc.value.toFixed(2)}</strong>, ${esc(getICCInterpretation(ev.icc.value).label.toLowerCase())}, from ${ev.icc.subjects} ratings where the same pair of assessors rated the same participant on the same criterion.</p>
       <p class="muted">Computed on complete cases only: no missing rating is imputed. VIFM's target is 0.70 in year one and 0.80 by year three.</p>`
    : gap("Not yet computable: it needs two assessors to have rated the same participants on the same criteria.");

  // 3. Criteria overlap.
  const overlap = ev.overlap.length
    ? `<table><thead><tr><th>Pair</th><th class="num">Participants</th><th class="num">r</th><th>Reading</th></tr></thead><tbody>
       ${ev.overlap.map((o) => `<tr><td>${esc(o.a)} and ${esc(o.b)}</td><td class="num">${o.n}</td><td class="num">${o.r.toFixed(2)}</td><td>${o.merge ? '<span class="gap">Above 0.7: consider merging (4.6.1)</span>' : "Distinct"}</td></tr>`).join("")}
       </tbody></table>`
    : gap("Not yet computable: it needs at least 10 participants rated on each pair of criteria.");

  // 4. Criterion validity.
  const fs = ev.followupSummary;
  const validity = `
    <p>${esc(ev.validity.statement)}</p>
    <table><thead><tr><th>Follow-ups</th><th class="num">Count</th></tr></thead><tbody>
      <tr><td>Scheduled</td><td class="num">${fs.total}</td></tr>
      <tr><td>Collected</td><td class="num">${fs.collected}</td></tr>
      <tr><td>Due</td><td class="num">${fs.due}</td></tr>
      <tr><td>Overdue</td><td class="num">${fs.overdue}</td></tr>
      <tr><td>Not available</td><td class="num">${fs.notAvailable}</td></tr>
      <tr><td>Went into the role</td><td class="num">${fs.inRole}</td></tr>
    </tbody></table>
    <p class="muted">The criterion is the line manager's rating of performance in the role, on the centre's own 1 to 5 scale, six and twelve months on. Only participants who went into the role can contribute; those who did not are the range-restriction caveat on any correlation. The standard's guide is about ${VALIDATION_ADEQUATE_N} participants for a study with reasonable power (9.10).</p>`;

  // 5. Fairness.
  const fair = ev.fairness;
  const fairness = fair.report
    ? `<p>${esc(ev.fairnessNote)}</p>
       <table><thead><tr><th>Dimension</th><th>Reference group</th><th>Groups</th><th>Finding</th></tr></thead><tbody>
       ${fair.report.dimensions.map((d) => `<tr><td>${esc(d.label)}</td><td>${esc(d.referenceGroup ?? "-")}</td><td>${d.groups.map((g) => `${esc(g.label)} ${g.n}`).join(", ")}</td><td>${d.anyAdverseImpact ? '<span class="gap">Below four-fifths</span>' : "No adverse impact"}${d.underpowered ? " (small sample)" : ""}</td></tr>`).join("")}
       </tbody></table>
       <p class="muted">Demographics are voluntary; ${fair.disclosed} of ${fair.participants} participants disclosed any. A flag is a prompt to review job-relatedness, not a finding of discrimination.</p>`
    : `<p>${esc(fair.reason ?? "Not applicable.")}</p>`;

  // 6. Participant impact.
  const pi = ev.participantImpact;
  const impact = pi.responses
    ? `<p>${pi.responses} participant${pi.responses === 1 ? "" : "s"} gave feedback on the centre${pi.meanRating !== null ? `, with a mean rating of ${pi.meanRating} out of 5` : ""}. Concerns and appeals raised through the participant portal are recorded on the engagement.</p>`
    : gap("No participant feedback collected yet. Participants can rate the centre from their portal after it ends.");

  // 7. Utility and the agreed plan.
  const plan = ev.plan;
  const utility = plan
    ? `<ul>
        <li>Validation study: ${plan.validation ? "agreed with the client" : "not agreed"}</li>
        <li>Participant reaction study: ${plan.reaction ? "agreed" : "not agreed"}</li>
        <li>Business-outcome evaluation: ${plan.utility ? "agreed" : "not agreed"}</li>
        <li>Evaluation runs ${plan.trigger === "date" ? `on ${esc(fmtDate(plan.trigger_date))}` : `once ${plan.trigger_participants ?? "?"} participants have been assessed`}</li>
        ${plan.criterion ? `<li>Performance measure supplied by the client: ${esc(plan.criterion)}</li>` : ""}
        ${plan.note ? `<li>${esc(plan.note)}</li>` : ""}
      </ul>`
    : gap("No post-centre evaluation plan has been agreed with the client (3.20). The centre agreement, clause 11.3, is where it is agreed.");

  // 8. Evaluations.
  const evals = ev.evaluations.length
    ? ev.evaluations.map((x) => `
      <div class="eval">
        <p><strong>${x.kind === "major" ? "Major review" : x.kind === "annual" ? "Annual evaluation" : "Evaluation"}</strong>, ${esc(fmtDate(x.conducted_at))}, by ${esc(x.conducted_by_name)}${x.participants ? `, ${esc(x.participants)} participants` : ""}${x.series_name ? `, series ${esc(x.series_name)}` : ""}.</p>
        <dl>
        ${(["reliability", "validity", "diversity", "participant_impact", "utility", "recommendations"] as const).map((k) => x[k] ? `<dt>${esc(k.replace("_", " "))}</dt><dd>${esc(x[k])}</dd>` : "").join("")}
        </dl>
      </div>`).join("")
    : gap("No evaluation has been recorded yet.");
  const cal = ev.calendar;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap"/>
<title>Evidence pack - ${esc(e.name)}</title>
<style>
  @page { size: A4; margin: 16mm 16mm; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111232; font-size: 10pt; line-height: 1.45; }
  .eyebrow { color: #5391D5; font-size: 8.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin: 0; }
  h1 { font-size: 19pt; color: #010131; margin: 4px 0 2px; }
  .sub { color: #5b6480; margin: 0 0 12px; }
  h2 { font-size: 11.5pt; color: #010131; margin: 14px 0 5px; border-bottom: 1px solid #d7dce8; padding-bottom: 3px; break-after: avoid; }
  .clause { color: #8a91a8; font-size: 8.5pt; font-weight: normal; }
  p { margin: 0 0 7px; }
  ul { margin: 0 0 7px; padding-left: 18px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; break-inside: avoid; }
  th, td { border-bottom: 1px solid #e6e9f2; padding: 3px 6px; text-align: left; vertical-align: top; font-size: 9pt; }
  th { color: #5b6480; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; }
  td.num, th.num { text-align: right; }
  .gap { color: #9a6b00; background: #fff8e6; padding: 2px 5px; border-radius: 3px; display: inline-block; }
  .muted { color: #5b6480; font-size: 9pt; }
  .eval { border-left: 3px solid #5391D5; padding: 4px 10px; margin: 0 0 8px; }
  dl { margin: 0; } dt { font-size: 8.5pt; color: #5b6480; text-transform: capitalize; margin-top: 3px; } dd { margin: 0 0 2px; }
  .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin: 6px 0 4px; }
  .summary div { border: 1px solid #e6e9f2; border-radius: 6px; padding: 6px 9px; }
  .summary b { display: block; font-size: 8.5pt; color: #5b6480; text-transform: uppercase; letter-spacing: .04em; }
  footer { margin-top: 14px; border-top: 1px solid #e6e9f2; padding-top: 6px; color: #8a91a8; font-size: 8.5pt; break-inside: avoid; }
</style></head>
<body>
  <p class="eyebrow">Evidence pack</p>
  <h1>${esc(e.name)}</h1>
  <p class="sub">${[ev.organisationName, purpose ? `${purpose} centre` : null, e.target_role, `${fmtDate(e.start_date)} to ${fmtDate(e.end_date)}`].filter(Boolean).map(esc).join(" &middot; ")}</p>
  <p>What VIFM can show about whether this centre works, under the headings the BPS standard sets for evaluating a centre (9.9): reliability, validity, diversity, participant impact and utility, with the design evidence the criteria rest on. Every number carries the sample behind it, and a heading with no evidence yet says so.</p>
  <div class="summary">
    <div><b>Reliability</b>${ev.icc && ev.icc.value !== null ? `ICC ${ev.icc.value.toFixed(2)} (${ev.icc.subjects} co-rated)` : "Not yet computable"}</div>
    <div><b>Criterion validity</b>${ev.validity.r !== null ? `r ${ev.validity.r.toFixed(2)} over ${ev.validity.n}` : `${ev.validity.n} with both ratings`}${ev.validity.power === "adequate" ? "" : ev.validity.power === "early" ? " (provisional)" : ev.validity.power === "too_small" ? " (too few)" : " (no data)"}</div>
    <div><b>Fairness</b>${fair.report ? (fair.report.dimensions.some((d) => d.anyAdverseImpact) ? "A group flagged" : "No group flagged") : "Not applicable"}</div>
    <div><b>Participant impact</b>${pi.responses ? `${pi.responses} responses${pi.meanRating !== null ? `, mean ${pi.meanRating}/5` : ""}` : "No feedback yet"}</div>
  </div>

  <h2>1. Where the criteria came from <span class="clause">4.2, 4.4, 4.8</span></h2>${content}
  <h2>2. Reliability: assessor agreement <span class="clause">9.9</span></h2>${reliability}
  <h2>3. Independence of the criteria <span class="clause">4.6</span></h2>${overlap}
  <h2>4. Validity: ratings against later performance <span class="clause">3.20, 9.9, 9.10</span></h2>${validity}
  <h2>5. Diversity: how outcomes fell across groups <span class="clause">3.19, 9.9</span></h2>${fairness}
  <h2>6. Participant impact <span class="clause">9.9</span></h2>${impact}
  <h2>7. Utility and the agreed evaluation plan <span class="clause">3.20, 9.5</span></h2>${utility}
  <h2>8. Evaluations carried out <span class="clause">9.6, 9.8</span></h2>
  <p class="muted">${cal.annualDueOn ? `Next annual evaluation due ${esc(fmtDate(cal.annualDueOn))}${cal.annualOverdue ? " (overdue)" : ""}; major review due ${esc(fmtDate(cal.majorDueOn))}.` : "No centre dates, so no evaluation calendar."}</p>
  ${evals}

  <footer>Virginia Institute of Finance and Management &middot; Generated ${esc(generatedAt)} from the engagement in Caliber. Figures are computed from the centre's records on the day of generation and are not stored; a later pack may differ as follow-ups are collected.</footer>
</body></html>`;
}
