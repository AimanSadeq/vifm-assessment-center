// ─────────────────────────────────────────────────────────────
// Technical sandbox validators (pure, synchronous).
//
// Score a candidate's WORK against a skill block's CHECKPOINTS. Each
// checkpoint is a weighted pass/fail; the block score is the weighted
// pass-rate %, banded Basic/Intermediate/Advanced. SQL checkpoints are
// validated server-side against the DB (see sql-runner.ts) and folded
// in via `precomputed`.
// ─────────────────────────────────────────────────────────────
import type {
  Checkpoint,
  CheckpointResult,
  BlockScore,
  ProficiencyTier,
  SpreadsheetWork,
  LogicInputWork,
  SpreadsheetCell,
} from "./types";

const DEFAULT_TOLERANCE = 0.01;

export function tierFor(scorePct: number): ProficiencyTier {
  const p = Math.max(0, Math.min(100, scorePct));
  if (p >= 85) return "advanced";
  if (p >= 60) return "intermediate";
  return "basic";
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[, ]/g, "").trim();
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A1-range expansion, e.g. "C9:E11" -> ["C9","D9",...,"E11"]. */
export function expandRange(range: string): string[] {
  const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return [range];
  const [, c1, r1, c2, r2] = m;
  const colNum = (s: string) =>
    s.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
  const colStr = (n: number) => {
    let s = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const [ca, cb] = [colNum(c1), colNum(c2)].sort((a, b) => a - b);
  const [ra, rb] = [Number(r1), Number(r2)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let c = ca; c <= cb; c++)
    for (let r = ra; r <= rb; r++) out.push(`${colStr(c)}${r}`);
  return out;
}

/** A cell holds a genuine array/data-table formula, not a hardcoded value. */
export function looksLikeArrayFormula(cell: SpreadsheetCell | undefined): boolean {
  if (!cell) return false;
  if (cell.isArrayFormula === true) return true;
  const f = (cell.formula ?? "").toString().trim();
  if (!f) return false;
  if (/^\{?=.*\bTABLE\s*\(/i.test(f)) return true; // {=TABLE(...)} data table
  if (/^\{=/.test(f)) return true; // legacy CSE array formula
  return false;
}

function checkOne(
  cp: Checkpoint,
  work: unknown,
  precomputed?: Record<string, boolean>,
): CheckpointResult {
  const base = {
    id: cp.id,
    kind: cp.kind,
    weight: cp.weight,
    label_en: cp.label_en,
    label_ar: cp.label_ar,
  };
  switch (cp.kind) {
    case "cell_value": {
      const cells = (work as SpreadsheetWork)?.cells ?? {};
      const got = asNumber(cells[cp.target]?.value);
      const tol = cp.tolerance ?? DEFAULT_TOLERANCE;
      const passed = got !== null && Math.abs(got - cp.expected) <= tol;
      return { ...base, passed, detail: `${cp.target}=${got ?? "∅"} (want ${cp.expected})` };
    }
    case "logic_value": {
      const fields = (work as LogicInputWork)?.fields ?? {};
      const got = asNumber(fields[cp.field]);
      const tol = cp.tolerance ?? DEFAULT_TOLERANCE;
      const passed = got !== null && Math.abs(got - cp.expected) <= tol;
      return { ...base, passed, detail: `${cp.field}=${got ?? "∅"} (want ${cp.expected})` };
    }
    case "is_array_formula": {
      const cells = (work as SpreadsheetWork)?.cells ?? {};
      const refs = expandRange(cp.target);
      const present = refs.filter((r) => cells[r]?.formula || cells[r]?.isArrayFormula);
      const anyArray = refs.some((r) => looksLikeArrayFormula(cells[r]));
      // Pass when the interior is formula-driven (no hardcoded gaps) AND at
      // least one cell carries an array/data-table formula.
      const passed = anyArray && present.length === refs.length;
      return { ...base, passed, detail: `array=${anyArray}, filled=${present.length}/${refs.length}` };
    }
    case "sql_result_match": {
      const passed = precomputed?.[cp.id] === true;
      return { ...base, passed, detail: passed ? "result matches master" : "no match" };
    }
    default:
      return { ...base, passed: false, detail: "unknown checkpoint" } as CheckpointResult;
  }
}

/**
 * Score a block: weighted pass-rate over its checkpoints.
 * `precomputed` carries async (SQL) results keyed by checkpoint id.
 */
export function scoreBlock(
  checkpoints: Checkpoint[],
  work: unknown,
  precomputed?: Record<string, boolean>,
): BlockScore {
  const checkpointResults = checkpoints.map((cp) => checkOne(cp, work, precomputed));
  const totalWeight = checkpointResults.reduce((s, c) => s + c.weight, 0) || 1;
  const passedWeight = checkpointResults.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  const scorePct = Math.round((passedWeight / totalWeight) * 100);
  return { scorePct, tier: tierFor(scorePct), checkpointResults };
}
