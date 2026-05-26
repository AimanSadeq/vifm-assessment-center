/**
 * Generate the "VIFM AI Capability" strategic concept brief (.docx).
 *
 * Covers three tightly-related additions that extend the AI Readiness
 * Compass into a complete AI-capability lifecycle:
 *   1. Agentic-AI Readiness   (diagnose the frontier)
 *   2. AI Conversational Assessor (assess - already prototyped)
 *   3. AI Upskilling Pathways (close the gap)
 *
 * Run:
 *   NODE_PATH="C:\\Users\\AimanSadeq\\AppData\\Roaming\\npm\\node_modules" \
 *     node scripts/build-ai-capability-brief.js .tmp/VIFM-AI-Capability-Concept-Brief.docx
 */

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber,
} = require("docx");

const C = {
  primary: "010131", navy: "121140", accent: "5391D5", light: "A8C4E5",
  pale: "E8F0FA", paleEdge: "D0DFF4", text: "111232", mute: "5A5A6A",
  white: "FFFFFF", rule: "C9D6E8", good: "047857",
};
const FONT = "Open Sans";
const CONTENT_W = 9360;

const t = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const body = (runs, opts = {}) =>
  new Paragraph({ spacing: { after: 160, line: 276 }, children: Array.isArray(runs) ? runs : [new TextRun(runs)], ...opts });
const bullet = (runs) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 90, line: 270 },
    children: Array.isArray(runs) ? runs : [new TextRun(runs)] });

const callout = (label, sentenceRuns) => {
  const border = { style: BorderStyle.SINGLE, size: 2, color: C.paleEdge };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
    borders: { top: border, bottom: border, left: { style: BorderStyle.SINGLE, size: 18, color: C.accent }, right: border },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { fill: C.pale, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [
        new Paragraph({ spacing: { after: 40 }, children: [t(label, { bold: true, color: C.accent, size: 17, allCaps: true })] }),
        new Paragraph({ spacing: { line: 270 }, children: Array.isArray(sentenceRuns) ? sentenceRuns : [t(sentenceRuns, { color: C.text, size: 22 })] }),
      ],
    })] })],
  });
};

const dataTable = (headers, rows, widths) => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.rule };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  const headerCells = headers.map((h, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { fill: C.primary, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [t(h, { bold: true, color: C.white, size: 19 })] })],
  }));
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((cell, ci) => new TableCell({
      width: { size: widths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? C.white : C.pale, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: Array.isArray(cell) ? cell : [t(cell, { color: C.text, size: 19 })] })],
    })),
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, borders,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
  });
};

const doc = new Document({
  creator: "VIFM",
  title: "VIFM AI Capability - Concept Brief",
  description: "Concept brief extending the AI Readiness Compass into a complete AI-capability lifecycle.",
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: C.text } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: C.primary },
        paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: FONT, color: C.navy },
        paragraph: { spacing: { before: 200, after: 90 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 460, hanging: 260 } }, run: { color: C.accent } } }] }] },
  sections: [
    // Title page
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ spacing: { before: 2600 }, children: [t("STRATEGIC CONCEPT BRIEF  ·  CONFIDENTIAL", { color: C.accent, bold: true, size: 18, allCaps: true })] }),
        new Paragraph({ spacing: { before: 240 }, children: [t("VIFM AI Capability", { bold: true, size: 60, color: C.primary })] }),
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 8 } }, spacing: { before: 60, after: 260 }, children: [t("")] }),
        new Paragraph({ spacing: { after: 120, line: 320 }, children: [t("Extending the AI Readiness Compass into a complete AI-capability lifecycle - diagnose, assess, upskill.", { italics: true, size: 26, color: C.navy })] }),
        new Paragraph({ spacing: { before: 1700, after: 40 }, children: [t("Prepared for", { color: C.mute, size: 18 })] }),
        new Paragraph({ spacing: { after: 30 }, children: [t("VIFM Leadership", { bold: true, size: 22, color: C.text })] }),
        new Paragraph({ children: [t("Virginia Institute of Finance and Management", { size: 20, color: C.text })] }),
        new Paragraph({ spacing: { before: 60 }, children: [t("Draft for discussion  ·  2026", { color: C.mute, size: 18 })] }),
      ] },
    // Body
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.rule, space: 4 } },
        children: [t("VIFM AI Capability - Strategic Concept Brief", { color: C.mute, size: 16 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.rule, space: 4 } },
        children: [t("Confidential - for VIFM internal use only        ", { color: C.mute, size: 15 }),
          new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: C.mute })] })] }) },
      children: [
        H1("1.  Executive summary"),
        body([
          t("VIFM's "), t("AI Readiness Compass", { bold: true }),
          t(" (ARC) answers one question - "), t("“are we AI-ready?”", { italics: true }),
          t(" - and stops there. This brief proposes three tightly-related additions that turn that single diagnostic into a complete "),
          t("AI-capability lifecycle", { bold: true }),
          t(": "), t("Agentic-AI Readiness", { bold: true }), t(" (diagnose the frontier of delegating to autonomous agents), the "),
          t("AI Conversational Assessor", { bold: true }), t(" (assess individuals at depth and scale via a bilingual Claude interviewer), and "),
          t("AI Upskilling Pathways", { bold: true }), t(" (close the gap with personalised, factor-linked learning tracks)."),
        ]),
        body([
          t("Together they extend ARC from a point-in-time snapshot into "),
          t("diagnose → assess → upskill → re-diagnose", { bold: true, color: C.accent }),
          t(". Crucially, all three are mostly assembly over infrastructure VIFM has "),
          t("already built", { bold: true }),
          t(" - the same AI client, the same competency framework, the same bilingual report factory, the same recommender. One of the three, the Conversational Assessor, is "),
          t("already running as a working prototype", { bold: true }),
          t(" in the portal."),
        ]),
        callout("The one-line version",
          [t("ARC tells a client they have an AI gap. These three let VIFM measure it precisely, prove an individual's capability under interview, and close the gap with training - without leaving the platform.", { italics: true, size: 22, color: C.navy })]),

        H1("2.  The reframe: one diagnostic becomes a lifecycle"),
        body("ARC today is a snapshot. The three additions complete a loop that compounds in value because each stage feeds the next and the whole thing is re-runnable:"),
        bullet([t("Diagnose - ", { bold: true }), t("ARC (org 8 pillars + 4 personal factors). Exists today.")]),
        bullet([t("Diagnose the frontier - ", { bold: true }), t("Agentic-AI Readiness: can you safely delegate to autonomous agents?")]),
        bullet([t("Assess the individual - ", { bold: true }), t("the AI Conversational Assessor scores a person against the framework, at depth and at scale.")]),
        bullet([t("Close the gap - ", { bold: true }), t("AI Upskilling Pathways turn each below-target factor into a sequenced learning track.")]),
        bullet([t("Re-diagnose - ", { bold: true }), t("the existing reassessment spine proves movement year on year.")]),

        // 3a
        H1("3a.  Agentic-AI Readiness  -  the market-making frontier"),
        body([
          t("The bet: ", { bold: true }),
          t("ARC measures whether people "), t("use", { italics: true }),
          t(" AI. The 2026 frontier is whether an organisation can "),
          t("delegate to autonomous agents", { italics: true }),
          t(" - and almost nobody assesses readiness to do that safely."),
        ]),
        body("A premium ARC layer measuring whether an org (and its leaders) can deploy agentic AI with the right guardrails. Proposed dimensions: agent governance & accountability; human-in-the-loop design; failure-mode & risk awareness; tool/data access control; autonomy calibration by task risk; and auditability & oversight."),
        body([
          t("Reuses: ", { bold: true }),
          t("the ARC question-bank versioning (an "), t("agentic", { italics: true }),
          t(" tier on the existing bank, exactly as the personal layer added a tier), the "),
          t("governance", { italics: true }), t(" and "), t("model_management", { italics: true }),
          t(" pillars (this is their frontier), the regulatory engine, and the bilingual Puppeteer report. "),
          t("Net-new: ", { bold: true }),
          t("the agentic framework + a risk-posture maturity model, mapped to ISO 42001, the EU AI Act, NIST AI RMF, and Saudi SDAIA / UAE guidance."),
        ]),
        callout("Why it's market-making",
          [t("Agentic AI is the hottest enterprise topic of 2026 and there is essentially no assessment for readiness to deploy it safely. First-mover, and aligned to emerging GCC and international AI-governance regulation.", { italics: true, size: 22, color: C.navy })]),

        // 3b
        H1("3b.  AI Conversational Assessor  -  prototyped"),
        body([
          t("The bet: ", { bold: true }),
          t("a Claude agent runs structured competency-based interviews in Arabic and English and scores them against the VIFM framework - scaling the single most expensive part of an Assessment Center: assessor time."),
        ]),
        body([
          t("Status: ", { bold: true, color: C.good }),
          t("a working prototype is already live in the portal. A bilingual STAR interviewer conducts the conversation one question at a time, probes for what the candidate personally did, then extracts behavioural evidence and assigns a BARS 1–5 rating with rationale, strengths, and development areas."),
        ]),
        body([
          t("Reuses: ", { bold: true }),
          t("the existing "), t("competency_based_interview", { italics: true }),
          t(" exercise type and - critically - the "), t("observation-assistant", { italics: true }),
          t(" engine, which already classifies free-form text into competency + behaviour + polarity + confidence. Whisper handles voice; the bias-detector audits the AI's own scoring for fairness. "),
          t("Net-new: ", { bold: true }),
          t("the stateful interview orchestration, the live chat UI, and a scoring-to-BARS bridge with a human-review gate."),
        ]),
        callout("The positioning guardrail",
          [t("Position as a screening / sifting aid that runs BEFORE a human assessor - never the final hiring decision. The human validates the shortlist. This removes most of the manual interview load while sidestepping the legal and fairness risk of fully-automated hiring.", { italics: true, size: 22, color: C.navy })]),

        // 3c
        H1("3c.  AI Upskilling Pathways  -  the loop-closer"),
        body([
          t("The bet: ", { bold: true }),
          t("ARC diagnoses AI gaps; the obvious actuator is personalised AI-capability tracks tied to the four personal factors."),
        ]),
        body("Each factor becomes a sequenced learning track - not a flat course list:"),
        dataTable(
          ["Personal factor (exists)", "Upskilling track"],
          [
            ["AI Sense-Check (THINKING)", "Critical evaluation of AI output - hallucination detection, verification, domain validation"],
            ["AI Working Practice (RESULTS)", "Prompt-craft & workflow integration"],
            ["AI Collaboration (PEOPLE)", "Leading team AI adoption - norms, communication"],
            ["AI Adaptive Mindset (SELF)", "Responsible & governed AI use - ethics, confidentiality, policy"],
          ],
          [3400, 5960]
        ),
        body([
          t("Reuses: ", { bold: true }),
          t("the four factors + maturity stages (Emerging / Practising / Embedded), the existing individual-snapshot course recommender, the Learning-Plan PDF, and the reassessment spine. Unlike a language module, the "),
          t("artificial_intelligence", { italics: true }),
          t(" course vertical "), t("already exists", { bold: true }),
          t(", so the loop can close today. "),
          t("Net-new: ", { bold: true }),
          t("the pathway structure (sequenced modules + prerequisites), progress tracking, and - likely - some short-form AI micro-content, since the current catalogue is multi-day."),
        ]),

        // 4
        H1("4.  Why now"),
        bullet([t("AI is the board question. ", { bold: true }), t("Every CHRO and board is now asking how ready their people and their organisation are - a question that did not exist three years ago.")]),
        bullet([t("Agentic is the 2026 frontier. ", { bold: true }), t("Enterprises are moving from using AI to delegating to it; readiness to do so safely is unmeasured and urgent.")]),
        bullet([t("Vision 2030 makes capability national. ", { bold: true }), t("AI capability sits squarely inside the Human Capability Development agenda and parallel UAE programmes.")]),
        bullet([t("Regulation is arriving. ", { bold: true }), t("ISO 42001, the EU AI Act, and Gulf AI-governance guidance create demand for defensible AI-governance readiness evidence.")]),

        // 5
        H1("5.  What it reuses - day one is not zero"),
        body("The strategic point: almost all of this is assembly over assets VIFM has already built and proven."),
        dataTable(
          ["Addition", "Reuses (already built)", "Net-new"],
          [
            ["Agentic-AI Readiness", "ARC question-bank versioning, governance + model_management pillars, regulatory engine, bilingual report", "Agentic framework + risk-posture model + AI-governance regulation map"],
            ["Conversational Assessor", "CBI exercise type, observation-assistant evidence engine, Whisper, bias-detector, BARS pipeline", "Interview orchestration + chat UI + human-review gate (prototype done)"],
            ["Upskilling Pathways", "4 factors + maturity stages, snapshot recommender, AI course vertical, Learning-Plan PDF, reassessment", "Pathway structure + progress tracking + short-form micro-content"],
          ],
          [2500, 4360, 2500]
        ),

        // 6
        H1("6.  The moat - why VIFM"),
        bullet([t("Bilingual-native AI assessment. ", { bold: true }), t("A Claude interviewer and AI feedback authored in Arabic and English for the GCC - not translated.")]),
        bullet([t("The competency framework. ", { bold: true }), t("These tools score against VIFM's 38-competency model and 4 AI factors, not a generic rubric - the output plugs straight into the rest of the platform.")]),
        bullet([t("One vendor, full loop. ", { bold: true }), t("Diagnose, assess, and the training catalogue that closes the gap - and the reassessment that proves it - all in one place.")]),
        bullet([t("Consultant-led. ", { bold: true }), t("AI does the scale work; a named VIFM lead owns the judgement calls, the human-review gate, and the relationship.")]),

        // 7
        H1("7.  Sequencing"),
        body([t("1.  ", { bold: true, color: C.accent }), t("Conversational Assessor - already prototyped; productionise it first (human-review gate, persist evidence to the observation pipeline). Highest ROI, most demoable.")]),
        body([t("2.  ", { bold: true, color: C.accent }), t("Agentic-AI Readiness - the market-making bet; mostly content plus a tier flag on the existing question bank.")]),
        body([t("3.  ", { bold: true, color: C.accent }), t("Upskilling Pathways - organise the existing AI courses into factor tracks and add progress tracking; close the loop.")]),

        // 8
        H1("8.  Risks and open questions"),
        bullet([t("AI scoring validity & fairness. ", { bold: true }), t("Interview and agentic scoring need calibration against human raters; the bias-detector and the human-review gate are the mitigations. Keep the assessor at screening stakes, not final decisions.")]),
        bullet([t("Agentic content credibility. ", { bold: true }), t("The agentic framework needs SME authoring and a defensible mapping to AI-governance standards before it carries the VIFM name.")]),
        bullet([t("Anti-gaming. ", { bold: true }), t("Candidates may use AI to answer interview questions; mitigate with timing, voice, and probing follow-ups that require genuine recall.")]),
        bullet([t("Micro-content build. ", { bold: true }), t("Pathways imply finer-grained content than the current multi-day catalogue - a content decision, not a platform one.")]),

        // 9
        H1("9.  Recommended next steps"),
        body([t("1.  ", { bold: true, color: C.accent }), t("Productionise the Conversational Assessor - wire the human-review gate and persist scored evidence into the existing observation/consensus pipeline.")]),
        body([t("2.  ", { bold: true, color: C.accent }), t("Commission the Agentic-AI Readiness framework - SME-authored dimensions + the regulation map - as a new tier on the ARC question bank.")]),
        body([t("3.  ", { bold: true, color: C.accent }), t("Organise the AI course vertical into the four factor tracks and add pathway progress tracking.")]),
        new Paragraph({ spacing: { before: 240 }, children: [
          t("Prepared as a discussion draft. The through-line is the same one that makes Capability Assurance compelling: VIFM has already built the hard parts - the AI client, the competency framework, the evidence engine, the recommender and the report factory. These three additions are mostly assembly, and they convert ARC from a one-off readiness check into an AI-capability lifecycle that the GCC market is asking for right now.",
            { italics: true, color: C.mute, size: 20 }),
        ]}),
      ] },
  ],
});

const out = process.argv[2] || ".tmp/VIFM-AI-Capability-Concept-Brief.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log(`Wrote ${out} (${(buf.length/1024).toFixed(0)} KB)`); });
