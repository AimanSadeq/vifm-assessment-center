import { TOKENS } from "../../report/_components/report-primitives";

/**
 * Print-safe inline-SVG charts for the cross-unit consolidation (Division /
 * Enterprise). Same restraint as the unit report's charts: fixed pt
 * geometry, brand palette, semantic maturity colours, bilingual labels
 * passed in by the caller. Every value drawn here is a value the engine
 * already computed (unit-rollup.ts); nothing is re-derived.
 */

const FONT = "'Open Sans','Noto Naskh Arabic','Segoe UI',Tahoma,sans-serif";

/** Maturity colour for a 1-5 score - the same rule the unit report's bars use. */
export function scoreColor(s: number | null | undefined): string {
  if (s == null) return TOKENS.line;
  if (s >= 4.0) return TOKENS.emerald;
  if (s >= 3.0) return TOKENS.amber;
  return TOKENS.rose;
}

/** Distinct series colours for unit polygons / legends (max six units drawn). */
export const SERIES_COLORS = [TOKENS.navy, TOKENS.accent, TOKENS.teal, TOKENS.amber, TOKENS.violet, TOKENS.rose] as const;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ─── 1. Spread chart - per pillar, the range across units ───
/**
 * One row per pillar: a track from 1 to 5, the min-to-max range across units
 * as a bar, the mean as a marker, the 4.00 target as a dashed line. The
 * consolidation's whole argument is that the range matters more than the
 * mean, so the range is the loudest element.
 */
export function SpreadChart({ rows, target = 4, lang = "en" }: {
  rows: Array<{ label: string; min: number; max: number; mean: number; unitsScored: number; sharedGap: boolean; uneven: boolean }>;
  target?: number;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const W = 540, LABEL_W = 172, VALUE_W = 92, ROW_H = 22, GAP = 6, TOP = 18, BOTTOM = 14;
  const chartW = W - LABEL_W - VALUE_W;
  const H = TOP + rows.length * (ROW_H + GAP) - GAP + BOTTOM;
  const x = (v: number) => LABEL_W + ((Math.max(1, Math.min(5, v)) - 1) / 4) * chartW;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={`${W}pt`} height={`${H}pt`} style={{ maxWidth: "100%" }} role="img"
      aria-label={rtl ? "التفاوت بين الوحدات حسب الركيزة" : "Spread across units by pillar"}>
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={TOP - 4} x2={x(v)} y2={H - BOTTOM} stroke={TOKENS.line} strokeWidth={1} />
          <text x={x(v)} y={H - 2} textAnchor="middle" fontFamily={FONT} fontSize={7} fill={TOKENS.mute}>{v}</text>
        </g>
      ))}
      <line x1={x(target)} y1={TOP - 10} x2={x(target)} y2={H - BOTTOM} stroke={TOKENS.navy} strokeWidth={1.2} strokeDasharray="4 3" />
      <text x={x(target)} y={TOP - 12} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={700} fill={TOKENS.navy}>
        {rtl ? `المستهدف ${target.toFixed(2)}` : `AI Ready ${target.toFixed(2)}`}
      </text>
      {rows.map((r, i) => {
        const y = TOP + i * (ROW_H + GAP);
        const cy = y + ROW_H / 2;
        const x1 = x(r.min), x2 = x(r.max);
        const tone = r.sharedGap ? TOKENS.rose : r.uneven ? TOKENS.amber : TOKENS.accent;
        return (
          <g key={r.label}>
            <text x={LABEL_W - 8} y={cy + 3} textAnchor="end" fontFamily={FONT} fontSize={8.5} fontWeight={600} fill={TOKENS.ink2}>
              {clip(r.label, 38)}
            </text>
            <rect x={LABEL_W} y={cy - 3} width={chartW} height={6} fill={TOKENS.bgPanel} stroke={TOKENS.line} strokeWidth={0.75} />
            {r.unitsScored > 1 && (
              <rect x={x1} y={cy - 5} width={Math.max(2, x2 - x1)} height={10} rx={3} fill={tone} opacity={0.35} />
            )}
            <circle cx={x1} cy={cy} r={3} fill={tone} />
            <circle cx={x2} cy={cy} r={3} fill={tone} />
            <circle cx={x(r.mean)} cy={cy} r={4.5} fill="white" stroke={TOKENS.navy} strokeWidth={1.6} />
            <text x={LABEL_W + chartW + 6} y={cy + 3} fontFamily={FONT} fontSize={8} fill={TOKENS.navy} fontWeight={700}>
              {r.mean.toFixed(2)}
              <tspan fontWeight={400} fill={TOKENS.mute}> {r.unitsScored > 1 ? `${r.min.toFixed(2)}–${r.max.toFixed(2)}` : (rtl ? "وحدة واحدة" : "1 unit")}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── 2. Agenda matrix - central programme vs practice transfer ───
/**
 * 2x2 over the pillars scored by more than one unit:
 *   X = how far the MEAN sits below the 4.00 target (0 = at target, right = far)
 *   Y = how far apart the units are (spread; the uneven threshold splits it)
 * Bottom-right: every unit is low and they agree - a central programme.
 * Top-right: low on average but somebody is well ahead - lift the rest by
 * transferring that unit's practice. Top-left: near target on average but
 * uneven - move practice, no new spend. Bottom-left: at target and aligned -
 * sustain. Points are numbered with a legend so labels never collide.
 */
export function AgendaMatrix({ points, unevenThreshold, target = 4, lang = "en" }: {
  points: Array<{ label: string; mean: number; spread: number; sharedGap: boolean }>;
  unevenThreshold: number;
  target?: number;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const PAD = 44, W = 400, H = 270, LEGEND_W = 210;
  const plotW = W - PAD * 2, plotH = H - PAD * 2;
  const maxGap = 3, maxSpread = Math.max(2, unevenThreshold * 2, ...points.map((p) => p.spread)) ;
  const R = 10;
  // X is CATEGORICAL by the report's own finding - left column: some unit is
  // at target; right column: shared gap (every unit below 4.00). Inside a
  // column, points spread by the mean's distance from target so they do not
  // pile up. Y is the spread, split at the uneven threshold.
  const colW = plotW / 2;
  const px = (gap: number, shared: boolean) => PAD + (shared ? colW : 0) + Math.max(R + 2, Math.min(colW - R - 2, (Math.max(0, Math.min(maxGap, gap)) / maxGap) * colW));
  const LABEL_BAND = 16; // quadrant names live in the bottom strip; points stay above it
  const py = (spread: number) => PAD + plotH - LABEL_BAND - Math.max(R, Math.min(plotH - LABEL_BAND - R, (Math.max(0, Math.min(maxSpread, spread)) / maxSpread) * (plotH - LABEL_BAND)));
  const placed = points.map((p, i) => ({ ...p, i, x: px(target - p.mean, p.sharedGap), y: py(p.spread) }));
  // Deterministic de-overlap: nudge later points that land on an earlier one.
  for (let a = 0; a < placed.length; a++) for (let b = 0; b < a; b++) {
    const dx = placed[a].x - placed[b].x, dy = placed[a].y - placed[b].y;
    if (Math.hypot(dx, dy) < R * 2 + 2) { placed[a].y = Math.max(PAD + R, placed[a].y - (R * 2 + 2)); }
  }
  const qLabel = (en: string, ar: string) => (rtl ? ar : en);
  const xSplit = PAD + colW, ySplit = py(unevenThreshold);
  return (
    <svg viewBox={`0 0 ${W + LEGEND_W} ${H}`} width={`${W + LEGEND_W}pt`} height={`${H}pt`} style={{ maxWidth: "100%" }} role="img"
      aria-label={rtl ? "مصفوفة الأجندة: مركزي مقابل نقل الممارسات" : "Agenda matrix: central programme versus practice transfer"}>
      {/* quadrant tints */}
      <rect x={PAD} y={PAD} width={xSplit - PAD} height={ySplit - PAD} fill="#eff6ff" />
      <rect x={xSplit} y={PAD} width={PAD + plotW - xSplit} height={ySplit - PAD} fill="#fffbeb" />
      <rect x={PAD} y={ySplit} width={xSplit - PAD} height={PAD + plotH - ySplit} fill="#f0fdf4" />
      <rect x={xSplit} y={ySplit} width={PAD + plotW - xSplit} height={PAD + plotH - ySplit} fill="#fef2f2" />
      <rect x={PAD} y={PAD} width={plotW} height={plotH} fill="none" stroke={TOKENS.line} />
      <line x1={xSplit} y1={PAD} x2={xSplit} y2={PAD + plotH} stroke={TOKENS.mute} strokeDasharray="3 3" />
      <line x1={PAD} y1={ySplit} x2={PAD + plotW} y2={ySplit} stroke={TOKENS.mute} strokeDasharray="3 3" />
      {/* quadrant names */}
      <text x={PAD + 6} y={PAD + 12} fontFamily={FONT} fontSize={7.5} fontWeight={700} fill="#1e3a8a">{qLabel("MOVE PRACTICE", "نقل الممارسات")}</text>
      <text x={PAD + plotW - 6} y={PAD + 12} textAnchor="end" fontFamily={FONT} fontSize={7.5} fontWeight={700} fill="#78350f">{qLabel("LIFT THE REST", "رفع البقية")}</text>
      <text x={PAD + 6} y={PAD + plotH - 6} fontFamily={FONT} fontSize={7.5} fontWeight={700} fill="#065f46">{qLabel("SUSTAIN", "الحفاظ")}</text>
      <text x={PAD + plotW - 6} y={PAD + plotH - 6} textAnchor="end" fontFamily={FONT} fontSize={7.5} fontWeight={700} fill="#9f1239">{qLabel("CENTRAL PROGRAMME", "برنامج مركزي")}</text>
      {/* axes */}
      <text x={PAD + plotW / 2} y={H - 10} textAnchor="middle" fontFamily={FONT} fontSize={8} fill={TOKENS.mute}>
        {qLabel("Some unit at 4.00   |   Shared gap: every unit below 4.00", "وحدة ما عند 4.00   |   فجوة مشتركة: كل الوحدات دون 4.00")}
      </text>
      <text x={14} y={PAD + plotH / 2} textAnchor="middle" fontFamily={FONT} fontSize={8} fill={TOKENS.mute} transform={`rotate(-90 14 ${PAD + plotH / 2})`}>
        {qLabel("Spread between units →", "← التفاوت بين الوحدات")}
      </text>
      {placed.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r={R} fill={scoreColor(p.mean)} stroke="white" strokeWidth={1.5} />
          <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontFamily={FONT} fontSize={9} fontWeight={700} fill="white">{p.i + 1}</text>
        </g>
      ))}
      {/* legend */}
      {placed.map((p) => (
        <g key={`l-${p.label}`}>
          <circle cx={W + 12} cy={PAD + 8 + p.i * 18} r={6} fill={scoreColor(p.mean)} />
          <text x={W + 12} y={PAD + 11 + p.i * 18} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={700} fill="white">{p.i + 1}</text>
          <text x={W + 24} y={PAD + 11 + p.i * 18} fontFamily={FONT} fontSize={8} fill={TOKENS.ink2}>
            {clip(p.label, 30)} <tspan fill={TOKENS.mute}>{p.mean.toFixed(2)} · ±{p.spread.toFixed(2)}</tspan>
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── 3. Multi-unit radar - each unit's pillar profile as a polygon ───
export function MultiRadar({ axes, series, target = 4, size = 340, lang = "en" }: {
  axes: Array<{ id: string; label: string }>;
  series: Array<{ label: string; color: string; values: Record<string, number | undefined> }>;
  target?: number;
  size?: number;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const SIDE = 110; // horizontal room for axis labels beyond the plot
  const TOTAL_W = size + SIDE * 2;
  const CX = TOTAL_W / 2, C = size / 2, R = size / 2 - 40, MAX = 5, n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, v: number) => ({ x: CX + (Math.max(0, Math.min(MAX, v)) / MAX) * R * Math.cos(angle(i)), y: C + (Math.max(0, Math.min(MAX, v)) / MAX) * R * Math.sin(angle(i)) });
  const ring = (v: number) => axes.map((_, i) => { const p = pt(i, v); return `${p.x},${p.y}`; }).join(" ");
  const LEGEND_H = 16 * Math.ceil(series.length / 2) + 6;
  return (
    <svg viewBox={`0 0 ${TOTAL_W} ${size + LEGEND_H}`} width={`${TOTAL_W}pt`} height={`${size + LEGEND_H}pt`} style={{ maxWidth: "100%" }} role="img"
      aria-label={rtl ? "ملف الركائز لكل وحدة" : "Pillar profile of each unit"}>
      {[1, 2, 3, 5].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke={TOKENS.line} strokeWidth={0.8} />)}
      <polygon points={ring(target)} fill="none" stroke={TOKENS.navy} strokeWidth={1.2} strokeDasharray="4 3" />
      {axes.map((a, i) => {
        const end = pt(i, MAX);
        const lp = { x: CX + (R + 14) * Math.cos(angle(i)), y: C + (R + 16) * Math.sin(angle(i)) + (Math.abs(Math.cos(angle(i))) < 0.2 ? (Math.sin(angle(i)) < 0 ? -2 : 6) : 3) };
        const anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? "middle" : Math.cos(angle(i)) > 0 ? "start" : "end";
        return (
          <g key={a.id}>
            <line x1={CX} y1={C} x2={end.x} y2={end.y} stroke={TOKENS.line} strokeWidth={0.8} />
            <text x={lp.x} y={lp.y} textAnchor={anchor} fontFamily={FONT} fontSize={7.5} fontWeight={600} fill={TOKENS.ink2}>{clip(a.label, 32)}</text>
          </g>
        );
      })}
      {series.map((s) => {
        const pts = axes.map((a, i) => pt(i, s.values[a.id] ?? 0));
        return (
          <g key={s.label}>
            <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill={s.color} fillOpacity={0.10} stroke={s.color} strokeWidth={1.6} />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={s.color} />)}
          </g>
        );
      })}
      <text x={CX} y={C + 4} textAnchor="middle" fontFamily={FONT} fontSize={7} fill={TOKENS.mute}>{target.toFixed(2)}</text>
      {series.map((s, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = col === 0 ? SIDE : TOTAL_W / 2 + 6, y = size + 10 + row * 16;
        return (
          <g key={`lg-${s.label}`}>
            <rect x={x} y={y - 7} width={10} height={10} rx={2} fill={s.color} />
            <text x={x + 14} y={y + 1} fontFamily={FONT} fontSize={8} fill={TOKENS.ink2}>{clip(s.label, 28)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── 4. Factor bars - the four individual factors as a compact chart ───
export function FactorBars({ items, target = 4, lang = "en" }: {
  items: Array<{ label: string; value: number | null; color: string }>;
  target?: number;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const W = 540, LABEL_W = 196, VALUE_W = 34, ROW_H = 18, GAP = 5, TOP = 16, BOTTOM = 14;
  const chartW = W - LABEL_W - VALUE_W;
  const H = TOP + items.length * (ROW_H + GAP) - GAP + BOTTOM;
  const x = (v: number) => LABEL_W + (Math.max(0, Math.min(5, v)) / 5) * chartW;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={`${W}pt`} height={`${H}pt`} style={{ maxWidth: "100%" }} role="img" aria-label={rtl ? "العوامل الأربعة" : "Four factors"}>
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={TOP - 6} x2={x(v)} y2={H - BOTTOM} stroke={TOKENS.line} strokeWidth={1} />
          <text x={x(v)} y={H - 2} textAnchor="middle" fontFamily={FONT} fontSize={7} fill={TOKENS.mute}>{v}</text>
        </g>
      ))}
      <line x1={x(target)} y1={TOP - 10} x2={x(target)} y2={H - BOTTOM} stroke={TOKENS.navy} strokeWidth={1.2} strokeDasharray="4 3" />
      {items.map((it, i) => {
        const y = TOP + i * (ROW_H + GAP);
        return (
          <g key={it.label}>
            <text x={LABEL_W - 8} y={y + ROW_H / 2 + 3} textAnchor="end" fontFamily={FONT} fontSize={8.5} fontWeight={600} fill={TOKENS.ink2}>{clip(it.label, 44)}</text>
            <rect x={LABEL_W} y={y + 4} width={chartW} height={ROW_H - 8} fill={TOKENS.bgPanel} stroke={TOKENS.line} strokeWidth={0.75} />
            {it.value != null && <rect x={LABEL_W} y={y + 4} width={x(it.value) - LABEL_W} height={ROW_H - 8} fill={it.color} />}
            <text x={LABEL_W + chartW + 6} y={y + ROW_H / 2 + 3} fontFamily={FONT} fontSize={8.5} fontWeight={700} fill={TOKENS.navy}>{it.value != null ? it.value.toFixed(2) : "-"}</text>
          </g>
        );
      })}
    </svg>
  );
}
