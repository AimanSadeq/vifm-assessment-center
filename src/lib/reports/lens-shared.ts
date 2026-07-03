// ─────────────────────────────────────────────────────────────
// Shared DARE / EQ lens computation - data-source agnostic.
//
// The Persona reports read SELF scores; this core additionally accepts an
// OTHERS' score map (Reflect 360 combined raters) or an OBSERVED map (AC
// consensus ratings), all keyed by AC catalogue competency id, and re-groups
// them into the VIFM DARE roles / EQ quadrants with per-group coverage - the
// honesty rail for instruments that measure only a subset of the 41.
//
// Gap convention (360): gap = self - others. Positive = rates self higher
// than others experience (potential blind spot); negative = hidden strength.
// ─────────────────────────────────────────────────────────────

import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { DARE_ROLE, DARE_ROLES, DARE_META, type DareRole } from "@/lib/reports/persona-dare-dimensions";
import { EQ_QUADRANT, EQ_QUADRANTS, EQ_META, type EqQuadrant } from "@/lib/reports/persona-eq-dimensions";

/** Resolve an AC catalogue competency id from a display name (EN), tolerant of
 *  case/whitespace. Current catalogue names resolve directly; the seeded Reflect
 *  template (00034) still carries pre-rename legacy names, aliased below.
 *  Client-custom competencies that don't match return null (excluded, counted). */
const NAME_TO_ID = new Map(
  BEHAVIORAL_COMPETENCIES.map((c) => [c.nameEn.toLowerCase().replace(/\s+/g, " ").trim(), c.acCompetencyId])
);
// Legacy → current catalogue aliases (the 00034 Reflect template names, matched
// to today's 41 by their 00034 descriptions).
const LEGACY_ALIASES: Record<string, string> = {
  "drives vision and purpose": "Forward Strategy Setting",
  "drives results": "Outcome Ownership",
  "builds effective teams": "Building Cohesive Teams",
  "communicates effectively": "Clear & Adaptive Communication",
  "learning agility": "Adaptive Learning Capacity",
};
export function resolveAcCompetencyIdByName(name: string): string | null {
  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  const direct = NAME_TO_ID.get(key);
  if (direct) return direct;
  const alias = LEGACY_ALIASES[key];
  return alias ? NAME_TO_ID.get(alias.toLowerCase()) ?? null : null;
}
export const AC_COMPETENCY_NAME_BY_ID = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, c.nameEn]));

export type LensGroupRead = {
  key: string;
  label: string;
  hex: string;
  /** Mean (1-5) across the group's competencies that have a score; null = none. */
  self: number | null;
  others: number | null;
  /** self - others; null unless both sides present. */
  gap: number | null;
  /** "blind_spot" | "hidden_strength" | "aligned" (|gap| >= 0.5 threshold); null without both sides. */
  gapRead: "blind_spot" | "hidden_strength" | "aligned" | null;
  /** Competencies from this group present in the instrument (framework/matrix). */
  inInstrument: number;
  /** ...of the group's total in the model (e.g. Decide = 8). */
  totalInModel: number;
  /** Per-competency detail rows for the group (only those in the instrument). */
  rows: { id: string; name: string; self: number | null; others: number | null }[];
};

export const GAP_THRESHOLD = 0.5;

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function gapRead(gap: number | null): LensGroupRead["gapRead"] {
  if (gap == null) return null;
  if (gap >= GAP_THRESHOLD) return "blind_spot";
  if (gap <= -GAP_THRESHOLD) return "hidden_strength";
  return "aligned";
}

function computeLens(
  grouping: Record<string, string>, // AC competency id -> group key
  groups: { key: string; label: string; hex: string }[],
  modelTotals: Map<string, number>,
  opts: {
    /** AC competency ids the instrument measures at all (framework / matrix). */
    instrumentIds: string[];
    self?: Map<string, number> | null;
    others?: Map<string, number> | null;
  }
): LensGroupRead[] {
  const inInstrument = new Set(opts.instrumentIds);
  return groups.map((g) => {
    const ids = Object.entries(grouping)
      .filter(([cid, key]) => key === g.key && inInstrument.has(cid))
      .map(([cid]) => cid);
    const rows = ids
      .map((cid) => ({
        id: cid,
        name: AC_COMPETENCY_NAME_BY_ID.get(cid) ?? "Competency",
        self: opts.self?.get(cid) ?? null,
        others: opts.others?.get(cid) ?? null,
      }))
      .sort((a, b) => (b.others ?? b.self ?? 0) - (a.others ?? a.self ?? 0));
    const self = mean(rows.map((r) => r.self).filter((v): v is number => v != null));
    const others = mean(rows.map((r) => r.others).filter((v): v is number => v != null));
    const gap = self != null && others != null ? round2(self - others) : null;
    return {
      key: g.key,
      label: g.label,
      hex: g.hex,
      self,
      others,
      gap,
      gapRead: gapRead(gap),
      inInstrument: ids.length,
      totalInModel: modelTotals.get(g.key) ?? 0,
      rows,
    };
  });
}

const DARE_TOTALS = new Map<string, number>(
  DARE_ROLES.map((r) => [r, Object.values(DARE_ROLE).filter((x) => x === r).length])
);
const EQ_TOTALS = new Map<string, number>(
  EQ_QUADRANTS.map((q) => [q, Object.values(EQ_QUADRANT).filter((x) => x === q).length])
);

export function computeDareLens(opts: {
  instrumentIds: string[];
  self?: Map<string, number> | null;
  others?: Map<string, number> | null;
}): LensGroupRead[] {
  return computeLens(
    DARE_ROLE,
    DARE_ROLES.map((r: DareRole) => ({ key: r, label: DARE_META[r].label, hex: DARE_META[r].hex })),
    DARE_TOTALS,
    opts
  );
}

export function computeEqLens(opts: {
  instrumentIds: string[];
  self?: Map<string, number> | null;
  others?: Map<string, number> | null;
}): LensGroupRead[] {
  return computeLens(
    EQ_QUADRANT,
    EQ_QUADRANTS.map((q: EqQuadrant) => ({ key: q, label: EQ_META[q].label, hex: EQ_META[q].hex })),
    EQ_TOTALS,
    opts
  );
}

export const GAP_READ_LABEL: Record<NonNullable<LensGroupRead["gapRead"]>, string> = {
  blind_spot: "Potential blind spot",
  hidden_strength: "Hidden strength",
  aligned: "Aligned",
};
