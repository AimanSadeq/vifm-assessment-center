/**
 * ARC client ONBOARDING deck (.pptx) - generic / reusable for any client.
 * Styled to match the VIFM NUPCO proposal deck: off-white slides with a dark
 * title band, left accent rail, icon-in-circle cards, and the NUPCO footer
 * (section tag chip + running footer + page number). Reuses the VIFM icon set
 * (scripts/assets/arc-icons/imageN.png) extracted from that deck.
 *
 * Scope: the voucher -> individual AI Readiness Compass journey, start to finish.
 * Run:  npm install --no-save pptxgenjs && node scripts/build-arc-client-onboarding-deck.js
 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const C = {
  primary: "010131", navy: "1A3A6B", accent: "5391D5", light: "A8C4E5",
  pale: "D0DFF4", iceberg: "EDF1F5", offWhite: "F5F7FA", white: "FFFFFF",
  text: "1E293B", textMute: "64748B", green: "00843D",
};
const FONT = "Open Sans";
const W = 10, H = 5.625, BAND = 0.86, RAIL = 0.18;

// VIFM icon set (white glyphs unless noted). image2 = VIFM mark.
const I = {
  compass: 21, book: 5, bulb: 20, globe: 6, clip: 4, people: 16, peopleBlue: 7,
  target: 3, search: 10, pen: 11, check: 14, arrow: 15, calendar: 17,
  shield: 13, translate: 19, handshake: 22, flag: 23, vifm: 2, badge: 12,
};
const icon = (n) => path.join(__dirname, "assets/arc-icons", `image${n}.png`);

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "VIFM";
pres.company = "Virginia Institute of Finance and Management";
pres.title = "AI Readiness Compass - Client Onboarding";

const S = pres.shapes;

// ── chrome ──────────────────────────────────────────────────────
function rail(s) { s.addShape(S.RECTANGLE, { x: 0, y: 0, w: RAIL, h: H, fill: { color: C.accent }, line: { color: C.accent } }); }

function footer(s, tag, page, dark = false) {
  const chipW = 0.36 + tag.length * 0.082;
  s.addShape(S.ROUNDED_RECTANGLE, { x: 0.4, y: 5.33, w: chipW, h: 0.26, rectRadius: 0.04, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText(tag, { x: 0.4, y: 5.33, w: chipW, h: 0.26, fontSize: 8, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle", charSpacing: 1 });
  s.addText("VIFM   |   AI Readiness Compass", { x: 0.4 + chipW + 0.16, y: 5.33, w: 6, h: 0.26, fontSize: 8, color: dark ? C.light : C.textMute, fontFace: FONT, valign: "middle" });
  s.addText(String(page), { x: 9.1, y: 5.33, w: 0.5, h: 0.26, fontSize: 8, color: dark ? C.light : C.textMute, fontFace: FONT, align: "right", valign: "middle" });
}

function chrome(s, eyebrow, title) {
  s.addShape(S.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.offWhite }, line: { color: C.offWhite } });
  s.addShape(S.RECTANGLE, { x: 0, y: 0, w: W, h: BAND, fill: { color: C.primary }, line: { color: C.primary } });
  s.addShape(S.RECTANGLE, { x: 0, y: BAND, w: W, h: 0.04, fill: { color: C.accent }, line: { color: C.accent } });
  rail(s);
  s.addText(eyebrow, { x: 0.38, y: 0.13, w: 9, h: 0.26, fontSize: 9, bold: true, color: C.accent, fontFace: FONT, charSpacing: 3 });
  s.addText(title, { x: 0.38, y: 0.38, w: 9.2, h: 0.44, fontSize: 23, bold: true, color: C.white, fontFace: FONT, valign: "middle" });
}

function iconCircle(s, x, y, d, n, circle) {
  const cc = circle || C.accent;
  s.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color: cc }, line: { color: cc } });
  const id = d * 0.54;
  s.addImage({ path: icon(n), x: x + (d - id) / 2, y: y + (d - id) / 2, w: id, h: id });
}

// ════════════════════════════════════════════ 1 - Cover
{
  const s = pres.addSlide();
  s.addShape(S.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.primary }, line: { color: C.primary } });
  rail(s);
  s.addShape(S.RECTANGLE, { x: 7.55, y: 0, w: 2.45, h: 2.05, fill: { color: C.navy }, line: { color: C.navy } });
  iconCircle(s, 8.35, 0.55, 0.95, I.compass, C.accent);
  s.addText("[  CLIENT ONBOARDING   |   AI READINESS COMPASS  ]", { x: 0.4, y: 0.34, w: 7, h: 0.28, fontSize: 9, bold: true, color: C.accent, fontFace: FONT, charSpacing: 3 });
  s.addText("AI Readiness\nCompass", { x: 0.4, y: 1.3, w: 9, h: 2.2, fontSize: 46, bold: true, color: C.white, fontFace: FONT, valign: "middle", lineSpacingMultiple: 0.95 });
  s.addText("Your access, and how it works - a step-by-step guide for your team.", { x: 0.42, y: 3.65, w: 7.4, h: 0.5, fontSize: 15, italic: true, color: C.light, fontFace: FONT });
  const chips = ["A code for each person", "~10 minutes", "Bilingual EN / AR", "Private to you"];
  let cx = 0.42;
  chips.forEach((t) => {
    const cw = 0.34 + t.length * 0.094;
    s.addShape(S.ROUNDED_RECTANGLE, { x: cx, y: 4.45, w: cw, h: 0.42, rectRadius: 0.21, fill: { color: C.navy }, line: { color: C.accent, width: 0.75 } });
    s.addText(t, { x: cx, y: 4.45, w: cw, h: 0.42, fontSize: 10, color: C.light, fontFace: FONT, align: "center", valign: "middle" });
    cx += cw + 0.18;
  });
  s.addText("caliber.viftraining.com", { x: 0.42, y: 5.08, w: 5, h: 0.3, fontSize: 11, color: C.accent, fontFace: FONT });
}

// ════════════════════════════════════════════ 2 - What is the Compass
{
  const s = pres.addSlide();
  chrome(s, "[  THE INSTRUMENT  ]", "What is the AI Readiness Compass?");
  s.addText("A short, confidential self-check that shows each person where they stand on working effectively with AI.", { x: 0.42, y: 1.06, w: 9.2, h: 0.6, fontSize: 14, italic: true, color: C.navy, fontFace: FONT, wrap: true });
  const rows = [
    [I.calendar, "Quick and self-served", "About 10 minutes, online. No account, nothing to install."],
    [I.translate, "Bilingual", "Take it in English or Arabic, and switch at any time."],
    [I.shield, "Private to you", "Your results are yours. For development - not a pass / fail test."],
    [I.target, "Practical, not theoretical", "It looks at how you actually work with AI day to day."],
  ];
  const cw = 4.55, ch = 1.45, gx = 0.3, gy = 0.2, x0 = 0.4, y0 = 1.8;
  rows.forEach((r, i) => {
    const x = x0 + (i % 2) * (cw + gx), y = y0 + Math.floor(i / 2) * (ch + gy);
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 } });
    iconCircle(s, x + 0.24, y + 0.26, 0.62, r[0], C.accent);
    s.addText(r[1], { x: x + 1.04, y: y + 0.24, w: cw - 1.2, h: 0.4, fontSize: 14.5, bold: true, color: C.primary, fontFace: FONT, valign: "middle" });
    s.addText(r[2], { x: x + 1.04, y: y + 0.68, w: cw - 1.2, h: 0.65, fontSize: 11.5, color: C.text, fontFace: FONT, wrap: true });
  });
  footer(s, "OVERVIEW", 2);
}

// ════════════════════════════════════════════ 3 - What you receive
{
  const s = pres.addSlide();
  chrome(s, "[  YOUR ACCESS  ]", "What you receive");
  s.addShape(S.ROUNDED_RECTANGLE, { x: 0.4, y: 1.3, w: 3.2, h: 3.4, rectRadius: 0.12, fill: { color: C.primary }, line: { color: C.primary }, shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 135, opacity: 0.12 } });
  iconCircle(s, 1.5, 1.6, 1.0, I.badge, C.accent);
  s.addText("1 code", { x: 0.4, y: 2.75, w: 3.2, h: 0.6, fontSize: 30, bold: true, color: C.white, fontFace: FONT, align: "center" });
  s.addText("per person", { x: 0.4, y: 3.32, w: 3.2, h: 0.4, fontSize: 15, bold: true, color: C.accent, fontFace: FONT, align: "center" });
  s.addText("Single-use and personal to each delegate.", { x: 0.55, y: 3.8, w: 2.9, h: 0.7, fontSize: 11.5, color: C.light, fontFace: FONT, align: "center", wrap: true });

  const rights = [
    [I.globe, "A one-click invitation", "Each delegate gets a personal email with their code and a direct link - no code to type, no sign-up."],
    [I.handshake, "VIFM handles delivery", "We send the invitations and resend on request. Your team does not manage codes."],
    [I.check, "Works on any device", "Phone, tablet, or laptop. Nothing to install."],
  ];
  let ry = 1.32;
  rights.forEach((r) => {
    s.addShape(S.ROUNDED_RECTANGLE, { x: 3.95, y: ry, w: 5.7, h: 1.06, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 } });
    iconCircle(s, 4.15, ry + 0.23, 0.6, r[0], r[0] === I.check ? C.white : C.accent);
    s.addText(r[1], { x: 4.95, y: ry + 0.15, w: 4.55, h: 0.34, fontSize: 14, bold: true, color: C.primary, fontFace: FONT });
    s.addText(r[2], { x: 4.95, y: ry + 0.49, w: 4.55, h: 0.5, fontSize: 11, color: C.text, fontFace: FONT, wrap: true });
    ry += 1.18;
  });
  footer(s, "ACCESS", 3);
}

// ════════════════════════════════════════════ 4 - Journey at a glance
{
  const s = pres.addSlide();
  chrome(s, "[  THE PROCESS  ]", "The journey at a glance");
  const steps = [
    [I.globe, "Get your invite", "A personal email from VIFM with your link."],
    [I.compass, "One click", "Open the link - your details are pre-filled."],
    [I.clip, "Confirm", "Check your name and press Start."],
    [I.pen, "Take it", "~24 short questions, about 10 minutes."],
    [I.check, "Your results", "On screen instantly, plus an emailed PDF."],
  ];
  const cw = 1.74, gap = 0.13, x0 = 0.34, y = 1.55, ch = 3.0;
  steps.forEach((st, i) => {
    const x = x0 + i * (cw + gap);
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.primary }, line: { color: C.primary }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    iconCircle(s, x + cw / 2 - 0.34, y + 0.3, 0.68, st[0], i === 4 ? C.white : C.accent);
    s.addText(`0${i + 1}`, { x, y: y + 1.06, w: cw, h: 0.3, fontSize: 11, bold: true, color: C.accent, fontFace: FONT, align: "center", charSpacing: 2 });
    s.addText(st[1], { x: x + 0.1, y: y + 1.38, w: cw - 0.2, h: 0.55, fontSize: 13.5, bold: true, color: C.white, fontFace: FONT, align: "center", wrap: true });
    s.addText(st[2], { x: x + 0.12, y: y + 1.95, w: cw - 0.24, h: 0.95, fontSize: 10.5, color: C.light, fontFace: FONT, align: "center", wrap: true });
    if (i < steps.length - 1) s.addText(">", { x: x + cw - 0.05, y: y + 1.05, w: gap + 0.1, h: 0.4, fontSize: 15, bold: true, color: C.accent, fontFace: FONT, align: "center", valign: "middle" });
  });
  s.addText("Every step is self-served and takes one sitting. No training required.", { x: 0.34, y: 4.78, w: 9.3, h: 0.38, fontSize: 12, italic: true, color: C.navy, fontFace: FONT, align: "center" });
  footer(s, "PROCESS", 4);
}

function stepWithMock(s, eyebrow, title, rows, drawMock, tag, page) {
  chrome(s, eyebrow, title);
  let yy = 1.4;
  rows.forEach((p) => {
    iconCircle(s, 0.4, yy, 0.56, p[0], C.accent);
    s.addText(p[1], { x: 1.1, y: yy - 0.02, w: 3.9, h: 0.34, fontSize: 14, bold: true, color: C.primary, fontFace: FONT });
    s.addText(p[2], { x: 1.1, y: yy + 0.32, w: 3.9, h: 0.55, fontSize: 11.5, color: C.text, fontFace: FONT, wrap: true });
    yy += 0.95;
  });
  drawMock(s);
  footer(s, tag, page);
}

// ════════════════════════════════════════════ 5 - Step 1: invitation
{
  const s = pres.addSlide();
  stepWithMock(s, "[  STEP 1  ]", "Your invitation arrives by email",
    [
      [I.globe, "From VIFM", "It comes from the VIFM AI Readiness Compass."],
      [I.compass, "Your personal link", "A one-click button takes you straight in."],
      [I.badge, "Your access code", "Included as a backup - you rarely type it."],
      [I.check, "Check spam once", "If it is not in your inbox, look in junk."],
    ],
    (sl) => {
      const ex = 5.3, ey = 1.4, ew = 4.35, eh = 3.4;
      sl.addShape(S.ROUNDED_RECTANGLE, { x: ex, y: ey, w: ew, h: eh, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.12 } });
      sl.addShape(S.RECTANGLE, { x: ex, y: ey, w: ew, h: 0.62, fill: { color: C.primary }, line: { color: C.primary } });
      sl.addText("VIFM AI Readiness Compass", { x: ex + 0.2, y: ey + 0.07, w: ew - 0.4, h: 0.24, fontSize: 11, bold: true, color: C.white, fontFace: FONT });
      sl.addText("Your AI Readiness Compass access", { x: ex + 0.2, y: ey + 0.31, w: ew - 0.4, h: 0.24, fontSize: 9.5, color: C.light, fontFace: FONT });
      sl.addText("Dear delegate,\n\nYou have been invited to take the AI Readiness Compass - a short, confidential assessment.", { x: ex + 0.25, y: ey + 0.8, w: ew - 0.5, h: 1.05, fontSize: 11, color: C.text, fontFace: FONT, wrap: true });
      sl.addShape(S.ROUNDED_RECTANGLE, { x: ex + 0.25, y: ey + 2.0, w: 2.5, h: 0.55, rectRadius: 0.1, fill: { color: C.accent }, line: { color: C.accent } });
      sl.addText("Start your assessment", { x: ex + 0.25, y: ey + 2.0, w: 2.5, h: 0.55, fontSize: 12, bold: true, color: C.white, fontFace: FONT, align: "center", valign: "middle" });
      sl.addText("Access code:  VIFM-ARC-XXXX-XXXX", { x: ex + 0.25, y: ey + 2.75, w: ew - 0.5, h: 0.3, fontSize: 10, color: C.textMute, fontFace: FONT });
    }, "STEP 1", 5);
}

// ════════════════════════════════════════════ 6 - Step 2: one-click start
{
  const s = pres.addSlide();
  stepWithMock(s, "[  STEP 2  ]", "One click - we pre-fill the rest",
    [
      [I.compass, "The link opens the start page", "caliber.viftraining.com/ara/redeem"],
      [I.clip, "Code, email, company pre-filled", "Carried in from your invitation."],
      [I.pen, "Just confirm your name", "Then press Start. That is the whole sign-in."],
      [I.check, "No password, no account", "You go straight into the assessment."],
    ],
    (sl) => {
      const fx = 5.3, fy = 1.4, fw = 4.35, fh = 3.45;
      sl.addShape(S.ROUNDED_RECTANGLE, { x: fx, y: fy, w: fw, h: fh, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.12 } });
      sl.addText("AI Readiness Compass", { x: fx + 0.3, y: fy + 0.2, w: fw - 0.6, h: 0.3, fontSize: 13, bold: true, color: C.primary, fontFace: FONT });
      const fields = [["Voucher code", "VIFM-ARC-7K3M-9QX2", true], ["Email", "you@yourcompany.com", true], ["Company", "Your company", true], ["Full name", "type your name", false]];
      let fyy = fy + 0.62;
      fields.forEach((f) => {
        sl.addText(f[0], { x: fx + 0.3, y: fyy, w: fw - 0.6, h: 0.2, fontSize: 9, color: C.textMute, fontFace: FONT });
        sl.addShape(S.ROUNDED_RECTANGLE, { x: fx + 0.3, y: fyy + 0.22, w: fw - 0.6, h: 0.38, rectRadius: 0.05, fill: { color: f[2] ? C.offWhite : C.white }, line: { color: f[2] ? C.pale : C.accent, width: 1 } });
        sl.addText(f[1], { x: fx + 0.42, y: fyy + 0.22, w: fw - 0.85, h: 0.38, fontSize: 10.5, color: f[2] ? C.text : C.textMute, fontFace: FONT, valign: "middle", italic: !f[2] });
        if (f[2]) sl.addText("pre-filled", { x: fx + fw - 1.35, y: fyy, w: 1.05, h: 0.2, fontSize: 8, color: C.accent, fontFace: FONT, align: "right", bold: true });
        fyy += 0.68;
      });
    }, "STEP 2", 6);
}

// ════════════════════════════════════════════ 7 - Step 3: the assessment
{
  const s = pres.addSlide();
  chrome(s, "[  STEP 3  ]", "Take the assessment");
  const stats = [
    [I.calendar, "~10", "minutes", "In one sitting."],
    [I.clip, "~24", "short questions", "Quick to answer."],
    [I.translate, "2", "languages", "English or Arabic."],
    [I.target, "4", "factors", "See the next slide."],
  ];
  const sw = 2.27, sgap = 0.12, x0 = 0.34, y = 1.3, sh = 1.95;
  stats.forEach((st, i) => {
    const x = x0 + i * (sw + sgap);
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: sw, h: sh, rectRadius: 0.1, fill: { color: C.primary }, line: { color: C.primary }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    iconCircle(s, x + sw / 2 - 0.28, y + 0.22, 0.56, st[0], C.accent);
    s.addText(st[1], { x, y: y + 0.78, w: sw, h: 0.55, fontSize: 32, bold: true, color: C.accent, fontFace: FONT, align: "center" });
    s.addText(st[2], { x, y: y + 1.34, w: sw, h: 0.3, fontSize: 12.5, bold: true, color: C.white, fontFace: FONT, align: "center" });
    s.addText(st[3], { x: x + 0.1, y: y + 1.62, w: sw - 0.2, h: 0.3, fontSize: 9.5, color: C.light, fontFace: FONT, align: "center" });
  });
  s.addShape(S.ROUNDED_RECTANGLE, { x: 0.34, y: 3.55, w: 9.32, h: 1.2, rectRadius: 0.1, fill: { color: C.iceberg }, line: { color: C.pale, width: 1 } });
  iconCircle(s, 0.6, 3.85, 0.6, I.bulb, C.accent);
  s.addText("It is a self-reflection, not a test.", { x: 1.4, y: 3.66, w: 8.1, h: 0.38, fontSize: 15, bold: true, color: C.primary, fontFace: FONT });
  s.addText("No trick questions, no pass / fail. Answer honestly about how you work with AI today - that is what makes your results useful. Your answers are private to you.", { x: 1.4, y: 4.04, w: 8.1, h: 0.66, fontSize: 11.5, color: C.text, fontFace: FONT, wrap: true });
  footer(s, "STEP 3", 7);
}

// ════════════════════════════════════════════ 8 - The four factors (dark)
{
  const s = pres.addSlide();
  s.addShape(S.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.primary }, line: { color: C.primary } });
  rail(s);
  s.addText("[  WHAT IT MEASURES  ]", { x: 0.38, y: 0.22, w: 6, h: 0.28, fontSize: 9, bold: true, color: C.accent, fontFace: FONT, charSpacing: 3 });
  s.addText("The four factors", { x: 0.38, y: 0.5, w: 9.3, h: 0.5, fontSize: 23, bold: true, color: C.white, fontFace: FONT });
  const f = [
    [I.search, "THINKING", "AI Sense-Check", "You treat AI output as a draft to verify, not a finished answer - catching confidently-wrong facts.", "5391D5"],
    [I.pen, "RESULTS", "AI Working Practice", "You build AI into how you already work - clear prompts, iterating, folding it into recurring tasks.", "00843D"],
    [I.people, "PEOPLE", "AI Collaboration", "You help the team move with AI - explaining what it can and can't do, pushing back on blind trust.", "C2410C"],
    [I.bulb, "SELF", "AI Adaptive Mindset", "You stay open as AI changes the work - relearning, asking where models fail, keeping policy in view.", "6D28D9"],
  ];
  const cw = 4.56, ch = 1.78, gx = 0.3, gy = 0.18, x0 = 0.38, y0 = 1.12;
  f.forEach((c, i) => {
    const x = x0 + (i % 2) * (cw + gx), y = y0 + Math.floor(i / 2) * (ch + gy);
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.navy }, line: { color: C.navy }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.12 } });
    iconCircle(s, x + 0.26, y + 0.32, 0.62, c[0], c[4]);
    s.addText(c[1], { x: x + 1.06, y: y + 0.26, w: cw - 1.2, h: 0.28, fontSize: 9, bold: true, color: c[4], fontFace: FONT, charSpacing: 2 });
    s.addText(c[2], { x: x + 1.06, y: y + 0.52, w: cw - 1.2, h: 0.4, fontSize: 16, bold: true, color: C.white, fontFace: FONT });
    s.addText(c[3], { x: x + 0.26, y: y + 1.0, w: cw - 0.5, h: 0.72, fontSize: 11, color: C.light, fontFace: FONT, wrap: true });
  });
  footer(s, "FACTORS", 8, true);
}

// ════════════════════════════════════════════ 9 - Step 4: results
{
  const s = pres.addSlide();
  chrome(s, "[  STEP 4  ]", "Your results, instantly");
  const cards = [
    [I.clip, "On screen", "The moment you finish, your results appear - your profile across the four factors, with what each means."],
    [I.check, "By email, with PDF", "We email you a copy with the results PDF attached, to keep or share if you choose."],
    [I.compass, "A page to return to", "Your results page is bookmarkable - come back any time from the link in your email."],
  ];
  const cw = 3.04, gap = 0.1, x0 = 0.34, y = 1.3, ch = 2.8;
  cards.forEach((c, i) => {
    const x = x0 + i * (cw + gap);
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    iconCircle(s, x + cw / 2 - 0.35, y + 0.3, 0.7, c[0], c[0] === I.check ? C.white : C.accent);
    s.addText(c[1], { x: x + 0.2, y: y + 1.12, w: cw - 0.4, h: 0.4, fontSize: 15, bold: true, color: C.primary, fontFace: FONT, align: "center" });
    s.addText(c[2], { x: x + 0.24, y: y + 1.55, w: cw - 0.48, h: 1.1, fontSize: 11.5, color: C.text, fontFace: FONT, align: "center", wrap: true });
  });
  s.addText("No waiting - the delegate has their result before they close the tab.", { x: 0.34, y: 4.75, w: 9.3, h: 0.38, fontSize: 12, italic: true, color: C.navy, fontFace: FONT, align: "center" });
  footer(s, "STEP 4", 9);
}

// ════════════════════════════════════════════ 10 - What results tell you
{
  const s = pres.addSlide();
  chrome(s, "[  YOUR REPORT  ]", "What your results tell you");
  const rows = [
    [I.target, "A profile across the four factors", "Where you are strong with AI today, and where there is room to grow."],
    [I.bulb, "Plain-language guidance", "Each factor comes with a short read on what it means and how to develop it."],
    [I.check, "Development, not judgement", "There is no score to pass - it is a personal baseline to build from."],
    [I.shield, "Private to you", "Your report is yours. Your organisation sees completion and an anonymised group picture, not your answers."],
  ];
  let yy = 1.3;
  rows.forEach((r, i) => {
    s.addShape(S.ROUNDED_RECTANGLE, { x: 0.35, y: yy, w: 9.3, h: 0.84, rectRadius: 0.08, fill: { color: i % 2 ? C.white : C.iceberg }, line: { color: C.pale, width: 1 } });
    iconCircle(s, 0.55, yy + 0.2, 0.44, r[0], C.accent);
    s.addText(r[1], { x: 1.2, y: yy + 0.1, w: 3.5, h: 0.64, fontSize: 13.5, bold: true, color: C.primary, fontFace: FONT, valign: "middle" });
    s.addText(r[2], { x: 4.75, y: yy + 0.1, w: 4.75, h: 0.64, fontSize: 11.5, color: C.text, fontFace: FONT, valign: "middle", wrap: true });
    yy += 0.92;
  });
  footer(s, "REPORT", 10);
}

// ════════════════════════════════════════════ 11 - For the coordinator
{
  const s = pres.addSlide();
  chrome(s, "[  FOR THE COORDINATOR  ]", "Running this for your team");
  const items = [
    [I.globe, "We send the invitations", "Share your delegates' names and emails with VIFM, and we email each a personal one-click link."],
    [I.calendar, "Track completion", "You get a simple view of who has started and finished, by company - no spreadsheets."],
    [I.handshake, "An aggregated readout", "When the group is done, VIFM shares an anonymised picture of where the team stands, plus next steps."],
    [I.check, "Zero admin overhead", "No software, no licences to manage, no accounts to create for delegates."],
  ];
  const cw = 4.56, ch = 1.6, gx = 0.3, gy = 0.18, x0 = 0.38, y0 = 1.25;
  items.forEach((it, i) => {
    const x = x0 + (i % 2) * (cw + gx), y = y0 + Math.floor(i / 2) * (ch + gy);
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.pale, width: 1 }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 } });
    iconCircle(s, x + 0.22, y + 0.26, 0.6, it[0], it[0] === I.check ? C.white : C.accent);
    s.addText(it[1], { x: x + 0.96, y: y + 0.22, w: cw - 1.15, h: 0.34, fontSize: 14, bold: true, color: C.primary, fontFace: FONT });
    s.addText(it[2], { x: x + 0.96, y: y + 0.56, w: cw - 1.15, h: 0.95, fontSize: 11, color: C.text, fontFace: FONT, wrap: true });
  });
  footer(s, "COORDINATOR", 11);
}

// ════════════════════════════════════════════ 12 - Privacy (dark)
{
  const s = pres.addSlide();
  s.addShape(S.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.navy }, line: { color: C.navy } });
  rail(s);
  s.addText("[  PRIVACY & CONFIDENTIALITY  ]", { x: 0.38, y: 0.4, w: 7, h: 0.28, fontSize: 9, bold: true, color: C.light, fontFace: FONT, charSpacing: 3 });
  s.addText("Your answers stay yours", { x: 0.38, y: 0.74, w: 9.3, h: 0.6, fontSize: 26, bold: true, color: C.white, fontFace: FONT });
  const items = [
    [I.shield, "Individual results are private", "Your personal report is visible to you. It is not shared as an individual scorecard."],
    [I.check, "For development, not selection", "A readiness baseline - not a hiring, promotion, or performance decision."],
    [I.globe, "GCC-tuned", "Built for the region, aligned to UAE and Saudi expectations, bilingual throughout."],
  ];
  let yy = 1.78;
  items.forEach((it) => {
    iconCircle(s, 0.5, yy, 0.6, it[0], it[0] === I.check ? C.white : C.accent);
    s.addText(it[1], { x: 1.3, y: yy - 0.02, w: 8.2, h: 0.36, fontSize: 16, bold: true, color: C.white, fontFace: FONT });
    s.addText(it[2], { x: 1.3, y: yy + 0.36, w: 8.2, h: 0.6, fontSize: 12.5, color: C.light, fontFace: FONT, wrap: true });
    yy += 1.08;
  });
  footer(s, "PRIVACY", 12, true);
}

// ════════════════════════════════════════════ 13 - Timeline
{
  const s = pres.addSlide();
  chrome(s, "[  WHAT HAPPENS NEXT  ]", "From here to results");
  const steps = [
    [I.flag, "Now", "Codes issued", "Your access codes are ready to send."],
    [I.globe, "This week", "Invitations sent", "VIFM emails each delegate a one-click link."],
    [I.pen, "~2 weeks", "Delegates complete", "Each person takes ~10 minutes, whenever suits."],
    [I.handshake, "After", "Group readout", "VIFM shares an anonymised picture + next steps."],
  ];
  const cw = 2.2, gap = 0.18, x0 = 0.4, y = 1.5, ch = 2.75;
  steps.forEach((st, i) => {
    const x = x0 + i * (cw + gap);
    const active = i === 0;
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: active ? C.accent : C.primary }, line: { color: active ? C.accent : C.primary }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.1 } });
    iconCircle(s, x + cw / 2 - 0.33, y + 0.26, 0.66, st[0], active ? C.primary : C.accent);
    s.addText(st[1].toUpperCase(), { x: x + 0.15, y: y + 1.02, w: cw - 0.3, h: 0.3, fontSize: 10, bold: true, color: active ? C.primary : C.accent, fontFace: FONT, align: "center", charSpacing: 2 });
    s.addText(st[2], { x: x + 0.15, y: y + 1.34, w: cw - 0.3, h: 0.6, fontSize: 14, bold: true, color: C.white, fontFace: FONT, align: "center", wrap: true });
    s.addText(st[3], { x: x + 0.18, y: y + 1.95, w: cw - 0.36, h: 0.78, fontSize: 10.5, color: active ? C.primary : C.light, fontFace: FONT, align: "center", wrap: true });
    if (i < steps.length - 1) s.addText(">", { x: x + cw - 0.05, y: y + 1.05, w: gap + 0.1, h: 0.4, fontSize: 16, bold: true, color: C.navy, fontFace: FONT, align: "center", valign: "middle" });
  });
  s.addText("Timeline is indicative and flexes to your schedule.", { x: 0.4, y: 4.65, w: 9.2, h: 0.38, fontSize: 11.5, italic: true, color: C.navy, fontFace: FONT, align: "center" });
  footer(s, "TIMELINE", 13);
}

// ════════════════════════════════════════════ 14 - Closing (dark)
{
  const s = pres.addSlide();
  s.addShape(S.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.primary }, line: { color: C.primary } });
  rail(s);
  s.addShape(S.RECTANGLE, { x: 7.55, y: 3.55, w: 2.45, h: 2.075, fill: { color: C.navy }, line: { color: C.navy } });
  iconCircle(s, 8.35, 4.05, 0.95, I.compass, C.accent);
  s.addText("[  WE ARE HERE TO HELP  ]", { x: 0.4, y: 0.7, w: 6, h: 0.3, fontSize: 9, bold: true, color: C.accent, fontFace: FONT, charSpacing: 3 });
  s.addText("Welcome to your\nAI Readiness Compass", { x: 0.4, y: 1.1, w: 9, h: 1.6, fontSize: 33, bold: true, color: C.white, fontFace: FONT, lineSpacingMultiple: 1.0 });
  s.addText("Any questions before you begin? Reach the VIFM team:", { x: 0.42, y: 2.9, w: 8, h: 0.4, fontSize: 14, italic: true, color: C.light, fontFace: FONT });
  const contacts = [["Email", "courses@viftraining.com"], ["Phone", "+9714 436 5820"], ["Web", "caliber.viftraining.com"]];
  let yy = 3.55;
  contacts.forEach((c) => {
    s.addText(c[0].toUpperCase(), { x: 0.42, y: yy, w: 1.3, h: 0.34, fontSize: 10, bold: true, color: C.accent, fontFace: FONT, charSpacing: 2, valign: "middle" });
    s.addText(c[1], { x: 1.72, y: yy, w: 5.6, h: 0.34, fontSize: 15, bold: true, color: C.white, fontFace: FONT, valign: "middle" });
    yy += 0.5;
  });
  s.addText("Virginia Institute of Finance and Management", { x: 0.42, y: 5.2, w: 7, h: 0.3, fontSize: 9, color: C.light, fontFace: FONT });
}

pres.writeFile({ fileName: "VIFM-ARC-Client-Onboarding.pptx" }).then((fn) => console.log("Wrote", fn));
