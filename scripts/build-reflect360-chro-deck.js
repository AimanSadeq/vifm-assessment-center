/**
 * Build a CHRO briefing deck (.pptx) for VIFM Reflect 360.
 *
 * Audience: a CHRO who's about to ask "what is this and how does it run?"
 * Tone: high-level, story-led, no implementation jargon. 12 slides.
 *
 * Reuses VIFM brand palette + slide-layout idioms from the existing
 * ARC deck builder so this looks like the same product family.
 */

const pptxgen = require("pptxgenjs");

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

const FOOTER = "VIFM Reflect 360 . CHRO briefing . (c) Virginia Institute of Finance and Management";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "VIFM";
pres.title = "VIFM Reflect 360 — CHRO Briefing";
pres.company = "Virginia Institute of Finance and Management";

// ────────────────────────────────────────────────────────────────
// 1 — Cover
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  // Stylised wheel as a decorative motif (matches the cover wheel inside the actual product report)
  s.addShape(pres.shapes.OVAL, { x:7.4, y:1.0, w:2.4, h:2.4, fill:{type:"solid", color:C.accent, transparency:80}, line:{color:C.accent, width:1.2} });
  s.addShape(pres.shapes.OVAL, { x:7.85, y:1.45, w:1.5, h:1.5, fill:{type:"solid", color:C.accent, transparency:70}, line:{color:C.accent, width:1} });
  s.addShape(pres.shapes.OVAL, { x:8.25, y:1.85, w:0.7, h:0.7, fill:{color:C.accent}, line:{color:C.accent} });

  s.addText("[ CHRO BRIEFING ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("VIFM Reflect 360", {
    x:0.4, y:1.0, w:7.5, h:1.3,
    fontSize:54, bold:true, color:C.white, fontFace:"Open Sans",
  });
  s.addText("Leadership feedback. Built for the GCC. Connected to capability.", {
    x:0.4, y:2.55, w:7.0, h:0.9,
    fontSize:18, color:C.light, fontFace:"Open Sans", italic:true,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:3.7, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });

  // Three at-a-glance tags
  const tags = ["Bilingual EN + AR", "Custom framework", "Annual reassessment"];
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
  s.addText("How are our leaders actually performing — and what do we do about it?", {
    x:0.4, y:0.7, w:9.2, h:1.0, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  // 3 pain points in cards
  const pains = [
    { h:"No common evidence base", b:"Performance reviews tell us what got done. They don't tell us how our leaders show up — or how their teams experience them." },
    { h:"Feedback that goes nowhere", b:"Most 360 reports are a one-off PDF. Six months later nobody can show whether anything changed, or what training to invest in next." },
    { h:"Generic, foreign frameworks", b:"Off-the-shelf 360 tools were built for US and UK leaders. They translate the words but not the cultural context, and never the language." },
  ];
  pains.forEach((p, i) => {
    const x = 0.4 + i*3.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:2.0, w:3.0, h:2.6, rectRadius:0.1, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:2.0, w:3.0, h:0.08, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(p.h, { x:x+0.2, y:2.25, w:2.6, h:0.6, fontSize:14, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(p.b, { x:x+0.2, y:2.9, w:2.6, h:1.6, fontSize:11, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText("Reflect 360 is VIFM's answer to all three.", {
    x:0.4, y:4.85, w:9.2, h:0.40, fontSize:14, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 3 — What Reflect 360 is (split panel)
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
    "Custom frameworks per engagement: clone a VIFM template, import from a job description, or build from scratch.",
    "Plugged into VIFM's training catalogue so each leader sees the programmes that close their specific gaps.",
    "Built for the long game: annual reassessment with year-on-year delta arrows shows whether development actually moved the needle.",
  ];
  bullets.forEach((b, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x:4.1, y:1.0 + i*0.78, w:0.06, h:0.45, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(b, { x:4.28, y:0.96 + i*0.78, w:5.4, h:0.78, fontSize:11.5, color:C.primary, fontFace:"Open Sans", valign:"middle", wrap:true });
  });
  s.addText(FOOTER, { x:4.1, y:5.22, w:5.5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 4 — The six-stage engagement workflow
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ HOW AN ENGAGEMENT RUNS ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Six stages, end to end", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("A typical cohort runs in 6–8 weeks. Consultant-led at every stage.", {
    x:0.4, y:1.20, w:9.2, h:0.35, fontSize:12, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  const stages = [
    { n:"1", h:"Discovery",        b:"Frame the leadership question. Who's in scope, what's the decision the report should inform." },
    { n:"2", h:"Framework setup",  b:"Clone a VIFM template, build custom, or extract competencies from a job description with AI." },
    { n:"3", h:"Cohort enrolment", b:"Add participants + each leader's raters (manager, peers, direct reports). CSV upload supported." },
    { n:"4", h:"Field window",     b:"Raters complete a bilingual mobile-ready form. Auto-reminders. Anonymity enforced from day one." },
    { n:"5", h:"Report & debrief", b:"Individual report (12 sections) for each leader + cohort report for the HR office. 1:1 debrief by VIFM coach." },
    { n:"6", h:"Develop & reassess", b:"IDP in Keep/Stop/Start frame, paired with VIFM courses. Reassess 12 months later with delta arrows." },
  ];
  // 2 rows × 3 cols
  stages.forEach((st, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.75 + row*1.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:3.0, h:1.45, rectRadius:0.1, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.OVAL, { x:x+0.2, y:y+0.2, w:0.55, h:0.55, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(st.n, { x:x+0.2, y:y+0.2, w:0.55, h:0.55, fontSize:18, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(st.h, { x:x+0.85, y:y+0.18, w:2.0, h:0.4, fontSize:13, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(st.b, { x:x+0.2, y:y+0.80, w:2.7, h:0.65, fontSize:10, color:C.text, fontFace:"Open Sans", wrap:true });
  });
  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 5 — Framework: three ways to set one up
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 2 — FRAMEWORK SETUP ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Three ways to define what \"good leadership\" looks like for this cohort", {
    x:0.4, y:0.7, w:9.2, h:0.7, fontSize:18, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  const opts = [
    {
      title:"Clone a VIFM template",
      sub:"Fastest",
      body:"Pick from a library of curated frameworks (Banking Leadership, Government Manager, Treasury Lead) and tweak the wording. Behaviours are pre-translated to Arabic.",
    },
    {
      title:"Extract from a Job Description",
      sub:"Most relevant",
      body:"Paste the leader's JD. Claude reads it and proposes 6–10 competencies with rationale. Consultant reviews, accepts, edits.",
    },
    {
      title:"Build from scratch",
      sub:"Bespoke",
      body:"Some clients (Treasury, Risk) need a framework that mirrors their internal capability model. The platform lets the consultant author every competency and behaviour by hand.",
    },
  ];

  opts.forEach((o, i) => {
    const x = 0.4 + i*3.2;
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.65, w:3.0, h:3.3, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.65, w:3.0, h:0.55, fill:{color:C.primary}, line:{color:C.primary} });
    s.addText(o.title, { x:x+0.15, y:1.65, w:2.7, h:0.55, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
    s.addText(o.sub, { x:x+0.2, y:2.30, w:2.6, h:0.30, fontSize:10, italic:true, color:C.accent, fontFace:"Open Sans" });
    s.addText(o.body, { x:x+0.2, y:2.65, w:2.6, h:2.1, fontSize:11, color:C.text, fontFace:"Open Sans", wrap:true });
  });
  s.addText("Every framework is bilingual. Every behaviour has an English text and an Arabic text. The respondent sees the language they prefer.", {
    x:0.4, y:5.05, w:9.2, h:0.30, fontSize:10, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.35, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 6 — The respondent experience
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 4 — FIELD WINDOW ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What each rater experiences", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });

  // Left: phone-shaped mock with a few features as bullets inside
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

  // Right: feature list
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
// 7 — The individual leader's report (the heart of the product)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 5 — INDIVIDUAL REPORT ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What each leader gets in their PDF", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("12 sections. Bilingual. Confidential to the leader and their VIFM coach.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  const sections = [
    { h:"Cover wheel",                    b:"Self vs Others polygons on the competency axes" },
    { h:"Summary KPIs",                   b:"Overall mean, self-view, others' view, gap" },
    { h:"Critical-competency alignment",  b:"Self + Manager pick — alignment % + breakdown" },
    { h:"Strengths & Development",        b:"Top-5 strengths, top-5 dev areas, ranked" },
    { h:"Blind spots / Hidden strengths", b:"Triangulated Self-vs-Others gaps, auto-flagged" },
    { h:"Per-competency detail",          b:"Bars per rater group with Favorable Zone band" },
    { h:"Reference group comparison",     b:"Every group, every competency, one page" },
    { h:"Item-level table",               b:"Every behaviour, every group, consensus flags" },
    { h:"Verbatims",                      b:"Start / Stop / Continue in raters' own words" },
    { h:"AI coaching tips",               b:"60-90 word actionable tip per dev-area behaviour" },
    { h:"Recommended VIFM programmes",    b:"Top-5 courses with HIGH FIT badging" },
    { h:"IDP scaffold",                   b:"Keep / Stop / Start, ready for the debrief" },
  ];

  // 3 columns x 4 rows
  sections.forEach((sec, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.65 + row*0.85;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:0.78, fill:{color:C.white}, line:{color:C.pale, width:0.5} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:0.05, h:0.78, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(sec.h, { x:x+0.15, y:y+0.06, w:2.75, h:0.32, fontSize:11, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(sec.b, { x:x+0.15, y:y+0.36, w:2.75, h:0.40, fontSize:9, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText("Available in English, Arabic, or side-by-side bilingual. Generated as PDF on demand.", {
    x:0.4, y:5.10, w:9.2, h:0.30, fontSize:10, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.35, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 8 — The cohort report (for the HR office)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 5 — COHORT REPORT ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What the HR office sees", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  // Left column: cohort KPI summary
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:1.55, w:4.7, h:3.5, fill:{color:C.white}, line:{color:C.pale, width:1} });
  s.addText("AT A GLANCE", { x:0.55, y:1.65, w:4.5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  const kpis = [
    { label:"Top strengths",                  v:"Ranked list of the three competencies the cohort is strongest at." },
    { label:"Top development areas",          v:"Where to invest training budget first. Same ranking logic." },
    { label:"Competency heatmap",             v:"Every leader, every competency, colour-coded so patterns jump out." },
    { label:"% below / within / above zone",  v:"For each competency, the share of the cohort in each band. The exec-summary chart." },
    { label:"Year-on-year delta",             v:"On a reassessment, ↑+0.4 / ↓-0.2 arrows show what's moved." },
  ];
  kpis.forEach((k, i) => {
    const y = 2.0 + i*0.62;
    s.addShape(pres.shapes.OVAL, { x:0.55, y:y+0.12, w:0.18, h:0.18, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(k.label, { x:0.85, y, w:4.0, h:0.28, fontSize:11, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(k.v, { x:0.85, y:y+0.27, w:4.1, h:0.40, fontSize:9.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  // Right column: how the CHRO actually uses it
  s.addShape(pres.shapes.RECTANGLE, { x:5.3, y:1.55, w:4.3, h:3.5, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:5.3, y:1.55, w:0.06, h:3.5, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("HOW THE CHRO USES IT", { x:5.5, y:1.65, w:4.0, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  s.addText("Three conversations the cohort report drives", {
    x:5.5, y:1.95, w:4.0, h:0.7, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans",
  });
  const uses = [
    "With the CEO: where the leadership bench is strong, where the gaps are, and what we're doing about each one.",
    "With the L&D budget owner: which VIFM programmes to commit to next quarter, ranked by aggregated cohort gap.",
    "With each leader's line manager: priorities for the year, anchored on data instead of opinion.",
  ];
  uses.forEach((u, i) => {
    const y = 2.85 + i*0.65;
    s.addShape(pres.shapes.RECTANGLE, { x:5.5, y, w:0.05, h:0.55, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(u, { x:5.6, y:y-0.02, w:3.9, h:0.6, fontSize:10, color:C.light, fontFace:"Open Sans", valign:"middle", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 9 — The training bridge
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ STAGE 6 — DEVELOP ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("From feedback to capability — automatically", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Most 360 reports stop at \"here's what's wrong\". Reflect 360 names the next step.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:12, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  // Three-step flow
  const flow = [
    { tag:"Step 1", title:"Gaps identified",       body:"Scoring engine extracts the leader's lowest-scoring competencies (or, on the cohort report, the aggregated lowest)." },
    { tag:"Step 2", title:"Programmes matched",    body:"Each competency is matched against the 127 programmes in the VIFM catalogue — tagged by relevance + rationale." },
    { tag:"Step 3", title:"Quote requested",       body:"Each programme has a Request a Quote link in the PDF. One click and the L&D team is in the consultant's inbox." },
  ];
  flow.forEach((f, i) => {
    const x = 0.4 + i*3.2;
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.7, w:3.0, h:2.6, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.7, w:3.0, h:0.55, fill:{color:C.primary}, line:{color:C.primary} });
    s.addText(f.tag, { x:x+0.15, y:1.7, w:1.5, h:0.55, fontSize:10, color:C.accent, fontFace:"Open Sans", charSpacing:2, valign:"middle" });
    s.addText(f.title, { x:x+0.2, y:2.35, w:2.6, h:0.5, fontSize:14, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(f.body, { x:x+0.2, y:2.95, w:2.6, h:1.3, fontSize:11, color:C.text, fontFace:"Open Sans", wrap:true });

    if (i < 2) {
      // arrow chevron
      s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:3.45 + i*3.2, y:2.85, w:0.3, h:0.3, fill:{color:C.accent}, line:{color:C.accent}, rotate:0 });
    }
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:4.55, w:9.2, h:0.55, fill:{color:C.primary}, line:{color:C.primary} });
  s.addText("Same engine for individual reports (top-5 programmes per leader) and cohort reports (top-6 programmes for the whole group).", {
    x:0.6, y:4.55, w:8.8, h:0.55, fontSize:11, italic:true, color:C.white, fontFace:"Open Sans", valign:"middle",
  });

  s.addText(FOOTER, { x:0.4, y:5.30, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 10 — Privacy, anonymity, compliance
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ TRUST + COMPLIANCE ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Built so raters can be honest, and the data is yours", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });

  const items = [
    { h:"Anonymity threshold",       b:"No score (or comment) from peers, direct reports, or skip-level appears in any report until at least 3 raters in that group have responded. Configurable per engagement." },
    { h:"Self + Manager always shown", b:"You see your own scores. You see your manager's scores. That's the design — a 360 isn't a 360 without them." },
    { h:"UAE PDPL + KSA PDPL + GDPR", b:"Designed for the regulatory landscape we operate in. Consent captured at invitation. Right-to-erasure honoured. Data segregated per client." },
    { h:"ISO 10667 aligned",          b:"International standard for assessment of people in work and organisational settings. Methodology and reporting follow the framework." },
    { h:"2-year retention by default",b:"Automated purge of expired data. Customers can request extended retention via contract." },
    { h:"No vendor lock-in",          b:"Your framework and your data are exportable on demand. JSON for frameworks, PDF + CSV for reports." },
  ];

  // 2 cols x 3 rows
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.4 + col*4.7;
    const y = 1.55 + row*1.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:4.5, h:1.1, rectRadius:0.08, fill:{color:C.navy}, line:{color:C.accent, width:0.5} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:0.06, h:1.1, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(it.h, { x:x+0.18, y:y+0.08, w:4.2, h:0.32, fontSize:12, bold:true, color:C.white, fontFace:"Open Sans" });
    s.addText(it.b, { x:x+0.18, y:y+0.40, w:4.2, h:0.65, fontSize:10, color:C.light, fontFace:"Open Sans", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.22, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 11 — VIFM vs the market
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ POSITIONING ]", { x:0.4, y:0.25, w:5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("How Reflect 360 compares", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Sample-pack of competitor reports reviewed prior to building Reflect 360.",
    { x:0.4, y:1.20, w:9.2, h:0.30, fontSize:10, italic:true, color:C.textMute, fontFace:"Open Sans" });

  // Table header
  const colX = [0.4, 3.4, 5.2, 6.6, 8.0];
  const colW = [3.0, 1.8, 1.4, 1.4, 1.6];
  const headers = ["Capability", "Reflect 360", "Vendor A", "Vendor B", "Vendor C"];
  headers.forEach((h, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x:colX[i], y:1.65, w:colW[i], h:0.45, fill:{color:C.primary}, line:{color:C.primary} });
    s.addText(h, { x:colX[i]+0.1, y:1.65, w:colW[i]-0.2, h:0.45, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle", align: i===0 ? "left" : "center" });
  });

  // Rows
  const rows = [
    ["Bilingual EN + AR (native, not translated)", "Yes", "Partial", "No",      "Partial"],
    ["Custom framework per engagement",            "Yes", "Limited", "No",      "Limited"],
    ["GCC cultural anchoring",                     "Yes", "No",      "No",      "No"     ],
    ["Integrated training catalogue",              "Yes", "No",      "No",      "Partial"],
    ["Annual reassessment with delta arrows",      "Yes", "Add-on",  "Add-on",  "Add-on" ],
    ["Per-leader price band (USD)",                "Competitive", "350-500", "345", "255"],
  ];
  rows.forEach((r, ri) => {
    const y = 2.10 + ri*0.45;
    const stripe = ri % 2 === 0 ? C.white : C.pale;
    r.forEach((cell, ci) => {
      s.addShape(pres.shapes.RECTANGLE, { x:colX[ci], y, w:colW[ci], h:0.45, fill:{color:stripe}, line:{color:C.pale, width:0.3} });
      const isReflect = ci === 1;
      const text = cell;
      s.addText(text, {
        x:colX[ci]+0.1, y, w:colW[ci]-0.2, h:0.45,
        fontSize: 10.5,
        bold: isReflect,
        color: isReflect ? C.accent : C.text,
        fontFace:"Open Sans", valign:"middle",
        align: ci===0 ? "left" : "center",
      });
    });
  });

  s.addText("Vendors anonymised. Sample reports + pricing reviewed in May 2026.", {
    x:0.4, y:4.95, w:9.2, h:0.30, fontSize:9, italic:true, color:C.textMute, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.30, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 12 — Commercial model + next steps (closing CTA)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:7.5, y:0, w:2.5, h:5.625, fill:{color:C.navy}, line:{color:C.navy} });
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:6.8, y:0, w:1.0, h:5.625, fill:{color:C.accent}, line:{color:C.accent}, flipH:true });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });

  s.addText("[ TO MOVE FORWARD ]", { x:0.4, y:0.30, w:5, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Pilot first.\nScale on the\nback of evidence.", { x:0.4, y:0.95, w:6.2, h:2.2, fontSize:36, bold:true, color:C.white, fontFace:"Open Sans" });

  s.addText("Pricing tracks the GCC market band per focus person (one leader + ~10 raters). Volume discounts apply at 20+. Pilot pricing available on request.", {
    x:0.4, y:3.30, w:6.2, h:0.85, fontSize:12, color:C.light, fontFace:"Open Sans", italic:true,
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:4.20, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("caliber.viftraining.com / reflect", {
    x:0.4, y:4.35, w:6.2, h:0.45, fontSize:14, bold:true, color:C.accent, fontFace:"Consolas",
  });

  // Right panel: next steps
  s.addText("NEXT STEPS", { x:7.65, y:0.45, w:2.2, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  const next = [
    "Sample report walk-through (45 min)",
    "Pilot: 5 leaders, 4-6 week cycle",
    "Pilot debrief + roll-out plan",
    "Year-1 cohort: 20-30 leaders",
  ];
  next.forEach((n, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.90+i*0.95, w:2.20, h:0.80, fill:{color:C.primary}, line:{color:C.primary} });
    s.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.90+i*0.95, w:0.06, h:0.80, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(`${i+1}`, { x:7.80, y:0.90+i*0.95, w:0.40, h:0.80, fontSize:18, bold:true, color:C.accent, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(n, { x:8.20, y:0.90+i*0.95, w:1.62, h:0.80, fontSize:10, color:C.white, fontFace:"Open Sans", valign:"middle", wrap:true });
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
