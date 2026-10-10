/**
 * Logica visual items (Ali, 10 Oct 2026): matrix questions are served as drawn
 * figures instead of prose. The old stems described every cell in words AND
 * stated the rule that solves the grid, so they measured reading rather than
 * inductive reasoning, and the whole item could be pasted into a chatbot.
 *
 * A figure is DATA, never markup: psy_items.figure holds a small spec that the
 * client draws with plain SVG elements (components/shared/logica-figure.tsx).
 * No stored SVG string is ever injected into the page.
 *
 * `options` is aligned with options_en/options_ar in AUTHORED order; the
 * per-sitting shuffle permutes it with the same map as the option text, so the
 * key keeps pointing at the right drawing. The option text stays as the
 * accessible label of each drawing.
 *
 * Pure and dependency-free (server + client safe).
 */

export const FIG_SHAPES = ["circle", "square", "triangle"] as const;
export type FigShape = (typeof FIG_SHAPES)[number];
export type FigQuadrant = "tl" | "tr" | "br" | "bl";

export type FigCell = {
  /** Outline shape drawn in the centre of the cell. */
  shape?: FigShape;
  size?: "small" | "large";
  /** Shading of the shape (circle only uses left/right halves). */
  fill?: "none" | "full" | "left" | "right";
  /** Glyphs drawn inside the shape. */
  inner?: { glyph: "dot" | "star"; count: number };
  /** Dots drawn under the shape (two-feature items). */
  side?: { count: number };
  /** Free dots with no shape, in a dice layout. */
  dots?: number;
  /** Vertical strokes. */
  lines?: number;
  arrow?: "up" | "right" | "down" | "left";
  /** Clock face with one hand pointing at this hour. */
  clock?: 12 | 3 | 6 | 9;
  /** Square split into four small cells; these are shaded. */
  quad?: FigQuadrant[];
};

export type LogicaFigure = {
  cols: number;
  /** Row-major cells; null is the missing cell shown as "?". */
  cells: (FigCell | null)[];
  /** One drawing per answer option, in the same order as the option text. */
  options: FigCell[];
};

const MAX_COUNT = 6;
const QUADS: readonly FigQuadrant[] = ["tl", "tr", "br", "bl"];

const isCount = (n: unknown, min = 0): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= MAX_COUNT;

function parseCell(raw: unknown): FigCell | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: FigCell = {};
  let parts = 0;

  if (r.shape !== undefined) {
    if (!FIG_SHAPES.includes(r.shape as FigShape)) return null;
    out.shape = r.shape as FigShape;
    parts++;
  }
  if (r.size !== undefined) {
    if (r.size !== "small" && r.size !== "large") return null;
    out.size = r.size;
  }
  if (r.fill !== undefined) {
    if (!["none", "full", "left", "right"].includes(r.fill as string)) return null;
    out.fill = r.fill as FigCell["fill"];
  }
  if (r.inner !== undefined) {
    const i = r.inner as Record<string, unknown> | null;
    if (!i || (i.glyph !== "dot" && i.glyph !== "star") || !isCount(i.count)) return null;
    out.inner = { glyph: i.glyph, count: i.count };
  }
  if (r.side !== undefined) {
    const s = r.side as Record<string, unknown> | null;
    if (!s || !isCount(s.count, 1)) return null;
    out.side = { count: s.count };
  }
  if (r.dots !== undefined) {
    if (!isCount(r.dots, 1) || (r.dots as number) > 5) return null;
    out.dots = r.dots as number;
    parts++;
  }
  if (r.lines !== undefined) {
    if (!isCount(r.lines, 1)) return null;
    out.lines = r.lines as number;
    parts++;
  }
  if (r.arrow !== undefined) {
    if (!["up", "right", "down", "left"].includes(r.arrow as string)) return null;
    out.arrow = r.arrow as FigCell["arrow"];
    parts++;
  }
  if (r.clock !== undefined) {
    if (![12, 3, 6, 9].includes(r.clock as number)) return null;
    out.clock = r.clock as FigCell["clock"];
    parts++;
  }
  if (r.quad !== undefined) {
    if (!Array.isArray(r.quad) || !r.quad.every((q) => QUADS.includes(q as FigQuadrant))) return null;
    if (new Set(r.quad).size !== r.quad.length) return null;
    out.quad = r.quad as FigQuadrant[];
    parts++;
  }
  // Exactly one primary element per cell keeps every drawing unambiguous.
  if (parts !== 1) return null;
  // Modifiers only make sense on a shape.
  if (!out.shape && (out.size || out.fill || out.inner || out.side)) return null;
  return out;
}

/**
 * Validate a stored figure. Returns null for anything malformed, so a bad row
 * is never half-drawn. `optionCount` must match the item's option list.
 */
export function parseFigure(raw: unknown, optionCount: number): LogicaFigure | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const cols = r.cols;
  if (cols !== 2 && cols !== 3) return null;
  if (!Array.isArray(r.cells) || r.cells.length !== cols * cols) return null;
  const cells: (FigCell | null)[] = [];
  let missing = 0;
  for (const c of r.cells) {
    if (c === null) { missing++; cells.push(null); continue; }
    const p = parseCell(c);
    if (!p) return null;
    cells.push(p);
  }
  if (missing !== 1) return null;
  if (!Array.isArray(r.options) || r.options.length !== optionCount || optionCount < 2) return null;
  const options: FigCell[] = [];
  for (const o of r.options) {
    const p = parseCell(o);
    if (!p) return null;
    options.push(p);
  }
  // Two identical drawings would make the item unanswerable.
  const seen = new Set(options.map(cellKey));
  if (seen.size !== options.length) return null;
  return { cols, cells, options };
}

/** Canonical string for a cell (equality checks and tests). */
export function cellKey(c: FigCell): string {
  const keys = Object.keys(c).sort() as (keyof FigCell)[];
  return JSON.stringify(keys.map((k) => [k, k === "quad" ? [...(c.quad ?? [])].sort() : c[k]]));
}

/** Reorder a figure's option drawings with a served-order permutation. */
export function permuteFigure(fig: LogicaFigure, origIndex: number[]): LogicaFigure {
  return { ...fig, options: origIndex.map((i) => fig.options[i]) };
}
