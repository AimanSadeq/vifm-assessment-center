import { TOKENS } from "./report-primitives";
import { ARA_MATURITY_LEVELS } from "@/lib/constants/ara-pillars";

/**
 * Print-safe inline-SVG charts for the ARC portrait report (client request
 * 2026-08-31: "take the visualization one or two notches up"). Pure server
 * components - fixed pt geometry, brand palette, no animation, breakInside
 * avoided by the calling sections. Deliberately restrained styling (hairlines,
 * navy/accent, semantic maturity colours) - no gradients-on-cards.
 */

const FONT = "'Open Sans','Segoe UI',Tahoma,sans-serif";

/** Maturity colour for a 1-5 score (mirrors the traffic-light grid). */
function scoreColor(s: number | null): string {
  if (s == null) return TOKENS.line;
  if (s >= 4.0) return TOKENS.emerald;
  if (s >= 3.0) return TOKENS.amber;
  return TOKENS.rose;
}

// ─── 1. Pillar Profile - ranked horizontal bars vs the benchmark ───
/** The exec-level "readiness profile at a glance": every in-scope pillar as a
 *  ranked horizontal bar on the 1-5 scale, maturity-coloured, with the AI-Ready
 *  benchmark (4.0) as a labelled reference line. */
export function PillarProfileChart({ items, benchmark = 4, lang = "en" }: {
  items: Array<{ label: string; score: number | null }>;
  benchmark?: number;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const sorted = [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const W = 520, LABEL_W = 150, VALUE_W = 34, ROW_H = 22, GAP = 6, TOP = 16, BOTTOM = 14;
  const chartW = W - LABEL_W - VALUE_W;
  const H = TOP + sorted.length * (ROW_H + GAP) - GAP + BOTTOM;
  const x = (v: number) => LABEL_W + (Math.max(0, Math.min(5, v)) / 5) * chartW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={`${W}pt`} height={`${H}pt`} style={{ maxWidth: "100%" }} role="img"
      aria-label={rtl ? "ملف الجاهزية حسب الركيزة" : "Readiness profile by pillar"}>
      {/* scale gridlines 1..5 */}
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={TOP - 6} x2={x(v)} y2={H - BOTTOM} stroke={TOKENS.line} strokeWidth={v === benchmark ? 0 : 1} />
          <text x={x(v)} y={H - 2} textAnchor="middle" fontFamily={FONT} fontSize={7} fill={TOKENS.mute}>{v}</text>
        </g>
      ))}
      {/* benchmark reference */}
      <line x1={x(benchmark)} y1={TOP - 10} x2={x(benchmark)} y2={H - BOTTOM} stroke={TOKENS.navy} strokeWidth={1.2} strokeDasharray="4 3" />
      <text x={x(benchmark)} y={TOP - 12} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={700} fill={TOKENS.navy}>
        {rtl ? `المعيار ${benchmark.toFixed(1)}` : `AI-Ready ${benchmark.toFixed(1)}`}
      </text>
      {sorted.map((it, i) => {
        const y = TOP + i * (ROW_H + GAP);
        const s = it.score;
        const w = s != null ? x(s) - LABEL_W : 0;
        return (
          <g key={it.label}>
            <text x={LABEL_W - 8} y={y + ROW_H / 2 + 3} textAnchor="end" fontFamily={FONT} fontSize={8.5} fontWeight={600} fill={TOKENS.ink2}>
              {it.label.length > 30 ? it.label.slice(0, 29) + "…" : it.label}
            </text>
            {/* track */}
            <rect x={LABEL_W} y={y + 4} width={chartW} height={ROW_H - 8} fill={TOKENS.bgPanel} stroke={TOKENS.line} strokeWidth={0.75} />
            {/* bar */}
            {s != null && <rect x={LABEL_W} y={y + 4} width={w} height={ROW_H - 8} fill={scoreColor(s)} />}
            <text x={LABEL_W + chartW + 6} y={y + ROW_H / 2 + 3} fontFamily={FONT} fontSize={8.5} fontWeight={700} fill={TOKENS.navy}>
              {s != null ? s.toFixed(2) : "-"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── 2. Pillar band - maturity zones + respondent spread + markers ───
/** One compact visual per pillar deep-dive: the 1-5 scale banded into the five
 *  maturity zones, every respondent's pillar mean as a dot (so the reader SEES
 *  cohort agreement or disagreement), the cohort mean as a navy marker, and the
 *  benchmark as a dashed reference. */
export function PillarBandChart({ values, mean, benchmark = 4, lang = "en" }: {
  /** Per-respondent pillar means (1-5). Empty array hides the dot layer. */
  values: number[];
  mean: number | null;
  benchmark?: number;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const W = 520, H = 64, LEFT = 8, RIGHT = 8, BAND_Y = 22, BAND_H = 16;
  const chartW = W - LEFT - RIGHT;
  const x = (v: number) => LEFT + ((Math.max(1, Math.min(5, v)) - 1) / 4) * chartW;
  // Zones come from the CANONICAL five-level maturity model (the same
  // ARA_MATURITY_LEVELS the scoring engine + every prior report use), so the
  // chart's bands can never drift from the L1-L5 labels elsewhere. The chart
  // axis starts at 1, so Level 1's zone renders from 1.0.
  const ZONES = ARA_MATURITY_LEVELS.map((m, i) => ({
    from: Math.max(1, m.min),
    to: i < ARA_MATURITY_LEVELS.length - 1 ? Math.max(1, ARA_MATURITY_LEVELS[i + 1].min) : 5,
    label: `L${m.level} ${rtl ? m.label_ar : m.label_en}`,
  }));
  // Deterministic dot stacking: bucket values to 0.1 and stack duplicates
  // vertically so 40 dots never smear into one blob.
  const buckets = new Map<number, number>();
  const dots = values.map((v) => {
    const key = Math.round(Math.max(1, Math.min(5, v)) * 10);
    const n = buckets.get(key) ?? 0;
    buckets.set(key, n + 1);
    return { v, stack: n };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={`${W}pt`} height={`${H}pt`} style={{ maxWidth: "100%" }} role="img"
      aria-label={rtl ? "توزيع درجات المشاركين" : "Respondent score distribution"}>
      {/* zone band */}
      {ZONES.map((z, i) => (
        <g key={i}>
          <rect x={x(z.from)} y={BAND_Y} width={x(z.to) - x(z.from)} height={BAND_H}
            fill={i < 2 ? "#fdf1f2" : i === 2 ? "#fdf6e7" : "#eaf7f0"} stroke={TOKENS.line} strokeWidth={0.75} />
          <text x={(x(z.from) + x(z.to)) / 2} y={BAND_Y + BAND_H + 11} textAnchor="middle"
            fontFamily={FONT} fontSize={6.5} fill={TOKENS.mute} letterSpacing="0.05em">
            {z.label.toUpperCase()}
          </text>
        </g>
      ))}
      {/* respondent dots (above the band) */}
      {dots.map((d, i) => (
        <circle key={i} cx={x(d.v)} cy={BAND_Y - 5 - d.stack * 5} r={2.1}
          fill={TOKENS.accent} fillOpacity={0.55} stroke="white" strokeWidth={0.5} />
      ))}
      {/* benchmark */}
      <line x1={x(benchmark)} y1={BAND_Y - 4} x2={x(benchmark)} y2={BAND_Y + BAND_H + 3} stroke={TOKENS.navy} strokeWidth={1.1} strokeDasharray="3 2.5" />
      {/* cohort mean marker */}
      {mean != null && (
        <g>
          <polygon points={`${x(mean) - 4},${BAND_Y - 3} ${x(mean) + 4},${BAND_Y - 3} ${x(mean)},${BAND_Y + 4}`} fill={TOKENS.navy} />
          <text x={x(mean)} y={BAND_Y + BAND_H + 22} textAnchor="middle" fontFamily={FONT} fontSize={7.5} fontWeight={700} fill={TOKENS.navy}>
            {rtl ? `المتوسط ${mean.toFixed(2)}` : `Cohort ${mean.toFixed(2)}`}
          </text>
        </g>
      )}
    </svg>
  );
}
