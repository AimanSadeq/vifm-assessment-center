const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  TableOfContents, TabStopType, TabStopPosition } = require("docx");

const PRIMARY = "010131";
const ACCENT = "5391D5";
const LIGHT_BG = "F0F4F8";
const WHITE = "FFFFFF";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const W = 9026; // A4 content width with 1" margins

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text, bold: true, size: 32, font: "Arial", color: PRIMARY })] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text, bold: true, size: 26, font: "Arial", color: PRIMARY })] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 }, children: [new TextRun({ text, bold: true, size: 22, font: "Arial", color: ACCENT })] }); }
function p(text, opts = {}) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 21, font: "Arial", ...opts })] }); }
function pb(label, value) { return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: label + ": ", size: 21, font: "Arial", bold: true }), new TextRun({ text: value, size: 21, font: "Arial" })] }); }
function bullet(text, ref = "bullets") { return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, size: 21, font: "Arial" })] }); }
function numItem(text, ref = "numbers") { return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, size: 21, font: "Arial" })] }); }
function spacer() { return new Paragraph({ spacing: { after: 200 }, children: [] }); }

function makeTable(headers, rows, colWidths) {
  const tw = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) =>
    new TableCell({ borders, width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: PRIMARY, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: "Arial", color: WHITE })] })]
    })
  )});
  const dataRows = rows.map(row => new TableRow({ children: row.map((cell, i) =>
    new TableCell({ borders, width: { size: colWidths[i], type: WidthType.DXA },
      margins: { top: 50, bottom: 50, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 20, font: "Arial" })] })]
    })
  )}));
  return new Table({ width: { size: tw, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows] });
}

// Competency data
const domains = [
  { name: "THINKING", clusters: [
    { name: "Strategic Thinking", comps: [
      ["Strategic Mindset", "Seeing ahead to future possibilities and translating them into breakthrough strategies."],
      ["Business Insight", "Applying knowledge of business and the marketplace to advance the organization's goals."],
      ["Financial Acumen", "Interpreting and applying understanding of key financial indicators to make better business decisions."],
      ["Analytical Reasoning", "Identifying and understanding complex issues; reviewing related information to develop and evaluate options and implement solutions."],
      ["Decision Quality", "Making good and timely decisions that keep the organization moving forward."],
    ]},
    { name: "Innovation", comps: [
      ["Cultivates Innovation", "Creating new and better ways for the organization to be successful."],
      ["Manages Complexity", "Making sense of complex, high-quantity, and sometimes contradictory information to effectively solve problems."],
      ["Global Perspective", "Taking a broad, cross-cultural view when approaching issues; considering geopolitical, regulatory, and multi-market factors."],
      ["Digital Fluency", "Leveraging digital technologies, data analytics, and emerging tools to drive business transformation."],
    ]},
  ]},
  { name: "RESULTS", clusters: [
    { name: "Execution", comps: [
      ["Action Oriented", "Taking on new opportunities and tough challenges with a sense of urgency, high energy, and enthusiasm."],
      ["Drives Results", "Consistently achieving results, even under tough circumstances."],
      ["Ensures Accountability", "Holding self and others accountable to meet commitments."],
      ["Plans and Aligns", "Planning and prioritizing work to meet commitments aligned with organizational goals."],
      ["Optimizes Processes", "Knowing the most effective and efficient processes to get things done, with a focus on continuous improvement."],
    ]},
    { name: "Change", comps: [
      ["Manages Ambiguity", "Operating effectively, even when things are not certain or the way forward is not clear."],
      ["Nimble Learning", "Learning through experimentation when tackling new problems, using both successes and failures as learning fodder."],
      ["Being Resilient", "Rebounding from setbacks and adversity when facing difficult situations."],
      ["Drives Vision and Purpose", "Painting a compelling picture of the vision and strategy that motivates others to action."],
    ]},
  ]},
  { name: "PEOPLE", clusters: [
    { name: "Influence", comps: [
      ["Communicates Effectively", "Developing and delivering multi-mode communications that convey a clear understanding of the unique needs of different audiences."],
      ["Persuades", "Using compelling arguments to gain the support and commitment of others."],
      ["Manages Conflict", "Handling conflict situations effectively, with a minimum of noise."],
      ["Negotiation", "Achieving mutually beneficial agreements through dialogue and compromise."],
      ["Builds Networks", "Effectively building formal and informal relationship networks inside and outside the organization."],
    ]},
    { name: "Team Leadership", comps: [
      ["Develops Talent", "Developing people to meet both their career goals and the organization's goals."],
      ["Builds Effective Teams", "Building strong-identity teams that apply their diverse skills and perspectives to achieve common goals."],
      ["Collaboration", "Building partnerships and working collaboratively with others to meet shared objectives."],
      ["Instills Trust", "Gaining the confidence and trust of others through honesty, integrity, and authenticity."],
      ["Situational Adaptability", "Adapting approach and demeanor in real time to match the shifting demands of different situations."],
    ]},
  ]},
  { name: "SELF", clusters: [
    { name: "Character", comps: [
      ["Self-Awareness", "Using a combination of feedback and reflection to gain productive insight into personal strengths and weaknesses."],
      ["Emotional Intelligence", "Recognizing, understanding, and managing one's own emotions and those of others."],
      ["Courage", "Stepping up to address difficult issues and championing unpopular positions when necessary."],
      ["Integrity", "Consistently behaving in an honest, fair, and ethical manner."],
      ["Cultural Sensitivity", "Understanding and respecting diverse cultural norms, values, and practices."],
    ]},
    { name: "Personal Effectiveness", comps: [
      ["Learning Agility", "Quickly learning from experience and applying insights to perform successfully under new or first-time conditions."],
      ["Self-Development", "Actively seeking new ways to grow and be challenged using both formal and informal development channels."],
      ["Composure", "Being calm and composed under pressure, handling stress effectively."],
      ["Sustainable Performance", "Managing energy, workload, and priorities to maintain high performance over time."],
      ["Resourcefulness", "Securing and deploying resources effectively and efficiently."],
    ]},
  ]},
];

const coverSection = {
  properties: { page: { margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
  children: [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
      children: [new TextRun({ text: "VIRGINIA INSTITUTE OF FINANCE AND MANAGEMENT", size: 18, font: "Arial", color: ACCENT, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 20 } },
      children: [] }),
    new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "VIFM Assessment Center Portal", size: 52, font: "Arial", bold: true, color: PRIMARY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: "Comprehensive User Guide", size: 36, font: "Arial", color: ACCENT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
      children: [new TextRun({ text: "From Setup to Report Generation", size: 24, font: "Arial", color: "666666" })] }),
    new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "April 2026", size: 22, font: "Arial", color: "999999" })] }),
    new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "STRICTLY CONFIDENTIAL", size: 16, font: "Arial", color: "CC0000", bold: true })] }),
  ],
};

const mainFooter = new Footer({ children: [
  new Paragraph({
    children: [
      new TextRun({ text: "VIFM Assessment Center Portal \u2014 User Guide", size: 14, font: "Arial", color: "999999" }),
      new TextRun({ text: "\tPage ", size: 14, font: "Arial", color: "999999" }),
      new TextRun({ children: [PageNumber.CURRENT], size: 14, font: "Arial", color: "999999" }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  }),
]});

const mainHeader = new Header({ children: [
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ACCENT, space: 4 } },
    children: [
      new TextRun({ text: "VIFM Assessment Center Portal", size: 16, font: "Arial", color: ACCENT, bold: true }),
      new TextRun({ text: "\tConfidential", size: 14, font: "Arial", color: "CC0000", italics: true }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  }),
]});

// Build competency table rows
const compTableRows = [];
for (const d of domains) {
  for (const c of d.clusters) {
    for (const [name, desc] of c.comps) {
      compTableRows.push([d.name, c.name, name, desc]);
    }
  }
}

const contentSection = {
  properties: {
    page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
  },
  headers: { default: mainHeader },
  footers: { default: mainFooter },
  children: [
    // TABLE OF CONTENTS
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({ children: [new PageBreak()] }),

    // 1. EXECUTIVE SUMMARY
    h1("1. Executive Summary"),
    p("The VIFM Assessment Center Portal is a comprehensive digital platform built by the Virginia Institute of Finance and Management (VIFM) to operationalize the complete assessment center lifecycle. The portal serves four distinct user groups through dedicated interfaces, each designed for their specific workflow needs."),
    p("The platform supports the full assessment center process: from engagement setup and competency selection, through live behavioral observation and BARS rating, to structured wash-up discussions with real-time collaboration, and finally professional PDF report generation."),
    h3("The Four Portals"),
    pb("Admin Portal", "For VIFM consultants and administrators. Full system control including engagement creation, client management, assessor assignment, exercise configuration, analytics, and report release."),
    pb("Assessor Portal", "For trained assessors conducting the assessment center. Observation recording, BARS competency rating, integration worksheet consolidation, and wash-up consensus discussions."),
    pb("Candidate Portal", "For assessment participants. Welcome and orientation, data protection consent, assessment schedule viewing, and access to released reports."),
    pb("Client Portal", "For sponsoring organizations. View engagement progress, access candidate results and OAR recommendations, download PDF reports, and review cohort analytics."),
    h3("Key Differentiators"),
    bullet("Proprietary VIFM competency framework with 38 competencies, 249 behavioral indicators, and 114 development tips"),
    bullet("Real-time wash-up collaboration using Supabase Realtime for multi-assessor consensus"),
    bullet("Professional 6-page PDF assessment reports generated on demand"),
    bullet("Exercise-to-competency matrix enforcement (minimum 2 exercises per competency)"),
    bullet("Full compliance with UAE PDPL, Saudi PDPL, GDPR, and ISO 10667"),
    bullet("Arabic language support with RTL layout"),
    bullet("Row-Level Security (RLS) ensuring complete data isolation between clients"),
    new Paragraph({ children: [new PageBreak()] }),

    // 2. COMPETENCY FRAMEWORK
    h1("2. VIFM Competency Framework"),
    p("The VIFM Assessment Center Framework comprises 4 domains, 8 clusters, and 38 competencies. Each competency has a clear behavioral definition, positive and negative behavioral indicators, development tips, and is assessed using the BARS (Behaviorally Anchored Rating Scale) methodology."),
    h2("2.1 Framework Structure"),
    p("The framework is organized hierarchically:"),
    bullet("4 Domains: THINKING, RESULTS, PEOPLE, SELF"),
    bullet("8 Clusters: Two clusters per domain, grouping related competencies"),
    bullet("38 Competencies: Measurable behavioral dimensions with detailed descriptions"),
    bullet("249 Behavioral Indicators: Observable behaviors (positive and negative) for each competency"),
    bullet("114 Development Tips: Three actionable development suggestions per competency"),
    spacer(),

    h2("2.2 Domains and Clusters Overview"),
    makeTable(["Domain", "Cluster", "Competencies"], [
      ["THINKING", "Strategic Thinking", "5 competencies"],
      ["THINKING", "Innovation", "4 competencies"],
      ["RESULTS", "Execution", "5 competencies"],
      ["RESULTS", "Change", "4 competencies"],
      ["PEOPLE", "Influence", "5 competencies"],
      ["PEOPLE", "Team Leadership", "5 competencies"],
      ["SELF", "Character", "5 competencies"],
      ["SELF", "Personal Effectiveness", "5 competencies"],
    ], [2000, 3500, 3526]),
    spacer(),

    h2("2.3 Complete Competency Listing"),
    makeTable(["Domain", "Cluster", "Competency", "Description"],
      compTableRows, [1200, 1800, 2500, 3526]),
    new Paragraph({ children: [new PageBreak()] }),

    h2("2.4 BARS Rating Scale"),
    p("All competencies are rated using the Behaviorally Anchored Rating Scale (BARS), a 5-point scale:"),
    makeTable(["Score", "Label", "Meaning"], [
      ["5", "Significant Strength", "Consistently demonstrates outstanding competence; a role model in this area"],
      ["4", "Strength", "Frequently demonstrates strong competence; exceeds expectations"],
      ["3", "Competent", "Demonstrates adequate competence; meets the standard expected for the role"],
      ["2", "Development Needed", "Inconsistently demonstrates competence; below the standard in some areas"],
      ["1", "Significant Development Needed", "Rarely demonstrates competence; requires substantial development"],
      ["NE", "No Evidence", "The competency was not observed in this exercise"],
    ], [1000, 2800, 5226]),
    spacer(),

    h2("2.5 Behavioral Indicators"),
    p("Each competency includes positive (+) and negative (-) behavioral indicators that help assessors identify and classify observed behaviors:"),
    bullet("Positive indicators: Observable behaviors that demonstrate competence (e.g., 'Identifies strategic implications before addressing operational items')"),
    bullet("Negative indicators: Observable behaviors that indicate a development need (e.g., 'Misses connections between cross-functional initiatives')"),
    p("Assessors use these indicators as a reference when recording observations, ensuring consistent and evidence-based assessment."),
    new Paragraph({ children: [new PageBreak()] }),

    // 3. ADMIN PORTAL
    h1("3. Admin Portal Guide"),
    p("The Admin Portal is the command center for VIFM consultants and administrators. It provides full control over the assessment center lifecycle."),
    h2("3.1 Dashboard (Process Map)"),
    p("The admin dashboard displays a circular process map showing 7 stages of the assessment center lifecycle:"),
    numItem("Create Engagements \u2014 Set up new assessment center projects", "adminSteps"),
    numItem("Add Candidates \u2014 Register participants for the engagement", "adminSteps"),
    numItem("Assign Assessors \u2014 Map assessors to candidate-exercise pairs", "adminSteps"),
    numItem("Monitor Observations \u2014 Track assessor progress during the AC", "adminSteps"),
    numItem("Integration and Wash-Up \u2014 Oversee data integration sessions", "adminSteps"),
    numItem("Finalize OAR \u2014 Review Overall Assessment Ratings", "adminSteps"),
    numItem("Release Reports \u2014 Generate and distribute PDF reports to clients", "adminSteps"),
    p("Each stage shows a live metric count pulled from the database, with visual indicators for completed and active stages."),
    spacer(),

    h2("3.2 Creating an Engagement (5-Step Wizard)"),
    p("The engagement creation wizard guides administrators through 5 sequential steps:"),
    h3("Step 1: Basic Information"),
    bullet("Select or create a client organization"),
    bullet("Enter engagement name (e.g., 'ADNOC Senior Manager AC - April 2026')"),
    bullet("Set target role, start date, and end date"),
    h3("Step 2: Select Competencies"),
    bullet("Browse the competency framework by domain and cluster"),
    bullet("Select 4-15 competencies for the engagement"),
    bullet("Optionally assign weights to each competency"),
    bullet("Use the search bar to find specific competencies"),
    h3("Step 3: Select Exercises"),
    bullet("Choose from the exercise library (In-Basket, Role Play, Group Exercise, Case Study, Oral Presentation, CBI)"),
    bullet("At least 1 exercise required"),
    h3("Step 4: Exercise-Competency Matrix"),
    bullet("Map which competencies are observed in which exercises"),
    bullet("Each competency must appear in at least 2 exercises (enforced)"),
    bullet("Color-coded status indicators show coverage"),
    h3("Step 5: Review and Save"),
    bullet("Review all selections before creating"),
    bullet("Edit buttons allow jumping back to any step"),
    bullet("Click 'Create Engagement' to save"),
    spacer(),

    h2("3.3 Managing Clients"),
    p("The Clients page lists all client organizations with engagement counts. Administrators can:"),
    bullet("View all registered organizations"),
    bullet("Create new organizations with name, industry, country, and contact details"),
    bullet("Click through to see an organization's engagements"),
    spacer(),

    h2("3.4 Engagement Detail"),
    p("Each engagement has a detail page with 4 tabs:"),
    pb("Candidates Tab", "Add candidates by name and email. Remove candidates with the delete button. View status badges."),
    pb("Assignments Tab", "Create assessor-candidate-exercise assignments. Add new assessors. Delete assignments."),
    pb("Matrix Tab", "View the exercise-competency matrix mappings."),
    pb("Reports Tab", "Generate PDF reports for each candidate (requires OAR to be finalized)."),
    p("Status transitions: Draft \u2192 Active \u2192 Completed \u2192 Archived (with confirmation dialogs)."),
    spacer(),

    h2("3.5 Exercise Library"),
    p("The exercise library contains all assessment exercises. Each exercise has a 4-tab editor:"),
    pb("Details and Briefing", "Name, type, description, participant brief, scenario context"),
    pb("Timing", "Instructions time, preparation time, meeting/exercise time"),
    pb("Role Player Guide", "Character name, role, attitude, meeting objectives"),
    pb("Assessor Notes", "Notes and guidance for assessors observing this exercise"),
    spacer(),

    h2("3.6 Analytics"),
    p("The analytics page provides:"),
    bullet("ICC (Intraclass Correlation Coefficient) for inter-rater reliability"),
    bullet("Bias detection across assessor rating patterns"),
    bullet("Bar and radar chart visualizations"),
    new Paragraph({ children: [new PageBreak()] }),

    // 4. ASSESSOR PORTAL
    h1("4. Assessor Portal Guide"),
    p("The Assessor Portal is where trained assessors record observations, rate competencies, consolidate ratings, and participate in wash-up discussions."),
    h2("4.1 Mission Board"),
    p("The assessor dashboard shows a 6-step process map:"),
    numItem("Review Assignments \u2014 See which candidates and exercises you are assigned to", "assessorSteps"),
    numItem("Observe Candidates \u2014 Record behavioral observations during exercises", "assessorSteps"),
    numItem("Rate Competencies \u2014 Assign BARS ratings with justifications", "assessorSteps"),
    numItem("Complete Integration \u2014 Consolidate ratings across exercises per competency", "assessorSteps"),
    numItem("Join Wash-Up \u2014 Participate in structured consensus discussions", "assessorSteps"),
    numItem("Finalize OAR \u2014 Agree on overall assessment ratings and recommendations", "assessorSteps"),
    spacer(),

    h2("4.2 Viewing Assignments"),
    p("Click 'Assignments' to see the engagement picker, then select an engagement to view your assignment grid. The grid is grouped by candidate, showing each exercise assignment with an 'Observe' button."),
    spacer(),

    h2("4.3 Observation Form (4 Tabs)"),
    p("The observation form is the core assessor tool. It has 4 tabs:"),
    h3("Tab 1: Overview (Quick Score)"),
    bullet("Shows all competencies for the exercise in a grid"),
    bullet("Click a score (1-5) to quickly rate a competency"),
    bullet("Shows tags for quick reference"),
    bullet("NE (No Evidence) button for unobserved competencies"),
    h3("Tab 2: Observe"),
    bullet("Behavioral indicator reference panel (collapsible)"),
    bullet("Select a competency from the dropdown"),
    bullet("Mark the observation as positive (+) or negative (-)"),
    bullet("Type the behavioral observation text"),
    bullet("Click behavioral indicators to auto-fill the observation text"),
    bullet("All observations are listed below with delete buttons"),
    h3("Tab 3: Rate"),
    bullet("Per competency: select a BARS score (1-5) or NE"),
    bullet("Add justification text for each rating"),
    bullet("Save each rating individually"),
    bullet("Visual badge shows current rating status"),
    h3("Tab 4: Q&A"),
    bullet("Pre-loaded interview questions per competency"),
    bullet("Useful for Competency-Based Interview (CBI) exercises"),
    spacer(),

    h2("4.4 Integration Worksheet"),
    p("Before the wash-up session, each assessor completes an integration worksheet:"),
    bullet("One row per competency showing all observations and ratings from every exercise"),
    bullet("Enter a preliminary rating (1-5) that represents your overall view"),
    bullet("Add notes explaining your rationale"),
    bullet("Save each competency's worksheet individually"),
    spacer(),

    h2("4.5 Wash-Up Engine"),
    p("The wash-up is a structured data integration discussion where assessors reach consensus:"),
    bullet("Select an engagement, then select a candidate"),
    bullet("See all assessors' preliminary ratings side by side"),
    bullet("Radar chart visualizes the competency profile"),
    bullet("Color-coded score summary (green = strength, red = development needed)"),
    bullet("Click 'Agree' on each competency to record the consensus rating"),
    bullet("Add discussion notes for each competency"),
    bullet("Real-time collaboration: changes appear instantly for all connected assessors (Supabase Realtime)"),
    spacer(),

    h2("4.6 OAR Finalization"),
    p("After consensus ratings are agreed, the lead assessor finalizes the Overall Assessment Rating:"),
    bullet("Select an overall score (1-5)"),
    bullet("Choose a recommendation: Ready Now, Ready with Development, or Not Ready"),
    bullet("Write an executive summary narrative"),
    bullet("Save the OAR"),
    new Paragraph({ children: [new PageBreak()] }),

    // 5. CANDIDATE PORTAL
    h1("5. Candidate Portal Guide"),
    p("The Candidate Portal provides a guided experience for assessment participants."),
    h2("5.1 Welcome Page"),
    p("Displays personalized welcome information including:"),
    bullet("Candidate's name and engagement details"),
    bullet("Organization name and target role"),
    bullet("Assessment dates"),
    bullet("Next steps guidance"),
    spacer(),

    h2("5.2 Consent and Data Protection"),
    p("Before any data collection, candidates must provide explicit consent:"),
    bullet("Data Processing Consent: Acknowledges collection and processing of personal data"),
    bullet("Assessment Participation Consent: Voluntary agreement to participate"),
    bullet("References UAE PDPL, Saudi PDPL, and GDPR"),
    bullet("2-year data retention notice"),
    bullet("Both checkboxes must be accepted to proceed"),
    bullet("IP address logged for compliance audit trail"),
    spacer(),

    h2("5.3 Assessment Schedule"),
    p("Shows the candidate's exercise schedule with:"),
    bullet("Exercise name and type"),
    bullet("Duration in minutes"),
    bullet("Scheduled date and time (if set)"),
    spacer(),

    h2("5.4 Report Viewer"),
    p("After reports are released, candidates can view their results:"),
    bullet("Overall Assessment Rating and recommendation"),
    bullet("Competency score breakdown with visual bars"),
    bullet("Gated behind report release status (clients must release reports first)"),
    new Paragraph({ children: [new PageBreak()] }),

    // 6. CLIENT PORTAL
    h1("6. Client Portal Guide"),
    p("The Client Portal gives sponsoring organizations visibility into their assessment center engagements."),
    h2("6.1 Dashboard"),
    p("A 5-step process map showing:"),
    numItem("View Engagements \u2014 See all your organization's assessment centers", "clientSteps"),
    numItem("Track Candidates \u2014 Monitor candidate participation", "clientSteps"),
    numItem("Review Results \u2014 Access Overall Assessment Ratings", "clientSteps"),
    numItem("Access Reports \u2014 Download PDF assessment reports", "clientSteps"),
    numItem("Analyze Talent Pool \u2014 View cohort-level analytics", "clientSteps"),
    spacer(),

    h2("6.2 Engagements"),
    p("Lists all engagements for your organization with status, dates, and candidate counts. Click an engagement to see detailed candidate results."),
    spacer(),

    h2("6.3 Candidate Results"),
    p("For each candidate in an engagement, see:"),
    bullet("Assessment status"),
    bullet("OAR score (1-5) with BARS label"),
    bullet("Recommendation badge (Ready Now / Ready with Development / Not Ready)"),
    bullet("'Generate PDF' button to download the full assessment report"),
    spacer(),

    h2("6.4 Cohort Analytics"),
    p("Aggregate insights across all candidates:"),
    bullet("Total candidates assessed"),
    bullet("Average OAR score"),
    bullet("Recommendation distribution (Ready Now / Ready with Development / Not Ready)"),
    bullet("Top 5 cohort strengths (competencies averaging 3.5+)"),
    bullet("Top 5 development areas (competencies averaging below 3.5)"),
    new Paragraph({ children: [new PageBreak()] }),

    // 7. PDF REPORT
    h1("7. PDF Report Structure"),
    p("The portal generates professional 6-page PDF assessment reports for each candidate. Reports are generated on demand and require the OAR to be finalized."),
    h2("7.1 Report Pages"),
    makeTable(["Page", "Content"], [
      ["1. Cover Page", "VIFM branding, 'Talent Assessment Report' title, candidate name, engagement details, assessment dates, assessor names, 'STRICTLY CONFIDENTIAL' label"],
      ["2. About the AC", "Description of the assessment center methodology, list of exercises completed with types and durations, BARS scale explanation, guidance on interpreting results"],
      ["3. Summary", "Overall Assessment Rating box (score + recommendation + executive summary), competency score bar chart, key strengths badges, key development area badges"],
      ["4-5. Competency Detail", "Per competency: name, domain/cluster, consensus score badge, exercise ratings, strengths (positive observations), development areas (negative observations), suggested development actions"],
      ["6. Development Recs", "Table of formal development recommendations with competency, recommendation text, and priority level"],
    ], [2000, 7026]),
    spacer(),

    h2("7.2 Generating Reports"),
    p("To generate a PDF report:"),
    numItem("Ensure the OAR is finalized for the candidate (wash-up must be complete)", "reportSteps"),
    numItem("Go to Admin Portal \u2192 Engagements \u2192 [Engagement] \u2192 Reports tab", "reportSteps"),
    numItem("Click 'Generate PDF' next to the candidate's name", "reportSteps"),
    numItem("The PDF downloads automatically with filename: VIFM_Report_[CandidateName].pdf", "reportSteps"),
    new Paragraph({ children: [new PageBreak()] }),

    // 8. EXERCISE TYPES
    h1("8. Exercise Types"),
    p("The portal supports 6 standard assessment center exercise types, each with structured timing:"),
    makeTable(["Exercise Type", "Description", "Typical Duration"], [
      ["In-Basket / E-Tray", "Digital inbox simulation requiring prioritization, delegation, and decision-making across multiple items", "60-90 minutes"],
      ["Role Play", "One-on-one simulation with a role player (e.g., meeting with a direct report, client, or stakeholder)", "15-30 minutes"],
      ["Group Exercise", "Multiple participants working together to solve a problem, reach consensus, or complete a task", "30-60 minutes"],
      ["Case Study", "Analysis of business data and preparation of recommendations, often combined with a presentation", "60-120 minutes"],
      ["Oral Presentation", "Formal presentation of analysis, findings, and recommendations, followed by Q&A", "15-25 minutes"],
      ["CBI (Competency-Based Interview)", "Structured interview using behavioral questions targeting specific competencies", "30-60 minutes"],
    ], [2200, 4826, 2000]),
    spacer(),

    h2("8.1 Exercise Timing Structure"),
    p("Each exercise has a 3-part timing structure:"),
    pb("Instructions Time", "Time for the assessor to read the brief and explain the exercise to the candidate"),
    pb("Preparation Time", "Time for the candidate to prepare (read materials, plan approach)"),
    pb("Meeting/Exercise Time", "The actual exercise duration during which assessors observe and record behaviors"),
    new Paragraph({ children: [new PageBreak()] }),

    // 9. GLOSSARY
    h1("9. Glossary of Key Terms"),
    makeTable(["Term", "Definition"], [
      ["Engagement", "A single assessment center project for a specific client and target role"],
      ["Competency", "A measurable behavioral dimension that can be observed and rated during exercises"],
      ["BARS", "Behaviorally Anchored Rating Scale \u2014 a 1-5 rating system with defined behavioral anchors"],
      ["NE (No Evidence)", "Indicates a competency was not observable in a particular exercise"],
      ["OAR", "Overall Assessment Rating \u2014 the final 1-5 score with a recommendation for each candidate"],
      ["Recommendation", "Ready Now / Ready with Development / Not Ready \u2014 the final outcome per candidate"],
      ["Exercise-Competency Matrix", "A mapping table defining which competencies are assessed in which exercises"],
      ["Observation", "A recorded behavioral note from an assessor, tagged to a specific competency and classified as positive or negative"],
      ["Rating", "A BARS score (1-5) assigned to a competency for a specific exercise, with justification"],
      ["Integration Worksheet", "Pre-wash-up form where assessors consolidate their ratings and notes across exercises for each competency"],
      ["Wash-Up", "A structured discussion where all assessors review evidence and agree on consensus ratings for each competency"],
      ["Consensus Rating", "The agreed-upon score for a competency after the wash-up discussion"],
      ["ICC", "Intraclass Correlation Coefficient \u2014 a statistical measure of inter-rater reliability (how consistently assessors rate)"],
      ["Behavioral Indicator", "A specific observable behavior (positive or negative) associated with a competency"],
      ["Development Tip", "An actionable suggestion for improving performance in a specific competency"],
      ["RLS", "Row-Level Security \u2014 database policies ensuring each user can only access their own data"],
      ["Supabase Realtime", "Live data synchronization technology enabling multi-assessor collaboration during wash-up"],
    ], [2800, 6226]),
    new Paragraph({ children: [new PageBreak()] }),

    // 10. LOGIN & ACCESS
    h1("10. Login and Access Control"),
    h2("10.1 Test Accounts"),
    p("The following test accounts are available for system testing:"),
    makeTable(["Email", "Password", "Role", "Portal URL"], [
      ["admin@viftraining.com", "admin123", "Admin", "/admin"],
      ["assessor@viftraining.com", "admin123", "Lead Assessor", "/assessor"],
      ["candidate@viftraining.com", "admin123", "Candidate", "/candidate"],
      ["client@viftraining.com", "admin123", "Client", "/client"],
    ], [3000, 1500, 2026, 2500]),
    spacer(),

    h2("10.2 Role-Based Access Control"),
    p("The portal enforces strict role-based access through Row-Level Security (RLS):"),
    makeTable(["Role", "Can See", "Cannot See"], [
      ["Admin", "Everything across all organizations", "N/A \u2014 full access"],
      ["Assessor", "Only assigned candidates and engagements; own observations and ratings", "Other assessors' data; client portal; admin functions"],
      ["Candidate", "Own profile, consent form, schedule, and released reports only", "Other candidates; observations; ratings; OARs; admin/assessor data"],
      ["Client", "Own organization's engagements, candidate results, and released reports", "Other organizations' data; assessor observations; admin functions"],
    ], [1500, 3763, 3763]),
    spacer(),

    h2("10.3 Login Page"),
    p("The login page provides two ways to sign in:"),
    bullet("Quick Login Buttons: 4 role buttons (Admin, Assessor, Candidate, Client) for one-click access during testing"),
    bullet("Email/Password Form: Standard authentication for production use"),
    bullet("Magic Link: Passwordless login via email link"),
    bullet("Password Reset: Available via 'Forgot password?' link"),
    spacer(),

    h2("10.4 Compliance"),
    p("The portal is designed to comply with:"),
    bullet("UAE Federal Decree-Law No. 45 of 2021 (Data Protection)"),
    bullet("Saudi Arabia Personal Data Protection Law (PDPL)"),
    bullet("EU General Data Protection Regulation (GDPR)"),
    bullet("ISO 10667 (Assessment of People in Work and Organizational Settings)"),
    bullet("International Taskforce on Assessment Center Guidelines (6th Edition)"),
    p("Data retention is set to a maximum of 2 years. Candidate consent is required before any data collection. All significant actions are logged in an immutable audit trail."),
  ],
};

const doc = new Document({
  title: "VIFM Assessment Center Portal - Comprehensive User Guide",
  description: "Complete guide for the VIFM Assessment Center Portal covering all four portals, competency framework, and workflows.",
  creator: "Virginia Institute of Finance and Management",
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: PRIMARY },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: PRIMARY },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "adminSteps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "assessorSteps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "clientSteps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "reportSteps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [coverSection, contentSection],
});

const OUTPUT = "C:\\Users\\AimanSadeq\\OneDrive - Virginia Institute of Finance\\VIFM ASSESSMENT CENTER\\VIFM_Assessment_Center_User_Guide.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Document created:", OUTPUT);
  console.log("Size:", (buffer.length / 1024).toFixed(1), "KB");
}).catch(err => { console.error("Failed:", err); process.exit(1); });
