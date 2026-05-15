/**
 * Build a pitch-briefing DOCX for Dr. Ahmad to use when demoing the
 * VIFM AI Readiness Compass to an AI government agency.
 *
 * Source of truth for product copy: CLAUDE.md, /ara/engage tier
 * cards, /ara/roadmap journey steps. Anything embellished beyond
 * those sources is flagged with [marketing voice] in comments so the
 * reviewer can pressure-test it.
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  TabStopType, TabStopPosition, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, VerticalAlign,
} = require("docx");

// ────────────────────────────────────────────────────────────────
// VIFM brand palette (from CLAUDE.md "Brand Kit" section)
// ────────────────────────────────────────────────────────────────
const C = {
  primary:   "010131", // primary blue
  accent:    "5391D5", // accent blue
  text:      "121232", // dark blue
  navy:      "121140", // navy
  textLight: "6B7280",
  border:    "E5E7EB",
  bgSoft:    "F9FAFB",
  positive:  "059669",
  warning:   "D97706",
  rose:      "E11D48",
};

// ────────────────────────────────────────────────────────────────
// Helpers — keep the body of the doc focused on content
// ────────────────────────────────────────────────────────────────
const para = (text, opts = {}) => new Paragraph({
  alignment: opts.align,
  spacing: opts.spacing ?? { after: 120 },
  ...opts.props,
  children: opts.children ?? [new TextRun({ text, ...opts.run })],
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 180 },
  children: [new TextRun({ text, color: C.primary })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({ text, color: C.primary })],
});

const eyebrow = (text, color = C.accent) => new Paragraph({
  spacing: { after: 60 },
  children: [new TextRun({
    text: text.toUpperCase(),
    bold: true,
    size: 16, // 8pt
    color,
    characterSpacing: 60,
  })],
});

const bullet = (text, level = 0) => new Paragraph({
  numbering: { reference: "bullets", level },
  spacing: { after: 80 },
  children: [new TextRun({ text })],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// Generic table border
const tBorder = { style: BorderStyle.SINGLE, size: 4, color: C.border };
const tBorders = { top: tBorder, bottom: tBorder, left: tBorder, right: tBorder };

const tCell = (text, opts = {}) => new TableCell({
  borders: tBorders,
  width: { size: opts.width, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  verticalAlign: VerticalAlign.TOP,
  children: [new Paragraph({
    alignment: opts.align,
    children: [new TextRun({
      text,
      bold: opts.bold,
      size: opts.size ?? 20, // 10pt default
      color: opts.color ?? C.text,
    })],
  })],
});

// ────────────────────────────────────────────────────────────────
// Document content
// ────────────────────────────────────────────────────────────────

// Page 1 — cover
const cover = [
  new Paragraph({ spacing: { before: 1200 }, children: [] }),
  eyebrow("Pitch briefing · prepared for Dr. Ahmad", C.accent),
  new Paragraph({
    spacing: { before: 60, after: 120 },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({
      text: "VIFM AI Readiness Compass",
      bold: true, size: 56, color: C.primary,
    })],
  }),
  new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({
      text: "An engagement roadmap for the AI government agency pitch",
      size: 28, italics: true, color: C.textLight,
    })],
  }),
  new Paragraph({
    spacing: { before: 600 },
    children: [new TextRun({
      text: "Use this document to prep tonight. It covers what ARC is, the four-tier engagement model, what the client receives at each tier, how the workforce-readiness layer connects org capability to individual behaviour, a 15-minute demo flow for tomorrow, and answers to the questions a government agency is likely to ask.",
      size: 22, color: C.text,
    })],
  }),
  new Paragraph({
    spacing: { before: 600 },
    children: [new TextRun({
      text: "Live URL · caliber.viftraining.com",
      size: 18, color: C.textLight, font: "Consolas",
    })],
  }),
  new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({
      text: "Region · United Arab Emirates · Saudi Arabia (GCC-calibrated)",
      size: 18, color: C.textLight,
    })],
  }),
  new Paragraph({
    children: [new TextRun({
      text: `Briefing date · ${new Date().toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })}`,
      size: 18, color: C.textLight,
    })],
  }),
  pageBreak(),
];

// Section 1 — Executive summary
const execSummary = [
  eyebrow("Section 1"),
  h1("Executive summary"),
  para("VIFM AI Readiness Compass (ARC) is a bilingual, GCC-calibrated diagnostic platform that measures how ready an organisation — and the people inside it — are to put AI into productive use. It is not an AI tool itself. It is the instrument an executive team or government agency uses to find out where they actually stand before they invest in tools."),
  para("ARC is built on three things that competing readiness instruments do not have together:"),
  bullet("Eight organisational pillars that cover the full surface of AI capability — Strategy, Data, Technology, Talent, Culture, Governance, Operations, Model Management — and sixteen UAE and Saudi regulatory frameworks pre-mapped to those pillars, so the diagnostic produces compliance evidence the agency can use directly."),
  bullet("Four personal AI-readiness factors that measure how individuals actually behave with AI — AI Sense-Check, AI Working Practice, AI Collaboration, AI Adaptive Mindset — so the report can say not only \"the organisation has built the conditions\" but also \"the people are or are not using them.\""),
  bullet("Fully bilingual English and Arabic with proper RTL shaping in every screen and in the final PDF report, so the same instrument can run for an Arabic-speaking ministry team and an English-speaking secretariat without two separate workstreams."),
  para("The engagement is staged in four tiers — Personal, Department, Division, Enterprise — and the first two tiers are complimentary by design. The agency can have the experience and see a real report before any procurement conversation begins."),
  pageBreak(),
];

// Section 2 — The Compass model
const compass = [
  eyebrow("Section 2"),
  h1("The Compass model"),
  para("ARC measures readiness on two complementary axes. The eight pillars measure organisational capability — what the institution has built. The four personal factors measure individual behaviour — how its people work with AI day to day. A government agency's realised readiness is the intersection of both."),
  h2("Eight organisational pillars"),
  para("Every pillar is scored on a 1-5 maturity scale from multiple stakeholders. Department engagements assess four of the eight; Division engagements assess six; Enterprise covers all eight."),
];

// Pillars table — 4 cols x 3 rows (8 pillars + headers)
const pillarsTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [2340, 2340, 2340, 2340],
  rows: [
    new TableRow({ tableHeader: true, children: [
      tCell("Strategy", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Data", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Technology", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Talent", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
    ]}),
    new TableRow({ children: [
      tCell("Is there a documented AI strategy with named owners and milestones?", { width: 2340, size: 18, color: C.textLight }),
      tCell("Is the institution's data accessible, classified, and trustworthy enough for AI to draw on?", { width: 2340, size: 18, color: C.textLight }),
      tCell("Are the platforms, infrastructure, and tools in place to deploy AI safely at scale?", { width: 2340, size: 18, color: C.textLight }),
      tCell("Are the AI skills present, growing, and retained inside the workforce?", { width: 2340, size: 18, color: C.textLight }),
    ]}),
    new TableRow({ tableHeader: true, children: [
      tCell("Culture", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Governance", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Operations", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Model management", { width: 2340, fill: "E5EEF8", bold: true, color: C.primary }),
    ]}),
    new TableRow({ children: [
      tCell("Is the institution willing to experiment, accept failure, and learn from AI use?", { width: 2340, size: 18, color: C.textLight }),
      tCell("Are there ethics, risk, and policy structures in place to deploy AI responsibly?", { width: 2340, size: 18, color: C.textLight }),
      tCell("Are AI initiatives moving from pilot to production, with measured value?", { width: 2340, size: 18, color: C.textLight }),
      tCell("Are deployed models monitored, retrained, and decommissioned on a defined lifecycle?", { width: 2340, size: 18, color: C.textLight }),
    ]}),
  ],
});

const compass2 = [
  pillarsTable,
  para(" ", { spacing: { after: 120 } }),
  h2("Four personal AI-readiness factors"),
  para("Each factor is measured by a self-assessment of behaviour, not opinion. Items ask the respondent what they actually do — for example, \"I check AI-generated content for factual errors before relying on it for important work\" — rather than what they believe about AI."),
];

const factorsTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [1900, 2500, 4960],
  rows: [
    new TableRow({ tableHeader: true, children: [
      tCell("Domain", { width: 1900, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Factor", { width: 2500, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("What it measures", { width: 4960, fill: "E5EEF8", bold: true, color: C.primary }),
    ]}),
    new TableRow({ children: [
      tCell("THINKING", { width: 1900, bold: true, color: "5391D5" }),
      tCell("AI Sense-Check", { width: 2500, bold: true, color: C.primary }),
      tCell("Treats AI output as a draft to be checked, not a finished answer. Tests claims against domain knowledge, catches fabricated citations and confidently-wrong facts, and decides what to keep, edit, or discard before it leaves your hands.", { width: 4960, color: C.text }),
    ]}),
    new TableRow({ children: [
      tCell("RESULTS", { width: 1900, bold: true, color: "047857" }),
      tCell("AI Working Practice", { width: 2500, bold: true, color: C.primary }),
      tCell("Builds AI into the way you already work — writes clear prompts, iterates when the first answer misses, and folds the tool into recurring tasks. Measures success by faster, better deliverables, not by how often the tool is opened.", { width: 4960, color: C.text }),
    ]}),
    new TableRow({ children: [
      tCell("PEOPLE", { width: 1900, bold: true, color: "C2410C" }),
      tCell("AI Collaboration", { width: 2500, bold: true, color: C.primary }),
      tCell("Helps the team move with AI rather than around it. Explains what the tools can and can't do without overselling, shares prompts and patterns that worked, and pushes back when teammates take an output at face value.", { width: 4960, color: C.text }),
    ]}),
    new TableRow({ children: [
      tCell("SELF", { width: 1900, bold: true, color: "6D28D9" }),
      tCell("AI Adaptive Mindset", { width: 2500, bold: true, color: C.primary }),
      tCell("Stays open as AI changes how the work gets done — relearns familiar workflows when something better appears, asks where models can fail you, and keeps confidentiality, fairness, and policy in view when deciding what to feed into a system.", { width: 4960, color: C.text }),
    ]}),
  ],
});

const compass3 = [
  factorsTable,
  para(" ", { spacing: { after: 120 } }),
  h2("Sixteen regulatory frameworks pre-mapped"),
  para("Seven UAE frameworks and nine Saudi frameworks are seeded into ARC and mapped to the pillars. The diagnostic does not produce abstract maturity scores — it produces compliance evidence against the specific regulators the agency answers to. For UAE-based work, this includes the National AI Strategy 2031 alignment, the Federal Data Office's policy stack, and Federal Decree-Law 45 of 2021 on personal data protection. For Saudi work, it covers the National Strategy for Data and AI, the SDAIA AI Ethics Principles, and the Personal Data Protection Law."),
  pageBreak(),
];

// Section 3 — Engagement roadmap
const roadmap = [
  eyebrow("Section 3"),
  h1("Engagement roadmap"),
  para("ARC is delivered as a staged engagement. Each tier is a self-contained diagnostic that builds on the previous one. The agency can stop at any tier and still hold a complete report. The first two tiers are complimentary — designed to prove value before any procurement conversation starts."),
];

const roadmapTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [1400, 1400, 1200, 1400, 1800, 2160],
  rows: [
    new TableRow({ tableHeader: true, children: [
      tCell("Tier", { width: 1400, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Scope", { width: 1400, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Pillars / factors", { width: 1200, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Stakeholders", { width: 1400, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Report depth", { width: 1800, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Commercial", { width: 2160, fill: "E5EEF8", bold: true, color: C.primary }),
    ]}),
    new TableRow({ children: [
      tCell("Personal Snapshot", { width: 1400, bold: true, color: C.primary }),
      tCell("One individual", { width: 1400 }),
      tCell("4 personal factors", { width: 1200 }),
      tCell("1 (self)", { width: 1400 }),
      tCell("1-page PDF · stage-keyed coaching · VIFM training recommendations", { width: 1800, size: 18, color: C.text }),
      tCell("Complimentary · anonymous self-served · no account", { width: 2160, size: 18, color: C.positive, bold: true }),
    ]}),
    new TableRow({ children: [
      tCell("Department", { width: 1400, bold: true, color: C.primary }),
      tCell("One team or unit", { width: 1400 }),
      tCell("4 of 8 pillars · optional workforce layer", { width: 1200 }),
      tCell("1-2 leaders", { width: 1400 }),
      tCell("8-page client PDF · pillar maturity · gap heatmap · regulatory summary", { width: 1800, size: 18, color: C.text }),
      tCell("Complimentary · consultant-led · proves value inside one unit", { width: 2160, size: 18, color: C.positive, bold: true }),
    ]}),
    new TableRow({ children: [
      tCell("Division", { width: 1400, bold: true, color: C.primary }),
      tCell("Several departments", { width: 1400 }),
      tCell("6 of 8 pillars · optional workforce layer", { width: 1200 }),
      tCell("4-8 leaders", { width: 1400 }),
      tCell("27-page client PDF · investment matrix · gantt roadmap · use-case portfolio", { width: 1800, size: 18, color: C.text }),
      tCell("Paid · multi-stakeholder · cross-function calibration", { width: 2160, size: 18, color: C.text }),
    ]}),
    new TableRow({ children: [
      tCell("Enterprise", { width: 1400, bold: true, color: C.primary }),
      tCell("Whole organisation", { width: 1400 }),
      tCell("All 8 pillars · workforce layer recommended", { width: 1200 }),
      tCell("15+ leaders", { width: 1400 }),
      tCell("27-60 page bilingual report · all eight pillar deep-dives · YoY comparison · board-grade", { width: 1800, size: 18, color: C.text }),
      tCell("Paid · board-grade · annual reassessment built in", { width: 2160, size: 18, color: C.text }),
    ]}),
  ],
});

const roadmap2 = [
  roadmapTable,
  para(" ", { spacing: { after: 240 } }),
  h2("Typical timeline"),
  para("A Department engagement runs four to six weeks end-to-end from kick-off to released report. A Division engagement runs six to eight weeks. An Enterprise engagement runs eight to twelve weeks, with the addition of the validation workshop and the broader stakeholder set."),
  para("Annual reassessment is supported out of the box: every assessment can be cloned into a new run that preserves the organisation, scope, weights, and respondent roster, producing a year-on-year comparison in the final report."),
  pageBreak(),
];

// Section 4 — How the consultant delivers it
const delivery = [
  eyebrow("Section 4"),
  h1("How a single engagement is delivered"),
  para("Each tier follows the same six-stage process. The platform automates the mechanics so the consultant can focus on the conversation with the client."),
];

const deliveryTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [1500, 2200, 5660],
  rows: [
    new TableRow({ tableHeader: true, children: [
      tCell("Stage", { width: 1500, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("What happens", { width: 2200, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Platform mechanics", { width: 5660, fill: "E5EEF8", bold: true, color: C.primary }),
    ]}),
    new TableRow({ children: [
      tCell("1. Discover", { width: 1500, bold: true, color: C.primary }),
      tCell("Consultant creates the engagement", { width: 2200 }),
      tCell("Pick the client organisation, region (UAE or Saudi), sector, language, engagement tier, and which pillars are in scope. Toggle the optional workforce-readiness layer.", { width: 5660 }),
    ]}),
    new TableRow({ children: [
      tCell("2. Invite", { width: 1500, bold: true, color: C.primary }),
      tCell("Stakeholders receive token URLs", { width: 2200 }),
      tCell("Each respondent gets a unique link — no login, no account, no friction. Bilingual invitation email goes out automatically. Responses are tracked end-to-end.", { width: 5660 }),
    ]}),
    new TableRow({ children: [
      tCell("3. Gather", { width: 1500, bold: true, color: C.primary }),
      tCell("Stakeholders complete the questionnaire", { width: 2200 }),
      tCell("Bilingual EN / AR questionnaire. Auto-save on every answer. Offline detection. Supporting materials upload. AI use-case portfolio capture. Distortion detection runs in real time.", { width: 5660 }),
    ]}),
    new TableRow({ children: [
      tCell("4. Validate", { width: 1500, bold: true, color: C.primary }),
      tCell("Consultant runs a Phase 2 workshop", { width: 2200 }),
      tCell("Side-by-side perception-vs-reality scoring. Gap detector flags where leadership disagrees with the workforce. Shadow-AI alert fires when risk patterns appear in responses.", { width: 5660 }),
    ]}),
    new TableRow({ children: [
      tCell("5. Analyse", { width: 1500, bold: true, color: C.primary }),
      tCell("Maturity model is computed", { width: 2200 }),
      tCell("Per-pillar maturity 1-5. Investment matrix (impact x effort). Compliance summary mapped to UAE or Saudi frameworks. Workforce-readiness rollup if the individual layer is on.", { width: 5660 }),
    ]}),
    new TableRow({ children: [
      tCell("6. Report", { width: 1500, bold: true, color: C.primary }),
      tCell("Client-grade PDF delivered", { width: 2200 }),
      tCell("English, Arabic, or side-by-side landscape — consultant chooses. 8-60 pages depending on tier. Heatmaps, charts, regulatory crosswalk, use-case portfolio, next-steps roadmap. Re-assessable annually with built-in YoY view.", { width: 5660 }),
    ]}),
  ],
});

const delivery2 = [
  deliveryTable,
  pageBreak(),
];

// Section 5 — Workforce layer
const workforce = [
  eyebrow("Section 5"),
  h1("The workforce-readiness layer · the differentiator that closes the strategy-to-adoption gap"),
  para("Every readiness diagnostic in the market scores the organisation. ARC is the only one that also scores the people inside it — using the same engagement, the same report, the same conversation. This matters because a government agency can score 5 out of 5 on Data and Strategy and still fail to land AI in practice if the workforce does not actually use what has been built."),
  para("When the consultant enables the workforce layer on a Department, Division, or Enterprise engagement, every respondent answers the four personal factor items (24 in snapshot tier, 48 in deep-dive tier) alongside their pillar questions. The platform then produces, in addition to the standard pillar maturity heatmap:"),
  bullet("A cohort-level workforce readiness rollup — overall score and per-factor scores aggregated across the respondents."),
  bullet("Per-respondent personal results pages — each person can see their own snapshot after submitting, with stage-keyed coaching and recommended VIFM training programmes."),
  bullet("A Workforce AI Readiness section in the client PDF that sits next to the pillar maturity section, so the board sees both signals on facing pages."),
  para("The pitch line for the agency: \"Your strategy might be solid. Your data might be ready. But until you measure whether the people actually use what you've built, you do not know if AI has landed. We measure both, in one engagement.\""),
  pageBreak(),
];

// Section 6 — Differentiators
const differentiators = [
  eyebrow("Section 6"),
  h1("Why ARC, not a generic readiness scan"),
];

const diffTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3120, 6240],
  rows: [
    new TableRow({ children: [
      tCell("GCC-calibrated, not retrofitted", { width: 3120, bold: true, color: C.primary, fill: "F5F8FC" }),
      tCell("Question bank, regulatory frameworks, region toggle (UAE vs Saudi), Arabic translations, and worked examples are built around GCC government and banking. Generic global instruments translate poorly into a sovereign-AI context.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Bilingual end-to-end", { width: 3120, bold: true, color: C.primary, fill: "F5F8FC" }),
      tCell("English and Arabic on every screen, every question, every report page. RTL layout flips natively. The same instrument can run for an Arabic-speaking ministry team and an English-speaking secretariat without two separate workstreams.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Pillars and factors together", { width: 3120, bold: true, color: C.primary, fill: "F5F8FC" }),
      tCell("The only instrument that pairs organisational maturity with individual behaviour in one engagement. Both signals show up in the same PDF, on facing pages, so the board sees the full picture.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Regulatory crosswalk pre-built", { width: 3120, bold: true, color: C.primary, fill: "F5F8FC" }),
      tCell("Sixteen UAE and Saudi frameworks already mapped to the pillars. The report does not produce abstract maturity scores — it produces compliance evidence against the regulators the agency answers to.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Training catalogue integration", { width: 3120, bold: true, color: C.primary, fill: "F5F8FC" }),
      tCell("Every gap surfaces VIFM training programmes that close it, ranked by fit. The diagnostic is connected to the path forward, not detached from it.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Built for annual reassessment", { width: 3120, bold: true, color: C.primary, fill: "F5F8FC" }),
      tCell("Year-on-year comparison is wired in. The agency can take the same diagnostic again a year later and the platform automatically renders a delta view alongside the current report — quantified progress for the board.", { width: 6240 }),
    ]}),
  ],
});

const differentiators2 = [
  diffTable,
  pageBreak(),
];

// Section 7 — Demo flow
const demoFlow = [
  eyebrow("Section 7"),
  h1("Suggested demo flow for tomorrow · 15-20 minutes"),
  para("This is a sequence that takes the agency from product narrative to live demonstration to commercial framing without losing the thread. Time markers are guides; lengthen the sections that match the questions in the room."),
  h2("1. Open with the compass narrative · 2 minutes"),
  para("URL: caliber.viftraining.com · Show the homepage. Land on \"Know where you stand. Know where to go with AI.\" Explain that ARC is a diagnostic, not a tool — the instrument that tells the agency where they actually sit before they invest in AI tooling."),
  h2("2. Show the four-tier model · 2 minutes"),
  para("Click into Engage (/ara/engage). Walk the four tier cards left to right. Make the point that Personal and Department are complimentary — they can have the experience tomorrow, free, before any commercial conversation begins."),
  h2("3. Run the Personal Snapshot live · 3 minutes"),
  para("Click into the Personal Snapshot. Fill it on screen with a couple of factors at 3 and a couple at 4. Submit. Land on the results page. Show the EMBEDDED / PRACTISING / EMERGING stage pill. Click Download PDF and open the three-page report. This is the experience every member of the agency's staff would have, free, today."),
  h2("4. Show the consultant-side engagement · 4 minutes"),
  para("Switch to the consultant dashboard. Open the new-engagement wizard. Walk through stage selection, region selection, pillar picker. Stop on the workforce-readiness layer toggle and read its panel out loud — \"Pillars measure what the organisation has built. Factors measure how its people behave.\" This is the pitch in one sentence."),
  h2("5. Open a representative assessment report · 4 minutes"),
  para("Open the Phase 1 maturity report PDF in landscape bilingual mode. Walk the pillar heatmap, the regulatory crosswalk, the gap detector. Mention that the same report can come out in English-only, Arabic-only, or side-by-side."),
  h2("6. Close on commercial framing · 2-3 minutes"),
  para("Personal Snapshot is complimentary for any individual. A Department-tier engagement is complimentary for any agency that wants to see the platform on real data inside one of their units. Division and Enterprise are paid engagements priced per-stakeholder. The agency can decide after the Department engagement whether to scale."),
  pageBreak(),
];

// Section 8 — Anticipated Q&A
const qa = [
  eyebrow("Section 8"),
  h1("Anticipated questions · prepared answers"),
];

const qaTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3120, 6240],
  rows: [
    new TableRow({ tableHeader: true, children: [
      tCell("Likely question", { width: 3120, fill: "E5EEF8", bold: true, color: C.primary }),
      tCell("Prepared answer", { width: 6240, fill: "E5EEF8", bold: true, color: C.primary }),
    ]}),
    new TableRow({ children: [
      tCell("Who validated the methodology?", { width: 3120, bold: true }),
      tCell("The four-factor framework is anchored to published behavioural instruments (Technology Acceptance Model, Self-Determination Theory, the Big-Five behavioural taxonomy). Each question is content-validated against at least one published anchor; the methodology brief documents every anchor with citation. Available in the report and as a standalone PDF on request.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Where is the data stored? Is it sovereign?", { width: 3120, bold: true }),
      tCell("ARC runs on Supabase Postgres hosted in a configurable region. For UAE and Saudi government clients, we can deploy a dedicated instance in a region of the client's choice (or on-premise) so data never leaves the jurisdiction. The default instance is non-sovereign and clearly marked as such.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Is it GDPR / UAE PDPL / Saudi PDPL compliant?", { width: 3120, bold: true }),
      tCell("Yes, designed-in. Consent is required before any data collection. Data retention is capped at two years unless contractually extended. Right-to-erasure is supported. Audit trail is immutable. The platform itself does not transmit any personal data outside the deployed region.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Can the report be white-labelled?", { width: 3120, bold: true }),
      tCell("The PDF carries VIFM's brand on the cover and footer. For paid engagements, co-branding (agency logo alongside VIFM's, or agency-first branding) is supported with no additional engineering work.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("How do you guard against bias in the scoring?", { width: 3120, bold: true }),
      tCell("Three mechanisms: a distortion detector flags response patterns that suggest acquiescence or socially-desirable answering; the perception-vs-reality validation in Phase 2 surfaces leadership-workforce divergence; inter-rater reliability (ICC) is computed and reported when more than one stakeholder rates the same pillar.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("What does an Enterprise engagement actually cost?", { width: 3120, bold: true }),
      tCell("Priced per active stakeholder and depth of consultant facilitation. A 15-respondent Enterprise engagement with the workforce layer and the full bilingual board-grade PDF is in the [insert] range. Department-tier complimentary engagement is the recommended entry point — costs nothing and gives the agency a real artifact to evaluate.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("Can we integrate with our LMS or HRIS?", { width: 3120, bold: true }),
      tCell("ARC exports machine-readable JSON for every assessment and PDF for every report. Direct integration to an LMS (Cornerstone, SuccessFactors, Moodle) is on the roadmap and quotable on a paid engagement.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("How long until we see results?", { width: 3120, bold: true }),
      tCell("The Personal Snapshot returns results in five minutes. A Department engagement runs four to six weeks end-to-end. An Enterprise engagement runs eight to twelve weeks. The platform's auto-save and token-based access mean stakeholders complete the questionnaire on their own time without consultant babysitting.", { width: 6240 }),
    ]}),
    new TableRow({ children: [
      tCell("What happens after the report — do you just leave us with a PDF?", { width: 3120, bold: true }),
      tCell("No. Every gap surfaces VIFM training programmes that close it, ranked by fit. The diagnostic is the start of the development path, not the end of it. The agency can engage VIFM directly for the training, or apply the gaps to their existing development providers.", { width: 6240 }),
    ]}),
  ],
});

const qa2 = [
  qaTable,
  pageBreak(),
];

// Section 9 — One-page summary for the room
const onePager = [
  eyebrow("Section 9"),
  h1("One-page summary · for screen-share or hand-out"),
  new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: "VIFM AI Readiness Compass · in one page", bold: true, size: 28, color: C.primary })],
  }),
  new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({
      text: "ARC is a bilingual, GCC-calibrated diagnostic that measures organisational AI readiness across eight pillars and individual AI readiness across four personal factors, pre-mapped to sixteen UAE and Saudi regulatory frameworks. Delivered as a four-tier engagement, the first two tiers complimentary.",
      size: 22, color: C.text, italics: true,
    })],
  }),
  para("Eight organisational pillars", { run: { bold: true, size: 22, color: C.primary } }),
  para("Strategy · Data · Technology · Talent · Culture · Governance · Operations · Model management.", { run: { size: 22 } }),
  para("Four personal factors", { run: { bold: true, size: 22, color: C.primary } }),
  para("AI Sense-Check · AI Working Practice · AI Collaboration · AI Adaptive Mindset.", { run: { size: 22 } }),
  para("Four engagement tiers", { run: { bold: true, size: 22, color: C.primary } }),
  para("Personal (complimentary, self-served) · Department (complimentary, consultant-led, 4 of 8 pillars) · Division (paid, 6 of 8 pillars) · Enterprise (paid, all 8 pillars, board-grade).", { run: { size: 22 } }),
  para("Sixteen regulatory frameworks", { run: { bold: true, size: 22, color: C.primary } }),
  para("Seven UAE + nine Saudi, pre-mapped to the eight pillars. The report produces compliance evidence, not abstract scores.", { run: { size: 22 } }),
  para("Bilingual end-to-end", { run: { bold: true, size: 22, color: C.primary } }),
  para("English, Arabic, or side-by-side landscape. RTL layout native on every screen and every report page.", { run: { size: 22 } }),
  para("Workforce readiness layer", { run: { bold: true, size: 22, color: C.primary } }),
  para("Optional on any org-tier engagement: every respondent also answers the four personal factor items, giving the report a cohort workforce-readiness section alongside the pillar maturity heatmap.", { run: { size: 22 } }),
  para("Annual reassessment built in", { run: { bold: true, size: 22, color: C.primary } }),
  para("One-click clone preserves the engagement scope and roster, producing a year-on-year delta view in the next report.", { run: { size: 22 } }),
  new Paragraph({
    spacing: { before: 360, after: 60 },
    children: [new TextRun({ text: "Try it tonight: caliber.viftraining.com/ara/personal/start", size: 22, bold: true, color: C.accent, font: "Consolas" })],
  }),
  para("Five minutes, no account, your own personal AI-readiness PDF in the inbox.", { run: { size: 20, italics: true, color: C.textLight } }),
];

// ────────────────────────────────────────────────────────────────
// Assemble document
// ────────────────────────────────────────────────────────────────

const doc = new Document({
  creator: "VIFM",
  title: "VIFM AI Readiness Compass — Pitch Briefing",
  description: "Pitch briefing for Dr. Ahmad — AI government agency engagement",
  styles: {
    default: { document: { run: { font: "Arial", size: 22 /* 11pt */, color: C.text } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 40 /* 20pt */, bold: true, font: "Arial", color: C.primary },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28 /* 14pt */, bold: true, font: "Arial", color: C.primary },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ] },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({ text: "VIFM AI Readiness Compass · Pitch briefing", size: 16, color: C.textLight }),
              new TextRun({ text: "\tcaliber.viftraining.com", size: 16, color: C.textLight }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            spacing: { before: 0 },
            children: [
              new TextRun({ text: "Prepared for Dr. Ahmad", size: 16, color: C.textLight }),
              new TextRun({ text: "\tPage ", size: 16, color: C.textLight }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.textLight }),
              new TextRun({ text: " of ", size: 16, color: C.textLight }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.textLight }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          })],
        }),
      },
      children: [
        ...cover,
        ...execSummary,
        ...compass,
        ...compass2,
        ...compass3,
        ...roadmap,
        ...roadmap2,
        ...delivery,
        ...delivery2,
        ...workforce,
        ...differentiators,
        ...differentiators2,
        ...demoFlow,
        ...qa,
        ...qa2,
        ...onePager,
      ],
    },
  ],
});

const outPath = process.argv[2] || "VIFM-ARC-Pitch-Briefing-Dr-Ahmad.docx";
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
});
