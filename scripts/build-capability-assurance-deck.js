/**
 * Build the CHRO-facing pitch deck (.pptx) for VIFM Capability Assurance.
 *
 * Audience: a GCC bank CHRO + board / regulator-facing stakeholders.
 * Goal: sell Capability Assurance as a continuous capability-intelligence
 * partnership — the assurance layer over VIFM's existing assessment products.
 *
 * Reuses the exact VIFM brand palette + slide idioms from the Reflect 360
 * CHRO deck so the two read as one product family.
 */

const pptxgen = require("pptxgenjs");

// VIFM brand palette
const C = {
  primary:  "010131",
  navy:     "121140",
  accent:   "5391D5",
  light:    "A8C4E5",
  pale:     "D0DFF4",
  offWhite: "F5F7FA",
  white:    "FFFFFF",
  text:     "111232",
  textMute: "5A5A6A",
  good:     "047857",
  gold:     "B45309",
};

const FOOTER = "VIFM Capability Assurance . Capability intelligence for the GCC . (c) Virginia Institute of Finance and Management";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "VIFM";
pres.title = "VIFM Capability Assurance — CHRO Pitch";
pres.company = "Virginia Institute of Finance and Management";

// ────────────────────────────────────────────────────────────────
// 1 — Cover
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  // Decorative concentric "graph node" motif
  s.addShape(pres.shapes.OVAL, { x:7.3, y:0.9, w:2.5, h:2.5, fill:{type:"solid", color:C.accent, transparency:82}, line:{color:C.accent, width:1} });
  s.addShape(pres.shapes.OVAL, { x:7.75, y:1.35, w:1.6, h:1.6, fill:{type:"solid", color:C.accent, transparency:70}, line:{color:C.accent, width:1} });
  s.addShape(pres.shapes.OVAL, { x:8.2, y:1.8, w:0.7, h:0.7, fill:{color:C.accent}, line:{color:C.accent} });
  // small satellite nodes
  s.addShape(pres.shapes.OVAL, { x:7.0, y:2.9, w:0.3, h:0.3, fill:{color:C.light}, line:{color:C.light} });
  s.addShape(pres.shapes.OVAL, { x:9.4, y:1.0, w:0.3, h:0.3, fill:{color:C.light}, line:{color:C.light} });

  s.addText("[ CAPABILITY INTELLIGENCE FOR THE GCC ]", { x:0.4, y:0.25, w:7.5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("VIFM Capability\nAssurance", { x:0.4, y:1.0, w:7.0, h:1.9, fontSize:50, bold:true, color:C.white, fontFace:"Open Sans", lineSpacingMultiple:0.95 });
  s.addText("Prove your leadership is capable — to your board, and your regulator.", {
    x:0.4, y:2.95, w:6.7, h:0.7, fontSize:17, color:C.light, fontFace:"Open Sans", italic:true,
  });
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:3.75, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });

  const tags = ["One capability graph", "GCC benchmarks", "Proven training ROI"];
  tags.forEach((t, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.4 + i*2.7, y:4.0, w:2.5, h:0.5, rectRadius:0.05, fill:{color:C.navy}, line:{color:C.accent, width:0.5} });
    s.addText(t, { x:0.4 + i*2.7, y:4.0, w:2.5, h:0.5, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
  });

  s.addText("caliber.viftraining.com", { x:0.4, y:4.78, w:6, h:0.30, fontSize:11, color:C.light, fontFace:"Consolas" });
  s.addText(FOOTER, { x:0.4, y:5.24, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 2 — The boardroom question (the pain)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ THE QUESTION YOU CAN'T YET ANSWER ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("\"Is our leadership bench actually capable?\" — what do you hand the board?", {
    x:0.4, y:0.7, w:9.2, h:1.0, fontSize:21, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  const pains = [
    { h:"A gut feel", b:"Performance reviews tell you what got done. They don't tell you whether a leader is capable, or ready for the seat above them." },
    { h:"A stale survey", b:"Last year's engagement or 360 is a photograph — already out of date, scoped to one team, with nothing to compare it against." },
    { h:"A manual scramble", b:"When the regulator asks for fit-and-proper evidence, it's assembled by hand, slide by slide, with no benchmark and no audit trail." },
  ];
  pains.forEach((p, i) => {
    const x = 0.4 + i*3.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:2.0, w:3.0, h:2.6, rectRadius:0.1, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:2.0, w:3.0, h:0.08, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(p.h, { x:x+0.2, y:2.25, w:2.6, h:0.5, fontSize:15, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(p.b, { x:x+0.2, y:2.85, w:2.6, h:1.65, fontSize:11, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText("None of these is evidence. Capability Assurance is.", {
    x:0.4, y:4.85, w:9.2, h:0.40, fontSize:14, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.24, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 3 — Why now: capability is a reportable metric
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ WHY THIS MATTERS NOW ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("In the GCC, capability is no longer just an HR question", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("It is now a board-level and regulator-level metric — and the pressure is only rising.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:12, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  const cards = [
    { h:"National agenda", b:"Vision 2030 Human Capability Development and parallel UAE programmes make workforce capability a reported national KPI." },
    { h:"Nationalisation", b:"Saudization and Emiratization need more than headcount — they need proof of capability and a credible succession bench." },
    { h:"Fit-and-proper", b:"Central-bank and market regulators expect demonstrable competence and governance maturity for senior roles." },
    { h:"AI disruption", b:"Boards now also ask \"are we AI-ready?\" — a capability question that didn't exist three years ago." },
  ];
  cards.forEach((c, i) => {
    const x = 0.4 + i*2.35;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:1.7, w:2.2, h:3.1, rectRadius:0.1, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.7, w:2.2, h:0.55, fill:{color:C.primary}, line:{color:C.primary} });
    s.addText(c.h, { x:x+0.1, y:1.7, w:2.0, h:0.55, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(c.b, { x:x+0.18, y:2.4, w:1.86, h:2.3, fontSize:10.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.05, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 4 — The gap: today's tools weren't built for this
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ HOW IT'S DONE TODAY ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("The tools you have weren't built for this", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });

  // two columns: Today vs What you actually need
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:1.55, w:4.5, h:3.5, fill:{color:C.navy}, line:{color:C.navy} });
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:1.55, w:0.06, h:3.5, fill:{color:C.gold}, line:{color:C.gold} });
  s.addText("WHAT'S ON THE MARKET", { x:0.6, y:1.7, w:4.1, h:0.3, fontSize:10, color:C.gold, fontFace:"Open Sans", charSpacing:2 });
  const today = [
    "Point solutions — 360 OR assessment OR engagement, never one picture",
    "Consulting projects — expensive, bespoke, and gone when they leave",
    "Western frameworks with Arabic bolted on afterwards",
    "Point-in-time — a photograph, not a live feed",
    "No benchmark tied to GCC or national agendas",
  ];
  today.forEach((tx, i) => {
    s.addText("✕", { x:0.6, y:2.1 + i*0.55, w:0.3, h:0.4, fontSize:12, bold:true, color:C.gold, fontFace:"Open Sans" });
    s.addText(tx, { x:0.95, y:2.05 + i*0.55, w:3.8, h:0.5, fontSize:10, color:C.light, fontFace:"Open Sans", valign:"middle", wrap:true });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:5.1, y:1.55, w:4.5, h:3.5, fill:{color:C.white}, line:{color:C.white} });
  s.addShape(pres.shapes.RECTANGLE, { x:5.1, y:1.55, w:0.06, h:3.5, fill:{color:C.good}, line:{color:C.good} });
  s.addText("WHAT YOU ACTUALLY NEED", { x:5.3, y:1.7, w:4.1, h:0.3, fontSize:10, color:C.good, fontFace:"Open Sans", charSpacing:2 });
  const need = [
    "One connected capability picture across every assessment",
    "A living platform that stays after the project ends",
    "Bilingual, GCC-authored frameworks — not translated",
    "Continuous — reassessed and always current",
    "Benchmarked against your sector and national goals",
  ];
  need.forEach((tx, i) => {
    s.addText("✓", { x:5.3, y:2.1 + i*0.55, w:0.3, h:0.4, fontSize:12, bold:true, color:C.good, fontFace:"Open Sans" });
    s.addText(tx, { x:5.65, y:2.05 + i*0.55, w:3.8, h:0.5, fontSize:10, color:C.text, fontFace:"Open Sans", valign:"middle", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.24, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 5 — What Capability Assurance is (split panel)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:3.8, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:3.8, y:0, w:6.2, h:5.625, fill:{color:C.pale}, line:{color:C.pale} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addShape(pres.shapes.RECTANGLE, { x:3.8, y:0, w:0.06, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });

  s.addText("[ THE PRODUCT ]", { x:0.4, y:0.25, w:3.4, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("What is\nCapability\nAssurance?", { x:0.4, y:0.95, w:3.2, h:2.2, fontSize:28, bold:true, color:C.white, fontFace:"Open Sans", valign:"top" });
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:3.25, w:2.2, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("Always-on . benchmarked . regulator-ready", { x:0.4, y:3.35, w:3.2, h:0.6, fontSize:11, color:C.light, fontFace:"Open Sans", italic:true });

  s.addText("One assurance layer over the assessments you already run", {
    x:4.1, y:0.4, w:5.5, h:0.7, fontSize:15, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  const bullets = [
    "A single living model of your people's capability — not three disconnected reports.",
    "Fed automatically by every Assessment Center, Reflect 360 and AI Readiness engagement you run.",
    "Benchmarked against the GCC: see how your bench compares to your sector and national goals.",
    "Proves the training worked — reassessment deltas link development spend to measurable gain.",
    "Produces the regulator-ready capability evidence you assemble by hand today.",
  ];
  bullets.forEach((b, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x:4.1, y:1.2 + i*0.74, w:0.06, h:0.45, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(b, { x:4.28, y:1.16 + i*0.74, w:5.4, h:0.74, fontSize:11.5, color:C.primary, fontFace:"Open Sans", valign:"middle", wrap:true });
  });
  s.addText(FOOTER, { x:4.1, y:5.24, w:5.5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 6 — Pillar 1: The Capability Graph (diagram)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ PILLAR 1 — THE CAPABILITY GRAPH ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("One living model of your capability", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Three assessments stop being three PDFs and become one queryable picture — per person, and per organisation.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11.5, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  // 3 input sensors
  const sensors = ["Assessment Center", "Reflect 360", "AI Readiness Compass"];
  sensors.forEach((sx, i) => {
    const y = 1.85 + i*1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.5, y, w:2.4, h:0.75, rectRadius:0.08, fill:{color:C.white}, line:{color:C.accent, width:1} });
    s.addText(sx, { x:0.55, y, w:2.3, h:0.75, fontSize:11.5, bold:true, color:C.primary, fontFace:"Open Sans", align:"center", valign:"middle" });
    // connector
    s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:3.0, y:y+0.22, w:0.32, h:0.3, fill:{color:C.accent}, line:{color:C.accent} });
  });

  // central graph node
  s.addShape(pres.shapes.OVAL, { x:3.65, y:2.0, w:2.5, h:2.5, fill:{color:C.primary}, line:{color:C.accent, width:2} });
  s.addText("CAPABILITY\nGRAPH", { x:3.65, y:2.55, w:2.5, h:1.0, fontSize:15, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
  s.addText("per person + per org", { x:3.65, y:3.45, w:2.5, h:0.4, fontSize:9, italic:true, color:C.light, fontFace:"Open Sans", align:"center" });

  // arrow to query panel
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:6.25, y:3.05, w:0.35, h:0.35, fill:{color:C.accent}, line:{color:C.accent} });

  // query panel
  s.addShape(pres.shapes.RECTANGLE, { x:6.75, y:1.85, w:2.85, h:2.85, fill:{color:C.navy}, line:{color:C.navy} });
  s.addShape(pres.shapes.RECTANGLE, { x:6.75, y:1.85, w:0.06, h:2.85, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("ASK IT ANYTHING", { x:6.95, y:1.98, w:2.5, h:0.3, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  const qs = [
    "\"If we win this mandate, do we have the leadership bench?\"",
    "\"Where is our governance-competency gap vs the regulator's bar?\"",
    "\"Who is ready now for the C-suite — and who needs 18 months?\"",
  ];
  qs.forEach((q, i) => {
    s.addText(q, { x:6.95, y:2.35 + i*0.78, w:2.5, h:0.75, fontSize:10, italic:true, color:C.white, fontFace:"Open Sans", valign:"top", wrap:true });
  });

  s.addText("Built on data you already generate — Capability Assurance is intelligence, not another survey.", {
    x:0.4, y:5.0, w:9.2, h:0.3, fontSize:10, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.3, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 7 — Pillar 2: GCC Benchmarking (the differentiator)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ PILLAR 2 — THE DIFFERENCE NO ONE ELSE HAS ]", { x:0.4, y:0.25, w:6.5, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("See yourself against the GCC — not a US median", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });
  s.addText("VIFM operates region-wide. Anonymised aggregation lets you compare against your sector and national goals.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11.5, italic:true, color:C.light, fontFace:"Open Sans",
  });

  // Benchmark bar visual
  s.addText("YOUR BANK  vs  GCC BANKING BENCHMARK", { x:0.6, y:1.75, w:8, h:0.3, fontSize:10, color:C.accent, fontFace:"Open Sans", charSpacing:2 });
  const metrics = [
    { label:"Decision Quality", you:0.74, med:0.60 },
    { label:"Strategic Mindset", you:0.52, med:0.63 },
    { label:"Governance maturity", you:0.81, med:0.58 },
  ];
  metrics.forEach((m, i) => {
    const y = 2.2 + i*0.72;
    s.addText(m.label, { x:0.6, y, w:2.6, h:0.3, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans" });
    // track
    s.addShape(pres.shapes.RECTANGLE, { x:3.3, y:y+0.02, w:5.8, h:0.30, fill:{color:C.navy}, line:{color:C.navy} });
    // median marker
    const medX = 3.3 + 5.8*m.med;
    s.addShape(pres.shapes.RECTANGLE, { x:medX-0.01, y:y-0.06, w:0.04, h:0.44, fill:{color:C.light}, line:{color:C.light} });
    // your bar
    const youColor = m.you >= m.med ? C.good : C.gold;
    s.addShape(pres.shapes.RECTANGLE, { x:3.3, y:y+0.02, w:5.8*m.you, h:0.30, fill:{color:youColor}, line:{color:youColor} });
  });
  s.addText("│ = GCC median", { x:3.3, y:2.2 + 3*0.72 - 0.05, w:3, h:0.3, fontSize:9, italic:true, color:C.light, fontFace:"Open Sans" });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.4, y:4.55, w:9.2, h:0.6, rectRadius:0.06, fill:{color:C.navy}, line:{color:C.accent, width:0.5} });
  s.addText("The moat: every engagement makes the benchmark sharper. A competitor with no GCC base cannot match it at any price.", {
    x:0.6, y:4.55, w:8.8, h:0.6, fontSize:11, italic:true, color:C.white, fontFace:"Open Sans", valign:"middle", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.28, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 8 — Pillar 3: Closed-loop ROI
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ PILLAR 3 — PROOF, NOT PROMISES ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Prove the development actually worked", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("Most training is a cost line nobody can defend. Capability Assurance closes the loop.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:11.5, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  const flow = [
    { n:"1", h:"Gap measured", b:"The graph surfaces the cohort's lowest competency this cycle." },
    { n:"2", h:"Training delivered", b:"Matched VIFM programmes target that exact behavioural gap." },
    { n:"3", h:"Reassessed", b:"12 months on, the same cohort is measured again on the same scale." },
    { n:"4", h:"Delta proven", b:"The movement is attributed to the spend — defensible to the board." },
  ];
  flow.forEach((f, i) => {
    const x = 0.4 + i*2.35;
    s.addShape(pres.shapes.RECTANGLE, { x, y:1.75, w:2.15, h:2.3, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.OVAL, { x:x+0.15, y:1.9, w:0.5, h:0.5, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(f.n, { x:x+0.15, y:1.9, w:0.5, h:0.5, fontSize:16, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(f.h, { x:x+0.15, y:2.5, w:1.85, h:0.4, fontSize:12.5, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(f.b, { x:x+0.15, y:2.95, w:1.85, h:1.05, fontSize:10, color:C.text, fontFace:"Open Sans", wrap:true });
    if (i < 3) s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:x+2.18, y:2.75, w:0.22, h:0.25, fill:{color:C.accent}, line:{color:C.accent} });
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:4.4, w:9.2, h:0.7, fill:{color:C.good}, line:{color:C.good} });
  s.addText("\"VIFM programmes moved this cohort's Strategic Mindset +0.6 over twelve months.\"  — the sentence every CHRO wants to say to the board.", {
    x:0.6, y:4.4, w:8.8, h:0.7, fontSize:11.5, bold:true, italic:true, color:C.white, fontFace:"Open Sans", valign:"middle", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.26, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 9 — What you receive (deliverables)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ WHAT YOU RECEIVE ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Four artefacts, refreshed every cycle", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  const items = [
    { h:"Capability twin dashboard", b:"A live view of your bench — every leader, every competency, AI readiness, succession readiness — queryable on demand." },
    { h:"GCC benchmark report", b:"Where you stand against your sector and national goals, by competency and by leadership tier." },
    { h:"Regulator-ready assurance pack", b:"Bilingual, audit-trailed capability evidence mapped to fit-and-proper and governance expectations." },
    { h:"Training ROI statement", b:"Reassessment deltas linked to the programmes delivered — the defensible return on development spend." },
  ];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.4 + col*4.7;
    const y = 1.65 + row*1.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:4.5, h:1.55, rectRadius:0.08, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:0.06, h:1.55, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(it.h, { x:x+0.2, y:y+0.15, w:4.1, h:0.4, fontSize:14, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(it.b, { x:x+0.2, y:y+0.6, w:4.1, h:0.9, fontSize:11, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.24, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 10 — Your data, your control (governance / trust)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ YOUR DATA, YOUR CONTROL ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Built for a bank's standard of trust", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans",
  });

  const items = [
    { h:"Benchmarks are anonymised", b:"Your raw data is never shared. Benchmarks are computed from aggregated, de-identified pools — you contribute and consume, no one sees you." },
    { h:"Consent + PDPL by design", b:"KSA PDPL + UAE PDPL + GDPR aware. Consent captured up front; aggregation is contractual and opt-in." },
    { h:"Encryption + access control", b:"TLS in transit, AES-256 at rest, row-level access enforced server-side. Your engagements are segregated from every other client." },
    { h:"Evidence, not certification", b:"Capability Assurance gives you defensible evidence and insight. Regulatory decisions remain yours — we equip the conversation." },
  ];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.4 + col*4.7;
    const y = 1.55 + row*1.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:4.5, h:1.5, rectRadius:0.08, fill:{color:C.navy}, line:{color:C.accent, width:0.5} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:0.06, h:1.5, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(it.h, { x:x+0.18, y:y+0.12, w:4.2, h:0.4, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans" });
    s.addText(it.b, { x:x+0.18, y:y+0.55, w:4.2, h:0.9, fontSize:10.5, color:C.light, fontFace:"Open Sans", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.24, w:9.2, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 11 — Why VIFM
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ WHY VIFM ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Only VIFM can connect all of this", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });

  const reasons = [
    { h:"A finance institute", b:"VIFM speaks the language of fit-and-proper, governance and assurance — not just HR. The credibility a regulator-facing report needs." },
    { h:"Bilingual native", b:"Arabic and English are first-class throughout — authored for the GCC, not translated into it." },
    { h:"The full diagnostic suite", b:"Assessment Center, Reflect 360 and AI Readiness already exist and already feed the graph. Day one is not zero." },
    { h:"An integrated catalogue", b:"127 training programmes turn every diagnosed gap into a prescription — and the ROI loop proves it closed." },
    { h:"Consultant-led", b:"A named VIFM lead owns the relationship, the framework and the debrief. The platform is the toolkit, not the relationship." },
    { h:"GCC data network", b:"The benchmark only exists because VIFM works across the region. It compounds with every client — and it cannot be bought." },
  ];
  reasons.forEach((r, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col*3.2;
    const y = 1.65 + row*1.7;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:1.55, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w:3.0, h:0.06, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(r.h, { x:x+0.15, y:y+0.13, w:2.75, h:0.35, fontSize:12.5, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(r.b, { x:x+0.15, y:y+0.5, w:2.75, h:1.0, fontSize:9.5, color:C.text, fontFace:"Open Sans", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.24, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 12 — How we start (founding-partner model)
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("[ HOW WE START ]", { x:0.4, y:0.25, w:6, h:0.28, fontSize:9, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Start with one cohort. Prove it. Then scale.", {
    x:0.4, y:0.7, w:9.2, h:0.5, fontSize:22, bold:true, color:C.primary, fontFace:"Open Sans",
  });
  s.addText("A founding-partner engagement — your capability graph is live before any platform commitment.", {
    x:0.4, y:1.20, w:9.2, h:0.30, fontSize:12, italic:true, color:C.textMute, fontFace:"Open Sans",
  });

  const steps = [
    { n:"1", h:"Pilot cohort", b:"One leadership group — run an assessment + Reflect 360, stand up the first capability graph." },
    { n:"2", h:"First assurance pack", b:"Produce the regulator-ready evidence and the initial benchmark from the pilot." },
    { n:"3", h:"Prove + expand", b:"Review with the board, then extend across the leadership population." },
    { n:"4", h:"Always-on partner", b:"Annual reassessment + continuous benchmarking — the graph lives with you." },
  ];
  steps.forEach((st, i) => {
    const x = 0.4 + i*2.35;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:1.75, w:2.15, h:2.6, rectRadius:0.1, fill:{color:C.white}, line:{color:C.pale, width:1} });
    s.addShape(pres.shapes.OVAL, { x:x+0.15, y:1.92, w:0.5, h:0.5, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(st.n, { x:x+0.15, y:1.92, w:0.5, h:0.5, fontSize:16, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(st.h, { x:x+0.15, y:2.55, w:1.85, h:0.4, fontSize:12.5, bold:true, color:C.primary, fontFace:"Open Sans" });
    s.addText(st.b, { x:x+0.15, y:3.0, w:1.85, h:1.3, fontSize:10, color:C.text, fontFace:"Open Sans", wrap:true });
    if (i < 3) s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:x+2.18, y:2.95, w:0.22, h:0.25, fill:{color:C.accent}, line:{color:C.accent} });
  });

  s.addText("Low commitment to begin. The value — and the switching cost — compound from cycle one.", {
    x:0.4, y:4.6, w:9.2, h:0.35, fontSize:11, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  s.addText(FOOTER, { x:0.4, y:5.24, w:9.2, h:0.25, fontSize:8, color:C.textMute, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// 13 — Closing CTA
// ────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  s.addShape(pres.shapes.RECTANGLE, { x:7.5, y:0, w:2.5, h:5.625, fill:{color:C.navy}, line:{color:C.navy} });
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x:6.8, y:0, w:1.0, h:5.625, fill:{color:C.accent}, line:{color:C.accent}, flipH:true });
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });

  s.addText("[ THE OPPORTUNITY ]", { x:0.4, y:0.30, w:5, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  s.addText("Stop reporting\ncapability.\nStart assuring it.", { x:0.4, y:0.95, w:6.2, h:2.3, fontSize:34, bold:true, color:C.white, fontFace:"Open Sans" });

  s.addText("Be the founding GCC partner — and help define the benchmark every peer is measured against.", {
    x:0.4, y:3.35, w:6.2, h:0.85, fontSize:13, color:C.light, fontFace:"Open Sans", italic:true,
  });
  s.addShape(pres.shapes.RECTANGLE, { x:0.4, y:4.3, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });
  s.addText("caliber.viftraining.com", { x:0.4, y:4.45, w:6.2, h:0.45, fontSize:14, bold:true, color:C.accent, fontFace:"Consolas" });

  s.addText("NEXT STEPS", { x:7.65, y:0.45, w:2.2, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  const next = [
    "Working session with your HR + governance leads",
    "Define the pilot cohort",
    "Stand up the first capability graph",
    "Review the assurance pack with the board",
  ];
  next.forEach((n, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.9+i*0.95, w:2.2, h:0.8, fill:{color:C.primary}, line:{color:C.primary} });
    s.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.9+i*0.95, w:0.06, h:0.8, fill:{color:C.accent}, line:{color:C.accent} });
    s.addText(`${i+1}`, { x:7.8, y:0.9+i*0.95, w:0.4, h:0.8, fontSize:18, bold:true, color:C.accent, fontFace:"Open Sans", align:"center", valign:"middle" });
    s.addText(n, { x:8.2, y:0.9+i*0.95, w:1.62, h:0.8, fontSize:9.5, color:C.white, fontFace:"Open Sans", valign:"middle", wrap:true });
  });

  s.addText(FOOTER, { x:0.4, y:5.24, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
(async () => {
  const out = process.argv[2] || ".tmp/VIFM-Capability-Assurance-Pitch.pptx";
  await pres.writeFile({ fileName: out });
  console.log(`Wrote ${out}`);
})();
