// VIFM page styles, inline SVG icons and logo for the SDC High-Potential
// reports. Ported from scripts/cbi-pack/html-common.js (the sample generator)
// so the in-app PDFs match the approved samples. Open Sans loads from Google
// Fonts like the other in-app HTML reports (tech-cohort-html.ts); the route
// waits for document.fonts.ready before printing.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Stroke icons, currentColor (24 x 24 grid).
const ICON: Record<string, string> = {
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path d="M15 14.5c2.8 0 5 1.6 5 4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  brain: '<path d="M9 4a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 002 5v1a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M15 4a3 3 0 013 3v1a3 3 0 012 5 3 3 0 01-2 5v1a3 3 0 01-6 0V7a3 3 0 013-3z"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8z"/>',
  trend: '<path d="M4 17l5-6 4 3 7-8"/><path d="M15 6h5v5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  pin: '<path d="M12 21s-6-5.5-6-10a6 6 0 0112 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
};
export type IconName = keyof typeof ICON;

export const svg = (name: IconName, size = 14) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

let logoCache: string | null | undefined;
/** The full-colour VIFM logo (navy and blue, for light backgrounds), as a data URI (setContent cannot load /public URLs). Null if the file is missing. */
export function vifmLogoColour(): string | null {
  if (logoCache !== undefined) return logoCache;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "images", "vifm-logo-light.png"));
    logoCache = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />`;

/** Base page styles (A4, brand tokens) from html-common.js, trimmed to what these reports use. */
export const BASE_CSS = `
:root { --navy:#010131; --mid:#1A3A6B; --accent:#5391D5; --light:#A8C4E5; --pale:#D0DFF4; --off:#F5F7FA; --gray:#EDF1F5; --text:#1E293B; --muted:#64748B; --line:#E2E8F0; --amber:#B45309; --amberbg:#FEF3C7; --green:#00843D; --greenbg:#E8F5E9; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "Open Sans", Arial, sans-serif; color: var(--text); font-size: 10.5px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; padding: 12mm 15mm 16mm; page-break-after: always; position: relative; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.pfoot { position: absolute; left: 15mm; right: 15mm; bottom: 8mm; display: flex; justify-content: space-between; font-size: 8px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 4px; }
.band { background: var(--navy); color: #fff; border-radius: 10px; padding: 18px 22px; }
.band .eyebrow { color: var(--light); font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; font-weight: 600; }
.band h1 { font-size: 24px; margin: 6px 0 4px; font-weight: 700; line-height: 1.2; }
.band .sub { color: var(--pale); font-size: 11px; }
h2 { font-size: 15px; color: var(--navy); margin: 0 0 8px; font-weight: 700; }
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
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 5px 7px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-weight: 700; font-size: 9.5px; }
.pill.navy { background: var(--navy); color: #fff; }
.pill.light { background: var(--pale); color: var(--navy); } .pill.amber { background: var(--amberbg); color: var(--amber); }
.pill.green { background: var(--greenbg); color: var(--green); } .pill.gray { background: var(--gray); color: var(--muted); }
.bar { height: 7px; background: var(--gray); border-radius: 4px; position: relative; }
.bar .fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent); border-radius: 4px; }
`;
