/**
 * Build a generic, reusable client ONBOARDING deck (.pptx) for the AI Readiness Compass
 * voucher journey - what a delegate does, start to finish.
 *
 * Brand/template patterns reuse scripts/build-arc-pitch-deck.js (the VIFM
 * brand system materialised into pptxgenjs). Scope: ONLY the voucher ->
 * individual AI Readiness Compass journey. Not a sales pitch.
 *
 * Run:  npm install --no-save pptxgenjs && node scripts/build-arc-client-onboarding-deck.js
 */
const pptxgen = require("pptxgenjs");

const C = {
  primary:  "010131",
  navy:     "1A3A6B",
  accent:   "5391D5",
  light:    "A8C4E5",
  pale:     "D0DFF4",
  offWhite: "F5F7FA",
  white:    "FFFFFF",
  text:     "1E293B",
  textMute: "64748B",
};
const FONT = "Open Sans";
const FOOTER = "VIFM AI Readiness Compass   |   Client Onboarding";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";       // 10 x 5.625 in
pres.author = "VIFM";
pres.company = "Virginia Institute of Finance and Management";
pres.title = "AI Readiness Compass - Client Onboarding";

const W = 10, H = 5.625;

// ── shared helpers ──────────────────────────────────────────────
function rail(slide, color = C.accent) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.16, h: H, fill: { color }, line: { color } });
}
function footer(slide, n, onDark = false) {
  slide.addText(FOOTER, { x: 0.35, y: 5.24, w: 7.5, h: 0.25, fontSize: 8, color: onDark ? C.navy : C.textMute, fontFace: FONT });
  slide.addText(`${n}`, { x: 9.2, y: 5.24, w: 0.5, h: 0.25, fontSize: 8, color: onDark ? C.navy : C.textMute, fontFace: FONT, align: "right" });
}
function eyebrow(slide, text, x, y, color = C.accent) {
  slide.addText(text, { x, y, w: 7, h: 0.28, fontSize: 9, color, fontFace: FONT, charSpacing: 3, bold: true });
}
// content slide: light bg + dark title band
function contentHeader(slide, eb, title) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.offWhite }, line: { color: C.offWhite } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 1.0, fill: { color: C.primary }, line: { color: C.primary } });
  rail(slide);
  eyebrow(slide, eb, 0.35, 0.18, C.accent);
  slide.addText(title, { x: 0.35, y: 0.44, w: 9.3, h: 0.48, fontSize: 22, bold: true, color: C.white, fontFace: FONT, valign: "middle" });
}

// ════════════════════════════════════════════════════════════════
// 1 - Cover
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.primary }, line: { color: C.primary } });
  rail(s);
  // decorative geometric corner
  s.addShape(pres.shapes.RECTANGLE, { x: 7.7, y: 0, w: 2.3, h: 1.9, fill: { color: C.navy }, line: { color: C.navy } });
  s.addShape(pres.shapes.OVAL, { x: 8.15, y: 0.32, w: 0.55, h: 0.55, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pres.shapes.OVAL, { x: 8.95, y: 0.78, w: 0.32, h: 0.32, fill: { color: C.light }, line: { color: C.light } });
  eyebrow(s, "[  CLIENT ONBOARDING   |   AI READINESS COMPASS  ]", 0.35, 0.32, C.accent);
  s.addText("AI Readiness\nCompass", { x: 0.35, y: 1.25, w: 9, h: 2.3, fontSize: 46, bold: true, color: C.white, fontFace: FONT, valign: "middle", lineSpacingMultiple: 0.95 });
  s.addText("Your access, and how it works - a step-by-step guide for your team.", { x: 0.37, y: 3.7, w: 7.6, h: 0.6, fontSize: 15, italic: true, color: C.light, fontFace: FONT });
  // chips
  const chips = ["A code for each person", "~10 minutes", "Bilingual EN / AR", "Private to you"];
  let cx = 0.37;
  chips.forEach((t) => {
    const cw = 0.30 + t.length * 0.092;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 4.45, w: cw, h: 0.4, rectRadius: 0.2, fill: { color: C.navy }, line: { color: C.accent, width: 0.75 } });
    s.addText(t, { x: cx, y: 4.45, w: cw, h: 0.4, fontSize: 10, color: C.light, fontFace: FONT, align: "center", valign: "middle" });
    cx += cw + 0.18;
  });
  s.addText("caliber.viftraining.com", { x: 0.37, y: 5.05, w: 5, h: 0.3, fontSize: 11, color: C.accent, fontFace: FONT });
}

// ════════════════════════════════════════════════════════════════
// 2 - What is the Compass (split panel)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 3.9, h: H, fill: { color: C.primary }, line: { color: C.primary } });
  s.addShape(pres.shapes.RECTANGLE, { x: 3.9, y: 0, w: 6.1, h: H, fill: { color: C.offWhite }, line: { color: C.offWhite } });
  rail(s);
  eyebrow(s, "[  THE INSTRUMENT  ]", 0.35, 0.3, C.accent);
  s.addText("What is the\nAI Readiness\nCompass?", { x: 0.35, y: 1.0, w: 3.3, h: 2.0, fontSize: 26, bold: true, color: C.white, fontFace: FONT, lineSpacingMultiple: 1.0 });
  s.addText("A short, confidential self-check that shows each person where they stand on working effectively with AI.", { x: 0.35, y: 3.25, w: 3.3, h: 1.5, fontSize: 12.5, italic: true, color: C.light, fontFace: FONT, wrap: true });

  const points = [
    ["Quick and self-served", "About 10 minutes, online, no account and nothing to install."],
    ["Bilingual", "Take it in English or Arabic - switch at any time."],
    ["Private to you", "Your results are yours. This is for development, not a pass / fail test."],
    ["Practical, not theoretical", "It looks at how you actually work with AI day to day."],
  ];
  let py = 0.65;
  points.forEach((p, i) => {
    s.addShape(pres.shapes.OVAL, { x: 4.2, y: py, w: 0.44, h: 0.44, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(`${i + 1}`, { x: 4.2, y: py, w: 0.44, h: 0.44, fontSize: 13, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(p[0], { x: 4.8, y: py - 0.02, w: 4.9, h: 0.34, fontSize: 14.5, bold: true, color: C.primary, fontFace: FONT });
    s.addText(p[1], { x: 4.8, y: py + 0.34, w: 4.9, h: 0.62, fontSize: 12, color: C.text, fontFace: FONT, wrap: true });
    py += 1.13;
  });
  footer(s, 2);
}

// ════════════════════════════════════════════════════════════════
// 3 - What you've received (stat)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  YOUR ACCESS  ]", "What you receive");
  // big stat card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.35, y: 1.3, w: 3.4, h: 3.5, rectRadius: 0.12, fill: { color: C.primary }, line: { color: C.primary }, shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 135, opacity: 0.12 } });
  s.addText("1", { x: 0.35, y: 1.55, w: 3.4, h: 1.5, fontSize: 96, bold: true, color: C.accent, fontFace: FONT, align: "center", valign: "middle" });
  s.addText("code per person", { x: 0.35, y: 3.05, w: 3.4, h: 0.5, fontSize: 16, bold: true, color: C.white, fontFace: FONT, align: "center" });
  s.addText("Personal to you.\nEach single-use.", { x: 0.35, y: 3.6, w: 3.4, h: 0.9, fontSize: 12.5, color: C.light, fontFace: FONT, align: "center", wrap: true });

  const rights = [
    ["A one-click invitation", "Each delegate receives a personal email from VIFM with their code and a direct link - no code to type, no sign-up."],
    ["VIFM handles delivery", "We send the invitations and resend on request. your team does not need to manage codes."],
    ["Works on any device", "Phone, tablet, or laptop. Nothing to install."],
  ];
  let ry = 1.35;
  rights.forEach((r) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.05, y: ry, w: 5.6, h: 1.05, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 } });
    s.addText(r[0], { x: 4.3, y: ry + 0.14, w: 5.2, h: 0.34, fontSize: 14.5, bold: true, color: C.primary, fontFace: FONT });
    s.addText(r[1], { x: 4.3, y: ry + 0.48, w: 5.2, h: 0.5, fontSize: 11.5, color: C.text, fontFace: FONT, wrap: true });
    ry += 1.18;
  });
  footer(s, 3);
}

// ════════════════════════════════════════════════════════════════
// 4 - The journey at a glance (process flow)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  THE PROCESS  ]", "The journey at a glance");
  const steps = [
    ["1", "Get your invite", "A personal email from VIFM with your link."],
    ["2", "One click", "Open the link - your details are pre-filled."],
    ["3", "Confirm", "Check your name and press Start."],
    ["4", "Take it", "~24 short questions, about 10 minutes."],
    ["5", "Your results", "On screen instantly + emailed PDF."],
  ];
  const n = steps.length;
  const cardW = 1.74, gap = 0.13, startX = 0.34, y = 1.6, cardH = 2.7;
  steps.forEach((st, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cardW, h: cardH, rectRadius: 0.1, fill: { color: C.primary }, line: { color: C.primary }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    s.addShape(pres.shapes.OVAL, { x: x + cardW / 2 - 0.33, y: y + 0.28, w: 0.66, h: 0.66, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(st[0], { x: x + cardW / 2 - 0.33, y: y + 0.28, w: 0.66, h: 0.66, fontSize: 22, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(st[1], { x: x + 0.1, y: y + 1.08, w: cardW - 0.2, h: 0.6, fontSize: 13.5, bold: true, color: C.white, fontFace: FONT, align: "center", wrap: true });
    s.addText(st[2], { x: x + 0.12, y: y + 1.66, w: cardW - 0.24, h: 0.9, fontSize: 10.5, color: C.light, fontFace: FONT, align: "center", wrap: true });
    if (i < n - 1) {
      s.addText(">", { x: x + cardW - 0.02, y: y + 0.95, w: gap + 0.04, h: 0.4, fontSize: 16, bold: true, color: C.accent, fontFace: FONT, align: "center", valign: "middle" });
    }
  });
  s.addText("Every step is self-served and takes one sitting. No training required.", { x: 0.34, y: 4.7, w: 9.3, h: 0.4, fontSize: 12, italic: true, color: C.navy, fontFace: FONT, align: "center" });
  footer(s, 4);
}

// ════════════════════════════════════════════════════════════════
// 5 - Step 1: invitation (email mock)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  STEP 1  ]", "Your invitation arrives by email");
  // left guidance
  const pts = [
    ["From VIFM", "The email comes from the VIFM AI Readiness Compass."],
    ["Your personal link", "A one-click button takes you straight in."],
    ["Your access code", "Included as a backup - you rarely need to type it."],
    ["Check spam once", "If it is not in your inbox, look in junk / spam."],
  ];
  let yy = 1.4;
  pts.forEach((p) => {
    s.addShape(pres.shapes.OVAL, { x: 0.4, y: yy, w: 0.4, h: 0.4, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText("•", { x: 0.4, y: yy - 0.04, w: 0.4, h: 0.4, fontSize: 18, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(p[0], { x: 0.95, y: yy - 0.02, w: 4.0, h: 0.34, fontSize: 14.5, bold: true, color: C.primary, fontFace: FONT });
    s.addText(p[1], { x: 0.95, y: yy + 0.32, w: 4.0, h: 0.55, fontSize: 11.5, color: C.text, fontFace: FONT, wrap: true });
    yy += 0.92;
  });
  // right: email mock card
  const ex = 5.25, ey = 1.35, ew = 4.4, eh = 3.45;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ex, y: ey, w: ew, h: eh, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.12 } });
  s.addShape(pres.shapes.RECTANGLE, { x: ex, y: ey, w: ew, h: 0.62, fill: { color: C.primary }, line: { color: C.primary } });
  s.addText("VIFM AI Readiness Compass", { x: ex + 0.2, y: ey + 0.06, w: ew - 0.4, h: 0.24, fontSize: 11, bold: true, color: C.white, fontFace: FONT });
  s.addText("Your AI Readiness Compass access", { x: ex + 0.2, y: ey + 0.3, w: ew - 0.4, h: 0.26, fontSize: 9.5, color: C.light, fontFace: FONT });
  s.addText("Dear delegate,\n\nYou have been invited to take the AI Readiness Compass - a short, confidential assessment.", { x: ex + 0.25, y: ey + 0.78, w: ew - 0.5, h: 1.1, fontSize: 11, color: C.text, fontFace: FONT, wrap: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ex + 0.25, y: ey + 2.0, w: 2.5, h: 0.55, rectRadius: 0.1, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText("Start your assessment", { x: ex + 0.25, y: ey + 2.0, w: 2.5, h: 0.55, fontSize: 12, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
  s.addText("Access code:  VIFM-ARC-XXXX-XXXX", { x: ex + 0.25, y: ey + 2.75, w: ew - 0.5, h: 0.3, fontSize: 10, color: C.textMute, fontFace: FONT });
  footer(s, 5);
}

// ════════════════════════════════════════════════════════════════
// 6 - Step 2: one-click start (form mock)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  STEP 2  ]", "One click - we pre-fill the rest");
  const pts = [
    ["The link opens the start page", "caliber.viftraining.com/ara/redeem"],
    ["Code, email and company pre-filled", "Carried in from your invitation - nothing to look up."],
    ["Just confirm your name", "Then press Start. That is the whole sign-in."],
    ["No password, no account", "You go straight into the assessment."],
  ];
  let yy = 1.4;
  pts.forEach((p) => {
    s.addShape(pres.shapes.OVAL, { x: 0.4, y: yy, w: 0.4, h: 0.4, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText("•", { x: 0.4, y: yy - 0.04, w: 0.4, h: 0.4, fontSize: 18, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(p[0], { x: 0.95, y: yy - 0.02, w: 4.0, h: 0.34, fontSize: 14, bold: true, color: C.primary, fontFace: FONT });
    s.addText(p[1], { x: 0.95, y: yy + 0.32, w: 4.0, h: 0.55, fontSize: 11.5, color: C.text, fontFace: FONT, wrap: true });
    yy += 0.92;
  });
  // form mock
  const fx = 5.25, fy = 1.35, fw = 4.4, fh = 3.5;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: fy, w: fw, h: fh, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.12 } });
  s.addText("AI Readiness Compass", { x: fx + 0.3, y: fy + 0.22, w: fw - 0.6, h: 0.3, fontSize: 13, bold: true, color: C.primary, fontFace: FONT });
  const fields = [
    ["Voucher code", "VIFM-ARC-7K3M-9QX2", true],
    ["Email", "you@yourcompany.com", true],
    ["Company", "Your company", true],
    ["Full name", "type your name", false],
  ];
  let fyy = fy + 0.65;
  fields.forEach((f) => {
    s.addText(f[0], { x: fx + 0.3, y: fyy, w: fw - 0.6, h: 0.22, fontSize: 9.5, color: C.textMute, fontFace: FONT });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx + 0.3, y: fyy + 0.24, w: fw - 0.6, h: 0.4, rectRadius: 0.05, fill: { color: f[2] ? C.offWhite : C.white }, line: { color: f[2] ? C.pale : C.accent, width: 1 } });
    s.addText(f[1], { x: fx + 0.42, y: fyy + 0.24, w: fw - 0.8, h: 0.4, fontSize: 11, color: f[2] ? C.text : C.textMute, fontFace: FONT, valign: "middle", italic: !f[2] });
    if (f[2]) s.addText("pre-filled", { x: fx + fw - 1.35, y: fyy, w: 1.05, h: 0.22, fontSize: 8, color: C.accent, fontFace: FONT, align: "right", bold: true });
    fyy += 0.7;
  });
  footer(s, 6);
}

// ════════════════════════════════════════════════════════════════
// 7 - Step 3: the assessment (stats)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  STEP 3  ]", "Take the assessment");
  const stats = [
    ["~10", "minutes", "In one sitting."],
    ["~24", "short questions", "Quick to answer."],
    ["2", "languages", "English or Arabic."],
    ["4", "factors", "See the next slide."],
  ];
  const sw = 2.27, sgap = 0.12, sx0 = 0.34, sy = 1.35, sh = 1.85;
  stats.forEach((st, i) => {
    const x = sx0 + i * (sw + sgap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: sy, w: sw, h: sh, rectRadius: 0.1, fill: { color: C.primary }, line: { color: C.primary }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    s.addText(st[0], { x, y: sy + 0.18, w: sw, h: 0.85, fontSize: 44, bold: true, color: C.accent, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(st[1], { x, y: sy + 1.0, w: sw, h: 0.32, fontSize: 13, bold: true, color: C.white, fontFace: FONT, align: "center" });
    s.addText(st[2], { x: x + 0.1, y: sy + 1.34, w: sw - 0.2, h: 0.42, fontSize: 10, color: C.light, fontFace: FONT, align: "center", wrap: true });
  });
  // reassurance band
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.34, y: 3.5, w: 9.32, h: 1.25, rectRadius: 0.1, fill: { color: C.pale }, line: { color: C.pale } });
  s.addText("It is a self-reflection, not a test.", { x: 0.6, y: 3.62, w: 9, h: 0.4, fontSize: 15, bold: true, color: C.primary, fontFace: FONT });
  s.addText("There are no trick questions and no pass / fail. Answer honestly about how you work with AI today - that is what makes your results useful. Your answers are private to you.", { x: 0.6, y: 4.02, w: 9, h: 0.66, fontSize: 12, color: C.text, fontFace: FONT, wrap: true });
  footer(s, 7);
}

// ════════════════════════════════════════════════════════════════
// 8 - The four factors (2x2)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.primary }, line: { color: C.primary } });
  rail(s);
  eyebrow(s, "[  WHAT IT MEASURES  ]", 0.35, 0.22, C.accent);
  s.addText("The four factors", { x: 0.35, y: 0.5, w: 9.3, h: 0.5, fontSize: 22, bold: true, color: C.white, fontFace: FONT });
  const factors = [
    ["THINKING", "AI Sense-Check", "You treat AI output as a draft to verify, not a finished answer - testing claims and catching confidently-wrong facts.", "5391D5"],
    ["RESULTS", "AI Working Practice", "You build AI into how you already work - clear prompts, iterating, folding it into recurring tasks.", "047857"],
    ["PEOPLE", "AI Collaboration", "You help the team move with AI - explaining what it can and can't do, and pushing back on blind trust.", "C2410C"],
    ["SELF", "AI Adaptive Mindset", "You stay open as AI changes the work - relearning, asking where models fail, keeping policy in view.", "6D28D9"],
  ];
  const fw = 4.56, fh = 1.75, fgx = 0.3, fgy = 0.2, fx0 = 0.35, fy0 = 1.15;
  factors.forEach((f, i) => {
    const x = fx0 + (i % 2) * (fw + fgx), y = fy0 + Math.floor(i / 2) * (fh + fgy);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: fw, h: fh, rectRadius: 0.1, fill: { color: C.navy }, line: { color: C.navy }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.12 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.3, w: 0.5, h: 0.5, fill: { color: f[3] }, line: { color: f[3] } });
    s.addText(f[0], { x: x + 0.95, y: y + 0.2, w: fw - 1.1, h: 0.3, fontSize: 9, bold: true, color: f[3], fontFace: FONT, charSpacing: 2 });
    s.addText(f[1], { x: x + 0.95, y: y + 0.46, w: fw - 1.1, h: 0.4, fontSize: 16, bold: true, color: C.white, fontFace: FONT });
    s.addText(f[2], { x: x + 0.25, y: y + 0.95, w: fw - 0.5, h: 0.72, fontSize: 11, color: C.light, fontFace: FONT, wrap: true });
  });
  s.addText("Mapped to VIFM's behavioural framework: Thinking, Results, People, Self.", { x: 0.35, y: 4.95, w: 9.3, h: 0.35, fontSize: 11, italic: true, color: C.light, fontFace: FONT, align: "center" });
  footer(s, 8, true);
}

// ════════════════════════════════════════════════════════════════
// 9 - Step 4: your results
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  STEP 4  ]", "Your results, instantly");
  const cards = [
    ["On screen", "The moment you finish, your results appear - your profile across the four factors, with what each means for you."],
    ["By email, with PDF", "We email you a copy with the results PDF attached, so you can keep it and share it if you choose."],
    ["A page you can return to", "Your results page is bookmarkable - come back to it any time from the link in your email."],
  ];
  const cw = 3.04, cgap = 0.1, cx0 = 0.34, cy = 1.35, ch = 2.7;
  cards.forEach((c, i) => {
    const x = cx0 + i * (cw + cgap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: cy, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: cy + 0.28, w: 0.6, h: 0.6, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(`${i + 1}`, { x: x + 0.25, y: cy + 0.28, w: 0.6, h: 0.6, fontSize: 20, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(c[0], { x: x + 0.25, y: cy + 1.0, w: cw - 0.5, h: 0.45, fontSize: 15, bold: true, color: C.primary, fontFace: FONT });
    s.addText(c[1], { x: x + 0.25, y: cy + 1.45, w: cw - 0.5, h: 1.1, fontSize: 11.5, color: C.text, fontFace: FONT, wrap: true });
  });
  s.addText("No waiting, no follow-up needed - the delegate has their result before they close the tab.", { x: 0.34, y: 4.7, w: 9.3, h: 0.4, fontSize: 12, italic: true, color: C.navy, fontFace: FONT, align: "center" });
  footer(s, 9);
}

// ════════════════════════════════════════════════════════════════
// 10 - What the results tell you
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  YOUR REPORT  ]", "What your results tell you");
  const rows = [
    ["A profile across the four factors", "Where you are strong with AI today, and where there is room to grow - factor by factor."],
    ["Plain-language guidance", "Each factor comes with a short read on what it means and practical pointers to develop it."],
    ["Development, not judgement", "There is no score to pass. It is a personal baseline to build from."],
    ["Private to you", "Your individual report is yours. Your organisation and VIFM see completion and an anonymised group picture - not your answers."],
  ];
  let yy = 1.35;
  rows.forEach((r, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.35, y: yy, w: 9.3, h: 0.82, rectRadius: 0.08, fill: { color: i % 2 ? C.white : C.pale }, line: { color: C.pale, width: 1 } });
    s.addShape(pres.shapes.OVAL, { x: 0.55, y: yy + 0.21, w: 0.4, h: 0.4, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(`${i + 1}`, { x: 0.55, y: yy + 0.21, w: 0.4, h: 0.4, fontSize: 12, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(r[0], { x: 1.15, y: yy + 0.1, w: 3.4, h: 0.62, fontSize: 13.5, bold: true, color: C.primary, fontFace: FONT, valign: "middle" });
    s.addText(r[1], { x: 4.65, y: yy + 0.1, w: 4.85, h: 0.62, fontSize: 11.5, color: C.text, fontFace: FONT, valign: "middle", wrap: true });
    yy += 0.9;
  });
  footer(s, 10);
}

// ════════════════════════════════════════════════════════════════
// 11 - For the coordinator
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  FOR THE COORDINATOR  ]", "Running this for your team");
  const items = [
    ["We send the invitations", "Share your delegates' names and emails with VIFM, and we email each a personal one-click link. No code-handling for you."],
    ["Track completion", "You receive a simple view of who has started and who has finished, by company - no spreadsheets."],
    ["An aggregated readout", "When the group is done, VIFM can share an anonymised picture of where the team stands - plus optional next steps."],
    ["Zero admin overhead", "No software, no licences to manage, no accounts to create for delegates."],
  ];
  const cw = 4.56, ch = 1.55, cgx = 0.3, cgy = 0.2, cx0 = 0.35, cy0 = 1.3;
  items.forEach((it, i) => {
    const x = cx0 + (i % 2) * (cw + cgx), y = cy0 + Math.floor(i / 2) * (ch + cgy);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: y + 0.22, w: 0.5, h: 0.5, fill: { color: C.primary }, line: { color: C.primary } });
    s.addText(`${i + 1}`, { x: x + 0.22, y: y + 0.22, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.accent, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(it[0], { x: x + 0.85, y: y + 0.2, w: cw - 1.05, h: 0.34, fontSize: 14, bold: true, color: C.primary, fontFace: FONT });
    s.addText(it[1], { x: x + 0.85, y: y + 0.56, w: cw - 1.05, h: 0.9, fontSize: 11, color: C.text, fontFace: FONT, wrap: true });
  });
  footer(s, 11);
}

// ════════════════════════════════════════════════════════════════
// 12 - Privacy & confidentiality
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.navy }, line: { color: C.navy } });
  rail(s);
  eyebrow(s, "[  PRIVACY & CONFIDENTIALITY  ]", 0.35, 0.4, C.light);
  s.addText("Your answers stay yours", { x: 0.35, y: 0.75, w: 9.3, h: 0.6, fontSize: 26, bold: true, color: C.white, fontFace: FONT });
  const items = [
    ["Individual results are private", "Your personal report is visible to you. It is not shared with managers as an individual scorecard."],
    ["For development, not selection", "This is a readiness baseline - not a hiring, promotion, or performance decision."],
    ["GCC-tuned", "Built for the region and aligned to UAE and Saudi expectations, bilingual throughout."],
  ];
  let yy = 1.75;
  items.forEach((it) => {
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: yy, w: 0.5, h: 0.5, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText("✓", { x: 0.5, y: yy, w: 0.5, h: 0.5, fontSize: 18, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(it[0], { x: 1.2, y: yy - 0.02, w: 8.3, h: 0.36, fontSize: 16, bold: true, color: C.white, fontFace: FONT });
    s.addText(it[1], { x: 1.2, y: yy + 0.36, w: 8.3, h: 0.6, fontSize: 12.5, color: C.light, fontFace: FONT, wrap: true });
    yy += 1.05;
  });
  footer(s, 12, true);
}

// ════════════════════════════════════════════════════════════════
// 13 - Timeline / next steps
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  contentHeader(s, "[  WHAT HAPPENS NEXT  ]", "From here to results");
  const steps = [
    ["Now", "Codes issued", "Your access codes are ready to send."],
    ["This week", "Invitations sent", "VIFM emails each delegate their one-click link."],
    ["~2 weeks", "Delegates complete", "Each person takes ~10 minutes, whenever suits them."],
    ["After", "Group readout", "VIFM shares an anonymised picture + next steps."],
  ];
  const cardW = 2.2, gap = 0.18, startX = 0.4, y = 1.55, cardH = 2.6;
  steps.forEach((st, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cardW, h: cardH, rectRadius: 0.1, fill: { color: i === 0 ? C.accent : C.primary }, line: { color: i === 0 ? C.accent : C.primary }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    s.addText(st[0].toUpperCase(), { x: x + 0.2, y: y + 0.25, w: cardW - 0.4, h: 0.3, fontSize: 10, bold: true, color: i === 0 ? C.primary : C.accent, fontFace: FONT, charSpacing: 2 });
    s.addText(st[1], { x: x + 0.2, y: y + 0.62, w: cardW - 0.4, h: 0.7, fontSize: 15, bold: true, color: C.white, fontFace: FONT, wrap: true });
    s.addText(st[2], { x: x + 0.2, y: y + 1.45, w: cardW - 0.4, h: 1.0, fontSize: 11, color: i === 0 ? C.primary : C.light, fontFace: FONT, wrap: true });
    if (i < steps.length - 1) s.addText(">", { x: x + cardW - 0.04, y: y + 1.0, w: gap + 0.08, h: 0.4, fontSize: 18, bold: true, color: C.navy, fontFace: FONT, align: "center", valign: "middle" });
  });
  s.addText("Timeline is indicative and flexes to your schedule.", { x: 0.4, y: 4.6, w: 9.2, h: 0.4, fontSize: 11.5, italic: true, color: C.navy, fontFace: FONT, align: "center" });
  footer(s, 13);
}

// ════════════════════════════════════════════════════════════════
// 14 - Support & contact (closing)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.primary }, line: { color: C.primary } });
  rail(s);
  s.addShape(pres.shapes.RECTANGLE, { x: 7.7, y: 3.7, w: 2.3, h: 1.925, fill: { color: C.navy }, line: { color: C.navy } });
  s.addShape(pres.shapes.OVAL, { x: 8.95, y: 4.75, w: 0.55, h: 0.55, fill: { color: C.accent }, line: { color: C.accent } });
  eyebrow(s, "[  WE ARE HERE TO HELP  ]", 0.35, 0.75, C.accent);
  s.addText("Welcome to your\nAI Readiness Compass", { x: 0.35, y: 1.15, w: 9, h: 1.6, fontSize: 34, bold: true, color: C.white, fontFace: FONT, lineSpacingMultiple: 1.0 });
  s.addText("Any questions before you begin? Reach the VIFM team:", { x: 0.37, y: 2.95, w: 8, h: 0.4, fontSize: 14, italic: true, color: C.light, fontFace: FONT });
  const contacts = [
    ["Email", "courses@viftraining.com"],
    ["Phone", "+9714 436 5820"],
    ["Web", "caliber.viftraining.com"],
  ];
  let yy = 3.6;
  contacts.forEach((c) => {
    s.addText(c[0].toUpperCase(), { x: 0.4, y: yy, w: 1.3, h: 0.34, fontSize: 10, bold: true, color: C.accent, fontFace: FONT, charSpacing: 2, valign: "middle" });
    s.addText(c[1], { x: 1.7, y: yy, w: 6, h: 0.34, fontSize: 15, bold: true, color: C.white, fontFace: FONT, valign: "middle" });
    yy += 0.5;
  });
  s.addText("Virginia Institute of Finance and Management", { x: 0.37, y: 5.2, w: 7, h: 0.3, fontSize: 9, color: C.light, fontFace: FONT });
}

pres.writeFile({ fileName: "VIFM-ARC-Client-Onboarding.pptx" }).then((fn) => {
  console.log("Wrote", fn);
});
