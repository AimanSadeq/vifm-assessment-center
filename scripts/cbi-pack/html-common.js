// Shared HTML scaffolding for the VIFM CBI documents (A4, Open Sans, brand tokens).
const path = require("path");
const FONT_DIR = path.join(__dirname, "assets", "fonts");
const fs = require("fs");
// Data URIs: Chromium does not load file:// images into a page set from a string.
const b64 = (f) => "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "..", "public", "images", f)).toString("base64");
const LOGO_DARK = b64("vifm-logo-dark.png");
const LOGO_WHITE = b64("vifm-logo-white.png");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Inline SVG icons, stroke based, currentColor.
const ICON = {
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  pen: '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M13 8l3 3"/>',
  scale: '<path d="M12 4v16M5 20h14"/><path d="M4 8h16"/><path d="M6 8l-3 6a3 3 0 006 0zM18 8l-3 6a3 3 0 006 0z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path d="M15 14.5c2.8 0 5 1.6 5 4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  brain: '<path d="M9 4a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 002 5v1a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M15 4a3 3 0 013 3v1a3 3 0 012 5 3 3 0 01-2 5v1a3 3 0 01-6 0V7a3 3 0 013-3z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  minus: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  trend: '<path d="M4 17l5-6 4 3 7-8"/><path d="M15 6h5v5"/>',
};
const svg = (name, size = 14, cls = "") =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
const DOMAIN_ICON = { THINKING: "brain", RESULTS: "flag", PEOPLE: "users", SELF: "heart" };

const CSS = `
@font-face { font-family: "Open Sans"; src: url("file://${FONT_DIR}/OpenSans-Regular.ttf"); font-weight: 400; }
@font-face { font-family: "Open Sans"; src: url("file://${FONT_DIR}/OpenSans-Italic.ttf"); font-weight: 400; font-style: italic; }
@font-face { font-family: "Open Sans"; src: url("file://${FONT_DIR}/OpenSans-SemiBold.ttf"); font-weight: 600; }
@font-face { font-family: "Open Sans"; src: url("file://${FONT_DIR}/OpenSans-Bold.ttf"); font-weight: 700; }
:root { --navy:#010131; --mid:#1A3A6B; --accent:#5391D5; --light:#A8C4E5; --pale:#D0DFF4; --off:#F5F7FA; --gray:#EDF1F5; --text:#1E293B; --muted:#64748B; --line:#E2E8F0; --amber:#B45309; --amberbg:#FEF3C7; --green:#00843D; --greenbg:#E8F5E9; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "Open Sans", Arial, sans-serif; color: var(--text); font-size: 10.5px; line-height: 1.5; }
.page { width: 210mm; height: 297mm; padding: 12mm 15mm 16mm; page-break-after: always; position: relative; overflow: hidden; }
.page.comp .notes { height: 24px; } .page.comp .notes.tall { height: 36px; }
.page.comp .q { margin: 6px 0 2px; }
.page.comp .anchors td { padding: 1px 4px; font-size: 8.2px; line-height: 1.35; }
.page.comp .card.soft p { font-size: 10px; }
.page.comp ul.ind li { margin-bottom: 1px; font-size: 10px; }
.page:last-child { page-break-after: auto; }
.pfoot { position: absolute; left: 15mm; right: 15mm; bottom: 8mm; display: flex; justify-content: space-between; font-size: 8px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 4px; }
.band { background: var(--navy); color: #fff; border-radius: 10px; padding: 18px 22px; }
.band .eyebrow { color: var(--light); font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; font-weight: 600; }
.band h1 { font-size: 24px; margin: 6px 0 4px; font-weight: 700; line-height: 1.2; }
.band .sub { color: var(--pale); font-size: 11px; }
h2 { font-size: 15px; color: var(--navy); margin: 0 0 8px; font-weight: 700; }
h3 { font-size: 11.5px; color: var(--navy); margin: 0 0 4px; font-weight: 700; }
.eyebrow { color: var(--accent); font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.card.soft { background: var(--off); border-color: var(--gray); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.muted { color: var(--muted); }
.small { font-size: 9px; }
ul.ind { list-style: none; padding: 0; margin: 0; }
ul.ind li { display: flex; gap: 6px; align-items: flex-start; margin: 0 0 3px; }
ul.ind li .ic { flex: 0 0 auto; margin-top: 2px; }
.pos .ic { color: var(--accent); } .neg .ic { color: var(--muted); }
.q { border-left: 3px solid var(--accent); padding: 2px 0 2px 10px; margin: 8px 0 4px; }
.q .qt { font-weight: 700; color: var(--navy); font-size: 11px; }
.probes { margin: 2px 0 4px 10px; padding: 0; list-style: none; }
.probes li { margin: 1px 0; color: var(--text); }
.probes li::before { content: ""; display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); margin: 0 7px 2px 0; }
.notes { height: 34px; border-bottom: 1px dashed var(--line); margin: 0 0 2px 10px; }
.notes.tall { height: 52px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 5px 7px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-weight: 700; font-size: 9.5px; }
.pill.navy { background: var(--navy); color: #fff; } .pill.accent { background: var(--accent); color: #fff; }
.pill.light { background: var(--pale); color: var(--navy); } .pill.amber { background: var(--amberbg); color: var(--amber); }
.pill.green { background: var(--greenbg); color: var(--green); } .pill.gray { background: var(--gray); color: var(--muted); }
.scale { display: flex; gap: 6px; }
.scale .pt { flex: 1; border: 1px solid var(--line); border-radius: 6px; padding: 4px 6px; font-size: 8.5px; background: #fff; }
.scale .pt b { display: block; font-size: 12px; color: var(--navy); }
.scale .pt.ne { background: var(--off); }
.rating-row { display: flex; gap: 6px; align-items: center; }
.rating-row .box { width: 34px; height: 26px; border: 1.5px solid var(--navy); border-radius: 5px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; color: var(--navy); }
.rating-row .box.ne { border-color: var(--muted); color: var(--muted); font-size: 10px; }
.bar { height: 7px; background: var(--gray); border-radius: 4px; position: relative; }
.bar .fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent); border-radius: 4px; }
.bar .tgt { position: absolute; top: -3px; width: 2px; height: 13px; background: var(--navy); }
.callout { border: 1px solid var(--amber); background: var(--amberbg); border-radius: 8px; padding: 8px 12px; color: #78350F; }
.callout.blue { border-color: var(--accent); background: #EAF2FB; color: var(--mid); }
.domtag { display: inline-flex; align-items: center; gap: 5px; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--light); font-weight: 700; }
.field { display: flex; gap: 8px; align-items: baseline; margin: 4px 0; }
.field .lbl { color: var(--muted); font-size: 9px; width: 110px; flex: 0 0 auto; }
.field .val { border-bottom: 1px solid var(--line); flex: 1; min-height: 14px; }
`;

function doc(title, bodyHtml) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${bodyHtml}</body></html>`;
}
function foot(left) {
  return `<div class="pfoot"><span>${esc(left)}</span><span>Virginia Institute of Finance and Management  |  Confidential</span></div>`;
}
module.exports = { esc, svg, doc, foot, DOMAIN_ICON, LOGO_DARK, LOGO_WHITE };
