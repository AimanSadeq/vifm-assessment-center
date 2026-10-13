// SDC High-Potential reports: the rules, kept pure so the unit tests can load
// them directly (no server imports). Ported from the samples SDC approved on
// 8 Oct 2026 (scripts/sdc-hipo/data.js and build-reports.js). The I/O lives in
// data.ts and the page layout in html.ts.

import v3 from "../../bespoke/frameworks/sdc-v3.json";
import idpContent from "./idp-content.json";

/** The ten SDC competency codes. A bundle with exactly these is an SDC report bundle. */
export const SDC_CODES = ["IN", "RO", "ECC", "PI", "AO", "SM", "DSP", "EDP", "IM", "LBE"] as const;

export function isSdcFramework(codes: string[]): boolean {
  const set = new Set(codes);
  return set.size === SDC_CODES.length && codes.length === SDC_CODES.length && SDC_CODES.every((c) => set.has(c));
}

/** bundle_sjt_results level 0..3. */
export const LEVELS = ["Below Basic", "Basic", "Proficient", "Advanced"] as const;
export type LevelName = (typeof LEVELS)[number];
export const levelName = (n: number): LevelName => LEVELS[Math.max(0, Math.min(3, Math.round(n || 0)))];

/** Programme module each competency is mainly developed in (proposal 20260809-SDC-02-HPHLD, Part 2). */
export const MODULE: Record<string, string> = {
  IN: "M3 Leading the Business", RO: "M3 Leading the Business", ECC: "M2 Leading Others",
  PI: "M1 Leading Self", AO: "M1 Leading Self", SM: "M3 Leading the Business", DSP: "M2 Leading Others",
  EDP: "M3 Leading the Business", IM: "M2 Leading Others", LBE: "M4 Leading for the Future",
};

export const GRADE_LABEL: Record<number, string> = { 8: "Senior Manager", 7: "Manager", 6: "Senior Specialist", 5: "Specialist", 4: "Senior Analyst" };

/** GRID[reasoningBand][fitBand]: the placement title and its one-line reading. */
export const GRID: ReadonlyArray<ReadonlyArray<{ t: string; d: string }>> = [
  [{ t: "Foundational development", d: "Build core behaviours and reasoning before stretch roles." },
   { t: "Steady contributor", d: "Meets today's requirement; strengthen reasoning for bigger roles." },
   { t: "Effective in role", d: "Strong in role; build reasoning before accelerating." }],
  [{ t: "Develop competencies", d: "Capable thinker with clear behavioural gaps to close first." },
   { t: "Core talent", d: "Solid on both; grow steadily with targeted development." },
   { t: "Strong contributor", d: "Above the bar today; broaden scope and exposure." }],
  [{ t: "Untapped ability", d: "High reasoning ability; behaviours not yet at the required level." },
   { t: "Emerging potential", d: "Meets the requirement with strong reasoning; stretch with support." },
   { t: "High potential", d: "Above requirement with strong reasoning; accelerate." }],
];
export const FIT_LABELS = ["Below requirement", "Meets requirement", "Above requirement"] as const;
export const REASONING_LABELS = ["Developing", "Solid", "Strong"] as const;

/**
 * How many competency gaps the IDP plans in full (largest shortfall first),
 * plus one strength to build on, so the plan stays about one page. Further gaps
 * are listed by name only. Ali to confirm this number with SDC.
 */
export const IDP_MAX_GAPS = 3;

// ---------------------------------------------------------------- Competencies

export type SdcCompetency = {
  code: string;
  name: string;
  category: string | null;
  definition: string | null;
  /** bundle_competencies.required_levels, e.g. {"4":2,"7":2,"8":3}; 0 or missing = not required. */
  required_levels: Record<string, number>;
  sort_order: number;
};

export type CompRow = { code: string; name: string; category: string; sortOrder: number; res: number; req: number };

export const requiredLevel = (c: SdcCompetency, grade: number): number => {
  const v = Number(c.required_levels?.[String(grade)] ?? 0);
  return Number.isFinite(v) && v > 0 ? Math.min(3, Math.round(v)) : 0;
};

/** One row per competency in framework order, with the result level and the grade's required level. */
export function compRows(comps: SdcCompetency[], grade: number, levels: Record<string, number>): CompRow[] {
  return [...comps]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      code: c.code,
      name: c.name,
      category: c.category === "Leadership" ? "Leadership" : "Core",
      sortOrder: c.sort_order,
      res: Math.max(0, Math.min(3, Math.round(Number(levels[c.code] ?? 0) || 0))),
      req: requiredLevel(c, grade),
    }));
}

export type Fit = { met: number; total: number; above: number; band: 0 | 1 | 2; label: string };

/**
 * Competency fit. Above = every required competency met and at least two
 * exceeded; Meets = at least 80% of required competencies met (including all
 * met but fewer than two exceeded); Below = fewer than 80% met.
 */
export function fit(rows: CompRow[]): Fit {
  const req = rows.filter((r) => r.req > 0);
  const met = req.filter((r) => r.res >= r.req).length;
  const above = req.filter((r) => r.res > r.req).length;
  const total = req.length;
  const band: 0 | 1 | 2 = total > 0 && met === total && above >= 2 ? 2 : total > 0 && met / total >= 0.8 ? 1 : 0;
  return { met, total, above, band, label: FIT_LABELS[band] };
}

// ---------------------------------------------------------------- Reasoning

export type ReasoningTest = { key: string; name: string; pct: number };
export type Reasoning = { tests: ReasoningTest[]; mean: number; band: 0 | 1 | 2; label: string };

const TEST_ORDER = ["numerical", "verbal", "inductive", "deductive"];
const TEST_NAME: Record<string, string> = { numerical: "Numerical", verbal: "Verbal", inductive: "Inductive", deductive: "Deductive" };
const testName = (key: string) => TEST_NAME[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");

/**
 * Reasoning performance: the mean accuracy of the Logica tests the candidate
 * actually sat (psy_results.scales, raw = percent correct). Strong >= 70%,
 * Solid 50 to 69%, Developing < 50%. Null when no test was sat.
 */
export function reasoning(scales: unknown): Reasoning | null {
  if (!Array.isArray(scales)) return null;
  const tests: ReasoningTest[] = [];
  for (const s of scales as Array<{ key?: unknown; raw?: unknown }>) {
    const raw = Number(s?.raw);
    if (typeof s?.key !== "string" || !Number.isFinite(raw)) continue;
    tests.push({ key: s.key, name: testName(s.key), pct: Math.max(0, Math.min(100, raw)) });
  }
  if (tests.length === 0) return null;
  const pos = (k: string) => (TEST_ORDER.indexOf(k) + 1 || 99);
  tests.sort((a, b) => pos(a.key) - pos(b.key) || a.key.localeCompare(b.key));
  const mean = Math.round(tests.reduce((s, t) => s + t.pct, 0) / tests.length);
  const band: 0 | 1 | 2 = mean >= 70 ? 2 : mean >= 50 ? 1 : 0;
  return { tests: tests.map((t) => ({ ...t, pct: Math.round(t.pct) })), mean, band, label: REASONING_LABELS[band] };
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const numberWord = (n: number) => WORDS[n] ?? String(n);

/** "A", "A and B", "A, B and C". */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** e.g. "two timed Logica reasoning tests (Numerical and Inductive)". */
export function reasoningTestsPhrase(r: Reasoning): string {
  const n = r.tests.length;
  return `${numberWord(n)} timed Logica reasoning test${n === 1 ? "" : "s"} (${joinAnd(r.tests.map((t) => t.name))})`;
}

// ---------------------------------------------------------------- Strengths, gaps, IDP

/** Required competencies above the grade's level: largest margin first, then higher result, then framework order. */
export function strengthsOf(rows: CompRow[]): CompRow[] {
  return rows
    .filter((r) => r.req > 0 && r.res > r.req)
    .sort((a, b) => (b.res - b.req) - (a.res - a.req) || b.res - a.res || a.sortOrder - b.sortOrder);
}

/** Required competencies below the grade's level: largest shortfall first, then higher required level, then framework order. */
export function gapsOf(rows: CompRow[]): CompRow[] {
  return rows
    .filter((r) => r.req > 0 && r.res < r.req)
    .sort((a, b) => (b.req - b.res) - (a.req - a.res) || b.req - a.req || a.sortOrder - b.sortOrder);
}

export type IdpSelection = {
  /** Gaps planned in full (at most IDP_MAX_GAPS). */
  gaps: CompRow[];
  /** Further gaps, listed by name for after day 90. */
  later: CompRow[];
  /** One strength below Advanced to build on, if any. */
  strength: CompRow | null;
};

export function selectIdp(rows: CompRow[], maxGaps = IDP_MAX_GAPS): IdpSelection {
  const gaps = gapsOf(rows);
  return {
    gaps: gaps.slice(0, maxGaps),
    later: gaps.slice(maxGaps),
    strength: strengthsOf(rows).find((r) => r.res < 3) ?? null,
  };
}

export type IdpItem = {
  type: "gap" | "strength";
  row: CompRow;
  target: LevelName;
  goals: string[];
  actions: { job: string; coaching: string; learning: string } | null;
  plan: { smart: string; day30: string; day60: string; day90: string; evidence: string } | null;
};

type V3 = { indicators: Array<{ id: string; option_level: string; text: string }> };
const IDP = idpContent as unknown as {
  actions: Record<string, Record<string, IdpItem["actions"]>>;
  plan: Record<string, Record<string, IdpItem["plan"]>>;
};

/** The first `n` SDC behavioural indicators for a competency at a level (v3 framework). */
export function goalBehaviours(code: string, level: string, n = 2): string[] {
  return (v3 as V3).indicators
    .filter((i) => i.id.startsWith(`${code}-`) && i.option_level === level)
    .slice(0, n)
    .map((i) => i.text.replace(/\.$/, ""));
}

/** The IDP cards: gaps target the required level, a strength targets one level up. */
export function idpItems(sel: IdpSelection): IdpItem[] {
  const make = (row: CompRow, type: IdpItem["type"]): IdpItem => {
    const target = type === "gap" ? levelName(row.req) : levelName(Math.min(3, row.res + 1));
    return {
      type, row, target,
      goals: goalBehaviours(row.code, target),
      actions: IDP.actions[row.code]?.[target] ?? null,
      plan: IDP.plan[row.code]?.[target] ?? null,
    };
  };
  return [...sel.gaps.map((g) => make(g, "gap")), ...(sel.strength ? [make(sel.strength, "strength")] : [])];
}

// ---------------------------------------------------------------- Cohort

export type CohortPerson = {
  id: string;
  name: string;
  grade: number;
  unit: string | null;
  fit: Fit;
  reasoning: Reasoning;
  rows: CompRow[];
};
export type RankedPerson = CohortPerson & { code: string; place: string };
export type GradeBand = { key: "M" | "P"; label: string; people: RankedPerson[] };

/**
 * Ranking within a grade band: position on the grid (fit band plus reasoning
 * band), then fit band, share of required competencies met, number exceeded,
 * then reasoning accuracy. Name breaks any remaining tie so the order is stable.
 */
export function compareCohort(a: CohortPerson, b: CohortPerson): number {
  const share = (p: CohortPerson) => (p.fit.total ? p.fit.met / p.fit.total : 0);
  return (
    (b.fit.band + b.reasoning.band) - (a.fit.band + a.reasoning.band) ||
    b.fit.band - a.fit.band ||
    share(b) - share(a) ||
    b.fit.above - a.fit.above ||
    b.reasoning.mean - a.reasoning.mean ||
    a.name.localeCompare(b.name)
  );
}

/** What the band's grades require, e.g. "all 10 competencies required", "5 core competencies required". */
function bandRequirement(comps: SdcCompetency[], grades: number[]): string {
  const counts = new Set(grades.map((g) => comps.filter((c) => requiredLevel(c, g) > 0).length));
  if (counts.size !== 1) return "required competencies differ by grade";
  const n = [...counts][0];
  if (n === comps.length) return `all ${n} competencies required`;
  const coreOnly = grades.every((g) => comps.every((c) => requiredLevel(c, g) === 0 || c.category !== "Leadership"));
  return `${n} ${coreOnly ? "core " : ""}competenc${n === 1 ? "y" : "ies"} required`;
}

/** "Grade 7", "Grades 7 and 8", "Grades 4 to 8". */
export function gradeSpan(grades: number[]): string {
  const u = [...new Set(grades)].sort((a, b) => a - b);
  if (u.length === 0) return "";
  if (u.length === 1) return `Grade ${u[0]}`;
  if (u.length === 2 && u[1] === u[0] + 1) return `Grades ${u[0]} and ${u[1]}`;
  return `Grades ${u[0]} to ${u[u.length - 1]}`;
}

/** Managerial (Grades 7 and up) and Professional (Grade 6 and below), each ranked; codes M1.., P1... */
export function rankCohort(people: CohortPerson[], comps: SdcCompetency[]): GradeBand[] {
  const defs: Array<{ key: "M" | "P"; name: string; test: (g: number) => boolean; fallback: number[] }> = [
    { key: "M", name: "Managerial", test: (g) => g >= 7, fallback: [7, 8] },
    { key: "P", name: "Professional", test: (g) => g <= 6, fallback: [4, 5, 6] },
  ];
  return defs.map((d) => {
    const members = people.filter((p) => d.test(p.grade)).sort(compareCohort);
    const grades = members.length ? members.map((p) => p.grade) : d.fallback;
    const label = `${d.name}: ${gradeSpan(grades)} (${bandRequirement(comps, [...new Set(grades)])})`;
    return {
      key: d.key,
      label,
      people: members.map((p, i) => ({ ...p, code: `${d.key}${i + 1}`, place: GRID[p.reasoning.band][p.fit.band].t })),
    };
  });
}

/**
 * Why a person ranks above someone in the same grid box who has higher
 * reasoning (Ali, 13 Oct 2026: "how will a reader understand this?"): the
 * competency-fit tie-break that decided it, e.g. "+4 vs +2 exceeded". Null
 * when nobody below them in the same box has higher reasoning.
 */
export function fitOverReasoningNote(band: RankedPerson[], i: number): string | null {
  const p = band[i];
  const q = band.slice(i + 1).find(
    (x) => x.fit.band === p.fit.band && x.reasoning.band === p.reasoning.band && x.reasoning.mean > p.reasoning.mean,
  );
  if (!q) return null;
  const why =
    p.fit.met * q.fit.total !== q.fit.met * p.fit.total
      ? `${p.fit.met}/${p.fit.total} vs ${q.fit.met}/${q.fit.total} met`
      : p.fit.above !== q.fit.above
        ? `+${p.fit.above} vs +${q.fit.above} exceeded`
        : null;
  return why ? `Above ${q.code} on competency fit (${why})` : null;
}

/** Order for the codes inside a grid cell: M before P, then by number. */
export function compareCodes(a: string, b: string): number {
  return a[0] === b[0] ? parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10) : a < b ? -1 : 1;
}

export type GapRate = { code: string; name: string; n: number; below: number; pct: number };

/** Per competency: share of people for whom it is required who are below their grade's level, highest first. */
export function gapRates(people: CohortPerson[], comps: SdcCompetency[]): GapRate[] {
  return [...comps]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => {
      const rows = people.map((p) => p.rows.find((r) => r.code === c.code)).filter((r): r is CompRow => !!r && r.req > 0);
      const below = rows.filter((r) => r.res < r.req).length;
      return { code: c.code, name: c.name, n: rows.length, below, pct: rows.length ? Math.round((100 * below) / rows.length) : 0 };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Lowest grade at which any leadership competency is required, or null. */
export function leadershipFromGrade(comps: SdcCompetency[]): number | null {
  const grades = comps
    .filter((c) => c.category === "Leadership")
    .flatMap((c) => Object.entries(c.required_levels ?? {}).filter(([, v]) => Number(v) > 0).map(([g]) => Number(g)))
    .filter((g) => Number.isFinite(g));
  return grades.length ? Math.min(...grades) : null;
}
