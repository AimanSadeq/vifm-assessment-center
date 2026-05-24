/**
 * Generate the "VIFM Capability Assurance" strategic concept brief (.docx).
 *
 * Internal strategy artifact for VIFM leadership. Reframes the three existing
 * assessment products (Assessment Center, AI Readiness Compass, Reflect 360)
 * as one capability-intelligence platform and proposes a new market category.
 *
 * Run:
 *   NODE_PATH="C:\\Users\\AimanSadeq\\AppData\\Roaming\\npm\\node_modules" \
 *     node scripts/build-capability-assurance-brief.js .tmp/VIFM-Capability-Assurance-Concept-Brief.docx
 */

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak,
} = require("docx");

// VIFM brand palette (hex, no #)
const C = {
  primary: "010131",
  navy:    "121140",
  accent:  "5391D5",
  light:   "A8C4E5",
  pale:    "E8F0FA",
  paleEdge:"D0DFF4",
  text:    "111232",
  mute:    "5A5A6A",
  white:   "FFFFFF",
  rule:    "C9D6E8",
};

const FONT = "Open Sans";
const CONTENT_W = 9360; // US Letter, 1" margins

// ── helpers ──────────────────────────────────────────────────────
const H1 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const H2 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });

const body = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: 160, line: 276 },
    children: Array.isArray(runs) ? runs : [new TextRun(runs)],
    ...opts,
  });

const t = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });

const bullet = (runs) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 90, line: 270 },
    children: Array.isArray(runs) ? runs : [new TextRun(runs)],
  });

// Tinted callout box (single-cell table)
const callout = (label, sentenceRuns) => {
  const border = { style: BorderStyle.SINGLE, size: 2, color: C.paleEdge };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: { top: border, bottom: border, left: { style: BorderStyle.SINGLE, size: 18, color: C.accent }, right: border },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: C.pale, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [t(label, { bold: true, color: C.accent, size: 17, allCaps: true })],
              }),
              new Paragraph({
                spacing: { line: 270 },
                children: Array.isArray(sentenceRuns) ? sentenceRuns : [t(sentenceRuns, { color: C.text, size: 22 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

// Generic table builder: header row + body rows
const dataTable = (headers, rows, widths) => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.rule };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  const headerCells = headers.map((h, i) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: C.primary, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [t(h, { bold: true, color: C.white, size: 19 })] })],
    })
  );
  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((cell, ci) =>
        new TableCell({
          width: { size: widths[ci], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? C.white : C.pale, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: Array.isArray(cell) ? cell : [t(cell, { color: C.text, size: 19 })],
          })],
        })
      ),
    })
  );
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
  });
};

// ── document ─────────────────────────────────────────────────────
const doc = new Document({
  creator: "VIFM",
  title: "VIFM Capability Assurance — Concept Brief",
  description: "Strategic concept brief reframing VIFM's assessment products as a capability-intelligence platform.",
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: C.text } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: C.primary },
        paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 4 } } },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: FONT, color: C.navy },
        paragraph: { spacing: { before: 200, after: 90 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 460, hanging: 260 } }, run: { color: C.accent } } },
      ]},
    ],
  },
  sections: [
    // ── Title page ──
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ spacing: { before: 2600, after: 0 },
          children: [t("STRATEGIC CONCEPT BRIEF  ·  CONFIDENTIAL", { color: C.accent, bold: true, size: 18, allCaps: true })] }),
        new Paragraph({ spacing: { before: 240, after: 0 },
          children: [t("VIFM Capability Assurance", { bold: true, size: 64, color: C.primary }),
                     t("™", { bold: true, size: 32, color: C.accent, superScript: true })] }),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 8 } },
          spacing: { before: 60, after: 260 }, children: [t("")],
        }),
        new Paragraph({ spacing: { after: 120, line: 320 },
          children: [t("Turning three assessment products into one capability-intelligence platform — and defining a new market category for the GCC.",
            { italics: true, size: 26, color: C.navy })] }),
        new Paragraph({ spacing: { before: 1800, after: 40 },
          children: [t("Prepared for", { color: C.mute, size: 18 })] }),
        new Paragraph({ spacing: { after: 30 }, children: [t("VIFM Leadership", { bold: true, size: 22, color: C.text })] }),
        new Paragraph({ spacing: { after: 0 }, children: [t("Virginia Institute of Finance and Management", { size: 20, color: C.text })] }),
        new Paragraph({ spacing: { before: 60 }, children: [t("Draft for discussion  ·  2026", { color: C.mute, size: 18 })] }),
      ],
    },
    // ── Body ──
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.rule, space: 4 } },
        children: [t("VIFM Capability Assurance — Strategic Concept Brief", { color: C.mute, size: 16 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.rule, space: 4 } },
        children: [
          t("Confidential — for VIFM internal use only        ", { color: C.mute, size: 15 }),
          new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: C.mute }),
        ] })] }) },
      children: [
        // 1
        H1("1.  Executive summary"),
        body([
          t("VIFM sells three assessment products — the "),
          t("Assessment Center", { bold: true }),
          t(", the "),
          t("AI Readiness Compass", { bold: true }),
          t(", and "),
          t("Reflect 360", { bold: true }),
          t(". Underneath, they are not three tools; they share one engine: a bilingual, GCC-anchored "),
          t("capability data platform", { bold: true }),
          t(". Every engagement already produces structured, longitudinal evidence of human and organisational capability — but that evidence walks out the door as a one-off PDF."),
        ]),
        body([
          t("This brief proposes converting that platform into a new category — "),
          t("Capability Assurance", { bold: true, color: C.accent }),
          t(" — that fuses every assessment into a single living capability graph, benchmarks it across the GCC, and proves the ROI of the training that follows. The prize is a shift from project fees to a recurring capability-intelligence partnership, defended by a data-network effect competitors cannot replicate, and aligned to the precise regulatory and national-development mandates that already make capability a board-reportable metric in this region."),
        ]),
        callout("The one-line version",
          [t("VIFM is one engagement away from being a capability-intelligence company, not an assessment vendor — and the GCC is the one market where that is worth the most.", { italics: true, size: 22, color: C.navy })]),

        // 2
        H1("2.  The reframe: you built a platform, not three tools"),
        body([
          t("The three products look distinct because they point at different targets. But they run on the same five layers — and those layers, taken together, are the actual asset:"),
        ]),
        bullet([t("Sensors. ", { bold: true }), t("The Assessment Center measures competence under simulation; Reflect 360 measures how others experience a leader; the AI Readiness Compass measures organisational and individual AI readiness.")]),
        bullet([t("A shared ontology. ", { bold: true }), t("38 competencies, 249 behavioural indicators, 8 AI-readiness pillars and 4 personal AI factors — all bilingual EN/AR and culturally anchored to the GCC.")]),
        bullet([t("An AI report factory. ", { bold: true }), t("Claude-driven extraction, scoring assistance and coaching, rendered into professional bilingual PDFs.")]),
        bullet([t("A training actuator. ", { bold: true }), t("A 127-programme catalogue with a recommender that turns any diagnosed gap into a prescription.")]),
        bullet([t("A longitudinal spine. ", { bold: true }), t("Annual reassessment with year-on-year delta arrows — the platform already remembers.")]),
        body([
          t("The strategic question is therefore not "),
          t("“what other assessments can we sell?”", { italics: true }),
          t(" It is "),
          t("“what can a capability data platform do that no one in the GCC is doing?”", { italics: true, bold: true }),
        ]),

        // 3
        H1("3.  The gap in the market today"),
        body("Across the global and regional landscape, six gaps recur — and every one of them is a wedge VIFM is already positioned to drive:"),
        bullet([t("Point solutions, not integration. ", { bold: true }), t("Vendors sell 360 or assessment or engagement — never one connected capability picture.")]),
        bullet([t("Consulting-led, not productised. ", { bold: true }), t("The incumbents (global talent-advisory firms) deliver via expensive bespoke projects, not a living platform.")]),
        bullet([t("Western frameworks, translated. ", { bold: true }), t("Tools built for US/UK leaders, with Arabic bolted on — not authored bilingually for the GCC context.")]),
        bullet([t("Point-in-time, not continuous. ", { bold: true }), t("An assessment is a photograph; organisations need a live feed.")]),
        bullet([t("No benchmark tied to national agendas. ", { bold: true }), t("Nobody can tell a Saudi bank how its leadership bench compares to the GCC banking median against Vision 2030 capability goals.")]),
        bullet([t("Training ROI never proven. ", { bold: true }), t("Training companies sell programmes and walk away; almost none demonstrate that capability actually moved.")]),

        // 4
        H1("4.  The concept: Capability Assurance"),
        body([
          t("Capability Assurance turns VIFM's longitudinal data into a continuously-maintained, regulator-grade capability layer. It rests on three pillars — each of which extends assets that already exist."),
        ]),
        H2("Pillar 1 — The Capability Graph"),
        body("One living model per person and per organisation that fuses Assessment Center, Reflect 360 and AI Readiness data into a single queryable picture. Not three PDFs — one capability twin you can interrogate: “If we win this mandate, do we have the leadership bench?”  “What is our governance-competency gap against the regulator's expectations?”"),
        H2("Pillar 2 — GCC benchmarking (the moat)"),
        body("Because VIFM operates region-wide, anonymised aggregation lets every client see its standing against a sector and national median — “your bank's Decision Quality vs the GCC banking benchmark.” Each new engagement makes the benchmark more valuable and harder to copy. This is a data-network effect, not a feature."),
        H2("Pillar 3 — Closed-loop ROI"),
        body("Link reassessment deltas back to the training delivered: “VIFM programmes moved this cohort's Strategic Mindset +0.6 over twelve months.” Closing this loop converts VIFM's training catalogue from a cost line into a provable investment — the single thing buyers most want and least often get."),
        callout("Why this is market-making, not me-too",
          [t("It defines a category at the intersection of talent development, regulatory compliance, and national capability agendas — exactly where GCC budget, mandate, and urgency all concentrate at once.", { italics: true, size: 22, color: C.navy })]),

        // 5
        H1("5.  Why now — the GCC tailwind"),
        body("Three forces make this the moment, and they are specific to this region:"),
        bullet([t("National capability is now a KPI. ", { bold: true }), t("Saudi Arabia's Human Capability Development Programme under Vision 2030 — and the UAE's parallel agenda — make workforce capability a government-reportable metric. (The client competency model that prompted this brief was itself framed from an “HCDD point of view.”)")]),
        bullet([t("Nationalisation needs evidence. ", { bold: true }), t("Saudization and Emiratization quotas increasingly require not just headcount but proof of capability and a credible succession bench.")]),
        bullet([t("Regulators demand fit-and-proper proof. ", { bold: true }), t("Central-bank and capital-market authorities expect demonstrable competence and governance maturity for senior roles — today assembled by hand, once a year, with no benchmark.")]),
        bullet([t("AI is resetting “capable.” ", { bold: true }), t("The AI Readiness Compass already gives VIFM a head-start on the fastest-moving capability question every board is now asking.")]),

        // 6
        H1("6.  How it works — reusing what you have already built"),
        body("Capability Assurance is mostly an intelligence and packaging layer over existing data. The heavy lifting is done:"),
        dataTable(
          ["Capability Assurance component", "Reuses what already exists", "Net-new work"],
          [
            ["Capability Graph (per person / org)", "AC consensus ratings, Reflect 360 scores, ARC pillar/factor data, role profiles", "A unifying schema + identity resolution across modules"],
            ["Query & scenario layer", "Existing scoring engines and reassessment spine", "A querying UI / API and scenario logic"],
            ["GCC benchmarking", "Multi-tenant data already captured per engagement", "Anonymised aggregation + consent model + percentile engine"],
            ["Closed-loop ROI", "Year-on-year delta arrows + course recommender", "Linking training records to delta + a correlation view"],
            ["Regulatory assurance report", "Bilingual PDF report factory (Puppeteer / React-PDF)", "A regulator-aligned report template + competency-to-requirement map"],
          ],
          [3400, 3760, 2200]
        ),

        // 7
        H1("7.  The moat — why this compounds and resists copying"),
        bullet([t("Data-network effect. ", { bold: true }), t("Benchmarks improve with every engagement; a competitor with no installed base cannot match them at any price.")]),
        bullet([t("Regulatory credibility. ", { bold: true }), t("VIFM is a finance institute — uniquely placed to speak the language of fit-and-proper, governance and assurance, not just HR.")]),
        bullet([t("Bilingual-native, GCC-authored. ", { bold: true }), t("Content built in Arabic and English for this culture, not translated into it.")]),
        bullet([t("Switching cost. ", { bold: true }), t("Once a client's capability twin lives with VIFM and accrues history, leaving means losing the longitudinal record.")]),

        // 8
        H1("8.  The business-model shift"),
        body([
          t("Today VIFM earns "),
          t("project fees", { bold: true }),
          t(": sell an engagement, deliver, walk away. Capability Assurance reframes the relationship as a "),
          t("recurring capability-intelligence subscription", { bold: true }),
          t(" — the organisation's capability twin lives with VIFM and is reassessed continuously. That is a different revenue quality (annual recurring vs one-off), a different retention profile, and a different valuation multiple."),
        ]),
        callout("The shareholder version",
          [t("The same data you already collect, repackaged as an always-on assurance layer, converts VIFM from a services vendor into a platform with recurring revenue and a defensible data moat.", { italics: true, size: 22, color: C.navy })]),

        // 9
        H1("9.  Go-to-market"),
        H2("Beachhead — GCC banking"),
        body("Start where the regulatory pressure and the budget are highest. Banks already face fit-and-proper and governance scrutiny; the Capability Assurance report becomes the artifact they bring to the regulator. VIFM's finance heritage makes this the most credible entry point."),
        H2("Expand — government and large enterprise"),
        body("Government entities under Vision 2030 / national-capability mandates are the natural second wave, followed by large enterprise groups managing succession and nationalisation at scale."),
        H2("Land-and-expand inside the existing base"),
        body("Every current Assessment Center, Reflect 360 and AI Readiness client is already feeding the graph. Capability Assurance is the upsell that turns each completed project into an ongoing subscription — the cheapest pipeline VIFM has."),

        // 10
        H1("10.  What it would take to build"),
        dataTable(
          ["Phase", "Deliverable", "Rough scope"],
          [
            ["0", "Capability Graph schema — unify AC + Reflect + ARC data per person/org", "Foundational; mostly data modelling over existing tables"],
            ["1", "Org capability twin + query and scenario view", "First client-visible surface"],
            ["2", "Anonymised GCC benchmarking + consent model", "Unlocks the moat; needs a data-governance design"],
            ["3", "Closed-loop training ROI view", "Links course history to reassessment deltas"],
            ["4", "Regulator-aligned Capability Assurance report", "The flagship deliverable; bilingual, audit-ready"],
          ],
          [900, 5200, 3260]
        ),

        // 11
        H1("11.  Risks and open questions"),
        bullet([t("Data privacy & aggregation consent. ", { bold: true }), t("Benchmarking requires a clean, contractual consent model under UAE PDPL / KSA PDPL — solvable, but must be designed in from Phase 2.")]),
        bullet([t("Benchmark cold-start. ", { bold: true }), t("Percentile claims need a critical mass of engagements; early benchmarks are sector-narrow until volume builds.")]),
        bullet([t("Positioning discipline. ", { bold: true }), t("“Assurance” must be framed as evidence and insight, not regulatory certification VIFM is not licensed to give.")]),
        bullet([t("Focus risk. ", { bold: true }), t("This is a platform bet; it should not stall the in-flight product roadmaps but sequence behind them.")]),

        // 12
        H1("12.  Recommended next steps"),
        body([t("1.  ", { bold: true, color: C.accent }), t("Validate the regulatory hook with one friendly GCC bank — confirm the Capability Assurance report is something they would bring to their regulator.")]),
        body([t("2.  ", { bold: true, color: C.accent }), t("Prototype the Capability Graph schema over existing Assessment Center + Reflect 360 + ARC data for a single client to prove the fusion works.")]),
        body([t("3.  ", { bold: true, color: C.accent }), t("Produce a CHRO-facing pitch (in the Reflect 360 deck style) for the beachhead conversation.")]),
        body([t("4.  ", { bold: true, color: C.accent }), t("Design the anonymised benchmarking consent model so Phase 2 is unblocked the moment volume justifies it.")]),
        new Paragraph({ spacing: { before: 240 }, children: [
          t("Prepared as a discussion draft. The whole point of Capability Assurance is that VIFM has already built the hard part — the sensors, the ontology, the report factory and the training bridge. What remains is the intelligence layer that turns capability data into foresight, and the data-network that makes VIFM's benchmark the one everyone else is measured against.",
            { italics: true, color: C.mute, size: 20 }),
        ]}),
      ],
    },
  ],
});

const out = process.argv[2] || ".tmp/VIFM-Capability-Assurance-Concept-Brief.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
});
