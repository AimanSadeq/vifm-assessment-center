/**
 * The centre plan (BPS 3.26).
 *
 * "The Service Provider shall, with the Client, agree and document a detailed
 * plan for the Centre including the assessment rationale, the scope of the
 * assessment criteria to be assessed, the methods and procedures to be used,
 * the management of data and reporting, the resources required in terms of
 * personnel and facilities and the timing and scheduling of procedures and
 * other logistics."
 *
 * Every one of those sections is generated from the engagement as designed -
 * the criteria and their weights, the exercises and their timings, the staff
 * and their roles, the retention period, who receives reports. Nothing here is
 * re-typed, so the plan cannot drift from the centre it describes, and a
 * section with nothing behind it says so rather than being quietly omitted.
 */

import { acPurposeLabel } from "@/lib/constants/ac-purpose";
import { centreRoleName } from "@/lib/ac/centre-roles";

export type CentrePlanData = {
  engagement: Record<string, unknown>;
  organisationName: string | null;
  competencies: { name: string; weight: number | null; rationale: string | null; source: string | null }[];
  exercises: { name: string; exerciseType: string | null; durationMinutes: number | null; competencies: string[] }[];
  roles: { roleKey: string; name: string; isExternal: boolean }[];
  participantCount: number;
  generatedAt: string;
};

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const para = (v: unknown, fallbackClause: string): string => {
  const text = String(v ?? "").trim();
  if (!text) {
    return `<p class="gap">Not recorded. The standard asks for this (${esc(fallbackClause)}).</p>`;
  }
  return `<p>${esc(text).replace(/\n/g, "<br/>")}</p>`;
};

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  in_basket: "In-basket",
  role_play: "Role play",
  group_exercise: "Group exercise",
  case_study: "Case study",
  oral_presentation: "Oral presentation",
  competency_based_interview: "Competency-based interview",
};

const fmtDate = (v: unknown): string => {
  if (!v) return "not set";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export function buildCentrePlanHtml(data: CentrePlanData): string {
  const e = data.engagement as Record<string, string | number | null>;
  const totalMinutes = data.exercises.reduce((sum, x) => sum + (x.durationMinutes ?? 0), 0);

  const criteriaRows = data.competencies
    .map(
      (c) => `
      <tr>
        <td>${esc(c.name)}</td>
        <td class="num">${c.weight ?? "-"}</td>
        <td>${c.rationale ? esc(c.rationale) : '<span class="gap">No link to the job recorded (4.4)</span>'}</td>
      </tr>`
    )
    .join("");

  const exerciseRows = data.exercises
    .map(
      (x) => `
      <tr>
        <td>${esc(x.name)}</td>
        <td>${esc(EXERCISE_TYPE_LABELS[x.exerciseType ?? ""] ?? x.exerciseType ?? "-")}</td>
        <td class="num">${x.durationMinutes ?? "-"}</td>
        <td>${x.competencies.length > 0 ? esc(x.competencies.join(", ")) : '<span class="gap">No criteria mapped</span>'}</td>
      </tr>`
    )
    .join("");

  const roleRows = data.roles.length
    ? data.roles
        .map(
          (r) => `
      <tr>
        <td>${esc(centreRoleName(r.roleKey))}</td>
        <td>${esc(r.name)}${r.isExternal ? ' <span class="muted">(client)</span>' : ""}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="2" class="gap">No centre roles assigned yet (4.42, 5.16).</td></tr>`;

  const approved = e.plan_approved_at
    ? `<p><strong>Agreed with the client.</strong> ${esc(e.plan_approved_client_name ?? "Client representative")}, ${esc(fmtDate(e.plan_approved_at))}.</p>`
    : `<p class="gap">This plan has not yet been agreed with the client. Clause 3.26 requires the plan to be agreed <em>with</em> the client, so an internal sign-off alone does not satisfy it.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Centre plan - ${esc(e.name)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111232; font-size: 10.5pt; line-height: 1.5; }
  h1 { font-size: 19pt; margin: 0 0 2px; color: #010131; }
  h2 { font-size: 12.5pt; margin: 22px 0 6px; color: #010131; border-bottom: 1px solid #d7dce8; padding-bottom: 3px; }
  .sub { color: #5b6480; margin: 0 0 4px; }
  .clause { color: #8a91a8; font-size: 8.5pt; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border-bottom: 1px solid #e6e9f2; padding: 5px 6px; text-align: left; vertical-align: top; font-size: 9.5pt; }
  th { color: #5b6480; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; }
  td.num, th.num { text-align: right; }
  .gap { color: #9a6b00; background: #fff8e6; padding: 2px 5px; border-radius: 3px; display: inline-block; }
  .muted { color: #8a91a8; }
  .meta { background: #f5f7fa; border: 1px solid #e6e9f2; border-radius: 6px; padding: 8px 10px; margin-top: 8px; }
  .meta div { display: flex; justify-content: space-between; gap: 12px; padding: 1px 0; }
  footer { margin-top: 26px; border-top: 1px solid #e6e9f2; padding-top: 6px; color: #8a91a8; font-size: 8.5pt; }
</style></head>
<body>
  <h1>Centre plan</h1>
  <p class="sub">${esc(e.name)}${data.organisationName ? ` &middot; ${esc(data.organisationName)}` : ""}</p>
  <p class="sub">${esc(acPurposeLabel(e.purpose as string | null))} centre &middot; ${esc(e.target_role ?? "role not stated")} &middot; ${esc(fmtDate(e.start_date))} to ${esc(fmtDate(e.end_date))}</p>
  ${approved}

  <h2>1. Why this centre, in this shape <span class="clause">4.1, 3.26</span></h2>
  ${para(e.design_rationale, "4.1")}
  <h3 style="font-size:10pt;margin:10px 0 2px;">Alternatives considered</h3>
  ${para(e.alternatives_considered, "4.1")}

  <h2>2. Where the criteria came from <span class="clause">4.4, 4.9, 4.23</span></h2>
  ${para(e.job_analysis_note ?? e.job_analysis_method, "4.4")}
  <h3 style="font-size:10pt;margin:10px 0 2px;">The work and its context</h3>
  ${para(e.work_context, "4.9")}
  <h3 style="font-size:10pt;margin:10px 0 2px;">Reviewed by people who do the job</h3>
  ${para(e.sme_review_note, "4.23")}

  <h2>3. What is assessed <span class="clause">4.4, 4.5</span></h2>
  <table>
    <thead><tr><th>Criterion</th><th class="num">Weight</th><th>Link to the role</th></tr></thead>
    <tbody>${criteriaRows || '<tr><td colspan="3" class="gap">No criteria recorded.</td></tr>'}</tbody>
  </table>

  <h2>4. How it is assessed <span class="clause">4.12, 4.14, 4.19, 4.21</span></h2>
  <table>
    <thead><tr><th>Exercise</th><th>Type</th><th class="num">Minutes</th><th>Criteria observed</th></tr></thead>
    <tbody>${exerciseRows || '<tr><td colspan="4" class="gap">No exercises recorded.</td></tr>'}</tbody>
  </table>
  <h3 style="font-size:10pt;margin:10px 0 2px;">Exercises do not carry into one another <span class="clause">4.19</span></h3>
  ${para(e.exercise_independence_note, "4.19")}
  <h3 style="font-size:10pt;margin:10px 0 2px;">Existing or adapted exercises <span class="clause">4.28</span></h3>
  ${para(e.existing_exercises_note, "4.28")}
  <h3 style="font-size:10pt;margin:10px 0 2px;">Results from methods other than exercises <span class="clause">4.32</span></h3>
  <p>${
    e.other_methods_rule === "documented_conversion"
      ? esc(e.other_methods_note ?? "Converted by a stated rule.")
      : e.other_methods_rule === "context_only"
        ? "Tests, questionnaires, interviews and 360s inform the discussion but never move a rating."
        : '<span class="gap">Not decided for this centre (4.32).</span>'
  }</p>
  <h3 style="font-size:10pt;margin:10px 0 2px;">Evidence from outside the centre <span class="clause">7.14 to 7.16</span></h3>
  <p>${
    e.external_evidence_rule === "permitted"
      ? esc(e.external_evidence_framework ?? "Permitted under an agreed framework.")
      : e.external_evidence_rule === "not_permitted"
        ? "Not permitted. Ratings rest on evidence gathered at this centre."
        : '<span class="gap">Not decided for this centre (7.14).</span>'
  }</p>

  <h2>5. How the rating is reached <span class="clause">7.3, 7.4</span></h2>
  <p>${
    e.integration_method === "weighted_average"
      ? "The overall rating is the weighted average of the agreed competency ratings, using the weights above, fixed at design time. It is calculated, not agreed in the room."
      : "The overall rating is agreed by the assessors in discussion at the wash-up, on the evidence recorded."
  }</p>
  ${e.weights_confirmed_at ? `<p class="muted">Weights confirmed ${esc(fmtDate(e.weights_confirmed_at))}.</p>` : '<p class="gap">The weights have not been confirmed (7.3).</p>'}

  <h2>6. People and facilities <span class="clause">3.26, 5.14, 5.16</span></h2>
  <table>
    <thead><tr><th>Role</th><th>Who</th></tr></thead>
    <tbody>${roleRows}</tbody>
  </table>
  ${para(e.facilities_note, "3.26")}

  <h2>7. Timing and scale <span class="clause">3.26</span></h2>
  <div class="meta">
    <div><span>Participants</span><strong>${data.participantCount}</strong></div>
    <div><span>Exercises</span><strong>${data.exercises.length}</strong></div>
    <div><span>Assessed activity per participant</span><strong>${totalMinutes > 0 ? `about ${Math.round((totalMinutes / 60) * 10) / 10} hours` : "not set"}</strong></div>
    <div><span>Dates</span><strong>${esc(fmtDate(e.start_date))} to ${esc(fmtDate(e.end_date))}</strong></div>
    <div><span>Where</span><strong>${esc(e.pack_location ?? "not set")}</strong></div>
  </div>
  <h3 style="font-size:10pt;margin:10px 0 2px;">How participants were allocated <span class="clause">5.37</span></h3>
  ${para(e.grouping_rationale, "5.37")}

  <h2>8. Data and reporting <span class="clause">3.26, 5.13, 5.41.6</span></h2>
  <div class="meta">
    <div><span>Who receives reports</span><strong>${esc(e.pack_report_recipients ?? "not recorded")}</strong></div>
    <div><span>Results held for</span><strong>${esc(e.retention_months ?? 24)} months, then deleted</strong></div>
    <div><span>Used in validation or research</span><strong>${e.research_use ? "Yes, with separate consent" : "No"}</strong></div>
    <div><span>Participant contact</span><strong>${esc(e.participant_contact_name ?? "not set")}</strong></div>
  </div>
  <p class="muted" style="margin-top:8px;">
    Anyone not named above needs the participant's express permission before they are given a report (8.13).
  </p>

  <footer>
    Generated ${esc(data.generatedAt)} &middot; VIFM Caliber &middot; This plan is the record of what was agreed for this
    centre. Where a section says nothing is recorded, that gap is real and is shown rather than hidden.
  </footer>
</body></html>`;
}
