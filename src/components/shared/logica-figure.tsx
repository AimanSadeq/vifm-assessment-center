"use client";

import { useId } from "react";
import type { DataFigure, FigCell, GridFigure } from "@/lib/psychometrics/figure";

/**
 * Draws a Logica figure spec (lib/psychometrics/figure.ts) with plain SVG
 * elements. Every cell uses the same 100x100 frame, stroke and palette, so no
 * option looks "different" from its siblings (no visual answer cue).
 *
 * The grid is always laid out left-to-right, also in Arabic sittings: the
 * figures were authored in that reading order.
 */

const INK = "#010131";
const STROKE = 3.5;

// Dice layouts for 1-5 free dots.
const DICE: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[32, 32], [68, 68]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[32, 32], [68, 32], [32, 68], [68, 68]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
};

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(2)},${(cy + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Centres for `n` glyphs in a row around (cx, cy). */
function rowPositions(n: number, cx: number, cy: number, gap: number): [number, number][] {
  const start = cx - ((n - 1) * gap) / 2;
  return Array.from({ length: n }, (_, i) => [start + i * gap, cy]);
}

function Shape({ cell, clipId }: { cell: FigCell; clipId: string }) {
  const withSide = !!cell.side;
  // Shapes that carry dots underneath sit higher and a little smaller.
  const scale = (cell.size === "small" ? 0.55 : 1) * (withSide ? 0.72 : 1);
  const cx = 50;
  const cy = withSide ? 40 : 50;
  const R = 34 * scale;
  let outline: React.ReactNode;
  let clipShape: React.ReactNode;
  if (cell.shape === "circle") {
    outline = <circle cx={cx} cy={cy} r={R} />;
    clipShape = <circle cx={cx} cy={cy} r={R} />;
  } else if (cell.shape === "square") {
    outline = <rect x={cx - R} y={cy - R} width={2 * R} height={2 * R} />;
    clipShape = <rect x={cx - R} y={cy - R} width={2 * R} height={2 * R} />;
  } else if (cell.shape === "rectangle") {
    outline = <rect x={cx - R * 1.08} y={cy - R * 0.6} width={2.16 * R} height={1.2 * R} />;
    clipShape = outline;
  } else if (cell.shape === "diamond") {
    // Rhombus: four equal sides, no right angles (diagonals 60 x 68 at R=34).
    const pts = `${cx},${cy - R} ${cx + R * 0.88},${cy} ${cx},${cy + R} ${cx - R * 0.88},${cy}`;
    outline = <polygon points={pts} />;
    clipShape = outline;
  } else if (cell.shape === "isosceles") {
    const pts = `${cx},${cy - R * 1.12} ${cx + R * 0.78},${cy + R * 1.0} ${cx - R * 0.78},${cy + R * 1.0}`;
    outline = <polygon points={pts} />;
    clipShape = outline;
  } else {
    const pts = `${cx},${cy - R * 1.05} ${cx + R * 1.1},${cy + R * 0.85} ${cx - R * 1.1},${cy + R * 0.85}`;
    outline = <polygon points={pts} />;
    clipShape = <polygon points={pts} />;
  }

  const fill = cell.fill ?? "none";
  // Glyphs inside a triangle sit lower, where the shape is wide enough.
  const innerY = cell.shape === "triangle" ? cy + R * 0.3 : cy;
  const inner = cell.inner && cell.inner.count > 0
    ? rowPositions(cell.inner.count, cx, innerY, cell.inner.glyph === "star" ? 21 * scale : 13 * scale)
    : [];

  return (
    <g>
      {(fill === "left" || fill === "right") && (
        <>
          <clipPath id={clipId}>{clipShape}</clipPath>
          <rect x={fill === "left" ? cx - R - 2 : cx} y={cy - R - 2} width={R + 2} height={2 * R + 4}
            fill={INK} clipPath={`url(#${clipId})`} />
        </>
      )}
      <g fill={fill === "full" ? INK : "none"} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">{outline}</g>
      {inner.map(([x, y], i) =>
        cell.inner!.glyph === "star"
          ? <path key={i} d={starPath(x, y, 10 * Math.max(scale, 0.8))} fill={INK} />
          : <circle key={i} cx={x} cy={y} r={4.5 * Math.max(scale, 0.8)} fill={INK} />,
      )}
      {cell.side && rowPositions(cell.side.count, 50, 85, 13).map(([x, y], i) => (
        <circle key={`s${i}`} cx={x} cy={y} r={4.5} fill={INK} />
      ))}
    </g>
  );
}

function CellDrawing({ cell }: { cell: FigCell }) {
  const clipId = useId().replace(/:/g, "");
  if (cell.shape) return <Shape cell={cell} clipId={clipId} />;

  if (cell.dots) {
    return <g fill={INK}>{DICE[cell.dots].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={6} />)}</g>;
  }
  if (cell.lines) {
    return (
      <g stroke={INK} strokeWidth={STROKE + 0.5} strokeLinecap="round">
        {rowPositions(cell.lines, 50, 50, 11).map(([x], i) => <line key={i} x1={x} y1={24} x2={x} y2={76} />)}
      </g>
    );
  }
  if (cell.arrow) {
    const deg = { up: 0, right: 90, down: 180, left: 270 }[cell.arrow];
    return (
      <g transform={`rotate(${deg} 50 50)`} fill={INK} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
        <line x1={50} y1={80} x2={50} y2={34} strokeLinecap="round" />
        <polygon points="50,18 37,36 63,36" />
      </g>
    );
  }
  if (cell.clock) {
    const deg = { 12: 0, 3: 90, 6: 180, 9: 270 }[cell.clock];
    return (
      <g stroke={INK} strokeWidth={STROKE} fill="none">
        <circle cx={50} cy={50} r={36} />
        {[0, 90, 180, 270].map((t) => (
          <line key={t} x1={50} y1={17} x2={50} y2={23} transform={`rotate(${t} 50 50)`} strokeWidth={2.5} />
        ))}
        <line x1={50} y1={50} x2={50} y2={24} strokeLinecap="round" strokeWidth={4.5} transform={`rotate(${deg} 50 50)`} />
        <circle cx={50} cy={50} r={3.5} fill={INK} />
      </g>
    );
  }
  if (cell.quad) {
    const q = new Set(cell.quad);
    const box = { tl: [18, 18], tr: [50, 18], br: [50, 50], bl: [18, 50] } as const;
    return (
      <g>
        {(Object.keys(box) as (keyof typeof box)[]).map((k) =>
          q.has(k) ? <rect key={k} x={box[k][0]} y={box[k][1]} width={32} height={32} fill={INK} /> : null,
        )}
        <g stroke={INK} strokeWidth={STROKE} fill="none">
          <rect x={18} y={18} width={64} height={64} />
          <line x1={50} y1={18} x2={50} y2={82} />
          <line x1={18} y1={50} x2={82} y2={50} />
        </g>
      </g>
    );
  }
  return null;
}

/** One drawn cell (also used inside each answer option). */
export function FigureCell({ cell, size = 72, label }: { cell: FigCell; size?: number; label?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} className="shrink-0">
      <CellDrawing cell={cell} />
    </svg>
  );
}

/** The question grid with its "?" cell. */
export function FigureGrid({ figure, ariaLabel }: { figure: GridFigure; ariaLabel: string }) {
  const cellPx = figure.cols === 3 ? 84 : 96;
  return (
    <div dir="ltr" role="img" aria-label={ariaLabel}
      className="inline-grid gap-1.5 rounded-lg border border-slate-200 bg-white p-2"
      style={{ gridTemplateColumns: `repeat(${figure.cols}, ${cellPx}px)` }}>
      {figure.cells.map((c, i) => (
        <div key={i} className={`flex items-center justify-center rounded-md ${c ? "border border-slate-200" : "border-2 border-dashed border-[#5391D5] bg-[#5391D5]/5"}`}
          style={{ width: cellPx, height: cellPx }}>
          {c ? (
            <FigureCell cell={c} size={cellPx - 12} />
          ) : (
            <svg viewBox="0 0 100 100" width={cellPx - 12} height={cellPx - 12} aria-hidden="true">
              <text x={50} y={66} textAnchor="middle" fontSize={48} fontWeight={700} fill="#5391D5">?</text>
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/**
 * Data for numerical items: a small table or a single-series column chart.
 * Every value is printed (candidates compute with exact figures, so nothing
 * is left to estimate from bar height); one hue, no legend, recessive
 * baseline. Labels follow the page direction; the chart keeps its authored
 * left-to-right order.
 */
export function FigureData({ figure }: { figure: DataFigure }) {
  if (figure.style === "table") {
    return (
      <table className="mt-1 min-w-[16rem] border-collapse overflow-hidden rounded-lg border border-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-50 text-[#010131]">
            <th className="border-b border-slate-200 px-4 py-2 text-start font-semibold">{figure.labelHead}</th>
            <th className="border-b border-slate-200 px-4 py-2 text-end font-semibold">{figure.title}</th>
          </tr>
        </thead>
        <tbody>
          {figure.rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-1.5 text-slate-700">{r.label}</td>
              <td className="px-4 py-1.5 text-end font-medium tabular-nums text-[#010131]">{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const n = figure.rows.length;
  const band = 72;
  const W = Math.max(240, n * band + 32);
  const H = 196;
  const top = 34, base = 156;
  const max = Math.max(...figure.rows.map((r) => r.value), 1);
  const barW = 24;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${figure.title}: ${figure.rows.map((r) => `${r.label} ${fmt(r.value)}`).join(", ")}`}
      // The chart's geometry is left-to-right in every language; Arabic labels
      // still shape correctly inside each text element.
      style={{ direction: "ltr" }}
      className="mt-1 max-w-full rounded-lg border border-slate-200 bg-white">
      <text x={16} y={20} fontSize={12} fontWeight={600} fill="#010131">{figure.title}</text>
      {figure.rows.map((r, i) => {
        const cx = 16 + band * i + band / 2;
        const h = Math.max(2, ((base - top) * r.value) / max);
        const x = cx - barW / 2, y = base - h, rr = Math.min(4, h);
        // 4px rounded data end, square at the baseline.
        const d = `M${x},${base} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + barW - rr} Q${x + barW},${y} ${x + barW},${y + rr} V${base} Z`;
        return (
          <g key={i}>
            <path d={d} fill="#5391D5" />
            <text x={cx} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="#010131">{fmt(r.value)}</text>
            <text x={cx} y={base + 18} textAnchor="middle" fontSize={11} fill="#475569">{r.label}</text>
          </g>
        );
      })}
      <line x1={12} x2={W - 12} y1={base} y2={base} stroke="#cbd5e1" strokeWidth={1} />
    </svg>
  );
}
