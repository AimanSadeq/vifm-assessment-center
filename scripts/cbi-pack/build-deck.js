// VIFM CBI approach deck. VIFM brand system, Open Sans, native SVG icons.
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const { ROLE, FRAMEWORK, SCALE, SIX } = require("./data");
const OUT_DIR = process.env.CBI_OUT || path.join(__dirname, "..", "..", "docs", "samples", "cbi");
fs.mkdirSync(OUT_DIR, { recursive: true });

const C = {
  navy: "010131", mid: "1A3A6B", accent: "5391D5", light: "A8C4E5", pale: "D0DFF4",
  off: "F5F7FA", gray: "EDF1F5", text: "1E293B", muted: "64748B", white: "FFFFFF",
};
const F = "Open Sans";
const mkSh = () => ({ type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 });

// ── SVG icons (hand-drawn, stroke based, editable in PowerPoint) ──
const ICON_DIR = path.join(__dirname, "assets", "icons");
fs.mkdirSync(ICON_DIR, { recursive: true });
const ICONS = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path d="M15 14.5c2.8 0 5 1.6 5 4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8z"/>',
  layers: '<path d="M12 4l9 4.5-9 4.5-9-4.5z"/><path d="M3 13l9 4.5 9-4.5"/><path d="M3 17l9 4.5 9-4.5"/>',
  scale: '<path d="M12 4v16M5 20h14"/><path d="M4 8h16"/><path d="M6 8l-3 6a3 3 0 006 0zM18 8l-3 6a3 3 0 006 0z"/>',
  trend: '<path d="M4 17l5-6 4 3 7-8"/><path d="M15 6h5v5"/>',
  brain: '<path d="M9 4a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 002 5v1a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M15 4a3 3 0 013 3v1a3 3 0 012 5 3 3 0 01-2 5v1a3 3 0 01-6 0V7a3 3 0 013-3z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  pen: '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M13 8l3 3"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/>',
};
function iconFile(name, color) {
  const file = path.join(ICON_DIR, `${name}-${color}.svg`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
  }
  return file;
}
function iconCircle(slide, name, { x, y, size = 0.55, fill = C.accent, color = C.white }) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: size, h: size, fill: { color: fill }, line: { color: fill } });
  const pad = size * 0.22;
  slide.addImage({ path: iconFile(name, color), x: x + pad, y: y + pad, w: size - 2 * pad, h: size - 2 * pad });
}

// ── deck ──
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "VIFM";
pres.title = "VIFM Competency-Based Interview (CBI)";

const FOOTER_Y = 5.38, FOOTER_H = 0.2;
let slideNo = 0;
function footer(slide, tag, dark, textX) {
  slideNo++;
  const tagW = Math.max(1.2, tag.length * 0.11 + 0.3);
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: FOOTER_Y, w: tagW, h: FOOTER_H, fill: { color: C.accent }, rectRadius: 0.05 });
  slide.addText(tag, { x: 0.4, y: FOOTER_Y, w: tagW, h: FOOTER_H, fontSize: 7, color: C.white, fontFace: F, align: "center", valign: "middle", charSpacing: 2, margin: 0 });
  // textX lets a split-background slide start the footer text on its light half.
  slide.addText("VIFM  |  Competency-Based Interview  |  Confidential", { x: textX ?? 0.4 + tagW + 0.15, y: FOOTER_Y, w: 4.6, h: FOOTER_H, fontSize: 8, color: dark ? C.light : C.muted, fontFace: F, valign: "middle", margin: 0 });
  slide.addText(String(slideNo), { x: 8.8, y: FOOTER_Y, w: 0.8, h: FOOTER_H, fontSize: 10, color: dark ? C.light : C.muted, fontFace: F, align: "right", valign: "middle", margin: 0 });
}
function lightBase(slide, title, eyebrow) {
  slide.background = { color: C.off };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: C.accent }, line: { color: C.accent } });
  slide.addText(eyebrow, { x: 0.4, y: 0.22, w: 6, h: 0.25, fontSize: 8, color: C.accent, fontFace: F, charSpacing: 3, margin: 0 });
  slide.addText(title, { x: 0.4, y: 0.45, w: 9.2, h: 0.55, fontSize: 24, bold: true, color: C.navy, fontFace: F, margin: 0 });
}
function darkBase(slide, title, eyebrow, bg = C.navy) {
  slide.background = { color: bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  slide.addText(eyebrow, { x: 0.4, y: 0.22, w: 6, h: 0.25, fontSize: 8, color: C.accent, fontFace: F, charSpacing: 3, margin: 0 });
  slide.addText(title, { x: 0.4, y: 0.45, w: 9.2, h: 0.55, fontSize: 24, bold: true, color: C.white, fontFace: F, margin: 0 });
}
function card(slide, { x, y, w, h, fill = C.white, line }) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: line ? { color: line, width: 1 } : { color: fill }, shadow: mkSh() });
}

// 1 ── Cover
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pres.shapes.RECTANGLE, { x: 7.6, y: 0, w: 2.4, h: 2.0, fill: { color: C.mid }, line: { color: C.mid } });
  s.addShape(pres.shapes.OVAL, { x: 8.0, y: 0.35, w: 0.55, h: 0.55, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pres.shapes.OVAL, { x: 8.75, y: 0.8, w: 0.32, h: 0.32, fill: { color: C.light }, line: { color: C.light } });
  s.addImage({ path: path.join(__dirname, "..", "..", "public", "images", "vifm-logo-white.png"), x: 0.45, y: 0.4, w: 1.9, h: 0.6 });
  s.addText("VIFM ASSESSMENT SERVICES", { x: 0.45, y: 1.55, w: 6, h: 0.3, fontSize: 9, color: C.accent, fontFace: F, charSpacing: 4, margin: 0 });
  s.addText("Competency-Based\nInterview (CBI)", { x: 0.45, y: 1.9, w: 7.2, h: 1.7, fontSize: 40, bold: true, color: C.white, fontFace: F, margin: 0, valign: "top" });
  s.addText("A structured, two-hour behavioural interview built on the VIFM Competency Framework, with an interview guide and a report for every candidate.", { x: 0.45, y: 3.65, w: 7.0, h: 0.75, fontSize: 13, color: C.light, fontFace: F, italic: true, margin: 0 });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y: 4.55, w: 3.2, h: 0.05, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText("Our approach, the interview guide, and a sample report  |  October 2026", { x: 0.45, y: 4.68, w: 7, h: 0.3, fontSize: 10, color: C.light, fontFace: F, margin: 0 });
  footer(s, "COVER", true);
}

// 2 ── Why a structured interview (split panel)
{
  const s = pres.addSlide();
  s.background = { color: C.pale };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 3.8, h: 5.625, fill: { color: C.navy }, line: { color: C.navy } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pres.shapes.RECTANGLE, { x: 3.8, y: 0, w: 0.06, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText("WHAT A CBI IS", { x: 0.4, y: 0.25, w: 3, h: 0.25, fontSize: 8, color: C.accent, fontFace: F, charSpacing: 3, margin: 0 });
  s.addText("Past behaviour,\nasked the same way\nof every candidate", { x: 0.4, y: 0.9, w: 3.2, h: 1.8, fontSize: 22, bold: true, color: C.white, fontFace: F, margin: 0 });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 2.85, w: 2.2, h: 0.04, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText("A structured series of questions that asks the candidate for specific examples of what they actually did, probed systematically and rated against defined behavioural indicators.", { x: 0.4, y: 3.0, w: 3.2, h: 1.6, fontSize: 11, color: C.light, fontFace: F, margin: 0 });
  s.addText("Why structure matters", { x: 4.1, y: 0.35, w: 5.5, h: 0.4, fontSize: 15, bold: true, color: C.mid, fontFace: F, margin: 0 });
  const pts = [
    ["Predicts job performance", "Structured interviews predict performance roughly twice as well as unstructured ones (operational validity about .51 against .38, Schmidt and Hunter, 1998)."],
    ["Fair by design", "Every candidate for the role is asked the same questions. Only the probes vary with the answers."],
    ["Evidence, not impressions", "The interviewer records what the candidate did, then classifies the evidence against positive and negative indicators."],
    ["A defined scale", "Each competency is rated 1 to 5 against anchors written for that competency, with a 'no evidence' option so a thin answer is never a 1."],
  ];
  pts.forEach((p, i) => {
    const y = 0.9 + i * 1.02;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.1, y, w: 5.5, h: 0.88, rectRadius: 0.06, fill: { color: C.white }, line: { color: C.white }, shadow: mkSh() });
    s.addShape(pres.shapes.RECTANGLE, { x: 4.1, y: y + 0.12, w: 0.06, h: 0.64, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(p[0], { x: 4.3, y: y + 0.08, w: 5.2, h: 0.28, fontSize: 12, bold: true, color: C.navy, fontFace: F, margin: 0 });
    s.addText(p[1], { x: 4.3, y: y + 0.36, w: 5.2, h: 0.5, fontSize: 9.5, color: C.text, fontFace: F, margin: 0 });
  });
  footer(s, "APPROACH", false, 4.1);
}

// 3 ── Built on the framework (KPI dashboard)
{
  const s = pres.addSlide();
  darkBase(s, "Built on the VIFM Competency Framework", "THE FOUNDATION");
  const kpis = [
    { v: "4", l: "Domains", sub: "Thinking · Results · People · Self", icon: "layers" },
    { v: "8", l: "Clusters", sub: "Group related competencies", icon: "grid" },
    { v: "21", l: "Competencies", sub: "Each with a definition and positive and negative indicators", icon: "target" },
    { v: "1 to 5", l: "Anchored scale", sub: "Behaviourally anchored ratings for every competency", icon: "scale" },
  ];
  const kW = 2.15, kH = 3.1, kY = 1.25, gap = 0.17;
  kpis.forEach((k, i) => {
    const x = 0.4 + i * (kW + gap);
    const fill = i % 2 === 0 ? C.mid : C.navy;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: kY, w: kW, h: kH, rectRadius: 0.08, fill: { color: fill }, line: { color: C.accent, width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.08, y: kY, w: kW - 0.16, h: 0.07, fill: { color: C.accent }, line: { color: C.accent } });
    iconCircle(s, k.icon, { x: x + kW / 2 - 0.3, y: kY + 0.3, size: 0.6 });
    s.addText(k.v, { x, y: kY + 1.0, w: kW, h: 0.8, fontSize: 40, bold: true, color: C.white, fontFace: F, align: "center", margin: 0 });
    s.addText(k.l, { x, y: kY + 1.8, w: kW, h: 0.35, fontSize: 13, bold: true, color: C.accent, fontFace: F, align: "center", margin: 0 });
    s.addText(k.sub, { x: x + 0.15, y: kY + 2.2, w: kW - 0.3, h: 0.75, fontSize: 9.5, color: C.light, fontFace: F, align: "center", margin: 0 });
  });
  s.addText("The same framework drives Persona (self-report), Reflect 360, Pre-Hire and the VIFM Assessment Centre, so interview ratings can be read next to every other VIFM signal.", { x: 0.4, y: 4.55, w: 9.2, h: 0.5, fontSize: 10.5, color: C.light, fontFace: F, italic: true, margin: 0 });
  footer(s, "FRAMEWORK", true);
}

// 4-7 ── The 21 competencies, one slide per domain
const DOMAIN_ICON = { THINKING: "brain", RESULTS: "flag", PEOPLE: "users", SELF: "heart" };
const DOMAIN_SUB = {
  THINKING: "How the person analyses, decides and sets direction",
  RESULTS: "How the person gets things done and serves those who depend on the work",
  PEOPLE: "How the person communicates, influences and grows others",
  SELF: "How the person manages themselves, their standards and their growth",
};
["THINKING", "RESULTS", "PEOPLE", "SELF"].forEach((dom, di) => {
  const s = pres.addSlide();
  lightBase(s, `${dom.charAt(0) + dom.slice(1).toLowerCase()} domain`, `THE 21 COMPETENCIES  |  ${di + 1} OF 4`);
  iconCircle(s, DOMAIN_ICON[dom], { x: 8.95, y: 0.42, size: 0.55, fill: C.navy });
  s.addText(DOMAIN_SUB[dom], { x: 0.4, y: 1.0, w: 8.3, h: 0.3, fontSize: 10.5, color: C.muted, fontFace: F, italic: true, margin: 0 });
  const groups = FRAMEWORK.filter((g) => g.domain === dom);
  const comps = groups.flatMap((g) => g.comps.map((c) => ({ cluster: g.cluster, name: c[0], def: c[1] })));
  const cols = comps.length <= 4 ? 2 : 3;
  const rows = Math.ceil(comps.length / cols);
  const gapX = 0.2, gapY = 0.15, startY = 1.4, availH = 5.1 - startY;
  const w = (9.2 - (cols - 1) * gapX) / cols;
  const h = Math.min(1.75, (availH - (rows - 1) * gapY) / rows);
  comps.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 0.4 + col * (w + gapX), y = startY + row * (h + gapY);
    card(s, { x, y, w, h });
    s.addShape(pres.shapes.RECTANGLE, { x, y: y + 0.15, w: 0.06, h: h - 0.3, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(c.cluster.toUpperCase(), { x: x + 0.2, y: y + 0.1, w: w - 0.3, h: 0.2, fontSize: 7, color: C.accent, fontFace: F, charSpacing: 2, margin: 0 });
    s.addText(c.name, { x: x + 0.2, y: y + 0.3, w: w - 0.3, h: 0.3, fontSize: cols === 3 ? 11 : 12.5, bold: true, color: C.navy, fontFace: F, margin: 0 });
    s.addText(c.def, { x: x + 0.2, y: y + 0.62, w: w - 0.3, h: h - 0.72, fontSize: cols === 3 ? 8.5 : 9.5, color: C.text, fontFace: F, margin: 0, valign: "top" });
  });
  footer(s, dom, false);
});

// 8 ── How we scope an interview (horizontal timeline)
{
  const s = pres.addSlide();
  s.background = { color: C.pale };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.85, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("SCOPING", { x: 0.4, y: 0.1, w: 4, h: 0.25, fontSize: 8, color: C.accent, fontFace: F, charSpacing: 3, margin: 0 });
  s.addText("From role to interview guide in four steps", { x: 0.4, y: 0.33, w: 9, h: 0.42, fontSize: 18, bold: true, color: C.white, fontFace: F, margin: 0 });
  const steps = [
    { n: "01", t: "Role profile", b: "The client's role profile, or one we build with them from the job description, sets the competencies and the target level for each.", icon: "doc" },
    { n: "02", t: "Five to seven competencies", b: "Enough to cover the role's critical behaviours, few enough to probe each one properly in about fifteen minutes.", icon: "target" },
    { n: "03", t: "Interview guide", b: "Generated for the role: definition, indicators, three questions with probes, note space and the anchored rating for each competency.", icon: "pen" },
    { n: "04", t: "Interviewer briefing", b: "Interviewers are trained on the guide, the STAR-L method, note-taking and the rating scale before the first candidate.", icon: "users" },
  ];
  const spineY = 2.1, r = 0.38, startX = 0.95, colW = 2.3;
  s.addShape(pres.shapes.RECTANGLE, { x: startX + r, y: spineY - 0.03, w: (steps.length - 1) * colW, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  steps.forEach((st, i) => {
    const cx = startX + i * colW;
    s.addShape(pres.shapes.OVAL, { x: cx, y: spineY - r, w: r * 2, h: r * 2, fill: { color: C.accent }, line: { color: C.accent } });
    s.addShape(pres.shapes.OVAL, { x: cx + 0.08, y: spineY - r + 0.08, w: (r - 0.08) * 2, h: (r - 0.08) * 2, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(st.n, { x: cx, y: spineY - r, w: r * 2, h: r * 2, fontSize: 12, bold: true, color: C.white, fontFace: F, align: "center", valign: "middle", margin: 0 });
    card(s, { x: cx - 0.6, y: spineY + 0.55, w: colW - 0.1, h: 2.3 });
    iconCircle(s, st.icon, { x: cx + r - 0.25, y: spineY + 0.7, size: 0.5 });
    s.addText(st.t, { x: cx - 0.5, y: spineY + 1.28, w: colW - 0.3, h: 0.3, fontSize: 11.5, bold: true, color: C.navy, fontFace: F, align: "center", margin: 0 });
    s.addText(st.b, { x: cx - 0.5, y: spineY + 1.6, w: colW - 0.3, h: 1.2, fontSize: 8.5, color: C.text, fontFace: F, align: "center", margin: 0 });
  });
  footer(s, "SCOPING", false);
}

// 9 ── The two-hour interview (agenda rows)
{
  const s = pres.addSlide();
  darkBase(s, "The two-hour interview", "STRUCTURE", C.mid);
  const rows = [
    { n: "10 min", t: "Opening", d: "Welcome, purpose, the competencies to be covered, note-taking explained, consent confirmed." },
    { n: "10 min", t: "Career overview", d: "A short walk through recent roles to settle the candidate and surface examples to return to." },
    { n: "90 min", t: "Six competencies, about fifteen minutes each", d: "Same questions for every candidate. Probes follow the answer. Evidence recorded, never evaluated in the room." },
    { n: "10 min", t: "Close", d: "Anything to add, the candidate's questions, next steps and timing." },
  ];
  rows.forEach((r, i) => {
    const y = 1.2 + i * 0.92;
    const fill = i % 2 === 0 ? C.navy : C.mid;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y, w: 9.2, h: 0.8, rectRadius: 0.06, fill: { color: fill }, line: { color: i % 2 === 0 ? C.navy : C.accent, width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: y + 0.1, w: 0.08, h: 0.6, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(r.n, { x: 0.6, y, w: 1.2, h: 0.8, fontSize: 15, bold: true, color: C.accent, fontFace: F, valign: "middle", margin: 0 });
    s.addText(r.t, { x: 1.85, y: y + 0.1, w: 7.6, h: 0.3, fontSize: 12.5, bold: true, color: C.white, fontFace: F, margin: 0 });
    s.addText(r.d, { x: 1.85, y: y + 0.4, w: 7.6, h: 0.36, fontSize: 9.5, color: C.light, fontFace: F, margin: 0 });
  });
  s.addText("Two interviewers where the decision is a selection decision: one leads and probes, one records. For development interviews one trained interviewer is sufficient.", { x: 0.4, y: 4.9, w: 9.2, h: 0.3, fontSize: 9, color: C.light, fontFace: F, italic: true, margin: 0 });
  footer(s, "STRUCTURE", true);
}

// 10 ── STAR-L cycle
{
  const s = pres.addSlide();
  darkBase(s, "STAR-L: how every question is asked", "METHOD");
  const cX = 3.0, cY = 3.05, trackR = 1.45;
  s.addShape(pres.shapes.OVAL, { x: cX - trackR - 0.08, y: cY - trackR - 0.08, w: (trackR + 0.08) * 2, h: (trackR + 0.08) * 2, fill: { color: C.mid }, line: { color: C.mid } });
  s.addShape(pres.shapes.OVAL, { x: cX - trackR + 0.08, y: cY - trackR + 0.08, w: (trackR - 0.08) * 2, h: (trackR - 0.08) * 2, fill: { color: C.navy }, line: { color: C.navy } });
  s.addShape(pres.shapes.OVAL, { x: cX - 0.55, y: cY - 0.55, w: 1.1, h: 1.1, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText("STAR-L", { x: cX - 0.55, y: cY - 0.55, w: 1.1, h: 1.1, fontSize: 12, bold: true, color: C.white, fontFace: F, align: "center", valign: "middle", margin: 0 });
  const nodes = ["Situation", "Task", "Action", "Result", "Learning"];
  nodes.forEach((n, i) => {
    const ang = (-90 + i * 72) * Math.PI / 180;
    const nx = cX + trackR * Math.cos(ang), ny = cY + trackR * Math.sin(ang), nr = 0.42;
    s.addShape(pres.shapes.OVAL, { x: nx - nr, y: ny - nr, w: nr * 2, h: nr * 2, fill: { color: i === 2 ? C.accent : C.mid }, line: { color: C.accent, width: 2 } });
    s.addText(n.charAt(0), { x: nx - nr, y: ny - nr, w: nr * 2, h: nr * 2, fontSize: 16, bold: true, color: C.white, fontFace: F, align: "center", valign: "middle", margin: 0 });
  });
  const rows = [
    ["S", "Situation", "What was the context? When, where, who was involved?"],
    ["T", "Task", "What were you responsible for? What had to be achieved?"],
    ["A", "Action", "What did you, personally, do? The interviewer spends most of the time here."],
    ["R", "Result", "What happened? How do you know? What did it cost or deliver?"],
    ["L", "Learning", "What would you do differently? What did you carry forward?"],
  ];
  rows.forEach((r, i) => {
    const y = 1.1 + i * 0.72;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.1, y, w: 4.5, h: 0.66, rectRadius: 0.06, fill: { color: C.mid }, line: { color: C.mid } });
    s.addShape(pres.shapes.OVAL, { x: 5.22, y: y + 0.15, w: 0.36, h: 0.36, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(r[0], { x: 5.22, y: y + 0.15, w: 0.36, h: 0.36, fontSize: 11, bold: true, color: C.white, fontFace: F, align: "center", valign: "middle", margin: 0 });
    s.addText(r[1], { x: 5.7, y: y + 0.06, w: 3.8, h: 0.26, fontSize: 11, bold: true, color: C.white, fontFace: F, margin: 0 });
    s.addText(r[2], { x: 5.7, y: y + 0.32, w: 3.8, h: 0.32, fontSize: 8.5, color: C.light, fontFace: F, margin: 0 });
  });
  s.addText("Answers in the hypothetical or the plural (\"we would\", \"the team usually\") are redirected to a specific, personal example.", { x: 0.4, y: 4.92, w: 9.2, h: 0.3, fontSize: 9, color: C.light, fontFace: F, italic: true, margin: 0 });
  footer(s, "METHOD", true);
}

// 11 ── Anatomy of a guide page (spotlight + side panel)
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.55, w: 5.4, h: 4.6, fill: { color: C.mid }, line: { color: C.mid } });
  s.addShape(pres.shapes.OVAL, { x: 0.95, y: 0.95, w: 4.5, h: 3.8, fill: { color: C.navy }, line: { color: C.navy } });
  s.addShape(pres.shapes.OVAL, { x: 1.4, y: 1.35, w: 3.6, h: 3.0, fill: { color: C.mid }, line: { color: C.mid } });
  s.addText("THE INTERVIEW GUIDE", { x: 1.4, y: 1.95, w: 3.6, h: 0.25, fontSize: 8, color: C.accent, fontFace: F, align: "center", charSpacing: 3, margin: 0 });
  s.addText("One page per\ncompetency", { x: 1.4, y: 2.25, w: 3.6, h: 1.1, fontSize: 24, bold: true, color: C.white, fontFace: F, align: "center", margin: 0 });
  s.addText("Printed or on screen, the same for every candidate", { x: 1.5, y: 3.4, w: 3.4, h: 0.4, fontSize: 9.5, color: C.light, fontFace: F, align: "center", italic: true, margin: 0 });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.4, y: 0, w: 3.6, h: 5.625, fill: { color: C.mid }, line: { color: C.mid } });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.4, y: 0, w: 0.06, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText("WHAT IS ON THE PAGE", { x: 6.6, y: 0.25, w: 3.2, h: 0.3, fontSize: 8, bold: true, color: C.accent, fontFace: F, charSpacing: 3, margin: 0 });
  const items = [
    ["doc", "Definition", "The competency as the framework defines it, with why it matters for this role."],
    ["eye", "Indicators", "What positive and negative evidence looks like, so notes can be classified."],
    ["chat", "Three questions, three probes each", "Asked in order; probes follow the answer."],
    ["pen", "Notes", "Space to record what the candidate said and did, factually."],
    ["scale", "Rating", "1 to 5 against the anchors for this competency, or NE for no evidence."],
  ];
  items.forEach((it, i) => {
    const y = 0.7 + i * 0.9;
    iconCircle(s, it[0], { x: 6.6, y: y + 0.05, size: 0.44 });
    s.addText(it[1], { x: 7.15, y, w: 2.7, h: 0.28, fontSize: 10.5, bold: true, color: C.white, fontFace: F, margin: 0 });
    s.addText(it[2], { x: 7.15, y: y + 0.28, w: 2.7, h: 0.55, fontSize: 8.5, color: C.light, fontFace: F, margin: 0 });
  });
  footer(s, "GUIDE", true);
}

// 12 ── Sample guide page preview
{
  const s = pres.addSlide();
  const c = SIX[0];
  lightBase(s, `Sample: ${c.name}`, `GUIDE PREVIEW  |  ${ROLE.title.toUpperCase()}`);
  card(s, { x: 0.4, y: 1.1, w: 4.4, h: 3.9 });
  s.addText("DEFINITION", { x: 0.6, y: 1.2, w: 4, h: 0.22, fontSize: 7.5, color: C.accent, fontFace: F, charSpacing: 2, margin: 0 });
  s.addText(c.definition.split(". ").slice(0, 2).join(". ") + ".", { x: 0.6, y: 1.42, w: 4.0, h: 0.95, fontSize: 8.5, color: C.text, fontFace: F, margin: 0 });
  s.addText("POSITIVE INDICATORS", { x: 0.6, y: 2.42, w: 4, h: 0.22, fontSize: 7.5, color: C.accent, fontFace: F, charSpacing: 2, margin: 0 });
  c.positive.slice(0, 3).forEach((p, i) => {
    s.addShape(pres.shapes.OVAL, { x: 0.62, y: 2.7 + i * 0.3, w: 0.12, h: 0.12, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(p, { x: 0.82, y: 2.64 + i * 0.3, w: 3.9, h: 0.28, fontSize: 8, color: C.text, fontFace: F, margin: 0, valign: "top" });
  });
  s.addText("NEGATIVE INDICATORS", { x: 0.6, y: 3.62, w: 4, h: 0.22, fontSize: 7.5, color: C.muted, fontFace: F, charSpacing: 2, margin: 0 });
  c.negative.slice(0, 2).forEach((p, i) => {
    s.addShape(pres.shapes.OVAL, { x: 0.62, y: 3.92 + i * 0.3, w: 0.12, h: 0.12, fill: { color: C.muted }, line: { color: C.muted } });
    s.addText(p, { x: 0.82, y: 3.84 + i * 0.3, w: 3.9, h: 0.28, fontSize: 8.5, color: C.text, fontFace: F, margin: 0, valign: "middle" });
  });
  card(s, { x: 5.0, y: 1.1, w: 4.6, h: 2.45 });
  s.addText("QUESTION 1 OF 3", { x: 5.2, y: 1.2, w: 4.2, h: 0.22, fontSize: 7.5, color: C.accent, fontFace: F, charSpacing: 2, margin: 0 });
  s.addText(c.questions[0].q, { x: 5.2, y: 1.42, w: 4.2, h: 0.6, fontSize: 10, bold: true, color: C.navy, fontFace: F, margin: 0 });
  c.questions[0].probes.forEach((p, i) => {
    s.addText("Probe", { x: 5.2, y: 2.08 + i * 0.3, w: 0.5, h: 0.26, fontSize: 7.5, bold: true, color: C.accent, fontFace: F, margin: 0, valign: "middle" });
    s.addText(p, { x: 5.7, y: 2.08 + i * 0.3, w: 3.7, h: 0.26, fontSize: 8.5, color: C.text, fontFace: F, margin: 0, valign: "middle" });
  });
  s.addText("Notes", { x: 5.2, y: 3.02, w: 1, h: 0.2, fontSize: 7.5, color: C.muted, fontFace: F, margin: 0 });
  [0, 1].forEach((i) => s.addShape(pres.shapes.LINE, { x: 5.2, y: 3.28 + i * 0.16, w: 4.2, h: 0, line: { color: C.gray, width: 1, dashType: "dash" } }));
  card(s, { x: 5.0, y: 3.7, w: 4.6, h: 1.3 });
  s.addText("INTERVIEW RATING", { x: 5.2, y: 3.78, w: 4.2, h: 0.22, fontSize: 7.5, color: C.accent, fontFace: F, charSpacing: 2, margin: 0 });
  ["1", "2", "3", "4", "5", "NE"].forEach((v, i) => {
    const x = 5.2 + i * 0.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.05, w: 0.6, h: 0.42, rectRadius: 0.06, fill: { color: v === "4" ? C.accent : C.off }, line: { color: v === "4" ? C.accent : C.gray, width: 1 } });
    s.addText(v, { x, y: 4.05, w: 0.6, h: 0.42, fontSize: 11, bold: true, color: v === "4" ? C.white : C.navy, fontFace: F, align: "center", valign: "middle", margin: 0 });
  });
  s.addText("Anchor for 4: " + c.anchors[4].split(". ")[0] + ".", { x: 5.2, y: 4.52, w: 4.2, h: 0.42, fontSize: 7.5, color: C.muted, fontFace: F, italic: true, margin: 0 });
  footer(s, "SAMPLE", false);
}

// 13 ── Rating scale rows
{
  const s = pres.addSlide();
  darkBase(s, "One scale, anchored for every competency", "RATING", C.mid);
  SCALE.forEach((r, i) => {
    const y = 1.15 + i * 0.64;
    const fill = i % 2 === 0 ? C.navy : C.mid;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y, w: 9.2, h: 0.56, rectRadius: 0.05, fill: { color: fill }, line: { color: fill } });
    s.addShape(pres.shapes.OVAL, { x: 0.52, y: y + 0.08, w: 0.4, h: 0.4, fill: { color: r.point === "NE" ? C.light : C.accent }, line: { color: C.accent } });
    s.addText(String(r.point), { x: 0.52, y: y + 0.08, w: 0.4, h: 0.4, fontSize: r.point === "NE" ? 9 : 12, bold: true, color: r.point === "NE" ? C.navy : C.white, fontFace: F, align: "center", valign: "middle", margin: 0 });
    s.addText(r.label, { x: 1.05, y, w: 2.1, h: 0.56, fontSize: 11.5, bold: true, color: C.white, fontFace: F, valign: "middle", margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: 3.2, y: y + 0.12, w: 0.04, h: 0.32, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(r.meaning, { x: 3.35, y, w: 6.15, h: 0.56, fontSize: 9.5, color: C.light, fontFace: F, valign: "middle", margin: 0 });
  });
  s.addText("Generic labels are not enough. Every competency carries its own written anchor for each point, so two interviewers read a 3 the same way.", { x: 0.4, y: 5.0, w: 9.2, h: 0.3, fontSize: 9, color: C.light, fontFace: F, italic: true, margin: 0 });
  footer(s, "RATING", true);
}

// 14 ── Assessing and reporting (icon grid 2x3)
{
  const s = pres.addSlide();
  lightBase(s, "After the interview: from notes to a rating", "ASSESSMENT");
  const items = [
    ["pen", "Write up the same day", "Notes are completed while the evidence is fresh, before any rating."],
    ["eye", "Classify the evidence", "Each piece of evidence is matched to a positive or negative indicator of one competency."],
    ["scale", "Rate against the anchors", "The rating is the anchor the evidence best fits, not an average of impressions."],
    ["users", "Calibrate", "Where there are two interviewers, ratings are agreed in a short discussion with the evidence on the table."],
    ["doc", "Report", "A per-competency report with the evidence, the rating against the role target, strengths and development areas."],
    ["chat", "Feed back", "The candidate receives a summary of strengths and development areas, whatever the decision."],
  ];
  const w = 2.95, h = 1.75, gx = 0.17, gy = 0.17;
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col * (w + gx), y = 1.2 + row * (h + gy);
    card(s, { x, y, w, h });
    iconCircle(s, it[0], { x: x + 0.2, y: y + 0.2, size: 0.5 });
    s.addText(it[1], { x: x + 0.85, y: y + 0.22, w: w - 1.0, h: 0.48, fontSize: 11, bold: true, color: C.navy, fontFace: F, margin: 0, valign: "middle" });
    s.addText(it[2], { x: x + 0.2, y: y + 0.85, w: w - 0.4, h: 0.85, fontSize: 9, color: C.text, fontFace: F, margin: 0 });
  });
  footer(s, "ASSESSMENT", false);
}

// 15 ── The report (three cards)
{
  const s = pres.addSlide();
  darkBase(s, "The CBI report", "REPORT", C.mid);
  const cards = [
    ["Summary", "The six competencies with their rating against the role's target level on one page, with an indicative overall read and the headline strengths and development areas."],
    ["Evidence per competency", "For each competency: the rating and its anchor, a summary of what the candidate described, the indicators observed and the gaps, and the interviewers' confidence in the evidence."],
    ["Development and decision", "Suggested development actions drawn from the framework, a decision-integration box the panel completes, and a plain statement of what the interview can and cannot tell you."],
  ];
  const cW = 2.95, cH = 3.5, cY = 1.2;
  cards.forEach((c, i) => {
    const x = 0.4 + i * (cW + 0.17);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: cY, w: cW, h: cH, rectRadius: 0.08, fill: { color: C.navy }, line: { color: C.navy } });
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.08, y: cY, w: cW - 0.16, h: 0.08, fill: { color: C.accent }, line: { color: C.accent } });
    s.addShape(pres.shapes.OVAL, { x: x + cW / 2 - 0.32, y: cY + 0.3, w: 0.64, h: 0.64, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(`0${i + 1}`, { x: x + cW / 2 - 0.32, y: cY + 0.3, w: 0.64, h: 0.64, fontSize: 15, bold: true, color: C.white, fontFace: F, align: "center", valign: "middle", margin: 0 });
    s.addText(c[0], { x: x + 0.15, y: cY + 1.1, w: cW - 0.3, h: 0.4, fontSize: 13, bold: true, color: C.white, fontFace: F, align: "center", margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.6, y: cY + 1.58, w: cW - 1.2, h: 0.04, fill: { color: C.mid }, line: { color: C.mid } });
    s.addText(c[1], { x: x + 0.2, y: cY + 1.75, w: cW - 0.4, h: 1.65, fontSize: 9.5, color: C.light, fontFace: F, margin: 0 });
  });
  s.addText("Every VIFM report states on its face what it is: interview evidence about past behaviour, to be read alongside other evidence. It is never a hiring decision on its own.", { x: 0.4, y: 4.85, w: 9.2, h: 0.4, fontSize: 9, color: C.light, fontFace: F, italic: true, margin: 0 });
  footer(s, "REPORT", true);
}

// 16 ── Fairness and defensibility (four cards, light)
{
  const s = pres.addSlide();
  lightBase(s, "Fair to candidates, defensible to the organisation", "FAIRNESS");
  const items = [
    ["check", "Standardised", "Same competencies, same questions, same scale for every candidate for the role. Deviations are recorded."],
    ["eye", "Evidence-based", "Ratings cite the behaviour described. No rating without notes; no evidence means NE, not a low score."],
    ["users", "Trained interviewers", "Interviewers are briefed on the guide, the method, note-taking and common rating errors before they interview."],
    ["shield", "Monitored", "Outcomes can be monitored by group for adverse impact, and the interview record supports any later review or appeal."],
  ];
  const w = 2.2, h = 3.4, g = 0.13;
  items.forEach((it, i) => {
    const x = 0.4 + i * (w + g), y = 1.25;
    card(s, { x, y, w, h });
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.08, y, w: w - 0.16, h: 0.07, fill: { color: C.accent }, line: { color: C.accent } });
    iconCircle(s, it[0], { x: x + w / 2 - 0.3, y: y + 0.3, size: 0.6, fill: C.navy });
    s.addText(it[1], { x: x + 0.15, y: y + 1.05, w: w - 0.3, h: 0.35, fontSize: 12, bold: true, color: C.navy, fontFace: F, align: "center", margin: 0 });
    s.addText(it[2], { x: x + 0.18, y: y + 1.5, w: w - 0.36, h: 1.8, fontSize: 9.5, color: C.text, fontFace: F, align: "center", margin: 0 });
  });
  s.addText("Structured interview validity: Schmidt and Hunter (1998), Psychological Bulletin 124(2); McDaniel, Whetzel, Schmidt and Maurer (1994), Journal of Applied Psychology 79(4).", { x: 0.4, y: 4.78, w: 9.2, h: 0.3, fontSize: 7.5, color: C.muted, fontFace: F, italic: true, margin: 0 });
  footer(s, "FAIRNESS", false);
}

// 17 ── Where CBI sits (three options)
{
  const s = pres.addSlide();
  darkBase(s, "On its own, or as part of a fuller picture", "OPTIONS");
  const opts = [
    ["Interview only", "A CBI on the role's competencies, with the guide and the report. Right for shortlists where the organisation wants structure and evidence quickly.", ["Interview guide per role", "Trained interviewers", "Report per candidate"]],
    ["Interview plus VIFM instruments", "Add Persona (behavioural self-report on the same framework) and Logica (reasoning) before the interview, so the guide can target what the self-report flags.", ["Self-report read next to interview evidence", "Reasoning as a separate signal", "Combined report"]],
    ["Assessment centre", "The CBI becomes one exercise in a VIFM Assessment Centre with simulations and trained assessors, integrated in a wash-up to one rating per competency.", ["Multiple exercises per competency", "Assessor consensus", "Full centre report"]],
  ];
  const cW = 2.95, cH = 3.6, cY = 1.2;
  opts.forEach((o, i) => {
    const x = 0.4 + i * (cW + 0.17);
    const fill = i === 1 ? C.accent : C.mid;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: cY, w: cW, h: cH, rectRadius: 0.08, fill: { color: fill }, line: { color: fill } });
    s.addText(o[0], { x: x + 0.2, y: cY + 0.2, w: cW - 0.4, h: 0.4, fontSize: 13, bold: true, color: C.white, fontFace: F, margin: 0 });
    s.addText(o[1], { x: x + 0.2, y: cY + 0.65, w: cW - 0.4, h: 1.4, fontSize: 9.5, color: i === 1 ? C.white : C.light, fontFace: F, margin: 0 });
    o[2].forEach((b, j) => {
      const by = cY + 2.15 + j * 0.42;
      s.addImage({ path: iconFile("check", "FFFFFF"), x: x + 0.22, y: by + 0.04, w: 0.22, h: 0.22 });
      s.addText(b, { x: x + 0.52, y: by, w: cW - 0.7, h: 0.32, fontSize: 9, color: C.white, fontFace: F, margin: 0, valign: "middle" });
    });
  });
  footer(s, "OPTIONS", true);
}

// 18 ── Closing / next steps
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 7.5, y: 0, w: 2.5, h: 5.625, fill: { color: C.mid }, line: { color: C.mid } });
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: 6.8, y: 0, w: 1.0, h: 5.625, fill: { color: C.accent }, line: { color: C.accent }, flipH: true });
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: 6.9, y: 0, w: 0.9, h: 5.625, fill: { color: C.mid }, line: { color: C.mid }, flipH: true });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });
  s.addImage({ path: path.join(__dirname, "..", "..", "public", "images", "vifm-logo-white.png"), x: 0.4, y: 0.4, w: 1.6, h: 0.51 });
  s.addText("NEXT STEPS", { x: 0.4, y: 1.25, w: 5, h: 0.28, fontSize: 8, color: C.accent, fontFace: F, charSpacing: 3, margin: 0 });
  s.addText("Ready to run for\nyour first role", { x: 0.4, y: 1.55, w: 6.2, h: 1.4, fontSize: 32, bold: true, color: C.white, fontFace: F, margin: 0 });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 3.05, w: 5.5, h: 0.05, fill: { color: C.accent }, line: { color: C.accent } });
  ["Agree the role profile and the five to seven competencies", "VIFM generates the interview guide and briefs the interviewers", "Run the interviews; VIFM scores and calibrates", "Reports delivered within five working days of the last interview"].forEach((t, i) => {
    s.addImage({ path: iconFile("check", "5391D5"), x: 0.4, y: 3.25 + i * 0.44, w: 0.26, h: 0.26 });
    s.addText(t, { x: 0.78, y: 3.22 + i * 0.44, w: 5.8, h: 0.32, fontSize: 11, color: C.light, fontFace: F, valign: "middle", margin: 0 });
  });
  s.addText("Virginia Institute of Finance and Management", { x: 0.4, y: 5.05, w: 6, h: 0.25, fontSize: 8, color: C.light, fontFace: F, margin: 0 });
  footer(s, "CLOSE", true);
}

(async () => {
  const out = path.join(OUT_DIR, "VIFM-Competency-Based-Interview-Approach.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out, "slides:", slideNo);
})();
