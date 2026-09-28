/**
 * The VIFM Assessment Centre Agreement and Statement of Work, as a Word file,
 * pre-filled from the engagement (BPS 3.21-3.30, 5.10).
 *
 * Word, not PDF, on purpose: VIFM completes the commercial and legal fields,
 * counsel reviews it and both parties sign, so it has to stay editable.
 *
 * Three kinds of text:
 *   plain  - the agreement's own wording;
 *   blue   - taken from the engagement in Caliber ([[value]] in the source);
 *   yellow - still to be completed by hand ({{field}} in the source).
 * Blue text should be changed in Caliber, not in Word, so the agreement and
 * the centre stay the same; the drafting notes say so.
 *
 * The wording mirrors the approved template (.tmp/_build_centre_agreement.py,
 * 2026-09-28). What the engagement knows comes from buildAgreementPrefill.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HighlightColor,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { AgreementPrefill } from "./centre-agreement-prefill";

const NAVY = "010131";
const ACCENT = "5391D5";
const MUTED = "5B616B";
const TEXT = "111232";
const FROM_CALIBER = "1F5FA8";
const FONT = "Open Sans";
const cm = (n: number) => Math.round(n * 567);
const BOX_ON = "☒";
const BOX_OFF = "☐";
const MARKERS = /\{\{([\s\S]*?)\}\}|\[\[([\s\S]*?)\]\]/g;

type RunOpts = { size?: number; bold?: boolean; italics?: boolean; color?: string };

/** {{fill}} -> yellow "[fill]"; [[value]] -> blue value; everything else plain. */
export function runs(source: string, o: RunOpts = {}): TextRun[] {
  const out: TextRun[] = [];
  const base = (t: string, extra: Record<string, unknown> = {}) =>
    new TextRun({
      text: t,
      font: FONT,
      size: o.size ? o.size * 2 : undefined,
      bold: o.bold,
      italics: o.italics,
      color: o.color,
      ...extra,
    });
  let last = 0;
  for (const m of Array.from(source.matchAll(MARKERS))) {
    const at = m.index ?? 0;
    if (at > last) out.push(base(source.slice(last, at)));
    if (m[1] !== undefined) out.push(base(`[${m[1]}]`, { highlight: HighlightColor.YELLOW }));
    else out.push(base(m[2] ?? "", { color: FROM_CALIBER }));
    last = at + m[0].length;
  }
  if (last < source.length) out.push(base(source.slice(last)));
  return out;
}

/** A value from Caliber when known, otherwise a fill-in. */
const val = (v: string | number | null | undefined, fill: string) =>
  v === null || v === undefined || v === "" ? `{{${fill}}}` : `[[${String(v).replace(/\]\]/g, "] ]")}]]`;

class Builder {
  children: (Paragraph | Table)[] = [];
  private newPage = false;

  pageBreak() {
    this.newPage = true;
  }

  para(t: string, o: RunOpts & { after?: number; indent?: number } = {}) {
    this.children.push(
      new Paragraph({
        children: runs(t, o),
        spacing: { after: (o.after ?? 5) * 20, line: 276 },
        indent: o.indent ? { left: cm(o.indent) } : undefined,
      })
    );
  }

  h1(t: string) {
    this.children.push(
      new Paragraph({
        children: [new TextRun({ text: t, font: FONT, size: 26, bold: true, color: NAVY })],
        spacing: { before: 280, after: 120 },
        keepNext: true,
        pageBreakBefore: this.newPage,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: ACCENT } },
      })
    );
    this.newPage = false;
  }

  h2(t: string) {
    this.children.push(
      new Paragraph({
        children: [new TextRun({ text: t, font: FONT, size: 21, bold: true, color: NAVY })],
        spacing: { before: 160, after: 60 },
        keepNext: true,
      })
    );
  }

  clause(num: string, t: string) {
    this.children.push(
      new Paragraph({
        children: [new TextRun({ text: `${num}\t`, font: FONT, bold: true, color: NAVY }), ...runs(t)],
        indent: { left: cm(1), hanging: cm(1) },
        tabStops: [{ type: "left", position: cm(1) }],
        spacing: { after: 100, line: 276 },
      })
    );
  }

  boxes(options: { label: string; on?: boolean }[]) {
    for (const o of options) this.para(`${o.on ? BOX_ON : BOX_OFF}  ${o.label}`, { indent: 1, after: 2 });
  }

  bullet(t: string) {
    this.children.push(new Paragraph({ children: runs(t), bullet: { level: 0 }, spacing: { after: 40 } }));
  }

  heading(head: string, body: string) {
    this.children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `${head}. `, font: FONT, bold: true, color: NAVY }), ...runs(body)],
      })
    );
  }

  table(headers: string[] | null, rows: string[][], widthsCm: number[]) {
    const cell = (t: string, header: boolean, w: number) =>
      new TableCell({
        width: { size: cm(w), type: WidthType.DXA },
        shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY } : undefined,
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            keepNext: header,
            children: header
              ? [new TextRun({ text: t.replace(/\{\{|\}\}|\[\[|\]\]/g, ""), font: FONT, size: 18, bold: true, color: "FFFFFF" })]
              : runs(t, { size: 9 }),
          }),
        ],
      });
    const trs: TableRow[] = [];
    if (headers) {
      trs.push(new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, true, widthsCm[i])) }));
    }
    for (const r of rows) {
      trs.push(new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, false, widthsCm[i])) }));
    }
    this.children.push(new Table({ rows: trs, width: { size: cm(widthsCm.reduce((a, b) => a + b, 0)), type: WidthType.DXA } }));
    this.children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }
}

export async function buildCentreAgreementDocx(p: AgreementPrefill, generatedAt: string): Promise<Buffer> {
  const b = new Builder();
  const client = val(p.clientName, "Client legal name");

  // ── Cover ─────────────────────────────────────────────────────────────────
  b.children.push(new Paragraph({ children: [], spacing: { before: cm(3) } }));
  b.para("VIRGINIA INSTITUTE OF FINANCE AND MANAGEMENT", { size: 9, bold: true, color: ACCENT, after: 4 });
  b.para("Assessment Centre Agreement", { size: 24, bold: true, color: NAVY, after: 0 });
  b.para("and Statement of Work", { size: 16, color: NAVY, after: 24 });
  b.table(null, [
    ["Client", client],
    ["Centre", val(p.centreName, "Centre name")],
    ["Accepted proposal", "{{Proposal reference}} dated {{date}}"],
    ["Agreement reference", "{{Agreement reference}}"],
    ["Version and date", "Version {{n}}, {{date}}"],
  ], [5.0, 11.6]);
  b.para(
    `Drafted from Caliber on ${generatedAt}. Blue text comes from the engagement in Caliber. Yellow fields are completed ` +
      "by hand. Delete the drafting notes page before issue. Section 9 and the parties' legal roles should be confirmed " +
      "with VIFM's legal counsel before the first client use.",
    { size: 8.5, italics: true, color: MUTED }
  );

  // ── Drafting notes ────────────────────────────────────────────────────────
  b.pageBreak();
  b.h1("Drafting notes for VIFM staff (delete this page before issue)");
  for (const t of [
    "This agreement must be signed before any implementation work on the centre starts.",
    "Blue text was taken from the engagement in Caliber when this file was produced. If it is wrong, correct it in " +
      "Caliber and download the agreement again, so the agreement and the centre stay the same.",
    "Attach the centre plan PDF from the engagement's design record as Schedule 1.",
    "House defaults: the joining pack goes out at least 21 days (three weeks) before the centre (8.1), and " +
      "Participants have 21 days to appeal a result once it is communicated (8.4). Change them only for a stated " +
      "reason, such as a selection centre that cannot give three weeks' notice.",
    "The agreement records what both parties commit to. Clauses about running the centre (materials, contingency, " +
      "technical support, sending the joining pack) are only met when the centre is run that way.",
    "Do not claim more than section 11 allows. If the content used has not finished expert review, it says so there.",
    "The proposal's terms and conditions cover fees, payment, liability, intellectual property and termination. Do " +
      "not restate them here; if the commercial terms change, change the proposal.",
    "When anything in the design changes, use section 13 and issue a new version of this agreement and the plan.",
    "Keep the signed copy on the engagement file.",
  ]) b.bullet(t);

  // ── 1 ─────────────────────────────────────────────────────────────────────
  b.pageBreak();
  b.h1("1. About this agreement");
  b.clause("1.1", `This agreement is between Virginia Institute of Finance and Management ("VIFM") and ${client} ("the Client"). ` +
    "It is the statement of work for the assessment centre described below and sits under the accepted proposal " +
    "{{Proposal reference}}. The proposal's terms and conditions apply to this work. Where this agreement and the " +
    "proposal differ, this agreement prevails, as the proposal provides.");
  b.clause("1.2", "The centre plan in Schedule 1 forms part of this agreement. The plan in force is the one generated from " +
    `Caliber on {{date}}${p.planApproval ? `, [[${p.planApproval}]]` : ""}. When the design changes under section 13, ` +
    "VIFM issues an updated plan, and the latest version accepted by both parties applies.");
  b.clause("1.3", "No implementation work starts until both parties have signed this agreement.");
  b.clause("1.4", 'In this agreement, a "Participant" is a person assessed at the centre, an "Assessor" is a person who ' +
    'observes and rates Participants, and "Caliber" is VIFM\'s assessment platform, through which the centre is ' +
    "designed, run and reported.");

  // ── 2 ─────────────────────────────────────────────────────────────────────
  b.h1("2. The assessment need");
  b.clause("2.1", `The Client has described its need as follows: ${val(p.needSummary, "summary of the need, in the Client's words")}.`);
  b.clause("2.2", "The Client has supplied these documents to support the design:");
  b.boxes([
    { label: `Job descriptions or role profiles for ${val(p.targetRole, "roles")}` },
    { label: "The Client's competency or leadership framework" },
    { label: "Organisational context (strategy, structure, change programme)" },
    { label: "Results of earlier assessments of this group" },
    { label: "Other: {{describe}}" },
  ]);
  if (p.jobAnalysis) b.para(`How the role was analysed: ${val(p.jobAnalysis, "")}`, { indent: 1 });
  b.clause("2.3", "VIFM's advice on the approach (tick one):");
  b.boxes([
    { label: "VIFM advises that an assessment centre is an appropriate response to this need." },
    { label: "VIFM advised that {{alternative approach}} may meet {{part / all}} of the need better. The Client has " +
      "chosen to proceed with an assessment centre because {{reason}}." },
  ]);
  if (p.alternativesConsidered) b.para(`Alternatives considered in the design: ${val(p.alternativesConsidered, "")}`, { indent: 1 });

  // ── 3 ─────────────────────────────────────────────────────────────────────
  b.h1("3. Purpose and use of the results");
  b.clause("3.1", "The purpose of the centre is (tick one):");
  b.boxes([
    { label: "Selection: choosing among candidates for a role or promotion.", on: p.purpose === "selection" },
    { label: "Development: identifying each Participant's strengths and development needs.", on: p.purpose === "development" },
    { label: "Succession: assessing readiness for future roles.", on: p.purpose === "succession" },
  ]);
  b.para("The purpose is recorded in Caliber. It sets how the overall rating is reached (section 7), the feedback owed " +
    "to Participants (section 7.8) and whether fairness monitoring applies (section 10).", { indent: 1, color: MUTED, size: 9 });
  b.clause("3.2", `The results will inform these decisions: ${val(p.decisions, "decisions")}. The decision makers are ` +
    `{{names or roles}}, and decisions are expected ${p.decisionTiming ? val(p.decisionTiming, "") : "by {{date}}"}.`);
  b.clause("3.3", "The results will be used only for the purpose in 3.1. Any other use needs a written variation under " +
    "section 13 and, where personal data is involved, the Participants' consent.");
  b.clause("3.4", "Decisions remain the Client's. VIFM provides evidence to inform a decision; it does not make the " +
    "decision. Every report states this.");
  b.clause("3.5", "Decision makers will be supported by a person trained to interpret assessment centre results (tick one):");
  b.boxes([
    { label: "The Client names {{name, role}}, who is trained to interpret the results." },
    { label: "VIFM provides this support, through {{name}}, as part of the service." },
  ]);

  // ── 4 ─────────────────────────────────────────────────────────────────────
  b.h1("4. What will be delivered");
  b.table(["Item", "Detail"], [
    ["Target role or roles", val(p.targetRole, "roles")],
    ["Participants", `${val(p.participants, "number")} Participants at {{level}}`],
    ["Number of centres", "{{number}}, each lasting {{hours or days}}"],
    ["Project start and end", "{{start date}} to {{end date}}"],
    ["Centre dates", val(p.centreDates, "dates")],
    ["Delivery", val(p.delivery, "In person at venue / virtual / hybrid")],
    ["Languages", "{{English / Arabic / both}}"],
    ["Deliverables", "Individual reports; {{group report}}; {{development plans}}; {{other}}"],
  ], [5.0, 11.6]);
  b.clause("4.1", "The competencies assessed, and where each is observed, are set out in the centre plan. Each " +
    "competency is assessed in at least two exercises.");
  b.clause("4.2", "Each exercise and why it is included:");
  const exRows = p.exercises.length
    ? p.exercises.map((x) => [
        val(x.name, "name"),
        val(x.type, "type"),
        val(x.competencies, "competencies"),
        "{{the part of the role it simulates}}",
        val(x.minutes, "min"),
      ])
    : [["{{name}}", "{{type}}", "{{competencies}}", "{{reason}}", "{{min}}"]];
  b.table(["Exercise", "Type", "Competencies it measures", "Why it is included", "Minutes"], exRows, [3.2, 2.6, 3.8, 5.4, 1.6]);
  if (p.designRationale) b.para(`Design rationale recorded in Caliber: ${val(p.designRationale, "")}`, { indent: 1 });
  b.clause("4.3", "Other instruments, such as ability tests or questionnaires (tick one):");
  b.boxes([
    { label: "None are used." },
    { label: p.otherInstruments?.kind === "documented_conversion"
        ? `{{instrument}} is used. Its result is converted onto the rating scale by this rule: ${val(p.otherInstruments.note, "rule")}.`
        : p.otherInstruments?.kind === "context_only"
          ? "{{instrument}} is used. Its result informs the discussion but never moves a rating."
          : "{{instrument}} is used. How its result is used, and whether it contributes to any rating, is set out in the centre plan." },
  ]);

  // ── 5 ─────────────────────────────────────────────────────────────────────
  b.h1("5. Roles and responsibilities");
  b.para("Each activity has one party that leads it. Where the other party has a part, it is shown.");
  b.table(["Activity", "VIFM", "Client"], [
    ["Supply information and documents about the need", "Supports", "Leads"],
    ["Design the centre and write the centre plan", "Leads", "Approves"],
    ["Propose competency weights; approve them before the centre", "Proposes", "Approves"],
    ["Brief sponsors, line managers and Participants to build commitment to the centre", "Supports", "Leads"],
    ["Adopt a centre policy statement (template in Schedule 4) and share it with Participants", "Supports", "Leads"],
    ["Nominate Participants and supply their contact details", "-", "Leads"],
    ["Issue the joining pack and collect consent through Caliber", "Leads", "-"],
    ["Provide the venue and rooms, or the virtual platform", "{{Leads / -}}", "{{Leads / -}}"],
    ["Prepare materials and check them against the materials checklist before the centre", "Leads", "-"],
    ["Provide technical support during the centre", "Leads", "{{Supports}}"],
    ["Supply assessors and role-players", "Leads", "{{Supports, see 6.2}}"],
    ["Brief any Client representative or observer attending the centre on how to behave", "Leads", "-"],
    ["Run the centre and the integration meeting; write the reports", "Leads", "-"],
    ["Release reports to the named recipients", "Leads", "-"],
    ["Give feedback to Participants", "{{Leads}}", "{{Supports}}"],
    ["Make decisions and tell Participants the outcome", "-", "Leads"],
    ["Receive concerns and appeals about the assessment", "Leads", "Supports"],
    ["Post-centre review and evaluation", "Leads", "Supports"],
  ], [9.6, 3.5, 3.5]);
  b.h2("Named contacts");
  b.table(["Role", "Name", "Email and phone"], [
    ["VIFM engagement lead", "{{name}}", "{{contact}}"],
    ["VIFM centre manager", val(p.centreManager, "name"), "{{contact}}"],
    ["Client sponsor", "{{name}}", "{{contact}}"],
    ["Client day-to-day contact", "{{name}}", "{{contact}}"],
    ["Contact for Participants' questions and concerns", val(p.participantContact.name, "name"), val(p.participantContact.email, "contact")],
  ], [6.0, 4.6, 6.0]);

  // ── 6 ─────────────────────────────────────────────────────────────────────
  b.h1("6. Centre staff and competence");
  b.clause("6.1", "VIFM is responsible for making sure that everyone who contributes to the centre is competent in their " +
    "role. VIFM trains its own staff and records their competence in Caliber. Nobody is assigned to a centre role " +
    "until their competence for that role is recorded as current.");
  b.clause("6.2", "Where Client staff act as assessors, role-players or administrators, VIFM specifies the competence " +
    "required, and the Client makes sure its staff meet it. Training for Client staff is provided by {{VIFM / the " +
    "Client}}: {{training content, length and dates}}.");
  b.clause("6.3", "Every Participant is rated by at least two different assessors, and there is at least one assessor for " +
    "every three Participants. Assessors declare any conflict of interest, and no assessor rates a Participant they " +
    "have declared a conflict with.");
  b.clause("6.4", "Centre roles for this centre:");
  b.table(["Role", "Provided by", "Number"], p.roleCounts.length
    ? p.roleCounts.map((r) => [val(r.role, "role"), val(r.providedBy, "provider"), val(r.count, "n")])
    : [
        ["Centre manager", "VIFM", "{{n}}"], ["Assessors", "{{VIFM / Client / both}}", "{{n}}"],
        ["Role-players", "{{VIFM / Client}}", "{{n}}"], ["Centre administrator", "{{VIFM / Client}}", "{{n}}"],
        ["Integration meeting chair", "VIFM", "1"], ["Feedback provider", "{{VIFM / Client}}", "{{n}}"],
      ], [7.0, 6.0, 3.6]);

  // ── 7 ─────────────────────────────────────────────────────────────────────
  b.h1("7. How results are combined and reported");
  b.clause("7.1", "Each competency is rated on one five-point scale: 1 Significant Development Needed, 2 Development " +
    'Needed, 3 Competent, 4 Strength, 5 Significant Strength. "No Evidence" is recorded where a competency was not observed.');
  b.clause("7.2", "Competency ratings are agreed at the integration meeting after all exercises. A named chair runs the " +
    "meeting and confirms that every assessor's evidence has been heard before a rating is agreed.");
  b.clause("7.3", "The overall rating is reached as follows (tick one):");
  b.boxes([
    { on: p.ratingRule === "calculated", label: "Calculated (required for selection). The overall rating is the weighted " +
      "average of the agreed competency ratings, using the weights in 7.4. The figure is kept to two decimal places and " +
      "recorded, and the overall rating is that figure rounded to the nearest whole point. If the panel disagrees with " +
      "the calculated rating, it records its reasons in the report, and the calculated rating stands." },
    { on: p.ratingRule === "discussed", label: "Discussed (development or succession). The panel agrees the overall " +
      "rating by discussion of the evidence." },
  ]);
  b.para("In both cases the panel also records a readiness recommendation: Ready Now, Ready with Development or Not Ready.", { indent: 1 });
  b.clause("7.4", "Competency weights (for a calculated overall rating). The Client approves these before the centre. " +
    "Caliber does not calculate an overall rating until the weights are confirmed, and the weights do not change once " +
    `any Participant has been assessed.${p.weightsConfirmedOn ? ` Weights confirmed in Caliber on [[${p.weightsConfirmedOn}]].` : ""}`);
  b.table(["Competency", "Weight"], p.weights.length
    ? p.weights.map((w) => [val(w.competency, "competency"), val(w.weight, "weight")])
    : [["{{competency}}", "{{weight}}"], ["{{competency}}", "{{weight}}"], ["{{competency}}", "{{weight}}"]],
    [12.6, 4.0]);
  b.clause("7.5", "Evidence from outside the centre, such as performance reviews (tick one):");
  b.boxes([
    { on: p.externalEvidence?.permitted === false, label: "Is not used." },
    { on: p.externalEvidence?.permitted === true, label: "May be used under these conditions: " +
      `${val(p.externalEvidence?.framework ?? null, "conditions")}. Each use is recorded with a reason.` },
  ]);
  b.clause("7.6", 'Every individual report includes a "Using this report" section. It explains what the report may be ' +
    "used for, how the ratings were reached, the limitations of the evidence, the review status of the content, and " +
    "how to raise a question or challenge. VIFM checks each report before release and records who checked it. " +
    "Reports are released within {{n}} working days of the centre.");
  b.clause("7.7", `Reports go only to these recipients: ${val(p.recipients, "names or roles")}. Anyone else needs the ` +
    "Participant's express permission, which VIFM requests with a stated reason. If a Participant refuses, the report " +
    "is not released to that person.");
  b.h2("7.8 Feedback to Participants");
  b.table(["Question", "Agreed position"], [
    ["Is feedback provided?", `${val(p.feedback.provided, "Yes / No")}. For development and succession centres feedback ` +
      "is required and includes a conversation."],
    ["What form does it take?", `${val(p.feedback.form, "Written report / oral debrief / both")}. Oral feedback is also ` +
      "summarised in writing."],
    ["Who gives it?", "{{name or role}}, trained to give assessment feedback."],
    ["How and where?", "{{In person at / by video / by phone}}"],
    ["By when?", p.feedback.when ? val(p.feedback.when, "") : "Within {{14}} days of the centre."],
  ], [5.0, 11.6]);

  // ── 8 ─────────────────────────────────────────────────────────────────────
  b.h1("8. Participants");
  b.clause("8.1", `Joining pack. VIFM issues each Participant a joining pack through Caliber at least [[${p.packNoticeDays}]] ` +
    "days (three weeks) before the centre. It explains the purpose of the centre, when and where it takes place, the " +
    "exercises and how long they take, how to prepare, how results are used and what decisions follow, who receives " +
    "the report, the feedback on offer, how long data is kept, how to ask for adjustments, and the Participant's " +
    "rights and contact. Participants confirm they have read the pack before they give consent." +
    (p.packPublished
      ? ` The pack for this centre was published on [[${p.packPublished.on}]]` +
        (p.packPublished.noticeGiven !== null ? ` with [[${p.packPublished.noticeGiven}]] days' notice` : "") +
        (p.packPublished.lateReason ? `; the reason for the shorter notice is recorded as: [[${p.packPublished.lateReason}]]` : "") +
        "."
      : ""));
  b.clause("8.2", "Consent. No assessment data is collected until the Participant has consented to data processing and " +
    "to taking part, and, where a recipients list is set, to those recipients. Use of results for research (tick one):");
  b.boxes([
    { on: p.researchUse === false, label: "Is not requested." },
    { on: p.researchUse === true, label: "Is requested. Each Participant chooses; it is off unless they opt in." },
  ]);
  b.clause("8.3", "Adjustments. Every Participant is asked whether they have a disability-related or other need that " +
    "requires an adjustment. Agreed adjustments, such as extra time, are recorded and applied. VIFM consults the " +
    "Client where an adjustment affects the venue or schedule.");
  b.clause("8.4", "Concerns and appeals. Participants may raise a concern before, during or after the centre, through " +
    "Caliber or with the contact named in section 5. VIFM acknowledges each one within {{n}} working days. An appeal " +
    `against an assessment result may be made within [[${p.appealWindowDays}]] days of the result being communicated. ` +
    `An appeal against the Client's decision follows the Client's own procedure: ${val(p.clientAppealProcedure, "procedure")}.`);
  b.clause("8.5", "Disruption. If a Participant is taken ill or seriously disturbed during the centre, VIFM arranges for " +
    "them to be assessed again where that is fair to them and to other Participants.");
  b.clause("8.6", "Decisions. The Client tells each Participant the decision made using their results by {{date}}, and " +
    "tells VIFM when it has done so.");

  // ── 9 ─────────────────────────────────────────────────────────────────────
  b.h1("9. Data protection, security and legal compliance");
  b.clause("9.1", "The data protection law that applies is (tick all that apply):");
  b.boxes([
    { label: "UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data" },
    { label: "Kingdom of Saudi Arabia Personal Data Protection Law" },
    { label: "EU or UK General Data Protection Regulation" },
    { label: "Other: {{law}}" },
  ]);
  b.clause("9.2", "The parties' roles under that law are: {{to be confirmed by counsel, e.g. the Client as controller and VIFM as processor}}.");
  b.clause("9.3", "Access to Participant data in Caliber is restricted by role and organisation. Participants see only " +
    "their own data. Client users see only their own organisation's released reports. Significant actions are " +
    "recorded in an audit trail.");
  b.clause("9.4", `Identifiable personal data is kept for [[${p.retentionMonths}]] months and then deleted, unless the ` +
    "parties agree a longer period here: {{period and reason}}.");
  b.clause("9.5", "VIFM will comply with these Client policies in delivering the centre: {{policies}}.");
  b.clause("9.6", "The centre is designed and used so that it does not discriminate unfairly. Section 10 sets out how this is checked.");

  // ── 10 ────────────────────────────────────────────────────────────────────
  b.h1("10. Impact on Participants and fairness");
  b.clause("10.1", "Intended benefits: {{e.g. better-informed promotion decisions; a development plan for every Participant}}.");
  b.clause("10.2", "Risks and how they are reduced:");
  b.table(["Risk", "How it is reduced"], [
    ["Unfair discrimination against a group", "Job-related design; fairness monitoring in 10.3"],
    ["Participant anxiety or poor preparation", "Joining pack, clear briefings, adjustments"],
    ["Challenge to a decision", "Documented design and rating rule, audit trail, concerns and appeals route"],
    ["Loss of confidentiality", "Named report recipients; access controls; retention limit"],
    ["{{other risk}}", "{{mitigation}}"],
  ], [6.6, 10.0]);
  b.clause("10.3", p.fairnessApplies === false
    ? "This is a development centre, so outcome fairness monitoring is not run: no selection decision rests on it. " +
      "Design fairness still applies through 9.6 and 10.2."
    : "For selection and succession centres, Participants are invited to answer optional questions about gender, age " +
      'band and whether they are a national or expatriate. "Prefer not to say" is always available, and the answers ' +
      "never affect ratings. VIFM checks outcomes against the four-fifths rule. Where a group has fewer than 5 people, " +
      "or the total is under 30, the result is reported as low confidence. A flag leads to a review of how job-related " +
      "the design is; it does not change anyone's result.");

  // ── 11 ────────────────────────────────────────────────────────────────────
  b.h1("11. Evidence and status of the content");
  b.clause("11.1", "On request, VIFM provides the design record and centre plan, which show why each competency and " +
    "exercise was chosen and how they relate to the role.");
  b.clause("11.2", "Some of the Caliber content library, including competency descriptions, behavioural indicators, " +
    "rating-scale descriptions and exercises, was drafted with the help of AI and is being reviewed by subject matter " +
    `experts. Each report states the review status of the content used. Status at signing: ${val(p.contentStatus, "status")}`);
  b.clause("11.3", "Evidence that results predict later performance in the Client's context (tick one):");
  b.boxes([
    { label: "VIFM does not yet hold this evidence for this design. With the Client's agreement, VIFM will collect " +
      "outcome data after the centre to build it." },
    { label: "VIFM holds this evidence: {{reference}}." },
  ]);
  b.clause("11.4", "Where budget or time has shaped the design, the effect is recorded here: {{e.g. one exercise instead " +
    "of two for a competency}}. Where a lower-cost method replaces a standard one, VIFM provides the evidence that it " +
    "works: {{evidence}}.");

  // ── 12 ────────────────────────────────────────────────────────────────────
  b.h1("12. Constraints, risks and contingency");
  b.clause("12.1", "Known constraints on time, logistics, venue, Participant availability, language or technology: {{constraints}}.");
  b.clause("12.2", "The risk assessment in Schedule 2 covers data security and privacy, consent, legal compliance and " +
    "delivery. It is reviewed before each centre.");
  b.clause("12.3", "The centre manual sets out how unexpected events are handled, based on the risk assessment in " +
    "Schedule 2. In any disruption, VIFM puts Participants' safety and wellbeing first, treats everyone fairly, and " +
    "protects the integrity of the assessment, for example by rescheduling an exercise rather than running it under " +
    "unfair conditions. Each such event, and how it was handled, is recorded in the centre's delivery log.");
  b.clause("12.4", "Technical support during the centre is provided by {{name}}, available {{hours}}. If Caliber is " +
    "unavailable, the centre continues using {{fallback arrangement}}.");

  // ── 13 ────────────────────────────────────────────────────────────────────
  b.h1("13. Changes");
  b.clause("13.1", "Either party may propose a change to this agreement or the centre plan in writing, using the form in Schedule 3.");
  b.clause("13.2", "VIFM sets out the effect of the change on the design, on the standards in this agreement, on dates " +
    "and on cost. No change takes effect until both parties have approved it in writing.");
  b.clause("13.3", "Each approved change produces a new version of this agreement and, where affected, of the centre plan.");

  // ── 14 ────────────────────────────────────────────────────────────────────
  b.h1("14. After the centre");
  b.clause("14.1", "Within {{n}} weeks of the last centre, VIFM leads a review: what worked, feedback from centre staff, " +
    "Participants' reactions, and any design changes with the reasons for them.");
  b.clause("14.2", "At {{12}} months, the parties compare the cost of the centre, in money and in staff time, with its " +
    "benefits, measured by {{e.g. performance of those appointed; progress against development plans}}.");

  // ── 15 ────────────────────────────────────────────────────────────────────
  b.h1("15. Fees and resources");
  b.clause("15.1", "Fees and payment are as set out in the accepted proposal {{Proposal reference}}.");
  b.clause("15.2", "Resources each party provides:");
  b.table(["Resource", "VIFM", "Client"], [
    ["People", "{{e.g. centre manager, 4 assessors, 2 role-players}}", "{{e.g. administrator, sponsor at opening}}"],
    ["Equipment", "{{e.g. laptops, printed materials}}", "{{e.g. screens, network access}}"],
    ["Space", "-", p.facilities ? val(p.facilities, "") : "{{e.g. 1 plenary room, 4 break-out rooms}}"],
  ], [3.6, 6.5, 6.5]);

  // ── 16 ────────────────────────────────────────────────────────────────────
  b.pageBreak();
  b.h1("16. Agreement");
  b.para("Signed for and on behalf of each party.");
  b.table(["", "Virginia Institute of Finance and Management", p.clientName ?? "Client legal name"], [
    ["Name", "", ""], ["Title", "", ""], ["Signature", "\n\n\n", "\n\n\n"], ["Date", "", ""],
  ], [3.0, 6.8, 6.8]);

  // ── Schedules ─────────────────────────────────────────────────────────────
  b.pageBreak();
  b.h1("Schedule 1. Centre plan");
  b.para("Attach the centre plan exported from the engagement's design record in Caliber, and record its date in " +
    "clause 1.2. The plan covers: why this centre and in this shape; where the criteria came from; what is assessed; " +
    "how it is assessed; how the rating is reached; people and facilities; timing and scale; and data and reporting.");
  b.h1("Schedule 2. Risk assessment");
  b.para("Reviewed before each centre. Likelihood and impact: Low, Medium or High.");
  b.table(["Risk", "Likelihood", "Impact", "Control", "Owner"], [
    ["Unauthorised access to Participant data", "{{L/M/H}}", "{{L/M/H}}", "Role-based access; named recipients", "VIFM"],
    ["Data sent to the wrong recipient", "", "", "Recipients list in 7.7; release check", "VIFM"],
    ["Participant has not given valid consent", "", "", "Consent before any data collection", "VIFM"],
    ["Local law not followed", "", "", "Section 9 confirmed by counsel", ""],
    ["Exercise materials leaked in advance", "", "", "Controlled issue of the centre manual", "VIFM"],
    ["Assessor unavailable on the day", "", "", "Standby assessor with current competence", "VIFM"],
    ["Platform or network failure", "", "", "Fallback in 12.4", "VIFM"],
    ["Participant taken ill", "", "", "Re-assessment under 8.5", "VIFM"],
    ["{{other}}", "", "", "", ""],
  ], [5.2, 2.0, 2.0, 5.4, 2.0]);
  b.h1("Schedule 3. Change request");
  b.table(["Field", "Entry"], [
    ["Change number and date", ""], ["Raised by", "{{name, party}}"], ["What should change", "{{description}}"],
    ["Why", "{{reason}}"], ["Effect on design and standards", "{{VIFM assessment}}"], ["Effect on dates", ""],
    ["Effect on cost", ""], ["Approved for VIFM (name, date)", ""], ["Approved for the Client (name, date)", ""],
  ], [6.0, 10.6]);

  b.pageBreak();
  b.h1("Schedule 4. Centre policy statement (template for the Client)");
  b.para("The Client's organisation should have a policy statement for assessment centres. VIFM offers this template " +
    "where none exists. The Client adapts and adopts it, links it to its human resources policies, and gives it to " +
    "everyone involved in the centre, including Participants.", { italics: true, color: MUTED });
  const org = val(p.clientName, "Organisation");
  const policy: [string, string][] = [
    ["Purpose", `${org} uses assessment centres to {{select / develop / plan succession for}} {{groups}}.`],
    ["Ethics", "Centres are run honestly and openly. Participants are told the purpose of the centre and how the results will be used before they take part."],
    ["Diversity and fairness", "Centres assess only what the role requires. Outcomes are monitored for unfair effects on any group, and the design is reviewed if a concern arises."],
    ["Security", "Exercise materials and results are kept secure and are shared only with those entitled to see them."],
    ["Briefing Participants", "Every Participant receives a joining pack in good time before the centre."],
    ["Participants' rights", "Participants may ask for adjustments, ask questions, raise concerns and appeal, and are told how to do so."],
    ["Data protection", "Personal data is handled under {{law}} and kept for no longer than {{period}}."],
    ["Feedback", "Participants receive feedback {{in this form}} within {{period}}."],
    ["Appeals", "Appeals are handled by {{role}} under {{procedure}}."],
    ["Staff training and competence", "Only trained and competent people act as assessors or in other centre roles."],
    ["Quality, evaluation and monitoring", "Each centre is reviewed afterwards, and the use of centres is evaluated against their costs and benefits."],
    ["Link to HR policies", `This statement forms part of ${org}'s {{recruitment / talent / development}} policies.`],
  ];
  for (const [head, body] of policy) b.heading(head, body);

  b.pageBreak();
  b.h1("Schedule 5. How this agreement addresses the BPS standard");
  b.para("The British Psychological Society standard for the design and delivery of assessment centres (Division of " +
    "Occupational Psychology, 2015) requires the agreement between the provider and the client to cover the points " +
    "below. A signed, completed agreement meets the requirements about what the agreement contains. Requirements " +
    "about how the centre is run are met only when the centre is run that way.", { size: 9 });
  b.table(["BPS clause", "What it requires", "Where this agreement covers it"], BPS_MAP.map((r) => [...r]), [2.8, 8.8, 5.0]);

  const doc = new Document({
    creator: "VIFM Caliber",
    title: `Assessment Centre Agreement - ${p.centreName}`,
    styles: { default: { document: { run: { font: FONT, size: 20, color: TEXT } } } },
    sections: [{
      properties: { page: { size: { width: cm(21), height: cm(29.7) }, margin: { top: cm(2), bottom: cm(2), left: cm(2.2), right: cm(2.2) } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            children: runs(`VIFM Assessment Centre Agreement  |  ${val(p.clientName, "Client")}  |  {{Agreement reference}}  |  Version {{n}}`, { size: 7.5, color: MUTED }),
          })],
        }),
      },
      children: b.children,
    }],
  });
  return Packer.toBuffer(doc);
}

const BPS_MAP: readonly (readonly [string, string, string])[] = [
  ["3.2", "Client shares its needs and documents", "2.1, 2.2"],
  ["3.3, 3.7", "Purpose agreed and defined", "3.1"],
  ["3.4", "Provider advises where a centre is not the best response", "2.3"],
  ["3.5", "Purpose, demographics and how outcomes are reported considered", "3, 7, 10.3"],
  ["3.6, 3.25", "Service, roles and responsibilities documented", "4, 5"],
  ["3.8", "Scope: criteria and methods", "4.1, 4.2, Schedule 1"],
  ["3.9", "Limitations and constraints", "12.1"],
  ["3.10", "Evidence-based approach; validity documentation", "11"],
  ["3.11", "Ethical, professional and legal issues", "9, 10"],
  ["3.12", "Competence of everyone contributing", "6"],
  ["3.21", "Detailed specification agreed before implementation", "1.3, 4, Schedule 1"],
  ["3.22.1", "Justification for each method", "4.2"],
  ["3.22.2", "Accommodations for disability-related and other needs", "8.3"],
  ["3.22.3", "How results combine into an overall rating", "7.3, 7.4"],
  ["3.22.4", "Risk assessment: security, privacy, consent, legal", "9, Schedule 2"],
  ["3.23.1-3.23.4", "Objectives, number and duration, dates, procedures", "3, 4"],
  ["3.23.5", "Competence of assessors and their training", "6"],
  ["3.23.6", "Managing and combining data; reporting", "7"],
  ["3.23.7-3.23.8", "Data security and privacy; policy and legal compliance", "9"],
  ["3.23.9", "Informed consent and feedback", "7.8, 8.2"],
  ["3.23.10", "Costs and resources", "15"],
  ["3.23.11", "Post-centre review", "14.1"],
  ["3.24", "Budget balanced against standards", "11.4"],
  ["3.26, 3.27", "Centre plan agreed and part of the agreement", "1.2, Schedule 1"],
  ["3.28", "Impact on Participants and stakeholders", "10"],
  ["3.29", "Stakeholder commitment", "5"],
  ["3.30", "Change procedure", "13, Schedule 3"],
  ["4.45-4.48", "Centre policy statement", "5, Schedule 4"],
  ["5.3", "Data used only for the agreed purpose", "3.3"],
  ["5.10", "Feedback: whether, what, how, where, by when", "7.8"],
  ["5.26", "Materials ready before the centre", "5"],
  ["5.27", "Attending stakeholders briefed", "5"],
  ["5.28-5.30", "Contingency plan, conduct, technical support", "12.3, 12.4"],
  ["5.40", "Joining pack sent in good time", "8.1"],
  ["7.4", "Calculated overall rating for selection", "7.3"],
  ["7.5", "Decision makers supported by a trained person", "3.5"],
  ["8.2", "Decisions are the Client's", "3.4"],
  ["9.5", "Cost evaluated against benefit", "14.2"],
];
