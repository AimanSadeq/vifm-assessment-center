/**
 * Build a CHRO briefing deck (.pptx) for VIFM Reflect 360 — MIAHONA edition.
 *
 * Audience: MIAHONA CHRO + executive HR team. Customised against:
 *   - MIAHONA Leadership Competencies PDF (6 competencies × 4 proficiency tiers)
 *   - MIAHONA Vision/Mission/Values (ASPIRE — 6 corporate values)
 *   - 67-leader population: 7 C-Suite / 13 Directors / 4 Senior Managers / 43 Managers
 *   - Colleague additions: business-impact slide, pilot deliverables, "Why VIFM",
 *     security / data-hosting, embedded visuals, sample items per competency,
 *     and the "measure culture → train culture" narrative arc.
 *
 * Real product screenshots embedded from .tmp/deck-screenshots/* (rendered
 * from the Reflect 360 PDF endpoints at 200 DPI).
 */

const pptxgen = require("pptxgenjs");
const path = require("path");

// VIFM brand palette
const C = {
  primary:  "010131", // primary dark blue
  navy:     "121140", // mid navy
  accent:   "5391D5", // accent blue
  light:    "A8C4E5",
  pale:     "D0DFF4",
  offWhite: "F5F7FA",
  white:    "FFFFFF",
  text:     "111232",
  textMute: "5A5A6A",
  // Reflect-specific tone colours
  strength: "047857",
  develop:  "B45309",
  blind:    "9F1239",
  hidden:   "6D28D9",
};

const FOOTER = "VIFM Reflect 360 . Prepared for MIAHONA . (c) Virginia Institute of Finance and Management";

// Screenshot files (200-DPI PNG renders of the real Reflect 360 PDF output)
const SHOTS_DIR = path.join(".tmp", "deck-screenshots");
const SHOT = {
  participantCover:    path.join(SHOTS_DIR, "participant-report-p01.png"),
  participantSummary:  path.join(SHOTS_DIR, "participant-report-p03.png"),
  participantDevelop:  path.join(SHOTS_DIR, "participant-report-p05.png"),
  participantDetail:   path.join(SHOTS_DIR, "participant-report-p09.png"),
  participantRefGroup: path.join(SHOTS_DIR, "participant-report-p10.png"),
  cohortHeatmap:       path.join(SHOTS_DIR, "cohort-report-p02.png"),
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "VIFM";
pres.title = "VIFM Reflect 360 — MIAHONA CHRO Briefing";
pres.company = "Virginia Institute of Finance and Management";

// ────────────────────────────────────────────────────────────────
// 1 — Cover  (customised for MIAHONA)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addShape(pres.shapes.OVAL, { x:7.4, y:1.0, w:2.4, h:2.4, fill:{type:"solid", color:C.accent, transparency:80}, line:{color:C.accent, width:1.2} });
  s.addShape(pres.shapes.OVAL, { x:7.85, y:1.45, w:1.5, h:1.5, fill:{type:"solid", color:C.accent, transparency:70}, line:{color:C.accent, width:1} });
  s.addShape(pres.shapes.OVAL, { x:8.25, y:1.85, w:0.7, h:0.7, fill:{color:C.accent}, line:{color:C.accent} });

  s.addText("[ PREPARED FOR MIAHONA  .  CHRO BRIEFING ]", { x:0.4, y:0.25, w:7.5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("VIFM Reflect 360", {
    x:0.4, y:1.0, w:7.5, h:1.3,
    fontSize:54, bold:true, color:C.white, fontFace:"Open Sans",
  });
  s.addText("Measure the culture. Strengthen the culture. Built around MIAHONA's six competencies and six values.", {
    x:0.4, y:2.55, w:7.0, h:0.9,
    fontSize:15, color:C.light, fontFace:"Open Sans", italic:true,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:3.7, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });

  const tags = ["6 competencies", "6 ASPIRE values", "4 proficiency levels"];
  tags.forEach((t, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.4 + i*2.7, y:3.95, w:2.5, h:0.5, rectRadius:0.05, fill:{color:C.navy}, line:{color:C.accent, width:0.5} });
    s.addText(t, { x:0.4 + i*2.7, y:3.95, w:2.5, h:0.5, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
  });

  s.addText("caliber.viftraining.com / reflect", { x:0.4, y:4.75, w:6, h:0.30, fontSize:11, color:C.light, fontFace:"Consolas" });
  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 2 — The strategic question
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ THE QUESTION ON THE BOARDROOM TABLE ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("How are MIAHONA's leaders living the culture — and what do we do about it?", {
    x:0.4, y:0.7, w:9.2, h:1.0, fontSize:21, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  const pains = [
    { h:"Values stated, not measured", b:"MIAHONA's ASPIRE values are visible on the website. They are not visible in any performance dashboard. Reflect 360 makes them measurable." },
    { h:"Feedback that goes nowhere", b:"Most 360 reports are a one-off PDF. Twelve months later nobody can show whether anything changed, or which programmes to invest in next." },
    { h:"Generic, foreign frameworks", b:"Off-the-shelf 360 tools were built for US and UK leaders. They translate the words but not the cultural context, and never the language." },
  ];
  pains.forEach((p, i) => {
    const x = 0.4 + i*3.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:2.0, w:3.0, h:2.6, rectRadius:0.1, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:2.0, w:3.0, h:0.08, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(p.h, { x:x+0.2, y:2.25, w:2.6, h:0.6, fontSize:14, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(p.b, { x:x+0.2, y:2.9, w:2.6, h:1.6, fontSize:10.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText("Reflect 360 is VIFM's answer to all three — built around MIAHONA's framework, not ours.", {
    x:0.4, y:4.85, w:9.2, h:0.40, fontSize:13, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 3 — What's in it for MIAHONA  (business impact)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ WHAT'S IN IT FOR MIAHONA ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Five outcomes the CHRO can defend to the board", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  const impacts = [
    { h:"Retention",            b:"Honest, structured feedback signals MIAHONA invests in its leaders. Reduces the silent attrition of high-potential talent." },
    { h:"Succession readiness", b:"Identifies who is ready now, who is ready in 12-24 months, and who needs more time for each level above them." },
    { h:"Leadership pipeline",  b:"Heatmap of capability across Managers → Directors → C-Suite. Names the bench strength gaps before they become hiring crises." },
    { h:"Culture alignment",    b:"Triangulates self vs others vs manager on every behaviour. Shows whether ASPIRE values are lived or merely stated." },
    { h:"Reduced risk",         b:"Decision Quality + Strategic Mindset measured at the team level. Catches governance blind spots before they hit operations." },
  ];

  impacts.forEach((it, i) => {
    const x = 0.4 + i*1.88;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:1.6, w:1.78, h:3.3, rectRadius:0.10, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.6, w:1.78, h:0.55, fill:{color:C.primary}, line:{color:C.primary} });
    s.addText(it.h, { x:x+0.1, y:1.6, w:1.58, h:0.55, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(it.b, { x:x+0.15, y:2.30, w:1.48, h:2.5, fontSize:10, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:5.05, w:9.2, h:0.10, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("Each outcome is evidenced in the Individual + Cohort reports MIAHONA receives at the end of the pilot.", {
    x:0.4, y:5.20, w:9.2, h:0.30, fontSize:10, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.45, w:9.2, h:0.20, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 4 — Pilot scope: 67 MIAHONA leaders
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ PILOT SCOPE  .  THE 67 LEADERS ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("MIAHONA's leadership population", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });
  s.addText("Population shared by MIAHONA HR — this is what the pilot covers, end to end.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11, italic:true, color:C.light, fontFace:"Open Sans",
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.4, y:1.75, w:2.7, h:3.3, rectRadius:0.15, fill:{color:C.navy}, line:{color:C.accent, width:1} });
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:1.75, w:0.08, h:3.3, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("LEADERS IN SCOPE", { x:0.5, y:1.9, w:2.5, h:0.3, fontSize:10, color:C.accent, fontFace:"Open Sans", charSpacing:2, align:"center" });
  s.addText("67", { x:0.5, y:2.25, w:2.5, h:1.6, fontSize:96, bold:true, color:C.white, fontFace:"Open Sans", align:"center" });
  s.addText("~10 raters each", { x:0.5, y:3.95, w:2.5, h:0.35, fontSize:13, color:C.light, fontFace:"Open Sans", italic:true, align:"center" });
  s.addText("= ~670 raters in total", { x:0.5, y:4.35, w:2.5, h:0.35, fontSize:13, bold:true, color:C.accent, fontFace:"Open Sans", align:"center" });

  const tiers = [
    { label:"Executive / C-Suite",   n:7  },
    { label:"Directors",             n:13 },
    { label:"Senior Managers",       n:4  },
    { label:"Managers",              n:43 },
  ];
  const maxN = Math.max(...tiers.map(t => t.n));
  tiers.forEach((t, i) => {
    const y = 1.85 + i*0.78;
    s.addText(t.label, { x:3.3, y, w:2.2, h:0.30, fontSize:12, bold:true, color:C.white, fontFace:"Open Sans" });
    s.addShape(pres.shapes.RECTANGLE, { x:3.3, y:y+0.35, w:5.8, h:0.32, fill:{color:C.navy}, line:{color:C.navy} });
    const fillW = 5.8 * (t.n / maxN);
    s.addShape(pres.shapes.RECTANGLE, { x:3.3, y:y+0.35, w:fillW, h:0.32, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(`${t.n}`, { x:9.15, y:y+0.30, w:0.65, h:0.4, fontSize:18, bold:true, color:C.white, fontFace:"Open Sans", align:"left" });
  });

  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 5 — What Reflect 360 is (split panel)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:3.8, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:3.8, y:0, w:6.2, h:5.625, fill:{color:C.pale}, line:{color:C.pale} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addShape(pres.shapes.RECTANGLE, { x:3.8, y:0, w:0.06, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });

  s.addText("[ THE PRODUCT ]", { x:0.4, y:0.25, w:3.4, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What is\nReflect 360?", {
    x:0.4, y:0.95, w:3.2, h:1.8, fontSize:32, bold:true, color:C.white, fontFace:"Open Sans", valign:"top",
  });
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:2.95, w:2.2, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("Custom-built . VIFM-native . consultant-led", {
    x:0.4, y:3.05, w:3.2, h:0.45, fontSize:11, color:C.light, fontFace:"Open Sans", italic:true,
  });

  s.addText("What it is", {
    x:4.1, y:0.4, w:5.5, h:0.45, fontSize:15, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  const bullets = [
    "A 360-degree leadership feedback platform built from scratch for VIFM — not a re-branded vendor product.",
    "Bilingual end-to-end with proper Arabic RTL shaping on every screen, every report, every email.",
    "Custom frameworks per engagement: for MIAHONA, the six approved competencies and six ASPIRE values are loaded as-is.",
    "Plugged into VIFM's 127-programme training catalogue so each leader sees the programmes that close their specific gaps.",
    "Built for the long game: annual reassessment with year-on-year delta arrows shows whether the culture has actually shifted.",
  ];
  bullets.forEach((b, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x:4.1, y:1.0 + i*0.78, w:0.06, h:0.45, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(b, { x:4.28, y:0.96 + i*0.78, w:5.4, h:0.78, fontSize:11.5, color:C.primary, fontFace:"Open Sans", valign:"middle", wrap:true });
  });
  s.addText(FOOTER, { x:4.1, y:5.22, w:5.5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 6 — Mapped to MIAHONA's framework  (competencies + ASPIRE values)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ MAPPED TO YOUR FRAMEWORK ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Six competencies + six 'ASPIRE' values — measured together", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:20, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("From MIAHONA's Approved Competencies (PDF) and the public Vision/Mission/Values page. Reflect 360 measures both behaviour systems.", {
    x:0.4, y:1.15, w:9.2, h:0.30, fontSize:10, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  // 6 competencies (2x3 grid, compressed to make room for values strip)
  const comps = [
    { h:"Customer Focus",            b:"Customer relationships and customer-centric solutions." },
    { h:"Communicates Effectively",  b:"Multi-mode communication tailored to the audience." },
    { h:"Strategic Mindset",         b:"Future possibilities translated into strategy." },
    { h:"Drives Results",            b:"Consistent results, even under tough circumstances." },
    { h:"Builds Effective Teams",    b:"Strong-identity teams aligned on common goals." },
    { h:"Decision Quality",          b:"Good and timely decisions that move the organisation forward." },
  ];
  comps.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.55 + row*1.10;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:1.0, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:0.06, h:1.0, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(c.h, { x:x+0.15, y:y+0.08, w:2.75, h:0.32, fontSize:12, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(c.b, { x:x+0.15, y:y+0.42, w:2.75, h:0.55, fontSize:9.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  // ASPIRE values strip
  s.addText("[ MIAHONA CORPORATE VALUES  .  'ASPIRE' ]", { x:0.4, y:3.95, w:9.2, h:0.25, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3, align:"center" });
  const values = [
    { ltr:"A", name:"Accountability" },
    { ltr:"S", name:"Sustainability" },
    { ltr:"P", name:"Progress"       },
    { ltr:"I", name:"Innovation"     },
    { ltr:"R", name:"Relationships"  },
    { ltr:"E", name:"Excellence"     },
  ];
  values.forEach((v, i) => {
    const x = 0.4 + i*1.55;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:4.25, w:1.45, h:0.55, rectRadius:0.05, fill:{color:C.primary}, line:{color:C.accent, width:0.5} });
    s.addShape(pres.shapes.OVAL, { x:x+0.08, y:4.32, w:0.40, h:0.40, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(v.ltr, { x:x+0.08, y:4.32, w:0.40, h:0.40, fontSize:14, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(v.name, { x:x+0.52, y:4.25, w:0.90, h:0.55, fontSize:9.5, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
  });

  s.addText("Reflect 360 scores each leader against the behaviours that make these values + competencies real — at four MIAHONA proficiency tiers.", {
    x:0.4, y:4.95, w:9.2, h:0.30, fontSize:10, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.30, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 7 — Sample items — how each competency is measured  (NEW)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ HOW EACH COMPETENCY IS MEASURED ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Sample items — drawn directly from MIAHONA's own behaviour anchors", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:19, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Each item is calibrated to the leader's tier — Managers and Executives are asked different behaviours, not the same questions.",
    { x:0.4, y:1.15, w:9.2, h:0.30, fontSize:11, italic:true, color:C.textMute, fontFace:"Open Sans" });

  const samples = [
    { name:"Customer Focus",          items:[
      { lvl:"L1", text:"Asks questions to accurately identify customer needs" },
      { lvl:"L2", text:"Anticipates and meets customer needs independently" },
      { lvl:"L4", text:"Fosters a customer-focused environment" },
    ]},
    { name:"Communicates Effectively", items:[
      { lvl:"L1", text:"Keeps others informed" },
      { lvl:"L2", text:"Is clear and thorough in reports and written information" },
      { lvl:"L4", text:"Promotes a free flow of information throughout the organisation" },
    ]},
    { name:"Strategic Mindset",        items:[
      { lvl:"L1", text:"Considers how own actions help the organisation succeed" },
      { lvl:"L2", text:"Considers industry and market trends when making decisions" },
      { lvl:"L4", text:"Leverages key differentiators to develop a long-term strategy" },
    ]},
    { name:"Drives Results",           items:[
      { lvl:"L1", text:"Puts in effort needed to meet goals and expected results" },
      { lvl:"L2", text:"Drives tasks to successful completion and closure" },
      { lvl:"L4", text:"Gets results with a clear, positive impact on business performance" },
    ]},
    { name:"Builds Effective Teams",   items:[
      { lvl:"L1", text:"Contributes to positive morale and team spirit" },
      { lvl:"L2", text:"Places the team's priorities above personal objectives" },
      { lvl:"L4", text:"Builds a cohesive leadership team that drives the organisation" },
    ]},
    { name:"Decision Quality",         items:[
      { lvl:"L1", text:"Uses rules and procedures to guide decisions" },
      { lvl:"L2", text:"Demonstrates good judgment in routine day-to-day decisions" },
      { lvl:"L4", text:"Willingly makes tough trade-offs on behalf of the organisation" },
    ]},
  ];

  samples.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.55 + row*1.50;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:1.40, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:0.32, fill:{color:C.primary}, line:{color:C.primary} });
    s.addText(c.name, { x:x+0.15, y, w:2.75, h:0.32, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
    c.items.forEach((it, j) => {
      const iy = y + 0.36 + j*0.34;
      s.addShape(pres.shapes.RECTANGLE, { x:x+0.10, y:iy, w:0.32, h:0.26, fill:{color:C.accent}, line:{color:C.accent} });
      s.addText(it.lvl, { x:x+0.10, y:iy, w:0.32, h:0.26, fontSize:8.5, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
      s.addText(it.text, { x:x+0.50, y:iy, w:2.40, h:0.30, fontSize:8.5, color:C.text, fontFace:"Open Sans", valign:"middle", wrap:true });
    });
  });

  // 4-level model strip at the bottom
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:4.65, w:9.2, h:0.50, fill:{color:C.primary}, line:{color:C.primary} });
  const levels = [
    { lvl:"L1", lab:"Contributing Dependently"  },
    { lvl:"L2", lab:"Contributing Independently"},
    { lvl:"L3", lab:"Contributing Through Others"},
    { lvl:"L4", lab:"Contributing Strategically"},
  ];
  levels.forEach((lv, i) => {
    const x = 0.4 + i*2.3;
    s.addShape(pres.shapes.RECTANGLE, { x, y:4.65, w:0.4, h:0.50, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(lv.lvl, { x, y:4.65, w:0.4, h:0.50, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(lv.lab, { x:x+0.45, y:4.65, w:1.8, h:0.50, fontSize:9.5, color:C.light, fontFace:"Open Sans", valign:"middle" });
  });

  s.addText("Each leader is rated on ~30-40 behaviours mapped to their tier. Source: MIAHONA's own Approved Competencies PDF.", {
    x:0.4, y:5.22, w:9.2, h:0.25, fontSize:9, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.45, w:9.2, h:0.20, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 8 — The six-stage engagement workflow
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ HOW AN ENGAGEMENT RUNS ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Six stages, end to end", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Pilot cycle for MIAHONA's 67 leaders: 6–8 weeks, consultant-led at every stage.", {
    x:0.4, y:1.20, w:9.2, h:0.35, fontSize:12, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  const stages = [
    { n:"1", h:"Discovery",        b:"Confirm scope, decisions the report should inform, communication plan with the MIAHONA HR office." },
    { n:"2", h:"Framework setup",  b:"Load the six MIAHONA competencies + six ASPIRE values + behaviours. Arabic translations supplied by MIAHONA." },
    { n:"3", h:"Cohort enrolment", b:"Enrol the 67 leaders + each one's raters (manager, peers, direct reports). CSV bulk-load supported." },
    { n:"4", h:"Field window",     b:"Raters complete a bilingual mobile-ready form. Auto-reminders. Anonymity enforced from day one." },
    { n:"5", h:"Report & debrief", b:"Individual report (12 sections) for each leader + cohort report for MIAHONA's HR office. 1:1 debriefs by VIFM coach." },
    { n:"6", h:"Develop & reassess", b:"IDP in Keep/Stop/Start frame, paired with VIFM courses. Reassess 12 months later with delta arrows." },
  ];
  stages.forEach((st, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.75 + row*1.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:3.0, h:1.45, rectRadius:0.1, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.OVAL, { x:x+0.2, y:y+0.2, w:0.55, h:0.55, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(st.n, { x:x+0.2, y:y+0.2, w:0.55, h:0.55, fontSize:18, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(st.h, { x:x+0.85, y:y+0.18, w:2.0, h:0.4, fontSize:13, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(st.b, { x:x+0.2, y:y+0.80, w:2.7, h:0.65, fontSize:9.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });
  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 9 — The respondent experience
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 4 — FIELD WINDOW ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What each rater experiences", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.5, y:1.5, w:3.0, h:3.6, rectRadius:0.2, fill:{color:C.navy}, line:{color:C.accent, width:1.5} });
  s.addText("[ MOBILE-READY FORM ]", { x:0.55, y:1.65, w:2.9, h:0.25, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:2, align:"center" });
  s.addText("Listens openly to all viewpoints", { x:0.6, y:2.0, w:2.8, h:0.4, fontSize:10, bold:true, color:C.white, fontFace:"Open Sans" });
  const dots = ["1","2","3","4","5"];
  dots.forEach((d, i) => {
    s.addShape(pres.shapes.OVAL, { x:0.6 + i*0.5, y:2.5, w:0.4, h:0.4, fill:{color: i===3 ? C.accent : C.primary}, line:{color:C.accent} });
    s.addText(d, { x:0.6 + i*0.5, y:2.5, w:0.4, h:0.4, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
  });
  s.addText("Not observable", { x:0.6, y:3.05, w:2.8, h:0.3, fontSize:9, italic:true, color:C.light, fontFace:"Open Sans" });
  s.addShape(pres.shapes.RECTANGLE, { x:0.6, y:3.45, w:2.8, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("Save & resume . Bilingual . 15-20 min", { x:0.6, y:3.55, w:2.8, h:0.3, fontSize:9, color:C.light, fontFace:"Open Sans" });

  const features = [
    "Bilingual: respondent picks English or Arabic at the top of every page. Full RTL layout when Arabic.",
    "Anonymity from day one: scores from peers / direct reports never show until at least 3 raters in that group have responded.",
    "More than ratings: short Start / Stop / Continue prompts capture the qualitative gold that ratings miss.",
    "Tenure context: each rater says how long they've worked with the leader. Shows up next to their verbatim comments in the report.",
    "Self + Manager triangulation: both pick which competencies are critical for the role. The alignment % becomes a coaching anchor.",
  ];
  features.forEach((f, i) => {
    const y = 1.55 + i*0.72;
    s.addShape(pres.shapes.RECTANGLE, { x:4.0, y, w:0.06, h:0.55, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(f, { x:4.15, y:y-0.05, w:5.5, h:0.7, fontSize:10.5, color:C.white, fontFace:"Open Sans", valign:"middle", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 10 — Individual leader's report  +  REAL SCREENSHOTS
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 5 — INDIVIDUAL REPORT ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What each MIAHONA leader receives", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("12 sections, bilingual, confidential to the leader and their VIFM coach. Actual product output shown below.",
    { x:0.4, y:1.20, w:9.2, h:0.30, fontSize:10, italic:true, color:C.textMute, fontFace:"Open Sans" });

  const sections = [
    { h:"Cover wheel",                    b:"Self vs Others polygons" },
    { h:"Summary KPIs",                   b:"Overall mean . self . others . gap" },
    { h:"Critical-competency alignment",  b:"Self + Manager picks vs reality" },
    { h:"Strengths & Development",        b:"Top-5 each, ranked" },
    { h:"Blind spots / Hidden strengths", b:"Triangulated Self-vs-Others gaps" },
    { h:"Verbatim comments",              b:"Start / Stop / Continue, in raters' own words" },
  ];
  sections.forEach((sec, i) => {
    const y = 1.65 + i*0.55;
    s.addShape(pres.shapes.RECTANGLE, { x:0.4, y, w:4.0, h:0.50, fill:{color:C.white}, line:{color:C.pale, width:0.5} });
    s.addShape(pres.shapes.RECTANGLE, { x:0.4, y, w:0.05, h:0.50, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(sec.h, { x:0.55, y:y+0.04, w:3.85, h:0.25, fontSize:11, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(sec.b, { x:0.55, y:y+0.27, w:3.85, h:0.22, fontSize:9, color:C.text, fontFace:"Open Sans" });
  });

  s.addText("ACTUAL PRODUCT PAGES", { x:4.75, y:1.65, w:5.0, h:0.25, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  s.addImage({ path:SHOT.participantCover,    x:4.75, y:1.95, w:2.45, h:3.46, sizing:{type:"contain", w:2.45, h:3.46} });
  s.addImage({ path:SHOT.participantRefGroup, x:7.30, y:1.95, w:2.45, h:3.46, sizing:{type:"contain", w:2.45, h:3.46} });
  s.addText("Cover wheel + KPIs", { x:4.75, y:5.42, w:2.45, h:0.20, fontSize:8, color:C.textMute, fontFace:"Open Sans", align:"center", italic:true });
  s.addText("Reference Group Comparison", { x:7.30, y:5.42, w:2.45, h:0.20, fontSize:8, color:C.textMute, fontFace:"Open Sans", align:"center", italic:true });

  s.addText(FOOTER, { x:0.4, y:5.42, w:4.2, h:0.20, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 11 — AI coaching tips  +  REAL SCREENSHOT
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ INSIDE THE REPORT ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Every development area comes with a coaching tip", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Generated by Claude against the leader's specific behaviours — not a stock library.",
    { x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11, italic:true, color:C.textMute, fontFace:"Open Sans" });

  const tips = [
    { h:"60-90 words",         b:"Long enough to be useful in a 1:1, short enough to scan in a coaching session." },
    { h:"Bilingual EN + AR",   b:"Same content, same length, same level of concreteness — Modern Standard Arabic." },
    { h:"Context-aware",       b:"Anchored to the leader's current rating: below 3 = focus on basics; 3-3.5 = focus on consistency." },
    { h:"Action-oriented",     b:"Names a specific meeting, project, or conversation in the next 2-4 weeks — not generic advice." },
    { h:"Consultant-editable", b:"VIFM coach can override or refine before the final PDF is generated." },
  ];
  tips.forEach((t, i) => {
    const y = 1.65 + i*0.72;
    s.addShape(pres.shapes.RECTANGLE, { x:0.4, y, w:5.0, h:0.66, fill:{color:C.white}, line:{color:C.pale, width:0.5} });
    s.addShape(pres.shapes.RECTANGLE, { x:0.4, y, w:0.06, h:0.66, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(t.h, { x:0.55, y:y+0.05, w:4.85, h:0.25, fontSize:11, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(t.b, { x:0.55, y:y+0.30, w:4.85, h:0.34, fontSize:10, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText("ACTUAL DEVELOPMENT PAGE", { x:5.8, y:1.40, w:4.0, h:0.25, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  s.addImage({ path:SHOT.participantDevelop, x:5.8, y:1.65, w:3.8, h:3.55 });

  s.addText(FOOTER, { x:0.4, y:5.42, w:9.2, h:0.20, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 12 — Cohort report  +  REAL SCREENSHOT
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 5 — COHORT REPORT ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What MIAHONA's HR office sees", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:1.55, w:4.2, h:3.55, fill:{color:C.white}, line:{color:C.pale, width:1} });
  s.addText("AT A GLANCE", { x:0.55, y:1.65, w:4.0, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  const kpis = [
    { label:"Top strengths",                  v:"Ranked list of the three competencies the cohort is strongest at." },
    { label:"Top development areas",          v:"Where to invest training budget first. Same ranking logic." },
    { label:"Competency heatmap",             v:"Every leader, every competency, colour-coded so patterns jump out." },
    { label:"% below / within / above zone",  v:"For each competency, the share of the cohort in each band." },
    { label:"Year-on-year delta",             v:"On a reassessment, ↑+0.4 / ↓-0.2 arrows show what's moved." },
  ];
  kpis.forEach((k, i) => {
    const y = 2.0 + i*0.60;
    s.addShape(pres.shapes.OVAL, { x:0.55, y:y+0.12, w:0.18, h:0.18, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(k.label, { x:0.85, y, w:3.6, h:0.28, fontSize:11, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(k.v, { x:0.85, y:y+0.27, w:3.6, h:0.35, fontSize:9.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText("ACTUAL COHORT PAGE", { x:4.95, y:1.40, w:4.8, h:0.25, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  s.addImage({ path:SHOT.cohortHeatmap, x:4.95, y:1.65, w:4.8, h:3.55 });

  s.addText(FOOTER, { x:0.4, y:5.30, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 13 — Measure culture, build culture  (reframed training bridge)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 6 — MEASURE & BUILD CULTURE ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("From measuring culture to building it", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Reflect 360 makes MIAHONA's six values + six competencies measurable. The same engine names the training that strengthens them.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  const flow = [
    { tag:"Step 1", title:"Behaviours scored",  body:"Every behaviour tied to your six competencies + six ASPIRE values is rated by the rater pool. Gaps surface where lived behaviour drifts from stated value." },
    { tag:"Step 2", title:"Culture quantified", body:"The cohort report shows which values are lived and which are merely stated — broken down by leadership tier and by competency. The culture becomes visible." },
    { tag:"Step 3", title:"Training targeted",  body:"The 127-programme VIFM catalogue is matched to the exact behavioural gaps. Each programme is a culture intervention, not a generic course." },
  ];
  flow.forEach((f, i) => {
    const x = 0.4 + i*3.2;
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.7, w:3.0, h:2.6, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.7, w:3.0, h:0.55, fill:{color:C.primary}, line:{color:C.primary} });
    s.addText(f.tag, { x:x+0.15, y:1.7, w:1.5, h:0.55, fontSize:10, color:C.accent, fontFace:"Open Sans", charSpacing:2, valign:"middle" });
    s.addText(f.title, { x:x+0.2, y:2.35, w:2.6, h:0.5, fontSize:14, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(f.body, { x:x+0.2, y:2.95, w:2.6, h:1.3, fontSize:10.5, color:C.text, fontFace:"Open Sans", wrap:true });

    if (i < 2) {
      s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:3.45 + i*3.2, y:2.85, w:0.3, h:0.3, fill:{color:C.accent}, line:{color:C.accent}, rotate:0 });
    }
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:4.55, w:9.2, h:0.55, fill:{color:C.primary}, line:{color:C.primary} });
  s.addText("Same engine for individual reports (per-leader programmes) and the cohort report (culture-strengthening plan for the CHRO and HR office).", {
    x:0.6, y:4.55, w:8.8, h:0.55, fontSize:11, italic:true, color:C.white, fontFace:"Open Sans", valign:"middle",
  });

  s.addText(FOOTER, { x:0.4, y:5.30, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 14 — Pilot deliverables  ("What MIAHONA receives")
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ WHAT MIAHONA RECEIVES ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Pilot deliverables — the tangible artefacts", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });
  s.addText("Six deliverables, each owned and produced by the VIFM consultant team.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11, italic:true, color:C.light, fontFace:"Open Sans",
  });

  const deliverables = [
    { n:"67",   h:"Individual bilingual PDF reports",   b:"One per leader. EN, AR, or side-by-side. Confidential to leader + coach." },
    { n:"1",    h:"Cohort report for the HR office",    b:"Heatmap, % within zone, top strengths / dev areas, culture-strengthening plan." },
    { n:"67",   h:"1:1 debriefs with VIFM coaches",     b:"45-minute structured conversation. Anchored on the report, ends with an IDP draft." },
    { n:"67",   h:"Individual Development Plans",       b:"Keep / Stop / Start frame, ready for line-manager sign-off." },
    { n:"127",  h:"Training programmes available",      b:"Top-5 matched per leader, top-6 matched for cohort. Quote-request link in every PDF." },
    { n:"2027", h:"Year-on-year baseline",              b:"All pilot data preserved for the 12-month reassessment, with delta arrows showing what moved." },
  ];
  deliverables.forEach((d, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.65 + row*1.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:3.0, h:1.5, rectRadius:0.10, fill:{color:C.navy}, line:{color:C.accent, width:0.5} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:0.06, h:1.5, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(d.n, { x:x+0.18, y:y+0.10, w:1.5, h:0.55, fontSize:24, bold:true, color:C.accent, fontFace:"Open Sans" });
    s.addText(d.h, { x:x+1.55, y:y+0.10, w:1.4, h:0.55, fontSize:10.5, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
    s.addText(d.b, { x:x+0.18, y:y+0.75, w:2.75, h:0.70, fontSize:9.5, color:C.light, fontFace:"Open Sans", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 15 — Security, data hosting & confidentiality
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ SECURITY  .  DATA HOSTING  .  CONFIDENTIALITY ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Built so raters can be honest, and the data is yours", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  const items = [
    { h:"Anonymity threshold",       b:"No score (or comment) from peers, direct reports, or skip-level appears in any report until at least 3 raters in that group have responded. Configurable per engagement." },
    { h:"Encryption end to end",     b:"TLS 1.2+ in transit. AES-256 encryption at rest on the database and storage layer. Per-row access policies enforced server-side, not in the browser." },
    { h:"Role-based access control", b:"Four roles — admin, consultant, candidate, client. Each role's view is enforced at the database level via row-level security. No cross-contamination across clients." },
    { h:"Regulatory alignment",      b:"KSA PDPL + UAE PDPL + GDPR aware. Consent captured at invitation. Right-to-erasure honoured. ISO 10667 methodology alignment." },
    { h:"Data residency on request", b:"Cloud-hosted with configurable regional residency. MIAHONA can specify the deployment region; data segregation is contractual and technical." },
    { h:"No vendor lock-in",         b:"Two-year default retention with automatic purge. Frameworks exportable as JSON. Reports + raw responses exportable as PDF + CSV on demand." },
  ];

  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.4 + col*4.7;
    const y = 1.45 + row*1.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:4.5, h:1.1, rectRadius:0.08, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:0.06, h:1.1, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(it.h, { x:x+0.18, y:y+0.08, w:4.2, h:0.32, fontSize:12, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(it.b, { x:x+0.18, y:y+0.40, w:4.2, h:0.65, fontSize:9.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:5.10, w:9.2, h:0.08, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("Detailed Security & Data Hosting addendum available on request from the MIAHONA project sponsor.", {
    x:0.4, y:5.25, w:9.2, h:0.25, fontSize:9, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.45, w:9.2, h:0.20, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 16 — Why VIFM
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ WHY VIFM ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Why MIAHONA chose to talk to us first", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Reflect 360 is not a SaaS bought-in. It is built and owned by a GCC training company.",
    { x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11, italic:true, color:C.textMute, fontFace:"Open Sans" });

  const reasons = [
    { h:"Training company first",   b:"VIFM's core business is leadership and finance development. The 360 platform is built to feed that engine — not as a stand-alone diagnostic." },
    { h:"Bilingual native",         b:"English and Arabic are first-class throughout. Not a Google-translated overlay, not a separate Arabic file. The same product, in the language each rater prefers." },
    { h:"GCC-anchored content",     b:"The competency templates, behavioural anchors, and AI coaching prompts are written for the cultural context our clients operate in." },
    { h:"Custom-built",             b:"No vendor licence dictating what we can and can't change. MIAHONA's six competencies + ASPIRE values load as-is — VIFM does not impose its own framework on top." },
    { h:"127-programme catalogue",  b:"The gaps the 360 surfaces are immediately matched to the courses that close them. One vendor, one continuous engagement from diagnosis to capability." },
    { h:"Consultant-led",           b:"Every engagement has a named VIFM lead who owns the framework setup, debrief, and reassessment cycle. The platform is the toolkit, not the relationship." },
  ];

  reasons.forEach((r, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.65 + row*1.65;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:1.5, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:0.06, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(r.h, { x:x+0.15, y:y+0.15, w:2.75, h:0.35, fontSize:12, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(r.b, { x:x+0.15, y:y+0.55, w:2.75, h:0.92, fontSize:10, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 17 — Next steps  (closing CTA, re-targeted to 67 leaders)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:7.5, y:0, w:2.5, h:5.625, fill:{color:C.navy}, line:{color:C.navy} });
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:6.8, y:0, w:1.0, h:5.625, fill:{color:C.accent}, line:{color:C.accent}, flipH:true });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });

  s.addText("[ TO MOVE FORWARD ]", { x:0.4, y:0.30, w:5, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Pilot first.\nScale on evidence.", { x:0.4, y:0.95, w:6.2, h:2.0, fontSize:38, bold:true, color:C.white, fontFace:"Open Sans" });

  s.addText("Phased rollout proposal: pilot the 7 Executive / C-Suite first to anchor the framework. Add the 13 Directors and 4 Senior Managers in wave 2. The 43 Managers in wave 3.",
    { x:0.4, y:3.15, w:6.2, h:1.0, fontSize:12, color:C.light, fontFace:"Open Sans", italic:true });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:4.20, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("caliber.viftraining.com / reflect", {
    x:0.4, y:4.35, w:6.2, h:0.45, fontSize:14, bold:true, color:C.accent, fontFace:"Consolas",
  });

  s.addText("NEXT STEPS", { x:7.65, y:0.45, w:2.2, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  const next = [
    "VIFM company profile shared with MIAHONA CHRO",
    "Sample report walk-through (45 min)",
    "Pilot scoping — wave 1 (7 leaders)",
    "Full rollout: wave 2 + 3 to 67 total",
  ];
  next.forEach((n, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.90+i*0.95, w:2.20, h:0.80, fill:{color:C.primary}, line:{color:C.primary} });
    s.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.90+i*0.95, w:0.06, h:0.80, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(`${i+1}`, { x:7.80, y:0.90+i*0.95, w:0.40, h:0.80, fontSize:18, bold:true, color:C.accent, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(n, { x:8.20, y:0.90+i*0.95, w:1.62, h:0.80, fontSize:9.5, color:C.white, fontFace:"Open Sans", valign:"middle", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Write
// ────────────────────────────────────────────────────────────────
(async () => {
  const out = process.argv[2] || ".tmp/VIFM-Reflect360-CHRO-Briefing.pptx";
  await pres.writeFile({ fileName: out });
  console.log(`Wrote ${out}`);
})();
