/**
 * Build a pitch deck (.pptx) for Dr. Ahmad's AI government agency demo.
 *
 * Uses the VIFM brand templates (T1-T24) from the pptx-svg-pro skill.
 * Source of truth for product copy: CLAUDE.md, /ara/engage tier cards,
 * /ara/roadmap journey steps. All slide content lifts from the briefing
 * DOCX so Dr. Ahmad can cross-reference the two.
 */

const pptxgen = require("pptxgenjs");

// VIFM brand colors only (per pptx-svg-pro skill rules)
const C = {
  primary:  "010131", // primary dark blue
  navy:     "1A3A6B", // mid navy
  accent:   "5391D5", // accent blue
  light:    "A8C4E5", // light blue
  pale:     "D0DFF4", // pale blue
  offWhite: "F5F7FA", // content bg
  white:    "FFFFFF",
  text:     "1E293B",
  textMute: "64748B",
};

const FOOTER = "ARC . Pitch briefing . (c) VIFM";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "VIFM";
pres.title = "VIFM AI Readiness Compass - Pitch Deck for Dr. Ahmad";
pres.company = "Virginia Institute of Finance and Management";

// ────────────────────────────────────────────────────────────────
// Slide 1 - Hero / Cover (T1 Hero Statement)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addShape(pres.shapes.RECTANGLE, { x:7.8, y:0, w:2.2, h:1.8, fill:{color:C.navy}, line:{color:C.navy} });
  slide.addShape(pres.shapes.OVAL, { x:8.2, y:0.3, w:0.5, h:0.5, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addShape(pres.shapes.OVAL, { x:8.9, y:0.7, w:0.3, h:0.3, fill:{color:C.light}, line:{color:C.light} });
  slide.addText("[ PITCH BRIEFING . FOR DR. AHMAD ]", { x:0.35, y:0.22, w:6, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("VIFM AI Readiness\nCompass", {
    x:0.35, y:1.2, w:9.0, h:2.4,
    fontSize:44, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle",
  });
  slide.addText("The instrument that tells the agency where they actually stand on AI -- before they invest in tools.", {
    x:0.35, y:3.55, w:7.4, h:0.85,
    fontSize:15, color:C.light, fontFace:"Open Sans", italic:true,
  });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.35, y:4.55, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("caliber.viftraining.com", { x:0.35, y:4.70, w:5, h:0.30, fontSize:10, color:C.light, fontFace:"Consolas" });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 2 - What is ARC (T2 Split Panel)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:3.8, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:3.8, y:0, w:6.2, h:5.625, fill:{color:C.pale}, line:{color:C.pale} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addShape(pres.shapes.RECTANGLE, { x:3.8, y:0, w:0.06, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ THE INSTRUMENT ]", { x:0.35, y:0.22, w:3.4, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("What is\nARC?", {
    x:0.35, y:0.95, w:3.2, h:1.8,
    fontSize:32, bold:true, color:C.white, fontFace:"Open Sans", valign:"top",
  });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.35, y:2.80, w:2.2, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("Bilingual . GCC-calibrated . consultant-led", {
    x:0.35, y:2.92, w:3.2, h:0.45,
    fontSize:11, color:C.light, fontFace:"Open Sans", italic:true,
  });
  slide.addText("What makes ARC different", {
    x:4.1, y:0.35, w:5.5, h:0.45,
    fontSize:15, bold:true, color:C.navy, fontFace:"Open Sans",
  });
  const bullets = [
    "Eight organisational pillars + sixteen UAE and Saudi regulatory frameworks pre-mapped.",
    "Four personal AI-readiness factors that measure individual behaviour, not opinion.",
    "Bilingual EN and AR end-to-end with proper RTL shaping in every screen and report page.",
    "Four-tier engagement model -- the first two tiers complimentary by design.",
  ];
  bullets.forEach((b, i) => {
    slide.addShape(pres.shapes.RECTANGLE, { x:4.1, y:1.05 + i*0.95, w:0.06, h:0.45, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(b, { x:4.28, y:1.00 + i*0.95, w:5.35, h:0.55, fontSize:13, color:C.primary, fontFace:"Open Sans", valign:"middle", wrap:true });
  });
  slide.addText(FOOTER, { x:4.1, y:5.22, w:5.5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 3 - The two-axis model (custom - pillars + factors)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ THE MODEL ]", { x:0.35, y:0.22, w:4, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Two axes . one engagement", { x:0.35, y:0.55, w:9, h:0.50, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.35, y:1.10, w:3.5, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });

  // Two big cards side-by-side
  const cardW = 4.55, cardH = 3.35, cardY = 1.35, gapX = 0.30;
  // Pillars card
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.35, y:cardY, w:cardW, h:cardH, rectRadius:0.1, fill:{color:C.navy}, line:{color:C.accent, width:1} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.35, y:cardY, w:cardW, h:0.10, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("EIGHT ORGANISATIONAL PILLARS", { x:0.55, y:cardY+0.22, w:4.2, h:0.32, fontSize:10, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("What the institution has built", { x:0.55, y:cardY+0.60, w:4.2, h:0.45, fontSize:18, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y:cardY+1.10, w:1.6, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("Strategy, Data, Technology, Talent, Culture, Governance, Operations, Model Management. Scored 1-5 by multiple stakeholders. Department covers 4 of 8; Division 6 of 8; Enterprise all 8.", { x:0.55, y:cardY+1.25, w:4.2, h:1.95, fontSize:12, color:C.light, fontFace:"Open Sans", wrap:true });

  // Factors card
  const fX = 0.35 + cardW + gapX;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:fX, y:cardY, w:cardW, h:cardH, rectRadius:0.1, fill:{color:C.navy}, line:{color:C.accent, width:1} });
  slide.addShape(pres.shapes.RECTANGLE, { x:fX, y:cardY, w:cardW, h:0.10, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("FOUR PERSONAL FACTORS", { x:fX+0.20, y:cardY+0.22, w:4.2, h:0.32, fontSize:10, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("How its people behave", { x:fX+0.20, y:cardY+0.60, w:4.2, h:0.45, fontSize:18, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addShape(pres.shapes.RECTANGLE, { x:fX+0.20, y:cardY+1.10, w:1.6, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("AI Sense-Check, AI Working Practice, AI Collaboration, AI Adaptive Mindset. Mapped to VIFM AC behavioural competencies. Measures behaviour, not opinion.", { x:fX+0.20, y:cardY+1.25, w:4.2, h:1.95, fontSize:12, color:C.light, fontFace:"Open Sans", wrap:true });

  // The pitch line
  slide.addText("A government agency's realised readiness is the intersection of both.", {
    x:0.35, y:4.85, w:9.3, h:0.40, fontSize:14, italic:true, color:C.accent, fontFace:"Open Sans", align:"center",
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 4 - Eight pillars (custom 4x2 grid)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:0.78, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addText("[ EIGHT ORGANISATIONAL PILLARS ]", { x:0.35, y:0.05, w:5, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("What the institution has built across the AI surface", { x:0.35, y:0.28, w:9.3, h:0.40, fontSize:17, bold:true, color:C.white, fontFace:"Open Sans" });
  const pillars = [
    { name:"Strategy",      desc:"AI strategy with named owners and milestones." },
    { name:"Data",          desc:"Accessible, classified, trustworthy data for AI." },
    { name:"Technology",    desc:"Platforms and infrastructure to deploy at scale." },
    { name:"Talent",        desc:"AI skills present, growing, and retained." },
    { name:"Culture",       desc:"Willingness to experiment, accept failure, learn." },
    { name:"Governance",    desc:"Ethics, risk, and policy structures in place." },
    { name:"Operations",    desc:"AI moves from pilot to production with value." },
    { name:"Model mgmt",    desc:"Monitored, retrained, decommissioned on lifecycle." },
  ];
  const cols=4, rows=2, gW=2.32, gH=1.85, gGapX=0.10, gGapY=0.18, gStartX=0.30, gStartY=0.95;
  pillars.forEach((p, i) => {
    const col=i%cols, row=Math.floor(i/cols);
    const gx=gStartX+col*(gW+gGapX), gy=gStartY+row*(gH+gGapY);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:gx, y:gy, w:gW, h:gH, rectRadius:0.08, fill:{color:C.primary}, line:{color:C.primary}, shadow:{type:"outer",color:"000000",blur:4,offset:1,angle:135,opacity:0.10} });
    slide.addShape(pres.shapes.RECTANGLE, { x:gx, y:gy, w:gW, h:0.07, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addShape(pres.shapes.OVAL, { x:gx+0.15, y:gy+0.22, w:0.36, h:0.36, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(`${i+1}`, { x:gx+0.15, y:gy+0.22, w:0.36, h:0.36, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    slide.addText(p.name, { x:gx+0.60, y:gy+0.22, w:gW-0.70, h:0.36, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
    slide.addText(p.desc, { x:gx+0.15, y:gy+0.72, w:gW-0.30, h:1.05, fontSize:10.5, color:C.light, fontFace:"Open Sans", wrap:true });
  });
  slide.addText("Department covers 4 of 8 . Division 6 of 8 . Enterprise all 8", {
    x:0.30, y:4.78, w:9.4, h:0.35, fontSize:11, color:C.navy, fontFace:"Open Sans", italic:true, align:"center",
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 5 - Four personal factors (custom 2x2 with domain colors)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ FOUR PERSONAL FACTORS ]", { x:0.35, y:0.20, w:5, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("How its people behave with AI day to day", { x:0.35, y:0.50, w:9.3, h:0.45, fontSize:20, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.35, y:1.05, w:3.5, h:0.04, fill:{color:C.accent}, line:{color:C.accent} });

  const factors = [
    { domain:"THINKING", name:"AI Sense-Check",       desc:"Treats AI output as a draft to be checked. Catches fabricated citations and confidently-wrong facts before they leave the room.", color:"5391D5" },
    { domain:"RESULTS",  name:"AI Working Practice",  desc:"Builds AI into the work that already exists -- writes clear prompts, folds the tool into recurring tasks, measures by deliverables not by tool-opens.", color:"047857" },
    { domain:"PEOPLE",   name:"AI Collaboration",     desc:"Helps the team move with AI rather than around it. Explains what tools can and can't do, shares prompts that worked, pushes back when output is taken at face value.", color:"C2410C" },
    { domain:"SELF",     name:"AI Adaptive Mindset",  desc:"Stays open as AI changes how the work gets done. Relearns familiar workflows, asks where models can fail, keeps confidentiality and policy in view.", color:"6D28D9" },
  ];
  const fW=4.55, fH=1.75, fGapX=0.30, fGapY=0.20, fStartX=0.35, fStartY=1.25;
  factors.forEach((f, i) => {
    const col=i%2, row=Math.floor(i/2);
    const fx=fStartX+col*(fW+fGapX), fy=fStartY+row*(fH+fGapY);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:fx, y:fy, w:fW, h:fH, rectRadius:0.1, fill:{color:C.navy}, line:{color:C.navy}, shadow:{type:"outer",color:"000000",blur:4,offset:1,angle:135,opacity:0.10} });
    slide.addShape(pres.shapes.RECTANGLE, { x:fx, y:fy, w:0.10, h:fH, fill:{color:f.color}, line:{color:f.color} });
    slide.addText(f.domain, { x:fx+0.25, y:fy+0.15, w:2.5, h:0.32, fontSize:9, bold:true, color:f.color, fontFace:"Open Sans", charSpacing:3 });
    slide.addText(f.name, { x:fx+0.25, y:fy+0.45, w:fW-0.40, h:0.45, fontSize:16, bold:true, color:C.white, fontFace:"Open Sans" });
    slide.addText(f.desc, { x:fx+0.25, y:fy+0.95, w:fW-0.40, h:0.75, fontSize:11, color:C.light, fontFace:"Open Sans", wrap:true });
  });
  slide.addText("Self-reported behaviour . 24 items snapshot / 48 items deep-dive . scored 1-5", {
    x:0.35, y:4.85, w:9.3, h:0.35, fontSize:11, color:C.light, fontFace:"Open Sans", italic:true, align:"center",
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 6 - The workforce layer (THE pitch line) - T22 style
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.navy}, line:{color:C.navy} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ THE DIFFERENTIATOR ]", { x:0.35, y:0.20, w:5, h:0.28, fontSize:8, color:C.light, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("The workforce-readiness layer", { x:0.35, y:0.50, w:9.3, h:0.50, fontSize:22, bold:true, color:C.white, fontFace:"Open Sans" });

  // Two stacked highlight rows
  const stripsY=1.20, stripH=1.65;
  // Strip 1 - Pillars
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.30, y:stripsY, w:9.40, h:stripH, rectRadius:0.10, fill:{color:C.primary}, line:{color:C.primary}, shadow:{type:"outer",color:"000000",blur:4,offset:1,angle:135,opacity:0.10} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.30, y:stripsY, w:0.10, h:stripH, fill:{color:C.light}, line:{color:C.light} });
  slide.addText("01", { x:0.55, y:stripsY+0.20, w:1.0, h:1.25, fontSize:52, bold:true, color:C.accent, fontFace:"Open Sans", align:"center" });
  slide.addText("Pillars measure what the organisation has built", { x:1.75, y:stripsY+0.20, w:7.6, h:0.50, fontSize:16, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addText("Strategy, Data, Technology, Governance -- the structural side. Most readiness diagnostics stop here.", { x:1.75, y:stripsY+0.75, w:7.6, h:0.80, fontSize:13, color:C.light, fontFace:"Open Sans", wrap:true });

  // Strip 2 - Factors
  const strip2Y = stripsY + stripH + 0.20;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.30, y:strip2Y, w:9.40, h:stripH, rectRadius:0.10, fill:{color:C.accent}, line:{color:C.accent}, shadow:{type:"outer",color:"000000",blur:4,offset:1,angle:135,opacity:0.10} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.30, y:strip2Y, w:0.10, h:stripH, fill:{color:C.light}, line:{color:C.light} });
  slide.addText("02", { x:0.55, y:strip2Y+0.20, w:1.0, h:1.25, fontSize:52, bold:true, color:C.primary, fontFace:"Open Sans", align:"center" });
  slide.addText("Factors measure how its people behave", { x:1.75, y:strip2Y+0.20, w:7.6, h:0.50, fontSize:16, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addText("Add the workforce layer to any Department, Division, or Enterprise engagement -- the report measures adoption alongside capability, on facing pages.", { x:1.75, y:strip2Y+0.75, w:7.6, h:0.80, fontSize:13, color:C.pale, fontFace:"Open Sans", wrap:true });

  slide.addText('"Your strategy is solid. The gap is adoption."', {
    x:0.35, y:4.95, w:9.3, h:0.30, fontSize:12, italic:true, color:C.light, fontFace:"Open Sans", align:"center",
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.light, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 7 - Four-tier engagement roadmap (T5 Horizontal Timeline)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:0.80, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addText("[ ENGAGEMENT ROADMAP ]", { x:0.35, y:0.05, w:5, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Four tiers . the first two complimentary by design", { x:0.35, y:0.28, w:9.3, h:0.40, fontSize:17, bold:true, color:C.white, fontFace:"Open Sans" });

  const steps = [
    { num:"01", title:"Personal",   sub:"Complimentary",   body:"One individual self-assessment, 5-7 minutes, 1-page PDF. No account required." },
    { num:"02", title:"Department", sub:"Complimentary",   body:"One team, 4 of 8 pillars, 1-2 leaders, 8-page consultant report. Proves value." },
    { num:"03", title:"Division",   sub:"Paid",            body:"Several departments, 6 of 8 pillars, 4-8 leaders, 27-page report with roadmap." },
    { num:"04", title:"Enterprise", sub:"Paid . board-grade", body:"Whole organisation, 8 of 8 pillars, 15+ leaders, 27-60 page bilingual report." },
  ];
  const spineY=2.20, nodeR=0.40, startX=0.85, colW=2.20;
  slide.addShape(pres.shapes.RECTANGLE, { x:startX+nodeR, y:spineY-0.03, w:(steps.length-1)*colW, h:0.06, fill:{color:C.accent}, line:{color:C.accent} });
  steps.forEach((s, i) => {
    const cx = startX + i*colW;
    slide.addShape(pres.shapes.OVAL, { x:cx, y:spineY-nodeR, w:nodeR*2, h:nodeR*2, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addShape(pres.shapes.OVAL, { x:cx+0.08, y:spineY-nodeR+0.08, w:(nodeR-0.08)*2, h:(nodeR-0.08)*2, fill:{color:C.primary}, line:{color:C.primary} });
    slide.addText(s.num, { x:cx, y:spineY-nodeR, w:nodeR*2, h:nodeR*2, fontSize:13, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    slide.addText(s.title, { x:cx-0.50, y:spineY+0.50, w:colW, h:0.40, fontSize:14, bold:true, color:C.primary, fontFace:"Open Sans", align:"center" });
    slide.addText(s.sub, { x:cx-0.50, y:spineY+0.90, w:colW, h:0.30, fontSize:10, color:i<2?"059669":C.navy, bold:true, fontFace:"Open Sans", align:"center", italic:true });
    slide.addText(s.body, { x:cx-0.45, y:spineY+1.25, w:colW-0.10, h:1.85, fontSize:10.5, color:C.navy, fontFace:"Open Sans", align:"center", wrap:true });
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 8 - What you get at each tier (T11 Stacked Highlight Rows)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.navy}, line:{color:C.navy} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ WHAT YOU GET ]", { x:0.35, y:0.12, w:4, h:0.28, fontSize:8, color:C.light, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Report depth scales with the tier", { x:0.35, y:0.38, w:9, h:0.45, fontSize:20, bold:true, color:C.white, fontFace:"Open Sans" });

  const rows = [
    { num:"01", label:"Personal",   detail:"1-page PDF . stage-keyed coaching . VIFM training recommendations" },
    { num:"02", label:"Department", detail:"8-page client PDF . pillar maturity heatmap . regulatory summary" },
    { num:"03", label:"Division",   detail:"27-page report . investment matrix . gantt roadmap . use cases" },
    { num:"04", label:"Enterprise", detail:"27-60 page bilingual board-grade report . all eight pillar deep-dives . year-on-year delta" },
  ];
  const rowColors = [C.primary, C.navy, C.primary, C.navy];
  rows.forEach((r, i) => {
    const ry = 1.05 + i*0.95;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.28, y:ry, w:9.4, h:0.82, rectRadius:0.08, fill:{color:rowColors[i]}, line:{color:rowColors[i]}, shadow:{type:"outer",color:"000000",blur:4,offset:1,angle:135,opacity:0.10} });
    slide.addShape(pres.shapes.RECTANGLE, { x:0.28, y:ry, w:0.08, h:0.82, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addShape(pres.shapes.OVAL, { x:0.48, y:ry+0.18, w:0.46, h:0.46, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(r.num, { x:0.48, y:ry+0.18, w:0.46, h:0.46, fontSize:11, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    slide.addText(r.label, { x:1.08, y:ry+0.10, w:2.0, h:0.62, fontSize:14, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
    slide.addShape(pres.shapes.RECTANGLE, { x:3.15, y:ry+0.14, w:0.04, h:0.55, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(r.detail, { x:3.32, y:ry+0.10, w:6.20, h:0.62, fontSize:12, color:C.light, fontFace:"Open Sans", valign:"middle", wrap:true });
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.light, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 9 - Six-stage delivery (T5 horizontal timeline with 6 nodes)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:0.78, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addText("[ HOW IT IS DELIVERED ]", { x:0.35, y:0.05, w:5, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Six stages from kick-off to released report", { x:0.35, y:0.28, w:9.3, h:0.40, fontSize:17, bold:true, color:C.white, fontFace:"Open Sans" });

  const steps = [
    { num:"1", title:"Discover",   body:"Consultant creates engagement" },
    { num:"2", title:"Invite",     body:"Token URLs to stakeholders" },
    { num:"3", title:"Gather",     body:"Bilingual questionnaire" },
    { num:"4", title:"Validate",   body:"Phase 2 workshop" },
    { num:"5", title:"Analyse",    body:"Maturity model + compliance" },
    { num:"6", title:"Report",     body:"Client-grade PDF delivered" },
  ];
  const spineY=2.40, nodeR=0.32, startX=0.65, colW=1.55;
  slide.addShape(pres.shapes.RECTANGLE, { x:startX+nodeR, y:spineY-0.03, w:(steps.length-1)*colW, h:0.06, fill:{color:C.accent}, line:{color:C.accent} });
  steps.forEach((s, i) => {
    const cx = startX + i*colW;
    slide.addShape(pres.shapes.OVAL, { x:cx, y:spineY-nodeR, w:nodeR*2, h:nodeR*2, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addShape(pres.shapes.OVAL, { x:cx+0.06, y:spineY-nodeR+0.06, w:(nodeR-0.06)*2, h:(nodeR-0.06)*2, fill:{color:C.primary}, line:{color:C.primary} });
    slide.addText(s.num, { x:cx, y:spineY-nodeR, w:nodeR*2, h:nodeR*2, fontSize:14, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    slide.addText(s.title, { x:cx-0.35, y:spineY+0.45, w:colW, h:0.40, fontSize:13, bold:true, color:C.primary, fontFace:"Open Sans", align:"center" });
    slide.addText(s.body, { x:cx-0.35, y:spineY+0.85, w:colW, h:0.95, fontSize:10, color:C.navy, fontFace:"Open Sans", align:"center", wrap:true });
  });

  // Timeline note
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:1.0, y:4.45, w:8.0, h:0.55, rectRadius:0.08, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:1.0, y:4.45, w:0.08, h:0.55, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("Department: 4-6 weeks  .  Division: 6-8 weeks  .  Enterprise: 8-12 weeks  .  Re-assessable annually", {
    x:1.20, y:4.45, w:7.75, h:0.55, fontSize:11, color:C.light, fontFace:"Open Sans", valign:"middle",
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 10 - Sixteen regulatory frameworks (T13-style icon grid)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ COMPLIANCE BUILT-IN ]", { x:0.35, y:0.20, w:5, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Sixteen regulatory frameworks pre-mapped", { x:0.35, y:0.50, w:9.3, h:0.45, fontSize:20, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addText("Seven UAE . nine Saudi . crosswalked to the eight pillars on every report", {
    x:0.35, y:1.00, w:9.3, h:0.35, fontSize:12, color:C.light, fontFace:"Open Sans", italic:true,
  });

  // Two big cards: UAE / Saudi
  const cardW = 4.55, cardH = 3.30, cardY = 1.50, gapX = 0.30;
  // UAE card
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.35, y:cardY, w:cardW, h:cardH, rectRadius:0.1, fill:{color:C.navy}, line:{color:C.accent, width:1} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.35, y:cardY, w:cardW, h:0.10, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("UAE . 7 FRAMEWORKS", { x:0.55, y:cardY+0.18, w:4.2, h:0.32, fontSize:10, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  const uae = [
    "UAE National AI Strategy 2031",
    "Federal Decree-Law 45 / 2021 (PDP)",
    "Federal Data Office policy stack",
    "Dubai AI Ethics Guidelines",
    "TDRA AI Framework",
    "Cybersecurity Council standards",
    "Sector-specific regulator overlays",
  ];
  uae.forEach((u, i) => {
    slide.addShape(pres.shapes.RECTANGLE, { x:0.55, y:cardY+0.65+i*0.34, w:0.06, h:0.24, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(u, { x:0.70, y:cardY+0.60+i*0.34, w:cardW-0.50, h:0.32, fontSize:11, color:C.white, fontFace:"Open Sans", valign:"middle" });
  });

  // Saudi card
  const sX = 0.35 + cardW + gapX;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:sX, y:cardY, w:cardW, h:cardH, rectRadius:0.1, fill:{color:C.navy}, line:{color:C.accent, width:1} });
  slide.addShape(pres.shapes.RECTANGLE, { x:sX, y:cardY, w:cardW, h:0.10, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("SAUDI ARABIA . 9 FRAMEWORKS", { x:sX+0.20, y:cardY+0.18, w:4.2, h:0.32, fontSize:10, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  const ksa = [
    "National Strategy for Data and AI (NSDAI)",
    "SDAIA AI Ethics Principles",
    "Personal Data Protection Law (PDPL)",
    "NCA Cloud Cybersecurity Controls",
    "MCIT digital regulation stack",
    "CITC ICT regulatory framework",
    "Sector overlays (SAMA, CMA, etc.)",
    "Vision 2030 alignment",
    "Open Data policy",
  ];
  ksa.forEach((k, i) => {
    slide.addShape(pres.shapes.RECTANGLE, { x:sX+0.20, y:cardY+0.65+i*0.28, w:0.06, h:0.20, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(k, { x:sX+0.35, y:cardY+0.60+i*0.28, w:cardW-0.50, h:0.30, fontSize:10.5, color:C.white, fontFace:"Open Sans", valign:"middle" });
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 11 - Differentiators (T13 Icon Grid 2x3)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.offWhite}, line:{color:C.offWhite} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:0.78, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addText("[ WHY ARC ]", { x:0.35, y:0.05, w:4, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Why ARC, not a generic readiness scan", { x:0.35, y:0.28, w:9, h:0.40, fontSize:17, bold:true, color:C.white, fontFace:"Open Sans" });

  const diffs = [
    { title:"GCC-calibrated",        body:"Question bank, frameworks, Arabic translations built around GCC government and banking. Not retrofitted." },
    { title:"Bilingual end-to-end",  body:"English, Arabic, side-by-side landscape. Native RTL on every screen and report page." },
    { title:"Pillars + factors",     body:"The only instrument that pairs organisational maturity with individual behaviour in one engagement." },
    { title:"Compliance evidence",   body:"Sixteen UAE and Saudi frameworks pre-mapped to the eight pillars. Not abstract scores -- evidence." },
    { title:"Training built-in",     body:"Every gap surfaces VIFM training programmes that close it, ranked by fit. Connected to the path forward." },
    { title:"Annual reassessment",   body:"One-click clone preserves scope and roster. Year-on-year delta view rendered automatically." },
  ];
  const gW=3.05, gH=1.65, gGapX=0.12, gGapY=0.15, gStartX=0.30, gStartY=0.95;
  const cardBgs = [C.primary, C.navy, C.primary, C.navy, C.primary, C.navy];
  diffs.forEach((d, i) => {
    const col=i%3, row=Math.floor(i/3);
    const gx=gStartX+col*(gW+gGapX), gy=gStartY+row*(gH+gGapY);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:gx, y:gy, w:gW, h:gH, rectRadius:0.1, fill:{color:cardBgs[i]}, line:{color:cardBgs[i]}, shadow:{type:"outer",color:"000000",blur:4,offset:1,angle:135,opacity:0.10} });
    slide.addShape(pres.shapes.RECTANGLE, { x:gx, y:gy, w:gW, h:0.07, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addShape(pres.shapes.OVAL, { x:gx+0.18, y:gy+0.22, w:0.40, h:0.40, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(`${i+1}`, { x:gx+0.18, y:gy+0.22, w:0.40, h:0.40, fontSize:12, bold:true, color:C.white, fontFace:"Open Sans", align:"center", valign:"middle" });
    slide.addText(d.title, { x:gx+0.68, y:gy+0.22, w:gW-0.80, h:0.40, fontSize:12.5, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
    slide.addText(d.body, { x:gx+0.18, y:gy+0.72, w:gW-0.36, h:0.85, fontSize:10.5, color:C.light, fontFace:"Open Sans", wrap:true });
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 12 - Suggested demo flow (T17 Vertical Step Flow style - 6 condensed)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ DEMO FLOW ]", { x:0.35, y:0.20, w:4, h:0.28, fontSize:8, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Suggested demo flow . 15-20 minutes", { x:0.35, y:0.50, w:9.3, h:0.45, fontSize:20, bold:true, color:C.white, fontFace:"Open Sans" });

  const demo = [
    { time:"2m",  what:"Open with the compass narrative",    where:"caliber.viftraining.com" },
    { time:"2m",  what:"Show the four-tier model",            where:"/ara/engage" },
    { time:"3m",  what:"Run the Personal Snapshot live",      where:"/ara/personal/start" },
    { time:"4m",  what:"Open the consultant new-engagement wizard . show the workforce-layer toggle", where:"/ara/consultant/assessments/new" },
    { time:"4m",  what:"Open a sample assessment report PDF . bilingual landscape", where:"/ara/consultant/assessments/[id]" },
    { time:"3m",  what:"Close on commercial framing",         where:"Personal + Department complimentary . Division + Enterprise paid" },
  ];
  const rH=0.61, rY=1.20, gap=0.06;
  demo.forEach((d, i) => {
    const ry = rY + i*(rH+gap);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.28, y:ry, w:9.4, h:rH, rectRadius:0.08, fill:{color:C.navy}, line:{color:C.navy}, shadow:{type:"outer",color:"000000",blur:3,offset:1,angle:135,opacity:0.10} });
    slide.addShape(pres.shapes.RECTANGLE, { x:0.28, y:ry, w:0.08, h:rH, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.45, y:ry+0.12, w:0.65, h:0.38, rectRadius:0.04, fill:{color:C.primary}, line:{color:C.primary} });
    slide.addText(d.time, { x:0.45, y:ry+0.12, w:0.65, h:0.38, fontSize:11, bold:true, color:C.accent, fontFace:"Open Sans", align:"center", valign:"middle" });
    slide.addText(d.what, { x:1.20, y:ry+0.08, w:6.20, h:0.45, fontSize:12, bold:true, color:C.white, fontFace:"Open Sans", valign:"middle" });
    slide.addText(d.where, { x:7.45, y:ry+0.08, w:2.20, h:0.45, fontSize:9.5, color:C.light, fontFace:"Consolas", valign:"middle", italic:true });
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 13 - Likely questions (T11 Stacked Highlight Rows - 4 of the 9)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.navy}, line:{color:C.navy} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("[ ROOM PREP ]", { x:0.35, y:0.12, w:4, h:0.28, fontSize:8, color:C.light, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Questions to expect from the agency", { x:0.35, y:0.38, w:9, h:0.45, fontSize:20, bold:true, color:C.white, fontFace:"Open Sans" });

  const qs = [
    { q:"Who validated the methodology?", a:"Four-factor framework anchored to TAM, Self-Determination Theory, and the Big-Five taxonomy. Methodology brief documents every anchor with citations." },
    { q:"Is the data sovereign?",         a:"Default instance is hosted; for government clients we deploy a dedicated regional instance (or on-premise) so data never leaves the jurisdiction." },
    { q:"PDPL / GDPR compliant?",         a:"Yes, designed-in. Consent required. 2-year retention cap. Right-to-erasure. Immutable audit trail. No outbound data flows." },
    { q:"How do you guard against bias?", a:"Three mechanisms: distortion detector on response patterns, perception-vs-reality validation in Phase 2, ICC reported when multiple raters score the same pillar." },
  ];
  const rowColors = [C.primary, C.navy, C.primary, C.navy];
  qs.forEach((q, i) => {
    const ry = 1.05 + i*0.95;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.28, y:ry, w:9.4, h:0.82, rectRadius:0.08, fill:{color:rowColors[i]}, line:{color:rowColors[i]}, shadow:{type:"outer",color:"000000",blur:4,offset:1,angle:135,opacity:0.10} });
    slide.addShape(pres.shapes.RECTANGLE, { x:0.28, y:ry, w:0.08, h:0.82, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText("Q", { x:0.45, y:ry+0.10, w:0.45, h:0.30, fontSize:11, bold:true, color:C.accent, fontFace:"Open Sans" });
    slide.addText(q.q, { x:0.95, y:ry+0.06, w:8.65, h:0.30, fontSize:12.5, bold:true, color:C.white, fontFace:"Open Sans" });
    slide.addText("A", { x:0.45, y:ry+0.42, w:0.45, h:0.30, fontSize:11, bold:true, color:C.accent, fontFace:"Open Sans" });
    slide.addText(q.a, { x:0.95, y:ry+0.40, w:8.65, h:0.40, fontSize:11, color:C.light, fontFace:"Open Sans", wrap:true });
  });
  slide.addText("Five more anticipated Q&A in the briefing DOCX, section 8.", {
    x:0.35, y:4.95, w:9.3, h:0.25, fontSize:10, italic:true, color:C.light, fontFace:"Open Sans", align:"center",
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.light, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Slide 14 - Closing CTA (T25-style)
// ────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625, fill:{color:C.primary}, line:{color:C.primary} });
  slide.addShape(pres.shapes.RECTANGLE, { x:7.5, y:0, w:2.5, h:5.625, fill:{color:C.navy}, line:{color:C.navy} });
  slide.addShape(pres.shapes.RIGHT_TRIANGLE, { x:6.8, y:0, w:1.0, h:5.625, fill:{color:C.accent}, line:{color:C.accent}, flipH:true });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.18, h:5.625, fill:{color:C.accent}, line:{color:C.accent} });

  slide.addText("[ START WHERE YOU STAND ]", { x:0.35, y:0.30, w:5, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  slide.addText("Try it tonight.\nFree.", { x:0.35, y:1.10, w:6.4, h:2.0, fontSize:48, bold:true, color:C.white, fontFace:"Open Sans" });
  slide.addText("Five minutes. No account required. Your own personal AI-readiness PDF in the inbox.", {
    x:0.35, y:3.15, w:6.4, h:0.85, fontSize:14, color:C.light, fontFace:"Open Sans", italic:true,
  });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.35, y:4.10, w:3.5, h:0.05, fill:{color:C.accent}, line:{color:C.accent} });
  slide.addText("caliber.viftraining.com / ara / personal / start", {
    x:0.35, y:4.25, w:6.4, h:0.45, fontSize:14, bold:true, color:C.accent, fontFace:"Consolas",
  });

  // Right panel
  slide.addText("NEXT STEPS", { x:7.65, y:0.45, w:2.2, h:0.30, fontSize:9, bold:true, color:C.accent, fontFace:"Open Sans", charSpacing:3 });
  const next = ["Demo today", "Personal Snapshot", "Complimentary Dept.", "Paid Division+"];
  next.forEach((n, i) => {
    slide.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.90+i*0.95, w:2.20, h:0.80, fill:{color:C.primary}, line:{color:C.primary} });
    slide.addShape(pres.shapes.RECTANGLE, { x:7.65, y:0.90+i*0.95, w:0.06, h:0.80, fill:{color:C.accent}, line:{color:C.accent} });
    slide.addText(`${i+1}`, { x:7.80, y:0.90+i*0.95, w:0.40, h:0.80, fontSize:18, bold:true, color:C.accent, fontFace:"Open Sans", align:"center", valign:"middle" });
    slide.addText(n, { x:8.20, y:0.90+i*0.95, w:1.62, h:0.80, fontSize:12, color:C.white, fontFace:"Open Sans", valign:"middle", wrap:true });
  });
  slide.addText(FOOTER, { x:0.35, y:5.22, w:5, h:0.25, fontSize:8, color:C.navy, fontFace:"Open Sans" });
}

// ────────────────────────────────────────────────────────────────
// Write to disk
// ────────────────────────────────────────────────────────────────
(async () => {
  const out = process.argv[2] || "VIFM-ARC-Pitch-Deck-Dr-Ahmad.pptx";
  await pres.writeFile({ fileName: out });
  console.log(`Wrote ${out}`);
})();
