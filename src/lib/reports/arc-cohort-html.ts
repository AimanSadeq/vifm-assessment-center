import { esc, svg, vifmLogoColour, FONT_LINKS, BASE_CSS } from "@/lib/reports/sdc-hipo/brand";
import {
  ARA_INDIVIDUAL_FACTORS,
  ARA_INDIVIDUAL_MATURITY_STAGES,
  ARA_FACTOR_TONES,
  getFactorTone,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { MIN_NORM_SAMPLE, ordinal } from "@/lib/ara/personal-norms";
import type { CompanyCohortDetail, CohortItemStat, CohortPillarStat } from "@/lib/ara/company-cohort-detail";
import type { RecommendedCourse } from "@/lib/recommender/courses";

export { cohortReportFilename } from "@/lib/ara/cohort-filenames";

/**
 * AI Readiness Compass: cohort dashboard for one voucher company.
 *
 * Client-facing and ORGANIZATIONAL ONLY: cohort aggregates, never a delegate's
 * name, email or score. Two layers when the vouchers carried both:
 *   1. the organizational pillars every delegate rated (department / division /
 *      enterprise sittings), pooled per pillar with agreement and item detail;
 *   2. the four-factor workforce readiness of the delegates themselves.
 *
 * Pure: HTML in, HTML out (A4 pages, inline SVG charts, no scripts), so it is
 * unit-tested without a browser. The PDF route renders it with Chromium.
 */

export type ArcCohortReportInput = {
  detail: CompanyCohortDetail;
  /** Programs for the workforce factor gaps (personal recommender). */
  personalCourses: RecommendedCourse[];
  /** Programs for the organizational pillar gaps (pillar recommender). */
  pillarCourses: RecommendedCourse[];
  generatedAt: string;
};

const TARGET = 4;
const ACCENT = "#5391D5";
const NAVY = "#010131";
const GRAY = "#CBD5E1";
const INK_MUTED = "#64748B";
/** One-hue sequential ramp for item heat cells (1.0 .. 5.0). */
const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab", "#0d366b"];
/** Status tones, always paired with a label. */
const TONE = {
  strong: { bg: "#dcfce7", fg: "#166534", bar: "#16a34a" },
  developing: { bg: "#fef3c7", fg: "#92400e", bar: "#d97706" },
  opportunity: { bg: "#fee2e2", fg: "#991b1b", bar: "#dc2626" },
  none: { bg: "#f1f5f9", fg: "#475569", bar: GRAY },
};

const f1 = (n: number | null | undefined) => (n == null ? "-" : n.toFixed(1));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const plural = (n: number, w: string, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);
const seqColor = (score: number) => SEQ[Math.max(0, Math.min(SEQ.length - 1, Math.round(((score - 1) / 4) * (SEQ.length - 1))))];
const seqInk = (score: number) => (score >= 3.4 ? "#fff" : NAVY);

function toneOf(score: number | null) {
  if (score == null) return { ...TONE.none, label: "No data" };
  const id = getFactorTone(score);
  return { ...TONE[id], label: ARA_FACTOR_TONES[id].en };
}
function levelTone(level: number) {
  if (level >= 4) return TONE.strong;
  if (level === 3) return TONE.developing;
  return TONE.opportunity;
}

// ---------------------------------------------------------------- SVG charts

/** Half-circle gauge: value out of 5, colored by tone, hero number inside. */
function gauge(value: number | null, color: string, sub: string, size = 150): string {
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size * 0.52;
  const arc = (from: number, to: number, stroke: string, w: number) => {
    const a0 = Math.PI * (1 + from);
    const a1 = Math.PI * (1 + to);
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = to - from > 0.5 ? 1 : 0;
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const frac = value == null ? 0 : Math.max(0, Math.min(1, (value - 1) / 4));
  // Target tick at 4.0, drawn across the track so it reads as a threshold.
  const ta = Math.PI * (1 + 0.75);
  const t0x = cx + (r - 9) * Math.cos(ta), t0y = cy + (r - 9) * Math.sin(ta);
  const t1x = cx + (r + 9) * Math.cos(ta), t1y = cy + (r + 9) * Math.sin(ta);
  return `<svg width="${size}" height="${size * 0.62}" viewBox="0 0 ${size} ${size * 0.62}" aria-hidden="true">
    ${arc(0, 1, "#EDF1F5", 11)}
    ${value != null && frac > 0.01 ? arc(0, frac, color, 11) : ""}
    <line x1="${t0x.toFixed(1)}" y1="${t0y.toFixed(1)}" x2="${t1x.toFixed(1)}" y2="${t1y.toFixed(1)}" stroke="${NAVY}" stroke-width="2" stroke-linecap="round"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="${size * 0.21}" font-weight="700" fill="${NAVY}" font-family="Open Sans, Arial, sans-serif">${value == null ? "-" : value.toFixed(1)}</text>
    <text x="${cx}" y="${cy + size * 0.07}" text-anchor="middle" font-size="${size * 0.058}" fill="${INK_MUTED}" font-family="Open Sans, Arial, sans-serif">${esc(sub)}</text>
    <text x="${size * 0.1}" y="${cy + size * 0.07}" text-anchor="middle" font-size="${size * 0.05}" fill="${INK_MUTED}" font-family="Open Sans, Arial, sans-serif">1</text>
    <text x="${size * 0.9}" y="${cy + size * 0.07}" text-anchor="middle" font-size="${size * 0.05}" fill="${INK_MUTED}" font-family="Open Sans, Arial, sans-serif">5</text>
  </svg>`;
}

/** Horizontal bars on a 1-5 scale with the target rule. */
function hbars(rows: { label: string; value: number | null; color: string; note?: string }[], opts?: { width?: number; labelW?: number; noteW?: number }): string {
  const W = opts?.width ?? 520, LW = opts?.labelW ?? 150, NW = opts?.noteW ?? 90, RH = 22, PAD = 10;
  const plotW = W - LW - NW - PAD;
  const H = rows.length * RH + 18;
  const x = (v: number) => LW + ((v - 1) / 4) * plotW;
  const ticks = [1, 2, 3, 4, 5]
    .map((t) => `<line x1="${x(t)}" y1="0" x2="${x(t)}" y2="${H - 16}" stroke="#EDF1F5" stroke-width="1"/><text x="${x(t)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="${INK_MUTED}">${t}</text>`)
    .join("");
  const body = rows
    .map((r, i) => {
      const y = i * RH + 4;
      const v = r.value;
      const w = v == null ? 0 : Math.max(0, x(v) - LW);
      return `<text x="${LW - 8}" y="${y + 11}" text-anchor="end" font-size="9.5" fill="#1E293B" font-weight="600">${esc(r.label)}</text>
        <rect x="${LW}" y="${y + 2}" width="${plotW}" height="10" fill="#F5F7FA"/>
        ${w > 0 ? `<path d="M${LW} ${y + 2} h${Math.max(0, w - 4)} a4 4 0 0 1 4 4 v2 a4 4 0 0 1 -4 4 h-${Math.max(0, w - 4)} z" fill="${r.color}"/>` : ""}
        <text x="${LW + w + 6}" y="${y + 11}" font-size="9" font-weight="700" fill="#1E293B">${v == null ? "-" : v.toFixed(1)}</text>
        ${r.note ? `<text x="${W}" y="${y + 11}" text-anchor="end" font-size="8.5" fill="${INK_MUTED}">${esc(r.note)}</text>` : ""}`;
    })
    .join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Open Sans, Arial, sans-serif" aria-hidden="true">${ticks}
    <line x1="${x(TARGET)}" y1="0" x2="${x(TARGET)}" y2="${H - 16}" stroke="${NAVY}" stroke-width="1.2"/>
    <text x="${x(TARGET) + 3}" y="${H - 18}" font-size="7.5" fill="${NAVY}" font-weight="700">target ${TARGET}.0</text>
    ${body}</svg>`;
}

/** Range (min to max) with the mean marker: how far apart the delegates are. */
function ranges(rows: { label: string; min: number; max: number; mean: number; n: number; divided: boolean }[], W = 520): string {
  const LW = 150, NW = 86, RH = 24, plotW = W - LW - NW - 10, H = rows.length * RH + 18;
  const x = (v: number) => LW + ((v - 1) / 4) * plotW;
  const ticks = [1, 2, 3, 4, 5].map((t) => `<line x1="${x(t)}" y1="0" x2="${x(t)}" y2="${H - 16}" stroke="#EDF1F5"/><text x="${x(t)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="${INK_MUTED}">${t}</text>`).join("");
  const body = rows.map((r, i) => {
    const y = i * RH + 12;
    return `<text x="${LW - 8}" y="${y + 3}" text-anchor="end" font-size="9.5" font-weight="600" fill="#1E293B">${esc(r.label)}</text>
      <line x1="${x(r.min)}" y1="${y}" x2="${x(r.max)}" y2="${y}" stroke="${r.divided ? "#d97706" : "#A8C4E5"}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="${x(r.mean)}" cy="${y}" r="5" fill="${NAVY}" stroke="#fff" stroke-width="2"/>
      <text x="${W}" y="${y + 3}" text-anchor="end" font-size="8.5" fill="${INK_MUTED}">${r.min.toFixed(1)} to ${r.max.toFixed(1)}${r.divided ? ", divided" : ""}</text>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Open Sans, Arial, sans-serif" aria-hidden="true">${ticks}
    <line x1="${x(TARGET)}" y1="0" x2="${x(TARGET)}" y2="${H - 16}" stroke="${NAVY}" stroke-width="1.2"/>${body}</svg>`;
}

/** Four-axis radar: cohort (filled), target (navy outline), population (gray outline). */
function radar(series: { cohort: (number | null)[]; population: (number | null)[] | null }, labels: string[], size = 230): string {
  // Wider than tall so the left and right axis labels have room.
  const W = size + 90;
  const cx = W / 2, cy = size / 2 - 4, R = size * 0.3;
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2;
  const pt = (i: number, v: number) => {
    const rr = ((Math.max(1, Math.min(5, v)) - 1) / 4) * R;
    return `${(cx + rr * Math.cos(ang(i))).toFixed(1)},${(cy + rr * Math.sin(ang(i))).toFixed(1)}`;
  };
  const poly = (vals: (number | null)[]) => vals.map((v, i) => pt(i, v ?? 1)).join(" ");
  const rings = [2, 3, 4, 5].map((v) => `<polygon points="${poly([v, v, v, v])}" fill="none" stroke="${v === TARGET ? NAVY : "#EDF1F5"}" stroke-width="${v === TARGET ? 1.2 : 1}"/>`).join("");
  const axes = [0, 1, 2, 3].map((i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, 5).split(",")[0]}" y2="${pt(i, 5).split(",")[1]}" stroke="#E2E8F0"/>`).join("");
  const lab = labels.map((l, i) => {
    const [x, y] = pt(i, 5.7).split(",").map(Number);
    const anchor = i === 1 ? "start" : i === 3 ? "end" : "middle";
    const dy = i === 0 ? -2 : i === 2 ? 8 : 3;
    return `<text x="${x}" y="${y + dy}" text-anchor="${anchor}" font-size="8.5" font-weight="600" fill="#1E293B">${esc(l)}</text>`;
  }).join("");
  const pop = series.population ? `<polygon points="${poly(series.population)}" fill="none" stroke="#94a3b8" stroke-width="1.5"/>` : "";
  const coh = `<polygon points="${poly(series.cohort)}" fill="${ACCENT}" fill-opacity="0.12" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round"/>` +
    series.cohort.map((v, i) => { const [x, y] = pt(i, v ?? 1).split(",").map(Number); return `<circle cx="${x}" cy="${y}" r="4" fill="${ACCENT}" stroke="#fff" stroke-width="2"/>`; }).join("");
  const legend = `<g font-size="8" fill="#475569" transform="translate(${(W - 190) / 2},${size - 8})">
      <rect x="0" y="-7" width="10" height="8" fill="${ACCENT}" fill-opacity="0.25" stroke="${ACCENT}"/><text x="14" y="0">Cohort</text>
      <line x1="56" y1="-3" x2="68" y2="-3" stroke="${NAVY}" stroke-width="1.5"/><text x="72" y="0">Target 4.0</text>
      ${series.population ? `<line x1="126" y1="-3" x2="138" y2="-3" stroke="#94a3b8" stroke-width="1.5"/><text x="142" y="0">All assessed</text>` : ""}
    </g>`;
  return `<svg width="100%" viewBox="0 0 ${W} ${size}" style="max-width:${W}px;display:block;margin:0 auto" font-family="Open Sans, Arial, sans-serif" aria-hidden="true">${rings}${axes}${pop}${coh}${lab}${legend}</svg>`;
}

/** Column chart of counts; the highlighted column carries the accent, the rest gray (emphasis). */
function columns(bins: { label: string; count: number; highlight?: boolean }[], W = 220, H = 110): string {
  const max = Math.max(1, ...bins.map((b) => b.count));
  const n = bins.length, slot = (W - 20) / n, bw = Math.min(24, slot * 0.6);
  const body = bins.map((b, i) => {
    const h = (b.count / max) * (H - 36);
    const x = 10 + i * slot + (slot - bw) / 2, y = H - 22 - h;
    return `<path d="M${x} ${H - 22} v-${Math.max(0, h - 4)} a4 4 0 0 1 4 -4 h${bw - 8} a4 4 0 0 1 4 4 v${Math.max(0, h - 4)} z" fill="${b.highlight ? ACCENT : GRAY}"/>
      <text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" font-size="9" font-weight="700" fill="#1E293B">${b.count}</text>
      <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="7.5" fill="${INK_MUTED}">${esc(b.label)}</text>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Open Sans, Arial, sans-serif" aria-hidden="true"><line x1="8" y1="${H - 22}" x2="${W - 8}" y2="${H - 22}" stroke="#E2E8F0"/>${body}</svg>`;
}

/** One stacked bar with 2px surface gaps; legend carries identity. */
function stacked(parts: { label: string; count: number; color: string }[], total: number, W = 520): string {
  const H = 16;
  let x = 0;
  const segs = parts.filter((p) => p.count > 0).map((p, i, arr) => {
    const w = (p.count / Math.max(1, total)) * W - (i < arr.length - 1 ? 2 : 0);
    const s = `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0, w).toFixed(1)}" height="${H}" rx="3" fill="${p.color}"/>` +
      (w > 26 ? `<text x="${(x + w / 2).toFixed(1)}" y="11.5" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">${p.count}</text>` : "");
    x += w + 2;
    return s;
  }).join("");
  const legend = parts.map((p) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:8.5px;color:#475569"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${p.color}"></i>${esc(p.label)} <b style="color:#1E293B">${p.count}</b></span>`).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${segs}</svg><div style="margin-top:5px">${legend}</div>`;
}

/** Completions per day with the cumulative line. */
function timeline(dates: string[], W = 520, H = 120): string {
  if (dates.length === 0) return `<p class="small muted">No completions yet.</p>`;
  const days = Array.from(new Set(dates.map((d) => d.slice(0, 10)))).sort();
  const first = new Date(`${days[0]}T00:00:00Z`).getTime(), last = new Date(`${days[days.length - 1]}T00:00:00Z`).getTime();
  const span = Math.max(1, Math.round((last - first) / 86400000) + 1);
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d.slice(0, 10), (counts.get(d.slice(0, 10)) ?? 0) + 1);
  const LW = 28, plotW = W - LW - 14, plotH = H - 34, maxC = Math.max(1, ...counts.values());
  const xOf = (iso: string) => LW + ((new Date(`${iso}T00:00:00Z`).getTime() - first) / 86400000 + 0.5) * (plotW / span);
  const bw = Math.min(18, Math.max(4, (plotW / span) * 0.6));
  let cum = 0;
  const pts: string[] = [];
  const bars = days.map((d) => {
    const c = counts.get(d) ?? 0; cum += c;
    const h = (c / maxC) * plotH, x = xOf(d) - bw / 2, y = H - 22 - h;
    pts.push(`${xOf(d).toFixed(1)},${(H - 22 - (cum / dates.length) * plotH).toFixed(1)}`);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="3" fill="${GRAY}"/>`;
  }).join("");
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const lastPt = pts[pts.length - 1].split(",");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Open Sans, Arial, sans-serif" aria-hidden="true">
    <line x1="${LW}" y1="${H - 22}" x2="${W - 10}" y2="${H - 22}" stroke="#E2E8F0"/>
    ${bars}
    <polyline points="${pts.join(" ")}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="4" fill="${ACCENT}" stroke="#fff" stroke-width="2"/>
    <text x="${Number(lastPt[0]) - 8}" y="${Number(lastPt[1]) - 7}" text-anchor="end" font-size="8.5" font-weight="700" fill="#1E293B">${dates.length} completed</text>
    <text x="${LW}" y="${H - 8}" font-size="8" fill="${INK_MUTED}">${esc(fmt(days[0]))}</text>
    ${days.length > 1 ? `<text x="${W - 10}" y="${H - 8}" text-anchor="end" font-size="8" fill="${INK_MUTED}">${esc(fmt(days[days.length - 1]))}</text>` : ""}
    <text x="${LW - 4}" y="${H - 22 - plotH + 4}" text-anchor="end" font-size="8" fill="${INK_MUTED}">${maxC}/day</text>
  </svg><div class="small muted" style="margin-top:2px">Bars: completions per day. Line: cumulative share of the cohort.</div>`;
}

/** Heat strip of items in one group: a cell per item, one-hue ramp by cohort mean. */
function heatStrip(items: CohortItemStat[]): string {
  return `<div class="heat">${items.map((it) => `<span class="cell" style="background:${seqColor(it.mean)};color:${seqInk(it.mean)}" title="${esc(it.text_en)}">${it.mean.toFixed(1)}</span>`).join("")}</div>`;
}

const heatLegend = `<div class="small muted" style="display:flex;align-items:center;gap:6px;margin-top:6px">Cohort mean per item: <span style="display:inline-flex;gap:1px">${SEQ.map((c) => `<i style="display:inline-block;width:14px;height:9px;background:${c}"></i>`).join("")}</span> 1.0 to 5.0. Each cell is one question.</div>`;

function itemList(items: CohortItemStat[], groupOf: (it: CohortItemStat) => string, kind: "strength" | "gap"): string {
  if (items.length === 0) return `<p class="small muted" style="margin:0">Nothing to list yet.</p>`;
  return `<ul class="items">${items.map((it) => `<li>
      <span class="score" style="background:${kind === "strength" ? TONE.strong.bg : TONE.opportunity.bg};color:${kind === "strength" ? TONE.strong.fg : TONE.opportunity.fg}">${it.mean.toFixed(1)}</span>
      <span><span class="eyebrow" style="margin:0;font-size:7.5px">${esc(groupOf(it))}</span><br>${esc(clip(it.text_en, 150))}<br><span class="small muted">${it.at_target} of ${it.n} at or above target</span></span></li>`).join("")}</ul>`;
}

// ---------------------------------------------------------------- page chrome

const EXTRA_CSS = `
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.top .tag { text-align:right; font-size:8.5px; letter-spacing:2px; text-transform:uppercase; color:var(--accent); font-weight:700; line-height:1.5; }
.blk { margin-bottom:10px; }
.kpi { background:#fff; border:1px solid var(--line); border-radius:8px; padding:8px 12px; }
.kpi .l { font-size:8.5px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); font-weight:700; }
.kpi .v { font-size:22px; font-weight:700; color:var(--navy); line-height:1.2; }
.grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.hero { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.hero .card { display:flex; gap:12px; align-items:center; }
.pill.strong { background:${TONE.strong.bg}; color:${TONE.strong.fg}; } .pill.developing { background:${TONE.developing.bg}; color:${TONE.developing.fg}; } .pill.opportunity { background:${TONE.opportunity.bg}; color:${TONE.opportunity.fg}; }
.cover-band { background:var(--navy); color:#fff; border-radius:12px; padding:26px 28px; margin:6px 0 14px; }
.cover-band .eyebrow { color:var(--light); }
.cover-band h1 { font-size:30px; margin:8px 0 6px; line-height:1.15; }
.cover-band .sub { color:var(--pale); font-size:12px; }
.toc li { display:flex; justify-content:space-between; border-bottom:1px solid var(--line); padding:5px 0; }
.toc li span:last-child { color:var(--muted); }
ul.items { list-style:none; margin:0; padding:0; } ul.items li { display:flex; gap:8px; align-items:flex-start; padding:5px 0; border-bottom:1px solid var(--line); font-size:9.5px; line-height:1.4; }
ul.items li:last-child { border-bottom:0; }
.score { flex:0 0 auto; min-width:30px; text-align:center; font-weight:700; font-size:10px; border-radius:6px; padding:2px 5px; margin-top:4px; }
.heat { display:flex; flex-wrap:wrap; gap:2px; } .heat .cell { display:inline-block; min-width:26px; text-align:center; font-size:7.5px; font-weight:700; padding:2px 3px; border-radius:3px; }
.levels td { padding:3px 6px; font-size:9px; }
.note { font-size:9.5px; color:#334155; margin:0; }
.fc { border-top:3px solid var(--line); }
.hl { font-size:15px; font-weight:700; color:var(--navy); line-height:1.25; margin:2px 0 4px; }
`;

function doc(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>${FONT_LINKS}<style>${BASE_CSS}${EXTRA_CSS}</style></head><body>${body}</body></html>`;
}

function topBar(company: string, section: string): string {
  const logo = vifmLogoColour();
  return `<div class="top">${logo ? `<img src="${logo}" style="height:34px" alt="VIFM">` : `<b style="color:var(--navy);font-size:16px">VIFM</b>`}<div class="tag">AI Readiness Compass  |  ${esc(company)}<br><span style="color:var(--muted);letter-spacing:1px">${esc(section)}</span></div></div>`;
}
const pfoot = (company: string, page: number, total: number) =>
  `<div class="pfoot"><span>AI Readiness Compass  |  ${esc(company)}  |  Cohort dashboard  |  VIFM, confidential</span><span>Page ${page} of ${total}</span></div>`;

// ---------------------------------------------------------------- the report

export function buildArcCohortReportHtml(input: ArcCohortReportInput): string {
  const { detail, generatedAt } = input;
  const { insight, org, personal_items } = detail;
  const company = insight.company_label;
  const scored = insight.respondents.filter((r) => r.overall != null).length;
  const completedDates = insight.respondents.map((r) => r.completed_at).filter((d): d is string => !!d);
  const stage = insight.cohort_overall != null ? getIndividualMaturityStage(insight.cohort_overall) : null;
  const wfTone = toneOf(insight.cohort_overall);
  const factors = ARA_INDIVIDUAL_FACTORS.map((f) => {
    const a = insight.factor_averages.find((x) => x.factor_id === f.id);
    const avg = a && a.respondent_count > 0 ? a.average : null;
    return { f, avg, below: a?.below_target_count ?? 0, n: a?.respondent_count ?? 0, t: toneOf(avg), pctl: insight.factor_percentiles[f.id], pop: insight.norm_factor_means[f.id] };
  });
  const byAvg = factors.filter((x) => x.avg != null).sort((a, b) => a.avg! - b.avg!);
  const weakestF = byAvg[0], strongestF = byAvg[byAvg.length - 1];
  const stageLabel = org ? { department: "department", division: "division", enterprise: "enterprise" }[org.stage] : null;
  const pillarsByMean = org ? org.pillars.slice().sort((a, b) => a.mean - b.mean) : [];
  const weakestP = pillarsByMean[0], strongestP = pillarsByMean[pillarsByMean.length - 1];
  const allOrgItems = org ? org.pillars.flatMap((p) => p.items.map((it) => ({ ...it, pillar: p.name_en }))) : [];
  const allPersonalItems = ARA_INDIVIDUAL_FACTORS.flatMap((f) => personal_items[f.id].map((it) => ({ ...it, factor: f.name_en })));
  const atOrAbove = insight.respondents.filter((r) => r.overall != null && r.overall >= TARGET).length;

  const pages: string[] = [];

  // 1. Cover -----------------------------------------------------------------
  const toc: string[] = ["Executive summary", "Participation"];
  if (org) toc.push("Organizational readiness by pillar", "Where the delegates agree, and where they do not", "Organizational strengths and gaps by question");
  toc.push("Workforce readiness by factor", "How the delegates are distributed", "Workforce strengths and gaps by question", "Development priorities", "About this report");
  pages.push(`${topBar(company, "Cohort dashboard")}
<div class="cover-band"><div class="eyebrow">AI Readiness Compass  |  Cohort dashboard</div>
  <h1>${esc(company)}</h1>
  <div class="sub">${plural(insight.completed, "delegate")} completed${org ? ` an ${esc(stageLabel ?? "")}-stage sitting: the organizational pillars and the personal readiness factors` : " the personal readiness snapshot"}  |  ${esc(generatedAt)}${insight.is_practice_only ? "  |  Practice data" : ""}</div></div>
<div class="hero blk">
  ${org ? `<div class="card"><div>${gauge(org.overall, org.band ? levelTone(ARA_OVERALL_BANDS.indexOf(org.band) + 1).bar : GRAY, "out of 5")}</div>
    <div><div class="eyebrow">${svg("grid")} Organizational readiness</div><div class="hl">${esc(org.band?.label_en ?? "Not scored")}</div>
    <p class="note">How ${plural(org.respondents, "delegate")} rate ${esc(company)} across ${plural(org.pillars.length, "pillar")} of AI readiness. Target: 4.0, Advanced.</p></div></div>` : ""}
  <div class="card"><div>${gauge(insight.cohort_overall, wfTone.bar, "out of 5")}</div>
    <div><div class="eyebrow">${svg("users")} Workforce readiness</div><div class="hl">${esc(stage?.name_en ?? "Not scored")}</div>
    <p class="note">${stage ? esc(stage.definition_en) : "No delegate has answered enough items to score yet."} Target: 4.0, confident routine use of AI at work.</p></div></div>
</div>
<div class="grid4 blk">
  <div class="kpi"><div class="l">Completed</div><div class="v">${insight.completed}</div><div class="small muted">of ${plural(insight.redeemed, "voucher")} redeemed</div></div>
  ${org ? `<div class="kpi"><div class="l">Priority pillar</div><div class="v" style="font-size:14px;margin-top:4px">${esc(weakestP?.name_en ?? "-")}</div><div class="small muted">${weakestP ? `${weakestP.mean.toFixed(1)} of 5, ${esc(weakestP.level.label_en)}` : ""}</div></div>` : `<div class="kpi"><div class="l">Scored</div><div class="v">${scored}</div><div class="small muted">delegates with a readiness score</div></div>`}
  <div class="kpi"><div class="l">Main workforce opportunity</div><div class="v" style="font-size:14px;margin-top:4px">${esc(weakestF?.f.name_en ?? "-")}</div><div class="small muted">${weakestF ? `${weakestF.avg!.toFixed(1)} of 5, ${weakestF.below} of ${weakestF.n} below target` : ""}</div></div>
  <div class="kpi"><div class="l">Population standing</div><div class="v">${insight.overall_percentile != null ? ordinal(insight.overall_percentile) : "-"}</div><div class="small muted">${insight.overall_percentile != null ? `percentile of all ${insight.norm_sample_size} personal snapshots` : `published once ${MIN_NORM_SAMPLE} snapshots exist (${insight.norm_sample_size} so far)`}</div></div>
</div>
<div class="card soft blk"><div class="eyebrow">${svg("info")} What is inside</div><ul class="toc" style="list-style:none;margin:0;padding:0">${toc.map((t, i) => `<li><span>${i + 2}. ${esc(t)}</span><span>page ${i + 2}</span></li>`).join("")}</ul></div>
<p class="note muted" style="position:absolute;bottom:22mm;left:15mm;right:15mm">This dashboard reports cohort aggregates only. No delegate is named and no individual score appears; each delegate holds their own Personal AI Readiness Report. Prepared by the Virginia Institute of Finance and Management on the Caliber platform.</p>`);

  // 2. Executive summary ----------------------------------------------------
  const orgLines: string[] = [];
  if (org && org.overall != null) {
    orgLines.push(`${company} rates its own AI readiness at ${org.overall.toFixed(1)} of 5 (${org.band?.label_en}) across ${org.pillars.length} pillars, as seen by ${plural(org.respondents, "delegate")}.`);
    if (strongestP) orgLines.push(`${strongestP.name_en} is the strongest pillar at ${strongestP.mean.toFixed(1)} (${strongestP.level.label_en}).`);
    if (weakestP) orgLines.push(`${weakestP.name_en} is the priority: ${weakestP.mean.toFixed(1)} (${weakestP.level.label_en}), with ${weakestP.below_target} of ${weakestP.n} delegates rating it below the 4.0 target.`);
    if (org.divided.length > 0) orgLines.push(`Delegates disagree most on ${org.divided.map((id) => org.pillars.find((p) => p.pillar_id === id)?.name_en ?? id).join(", ")}: a spread this wide usually means readiness differs by team or role rather than one organization-wide picture.`);
    else orgLines.push(`The delegates broadly agree on every pillar, so the pillar picture can be read as one organization-wide view.`);
  }
  const wfLines: string[] = [];
  if (insight.cohort_overall != null) {
    wfLines.push(`Workforce readiness averages ${insight.cohort_overall.toFixed(1)} of 5 (${stage?.name_en}); ${atOrAbove} of ${scored} delegates are at or above the 4.0 target.`);
    if (weakestF) wfLines.push(`${weakestF.f.name_en} is the main development opportunity at ${weakestF.avg!.toFixed(1)}, with ${weakestF.below} of ${weakestF.n} below target.`);
    if (strongestF && strongestF !== weakestF) wfLines.push(`${strongestF.f.name_en} is the strongest factor at ${strongestF.avg!.toFixed(1)} (${strongestF.t.label}).`);
    if (insight.overall_percentile != null) wfLines.push(`Against every personal snapshot on the platform (n=${insight.norm_sample_size}) the cohort sits at the ${ordinal(insight.overall_percentile)} percentile.`);
  }
  pages.push(`${topBar(company, "Executive summary")}
<h2>Executive summary</h2>
<div class="blk" style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px">
  <div class="stack" style="display:flex;flex-direction:column;gap:10px">
    ${org ? `<div class="card"><div class="eyebrow">${svg("grid")} The organization</div><ul class="ind pos">${orgLines.map((l) => `<li>${svg("check", 12)}<span>${esc(l)}</span></li>`).join("")}</ul></div>` : ""}
    <div class="card"><div class="eyebrow">${svg("users")} The workforce</div>${wfLines.length ? `<ul class="ind pos">${wfLines.map((l) => `<li>${svg("check", 12)}<span>${esc(l)}</span></li>`).join("")}</ul>` : `<p class="note">No delegate has answered enough items to score yet.</p>`}</div>
  </div>
  <div class="card"><div class="eyebrow">${svg("target")} Workforce factors vs target</div>${radar({ cohort: factors.map((x) => x.avg), population: insight.norms_ready ? factors.map((x) => x.pop) : null }, factors.map((x) => x.f.name_en.replace(/^AI /, "")), 232)}</div>
</div>
${org ? `<div class="card blk"><div class="eyebrow">${svg("grid")} Organizational pillars at a glance</div>${hbars(org.pillars.map((p) => ({ label: p.name_en, value: p.mean, color: levelTone(p.level.level).bar, note: `L${p.level.level} ${p.level.label_en}` })), { width: 540, labelW: 170, noteW: 92 })}</div>` : ""}
<div class="grid3 blk">
  <div class="card soft"><div class="eyebrow">${svg("flag")} Start here</div><p class="note">${org && weakestP ? `Raise <b>${esc(weakestP.name_en)}</b> first: it is the lowest pillar and ${weakestP.below_target === weakestP.n ? "every delegate" : `${weakestP.below_target} of ${weakestP.n} delegates`} rate it below target.` : weakestF ? `Build <b>${esc(weakestF.f.name_en)}</b> first: it is the lowest factor in the cohort.` : "Complete more sittings to establish a baseline."}</p></div>
  <div class="card soft"><div class="eyebrow">${svg("star")} Build on</div><p class="note">${org && strongestP ? `<b>${esc(strongestP.name_en)}</b> (${strongestP.mean.toFixed(1)}) is the organization's strongest pillar${strongestF ? `, and <b>${esc(strongestF.f.name_en)}</b> (${strongestF.avg!.toFixed(1)}) the workforce's strongest factor` : ""}.` : strongestF ? `<b>${esc(strongestF.f.name_en)}</b> (${strongestF.avg!.toFixed(1)}) is the cohort's strongest factor.` : "Nothing scored yet."}</p></div>
  <div class="card soft"><div class="eyebrow">${svg("trend")} Programs</div><p class="note">${input.pillarCourses.length + input.personalCourses.length > 0 ? `${plural(input.pillarCourses.length + input.personalCourses.length, "VIFM program")} match the gaps found here; see Development priorities.` : "No training gap wide enough to recommend a program."}</p></div>
</div>`);

  // 3. Participation ----------------------------------------------------------
  const started = insight.started, redeemed = insight.redeemed;
  pages.push(`${topBar(company, "Participation")}
<h2>Participation</h2>
<div class="grid2 blk">
  <div class="card"><div class="eyebrow">${svg("users")} Completion funnel</div>
    ${hbarsPlain([{ label: "Vouchers redeemed", value: redeemed }, { label: "Opened the assessment", value: started }, { label: "Completed", value: insight.completed }, { label: "Scored", value: scored }], redeemed)}
    <p class="note" style="margin-top:6px">${pct(insight.completed, redeemed)}% completion. ${insight.purged > 0 ? `${plural(insight.purged, "sitting")} cleared by retention purge and not counted. ` : ""}${insight.redeemed - insight.completed > 0 ? `${plural(insight.redeemed - insight.completed, "delegate")} still to finish.` : "Every delegate finished."}</p></div>
  <div class="card"><div class="eyebrow">${svg("clock")} When the cohort completed</div>${timeline(completedDates, 318, 120)}</div>
</div>
<div class="grid3 blk">
  <div class="kpi"><div class="l">Each delegate answered</div><div class="v" style="font-size:16px;margin-top:4px">${org ? `${org.questions_per_pillar != null ? `${org.questions_per_pillar} items per pillar` : "the pillar questions"} + ${allPersonalItems.length > 0 ? plural(Math.round(allPersonalItems.length), "personal item") : "the personal items"}` : plural(allPersonalItems.length, "personal item")}</div><div class="small muted">${org ? `${plural(org.pillars.length, "organizational pillar")} and 4 workforce factors` : "4 workforce factors"}</div></div>
  <div class="kpi"><div class="l">Assessment tier</div><div class="v" style="font-size:16px;margin-top:4px">${insight.tier_counts.deep_dive > 0 && insight.tier_counts.snapshot > 0 ? "Mixed" : insight.tier_counts.deep_dive > 0 ? "Deep dive" : "Snapshot"}</div><div class="small muted">${insight.tier_counts.snapshot} snapshot, ${insight.tier_counts.deep_dive} deep-dive</div></div>
  <div class="kpi"><div class="l">Data basis</div><div class="v" style="font-size:16px;margin-top:4px">${insight.is_practice_only ? "Practice" : "Live"}</div><div class="small muted">${insight.is_practice_only ? "practice codes, not norm-referenced" : "client sittings"}</div></div>
</div>
<div class="card soft blk"><div class="eyebrow">${svg("info")} How to read the two layers</div>
<p class="note">${org ? `<b>Organizational readiness</b> is each delegate's rating of ${esc(company)} itself on the pillars in scope (strategy, data, technology and so on): a perception measure pooled across the cohort, so agreement between delegates matters as much as the average. ` : ""}<b>Workforce readiness</b> is each delegate's own AI readiness on four factors, measured with self-ratings and scored scenario and knowledge items, then averaged across the cohort. Both use a 1 to 5 scale with 4.0 as the target.</p></div>
<div class="grid2 blk">
  ${org ? `<div class="card"><div class="eyebrow">${svg("grid")} Pillars in scope</div><div style="display:flex;flex-wrap:wrap;gap:5px">${org.pillars.map((p) => `<span class="pill light">${esc(p.name_en)} <span class="muted" style="font-weight:400">${p.n}</span></span>`).join("")}</div><p class="small muted" style="margin:6px 0 0">The number is how many delegates rated that pillar.</p></div>` : `<div class="card"><div class="eyebrow">${svg("grid")} Factors assessed</div><div style="display:flex;flex-wrap:wrap;gap:5px">${factors.map((x) => `<span class="pill light">${esc(x.f.name_en)} <span class="muted" style="font-weight:400">${x.n}</span></span>`).join("")}</div></div>`}
  <div class="card"><div class="eyebrow">${svg("trend")} Standing against everyone assessed</div>
    ${insight.norms_ready ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${factors.map((x) => `<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:var(--navy)">${x.pctl != null ? ordinal(x.pctl) : "-"}</div><div class="small muted" style="line-height:1.2">${esc(x.f.name_en.replace(/^AI /, ""))}</div></div>`).join("")}</div><p class="small muted" style="margin:6px 0 0">Percentile of the cohort mean among ${insight.norm_sample_size} personal snapshots on the platform.</p>` : `<p class="note">Population percentiles are published once ${MIN_NORM_SAMPLE} personal snapshots exist on the platform (${insight.norm_sample_size} so far).</p>`}</div>
</div>`);

  // 4-6. Organizational pages -------------------------------------------------
  if (org) {
    pages.push(`${topBar(company, "Organizational readiness")}
<h2>Organizational readiness by pillar</h2>
<div class="blk" style="display:grid;grid-template-columns:1fr 200px;gap:12px">
  <div class="card"><div class="eyebrow">${svg("grid")} Cohort mean per pillar, 1 to 5</div>${hbars(org.pillars.map((p) => ({ label: p.name_en, value: p.mean, color: levelTone(p.level.level).bar, note: `${p.below_target} of ${p.n} below target` })), { width: 436, labelW: 172, noteW: 86 })}</div>
  <div class="card" style="text-align:center"><div class="eyebrow" style="justify-content:center">${svg("target")} Overall</div>${gauge(org.overall, org.band ? levelTone(ARA_OVERALL_BANDS.indexOf(org.band) + 1).bar : GRAY, "out of 5", 150)}<div class="hl" style="font-size:13px">${esc(org.band?.label_en ?? "-")}</div><p class="small muted" style="margin:0">Equal-weight mean of the ${org.pillars.length} pillars, ${plural(org.respondents, "delegate")}</p></div>
</div>
<div class="card blk"><div class="eyebrow">${svg("grid")} Pillar detail</div>
<table><tr><th>Pillar</th><th style="width:40px">Mean</th><th style="width:96px">Maturity level</th><th style="width:78px">Below target</th><th>What the pillar covers</th></tr>
${org.pillars.map((p) => `<tr><td><b>${esc(p.name_en)}</b></td><td><b>${p.mean.toFixed(1)}</b></td><td><span class="pill ${p.level.level >= 4 ? "strong" : p.level.level === 3 ? "developing" : "opportunity"}">L${p.level.level} ${esc(p.level.label_en)}</span></td><td>${p.below_target} of ${p.n}</td><td class="small">${esc(p.description_en)}</td></tr>`).join("")}
</table></div>
<div class="card soft blk"><div class="eyebrow">${svg("info")} Maturity levels</div><table class="levels"><tr>${ARA_MATURITY_LEVELS.map((l) => `<td><b>L${l.level} ${esc(l.label_en)}</b><br><span class="muted">${l.min.toFixed(1)} to ${l.max.toFixed(1)}</span></td>`).join("")}</tr></table>
<p class="note" style="margin-top:4px">The target for an AI-ready organization is 4.0 (Advanced). A pillar below 3.0 is still exploring: the practices exist in pockets, not as a system.</p></div>`);

    pages.push(`${topBar(company, "Organizational readiness")}
<h2>Where the delegates agree, and where they do not</h2>
<div class="card blk"><div class="eyebrow">${svg("users")} Range of delegate ratings per pillar</div>
${ranges(org.pillars.map((p) => ({ label: p.name_en, min: p.min, max: p.max, mean: p.mean, n: p.n, divided: org.divided.includes(p.pillar_id) })), 540)}
<p class="note" style="margin-top:6px">Each bar runs from the lowest to the highest delegate rating of the pillar; the dot is the cohort mean. A bar wider than about two points means the delegates do not share one picture of the organization, which is itself a finding: readiness differs by team, role or exposure.</p></div>
<div class="grid2 blk">
  <div class="card"><div class="eyebrow">${svg("grid")} How the delegates see the organization overall</div>
    ${stacked(ARA_OVERALL_BANDS.map((b, i) => ({ label: b.label_en, count: org.band_counts[i], color: [TONE.opportunity.bar, "#f97316", TONE.developing.bar, TONE.strong.bar, "#166534"][i] })), org.overall_scores.length, 250)}
    <p class="note" style="margin-top:8px">${org.overall_scores.length} delegate${org.overall_scores.length === 1 ? "" : "s"}, each placed by their own overall rating of ${esc(company)}. Lowest ${f1(org.overall_scores[0])}, highest ${f1(org.overall_scores[org.overall_scores.length - 1])}.</p></div>
  <div class="card soft"><div class="eyebrow">${svg("flag")} Reading the agreement</div>
    ${org.divided.length > 0
      ? `<p class="note"><b>Divided:</b> ${esc(org.divided.map((id) => org.pillars.find((p) => p.pillar_id === id)?.name_en ?? id).join(", "))}. The mean understates what some delegates experience and overstates it for others. Before investing, find out which teams sit at each end.</p>`
      : `<p class="note"><b>Broad agreement</b> on every pillar: the delegates describe the same organization, so the pillar means can be acted on directly.</p>`}
    <p class="note" style="margin-top:6px"><b>Shared gaps:</b> ${(() => { const s = org.pillars.filter((p) => p.below_target === p.n && p.n > 0); return s.length ? esc(s.map((p) => p.name_en).join(", ")) + " sit below target for every delegate: fix once, centrally." : "none; every pillar has at least one delegate at target."; })()}</p></div>
</div>
<div class="card blk"><div class="eyebrow">${svg("grid")} Agreement by pillar</div>
<table><tr><th>Pillar</th><th style="width:44px">Mean</th><th style="width:44px">Lowest</th><th style="width:44px">Highest</th><th style="width:52px">Spread</th><th style="width:88px">Agreement</th><th>Reading</th></tr>
${org.pillars.map((p) => { const a = p.sd < 0.6 ? "Consistent" : p.sd < 0.9 ? "Mixed" : "Divided"; return `<tr><td><b>${esc(p.name_en)}</b></td><td>${p.mean.toFixed(1)}</td><td>${p.min.toFixed(1)}</td><td>${p.max.toFixed(1)}</td><td>${(p.max - p.min).toFixed(1)}</td><td><span class="pill ${a === "Consistent" ? "strong" : a === "Mixed" ? "developing" : "opportunity"}">${a}</span></td><td class="small">${a === "Consistent" ? "One organization-wide picture; act on the mean." : a === "Mixed" ? "Some teams ahead of others; check where before scaling a fix." : "Delegates describe different realities; diagnose by team first."}</td></tr>`; }).join("")}
</table><p class="small muted" style="margin:6px 0 0">Spread is the highest minus the lowest delegate rating. Agreement uses the standard deviation of the delegates' pillar means: under 0.6 consistent, under 0.9 mixed, otherwise divided.</p></div>`);

    const orgStrengths = allOrgItems.slice().sort((a, b) => b.mean - a.mean).slice(0, 6);
    const orgGaps = allOrgItems.slice().sort((a, b) => a.mean - b.mean).slice(0, 6);
    pages.push(`${topBar(company, "Organizational readiness")}
<h2>Organizational strengths and gaps by question</h2>
<div class="grid2 blk">
  <div class="card"><div class="eyebrow">${svg("plus")} Strongest practices</div>${itemList(orgStrengths, (it) => (it as typeof orgStrengths[number]).pillar, "strength")}</div>
  <div class="card"><div class="eyebrow">${svg("target")} Widest gaps</div>${itemList(orgGaps, (it) => (it as typeof orgGaps[number]).pillar, "gap")}</div>
</div>
<div class="card blk"><div class="eyebrow">${svg("grid")} Every pillar question, by cohort mean</div>
${org.pillars.map((p) => `<div style="display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:center;margin:3px 0"><span class="small" style="font-weight:600">${esc(p.name_en)}</span>${heatStrip(p.items)}</div>`).join("")}
${heatLegend}</div>`);
  }

  // 7. Workforce overview -----------------------------------------------------
  pages.push(`${topBar(company, "Workforce readiness")}
<h2>Workforce readiness by factor</h2>
<div class="blk" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
${factors.map(({ f, avg, below, n, t, pctl, pop }) => `
  <div class="card fc" style="border-top-color:${f.color}">
    <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:${f.color}"></span><span class="eyebrow" style="margin:0;color:var(--muted)">${esc(f.domain)}</span><span class="pill" style="margin-left:auto;background:${t.bg};color:${t.fg}">${esc(t.label)}</span></div>
    <div style="font-size:12.5px;font-weight:700;margin:3px 0 2px">${esc(f.name_en)}</div>
    <p class="small" style="margin:0 0 6px;color:#334155">${esc(f.description_en)}</p>
    <div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:24px;font-weight:700;color:var(--navy)">${f1(avg)}</span><span class="muted">/ 5</span><span class="small muted" style="margin-left:auto">${n > 0 ? `${below} of ${n} below target` : "no scores yet"}</span></div>
    <div class="bar" style="margin-top:4px"><div class="fill" style="width:${avg != null ? Math.round(((avg - 1) / 4) * 100) : 0}%;background:${t.bar}"></div></div>
    <div class="small muted" style="margin-top:5px">${pctl != null ? `${ordinal(pctl)} percentile of all assessed` : insight.norms_ready ? "" : "percentile published at " + MIN_NORM_SAMPLE + " snapshots"}${pop != null && avg != null ? `  |  all assessed average ${pop.toFixed(1)}` : ""}</div>
  </div>`).join("")}
</div>
<div class="grid2 blk">
  <div class="card"><div class="eyebrow">${svg("target")} Cohort vs target${insight.norms_ready ? " vs everyone assessed" : ""}</div>${radar({ cohort: factors.map((x) => x.avg), population: insight.norms_ready ? factors.map((x) => x.pop) : null }, factors.map((x) => x.f.name_en.replace(/^AI /, "")), 220)}</div>
  <div class="card soft"><div class="eyebrow">${svg("info")} What the numbers say</div><ul class="ind pos">${byAvg.map((x) => `<li>${svg(x.avg! < 3 ? "target" : x.avg! >= TARGET ? "check" : "trend", 12)}<span>${esc(factorReading(x.f.name_en, x.avg!, x.below, x.n, x === weakestF && byAvg.length > 1))}</span></li>`).join("")}</ul></div>
</div>`);

  // 8. Workforce distribution -------------------------------------------------
  const bins = (id: AraIndividualFactorId) => {
    const vals = insight.respondents.map((r) => r.per_factor[id]).filter((v): v is number => v != null);
    const b = [0, 0, 0, 0];
    for (const v of vals) b[v >= 4 ? 3 : v >= 3 ? 2 : v >= 2 ? 1 : 0] += 1;
    return [{ label: "1 to 1.9", count: b[0] }, { label: "2 to 2.9", count: b[1] }, { label: "3 to 3.9", count: b[2] }, { label: "4 to 5", count: b[3], highlight: true }];
  };
  const overallVals = insight.respondents.map((r) => r.overall).filter((v): v is number => v != null);
  const spread = overallVals.length > 1 ? Math.max(...overallVals) - Math.min(...overallVals) : 0;
  pages.push(`${topBar(company, "Workforce readiness")}
<h2>How the delegates are distributed</h2>
<div class="blk" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
${factors.map(({ f }) => `<div class="card" style="padding:8px"><div class="small" style="font-weight:700;display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${f.color}"></span>${esc(f.name_en)}</div>${columns(bins(f.id), 118, 100)}</div>`).join("")}
</div>
<p class="small muted" style="margin:-4px 0 10px">Delegates per score band on each factor. The highlighted column is the share already at or above the 4.0 target.</p>
<div class="grid2 blk">
  <div class="card"><div class="eyebrow">${svg("users")} Maturity spread</div>
    ${stacked([{ label: `${ARA_INDIVIDUAL_MATURITY_STAGES[0].name_en} (1.0 to 2.9)`, count: insight.band_distribution.emerging, color: TONE.opportunity.bar }, { label: `${ARA_INDIVIDUAL_MATURITY_STAGES[1].name_en} (3.0 to 3.9)`, count: insight.band_distribution.practising, color: TONE.developing.bar }, { label: `${ARA_INDIVIDUAL_MATURITY_STAGES[2].name_en} (4.0 to 5.0)`, count: insight.band_distribution.embedded, color: TONE.strong.bar }], scored, 250)}
    <p class="note" style="margin-top:8px">${scored} scored delegates by overall readiness stage. ${insight.band_distribution.embedded} already work with AI as a confident, routine part of the job.</p></div>
  <div class="card soft"><div class="eyebrow">${svg("info")} Consistency</div>
    <p class="note">${overallVals.length > 1 ? `Overall scores run from ${f1(Math.min(...overallVals))} to ${f1(Math.max(...overallVals))}, a spread of ${spread.toFixed(1)} points. ${spread >= 2 ? "That is a wide range: a one-size program will bore the top and lose the bottom, so stream the cohort by stage." : spread >= 1 ? "A moderate range: one program with stretch material for the Embedded group will serve most delegates." : "A tight range: the cohort can be developed as one group."}` : "Not enough scored delegates to describe the spread."}</p>
    <p class="note" style="margin-top:6px">${ARA_INDIVIDUAL_MATURITY_STAGES.map((s) => `<b>${esc(s.name_en)}</b>: ${esc(s.definition_en)}`).join(" ")}</p></div>
</div>
<div class="card blk"><div class="eyebrow">${svg("users")} Every delegate's overall readiness, anonymous</div>${dotStrip(overallVals, insight.cohort_overall)}
<p class="small muted" style="margin:4px 0 0">One dot per scored delegate on the 1 to 5 scale, no names. The navy marker is the cohort mean; the rule is the 4.0 target.</p></div>
<div class="card blk"><div class="eyebrow">${svg("target")} Share of delegates at or above target, by factor</div>
${hbarsPct(factors.map((x) => ({ label: x.f.name_en, value: x.n > 0 ? pct(x.n - x.below, x.n) : 0, color: x.f.color, note: x.n > 0 ? `${x.n - x.below} of ${x.n}` : "" })))}</div>`);

  // 9. Workforce items --------------------------------------------------------
  const pStrengths = allPersonalItems.slice().sort((a, b) => b.mean - a.mean).slice(0, 6);
  const pGaps = allPersonalItems.slice().sort((a, b) => a.mean - b.mean).slice(0, 6);
  pages.push(`${topBar(company, "Workforce readiness")}
<h2>Workforce strengths and gaps by question</h2>
${allPersonalItems.length === 0 ? `<p class="note">Item-level detail appears once delegates have scored answers.</p>` : `<div class="grid2 blk">
  <div class="card"><div class="eyebrow">${svg("plus")} Where the cohort is strongest</div>${itemList(pStrengths, (it) => (it as typeof pStrengths[number]).factor, "strength")}</div>
  <div class="card"><div class="eyebrow">${svg("target")} Where the cohort is weakest</div>${itemList(pGaps, (it) => (it as typeof pGaps[number]).factor, "gap")}</div>
</div>
<div class="card blk"><div class="eyebrow">${svg("grid")} Every personal item, by cohort mean</div>
${ARA_INDIVIDUAL_FACTORS.map((f) => `<div style="display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:center;margin:3px 0"><span class="small" style="font-weight:600;display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${f.color}"></span>${esc(f.name_en)}</span>${heatStrip(personal_items[f.id])}</div>`).join("")}
${heatLegend}</div>`}`);

  // 10. Development priorities ------------------------------------------------
  const courseTable = (rows: RecommendedCourse[]) => rows.length === 0
    ? `<p class="note">No gap wide enough to recommend a program here.</p>`
    : `<table><tr><th style="width:18px">#</th><th>Program</th><th style="width:72px">Level</th><th style="width:52px">Length</th><th>Addresses</th></tr>${rows.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.title_en)}</b>${c.course_code ? ` <span class="small muted">${esc(c.course_code)}</span>` : ""}</td><td>${esc(c.level)}</td><td>${c.default_duration_days} day${c.default_duration_days === 1 ? "" : "s"}</td><td class="small">${esc(c.drivers.slice().sort((a, b) => b.contribution - a.contribution).slice(0, 2).map((d) => d.label).join(", "))}</td></tr>`).join("")}</table>`;
  pages.push(`${topBar(company, "Development priorities")}
<h2>Development priorities</h2>
${org ? `<div class="card blk"><div class="eyebrow">${svg("grid")} For the organization: programs matched to the pillar gaps</div>${courseTable(input.pillarCourses.slice(0, 5))}
<p class="small muted" style="margin:6px 0 0">Ranked by the gap between each pillar's cohort mean and the 4.0 target, multiplied by the program's relevance to that pillar.</p></div>` : ""}
<div class="card blk"><div class="eyebrow">${svg("users")} For the workforce: programs matched to the factor gaps</div>${courseTable(input.personalCourses.slice(0, 5))}
<p class="small muted" style="margin:6px 0 0">Ranked by the gap between each factor's cohort mean and the 4.0 target, multiplied by the program's relevance to that factor.</p></div>
<div class="grid2 blk">
  <div class="card soft"><div class="eyebrow">${svg("flag")} Suggested sequence</div><ol style="margin:0;padding-left:16px;font-size:9.5px;line-height:1.5">
    ${org && weakestP ? `<li><b>Organization first:</b> address ${esc(weakestP.name_en)} (${weakestP.mean.toFixed(1)}), the pillar that limits everything else.</li>` : ""}
    ${weakestF ? `<li><b>Workforce foundation:</b> lift ${esc(weakestF.f.name_en)} (${weakestF.avg!.toFixed(1)}) across the ${weakestF.below} delegates below target.</li>` : ""}
    ${insight.band_distribution.embedded > 0 ? `<li><b>Use the ${plural(insight.band_distribution.embedded, "Embedded delegate")}</b> as internal champions and peer coaches.</li>` : ""}
    <li><b>Re-assess</b> after the program to measure the shift on the same scales.</li></ol></div>
  <div class="card soft"><div class="eyebrow">${svg("info")} Evidence behind the priorities</div><p class="note">${org ? `Pillar means come from ${plural(org.respondents, "delegate's", "delegates'")} ratings of ${esc(company)} on ${org.questions_per_pillar != null ? `${org.questions_per_pillar} items per pillar` : "the pillar items in scope"}. ` : ""}Factor means come from ${plural(scored, "scored delegate")} on ${allPersonalItems.length > 0 ? `${allPersonalItems.length} personal items` : "the personal items"}. Programs are drawn from the VIFM catalog by pillar and factor tags; the list is a starting point for a conversation, not a prescription.</p></div>
</div>`);

  // 11. About -----------------------------------------------------------------
  pages.push(`${topBar(company, "About this report")}
<h2>About this report</h2>
<div class="grid2 blk">
  <div class="card"><div class="eyebrow">${svg("info")} Method</div>
    <p class="note">${org ? `Each delegate completed a ${esc(stageLabel ?? "")}-stage AI Readiness Compass sitting: the organizational pillar questions about ${esc(company)} and the four-factor personal readiness items. ` : "Each delegate completed the VIFM Personal AI Readiness Snapshot. "}Every item is scored on a 1 to 5 scale. Cohort figures are the mean of the delegates' scores; the range and standard deviation describe agreement. The target of 4.0 marks confident, routine readiness on both layers.</p>
    <p class="note" style="margin-top:6px">Population percentiles compare the cohort mean with every personal snapshot collected on the platform to date and are published once at least ${MIN_NORM_SAMPLE} snapshots exist. Programs are matched from the VIFM catalog by the gap to target multiplied by each program's tagged relevance.</p></div>
  <div class="card"><div class="eyebrow">${svg("grid")} Scales</div>
    <table class="levels"><tr><th colspan="2">Organizational maturity (per pillar)</th></tr>${ARA_MATURITY_LEVELS.map((l) => `<tr><td><b>L${l.level} ${esc(l.label_en)}</b></td><td class="muted">${l.min.toFixed(1)} to ${l.max.toFixed(1)}</td></tr>`).join("")}</table>
    <table class="levels" style="margin-top:6px"><tr><th colspan="2">Workforce readiness stage (per delegate)</th></tr>${ARA_INDIVIDUAL_MATURITY_STAGES.slice().reverse().map((s, i) => `<tr><td><b>${esc(s.name_en)}</b></td><td class="muted">${["4.0 to 5.0", "3.0 to 3.9", "1.0 to 2.9"][i]}</td></tr>`).join("")}</table></div>
</div>
<div class="card soft blk"><div class="eyebrow">${svg("alert")} Reading and confidentiality</div>
  <p class="note">Scores describe self-reported and demonstrated readiness at the time of the assessment. They are a development signal, not a selection decision, and organizational ratings are the delegates' perception of ${esc(company)}, not an audit. Individual results are confidential to each delegate and appear nowhere in this document; the cohort view is shared with ${esc(company)} at the organizational level only.</p>
  <p class="note" style="margin-top:6px">Prepared by the Virginia Institute of Finance and Management on the Caliber platform, ${esc(generatedAt)}.</p></div>`);

  const total = pages.length;
  const body = pages.map((p, i) => `<div class="page">${p}${pfoot(company, i + 1, total)}</div>`).join("");
  return doc(`${company}: AI readiness cohort dashboard`, body);
}

/** Anonymous dots on a 1-5 axis, stacked where they coincide, with the mean and the target. */
function dotStrip(values: number[], mean: number | null, W = 540): string {
  const LW = 14, plotW = W - LW - 14, H = 64;
  const x = (v: number) => LW + ((v - 1) / 4) * plotW;
  const slots = new Map<number, number>();
  const dots = values.slice().sort((a, b) => a - b).map((v) => {
    const key = Math.round(v * 10);
    const k = slots.get(key) ?? 0;
    slots.set(key, k + 1);
    return `<circle cx="${x(v).toFixed(1)}" cy="${(40 - k * 9).toFixed(1)}" r="4" fill="${ACCENT}" stroke="#fff" stroke-width="2"/>`;
  }).join("");
  const ticks = [1, 2, 3, 4, 5].map((t) => `<line x1="${x(t)}" y1="46" x2="${x(t)}" y2="50" stroke="#94a3b8"/><text x="${x(t)}" y="60" text-anchor="middle" font-size="8" fill="${INK_MUTED}">${t}</text>`).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Open Sans, Arial, sans-serif" aria-hidden="true">
    <line x1="${LW}" y1="46" x2="${W - 14}" y2="46" stroke="#E2E8F0"/>${ticks}
    <line x1="${x(TARGET)}" y1="4" x2="${x(TARGET)}" y2="46" stroke="${NAVY}" stroke-width="1.2"/>
    ${mean != null ? `<path d="M${x(mean) - 5} 52 l5 -6 l5 6 z" fill="${NAVY}"/>` : ""}
    ${dots}</svg>`;
}

/** Percentage bars (0 to 100) in the factor's own color. */
function hbarsPct(rows: { label: string; value: number; color: string; note: string }[], W = 540): string {
  const LW = 150, NW = 60, RH = 20, plotW = W - LW - NW - 44, H = rows.length * RH + 4;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Open Sans, Arial, sans-serif" aria-hidden="true">${rows.map((r, i) => {
    const y = i * RH + 2, w = (r.value / 100) * plotW;
    return `<text x="${LW - 8}" y="${y + 11}" text-anchor="end" font-size="9.5" font-weight="600" fill="#1E293B">${esc(r.label)}</text><rect x="${LW}" y="${y + 2}" width="${plotW}" height="10" fill="#F5F7FA"/>${w > 0 ? `<path d="M${LW} ${y + 2} h${Math.max(0, w - 4)} a4 4 0 0 1 4 4 v2 a4 4 0 0 1 -4 4 h-${Math.max(0, w - 4)} z" fill="${r.color}"/>` : ""}<text x="${LW + w + 6}" y="${y + 11}" font-size="9" font-weight="700" fill="#1E293B">${r.value}%</text><text x="${W}" y="${y + 11}" text-anchor="end" font-size="8.5" fill="${INK_MUTED}">${esc(r.note)}</text>`;
  }).join("")}</svg>`;
}

/** Simple count bars for the funnel (not a 1-5 scale). */
function hbarsPlain(rows: { label: string; value: number }[], max: number): string {
  const W = 250, LW = 118, RH = 22, plotW = W - LW - 34, H = rows.length * RH + 4;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Open Sans, Arial, sans-serif" aria-hidden="true">${rows.map((r, i) => {
    const y = i * RH + 4, w = max > 0 ? (r.value / max) * plotW : 0;
    return `<text x="${LW - 8}" y="${y + 11}" text-anchor="end" font-size="9.5" font-weight="600" fill="#1E293B">${esc(r.label)}</text><rect x="${LW}" y="${y + 2}" width="${plotW}" height="10" fill="#F5F7FA"/>${w > 0 ? `<path d="M${LW} ${y + 2} h${Math.max(0, w - 4)} a4 4 0 0 1 4 4 v2 a4 4 0 0 1 -4 4 h-${Math.max(0, w - 4)} z" fill="${i === rows.length - 1 ? ACCENT : GRAY}"/>` : ""}<text x="${LW + w + 6}" y="${y + 11}" font-size="9" font-weight="700" fill="#1E293B">${r.value}</text>`;
  }).join("")}</svg>`;
}

function factorReading(name: string, avg: number, below: number, n: number, weakest: boolean): string {
  const a = avg.toFixed(1);
  if (avg >= TARGET) return `${name} is at or above the target of ${TARGET}.0 (${a}); ${below} of ${n} still sit below it, so the strength is not yet uniform.`;
  if (avg >= 3) return `${name} is developing: the cohort averages ${a}, with ${below} of ${n} delegates below the target of ${TARGET}.0.${weakest ? " This is the main opportunity." : ""}`;
  return `${name} is the cohort's main opportunity: an average of ${a}, with ${below} of ${n} delegates below the target of ${TARGET}.0. Development here will move the overall readiness most.`;
}

export type { CohortPillarStat };
