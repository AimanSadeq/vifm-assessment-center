// Scenario (SJT) workbook import for a bundle (00234), server only. A port of
// scripts/sdc-hipo/load-scenarios.py: reads the 'Scenarios' sheet of the SME's
// workbook (row 5 down, columns as built by scripts/sdc-hipo/build-template.py),
// checks every row against the SDC v3 framework, then upserts the competencies
// and scenarios and retires loaded scenarios that are no longer in the workbook.
//   errors   (row not loaded): missing situation or response, a level used other
//            than once, an indicator ID that is unknown, of another competency,
//            or of another level.
//   warnings (row loaded):     situation outside 50 to 100 words, responses more
//            than 10 words apart.
// Response keys are the same opaque hashes the script makes, so re-loading the
// same workbook keeps every key and candidates mid-sitting are not disturbed.

import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { readXlsxSheet } from "@/lib/xlsx/read";
import { OPTION_LEVELS, type BundleCompetency, type OptionLevel, type SjtOption } from "./sjt-shared";
import v3 from "./frameworks/sdc-v3.json";

type Indicator = { category: string; competency: string; definition: string; id: string; option_level: string };

const CODE: Record<string, string> = {
  Innovation: "IN",
  "Results Oriented": "RO",
  "Effective Collaboration and Communication": "ECC",
  "Professionalism and Integrity": "PI",
  "Accountability & Ownership": "AO",
  "Strategic Mindset": "SM",
  "Drives Sustainable Performance": "DSP",
  "Makes Effective Decisions and Plans": "EDP",
  "Inspires & Motivates": "IM",
  "Leads by Example": "LBE",
};
const LEVELS: readonly string[] = OPTION_LEVELS; // Advanced, Proficient, Basic, Counter-evidence
const LEVEL_NUM: Record<string, number> = { "Not required": 0, Basic: 1, Proficient: 2, Advanced: 3 };
const TARGET_ORDER: Record<string, number> = { Basic: 0, Proficient: 1, Advanced: 2 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const INDICATORS = v3.indicators as Indicator[];
const IND = new Map(INDICATORS.map((i) => [i.id, i]));
const COMPS: Array<{ category: string; competency: string }> = [];
for (const i of INDICATORS) {
  if (!COMPS.some((c) => c.category === i.category && c.competency === i.competency)) COMPS.push({ category: i.category, competency: i.competency });
}

export const SCENARIO_SHEET = "Scenarios";
export const DEFAULT_IMPORT_STATUSES = ["Approved"];

/** The ten SDC competencies with required level per grade (0 to 3). */
export function sdcCompetencyRows(): BundleCompetency[] {
  const gh = v3.grade_header as string[];
  const grades = v3.grades as string[][];
  return COMPS.map(({ category, competency }, n) => {
    const col = gh.indexOf(competency);
    const req: Record<string, number> = {};
    for (const g of grades) req[g[0]] = LEVEL_NUM[g[col]];
    if ("5" in req) req["4"] = req["5"]; // Grade 4 uses Grade 5 levels (Suzanne Salim, 6 Oct 2026)
    const sorted = Object.fromEntries(Object.entries(req).sort((a, b) => Number(a[0]) - Number(b[0])));
    return {
      code: CODE[competency],
      name: competency,
      category,
      definition: INDICATORS.find((i) => i.competency === competency)!.definition,
      required_levels: sorted,
      sort_order: n + 1,
    };
  });
}

/** messages: the errors first (errorCount of them), then the warnings; for a skipped row, the reason. */
export type ImportReportRow = { ref: string; row: number; outcome: "loaded" | "skipped" | "error"; messages: string[]; errorCount: number };
export type ImportOption = { letter: string; text: string; level: OptionLevel; indicator_id: string | null };
export type ImportItem = {
  ref: string;
  competency_code: string;
  target_level: "Basic" | "Proficient" | "Advanced";
  situation: string;
  options: ImportOption[];
  sort_order: number;
};
export type ParsedScenarioWorkbook = {
  statuses: string[];
  competencies: BundleCompetency[];
  items: ImportItem[];
  report: ImportReportRow[];
  /** Scenarios per competency code among the loadable rows, and codes with fewer than 3. */
  perCompetency: Record<string, number>;
  short: string[];
  /** Set when nothing in the file can be loaded at all (no sheet, duplicate IDs, unreadable file). */
  fatal: string | null;
};

const clean = (v: string | undefined) => (v ? v.trim().replace(/[ \t]+/g, " ") : "");
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

export async function parseScenarioWorkbook(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  opts: { statuses?: string[] } = {},
): Promise<ParsedScenarioWorkbook> {
  const statuses = Array.from(new Set(opts.statuses?.length ? opts.statuses : DEFAULT_IMPORT_STATUSES)).sort();
  const out: ParsedScenarioWorkbook = { statuses, competencies: sdcCompetencyRows(), items: [], report: [], perCompetency: {}, short: [], fatal: null };
  let grid: string[][] | null;
  try {
    grid = await readXlsxSheet(buffer, SCENARIO_SHEET);
  } catch (e) {
    return { ...out, fatal: e instanceof Error ? e.message : "Could not read the workbook." };
  }
  if (!grid) return { ...out, fatal: `No '${SCENARIO_SHEET}' sheet in this workbook.` };

  const compOrder = new Map(COMPS.map((c, n) => [c.competency, n]));
  const loaded: Array<ImportItem & { _sort: [number, number, number] }> = [];
  for (let r = 5; r <= grid.length; r++) {
    const cell = (c: number) => grid[r - 1]?.[c - 1];
    const ref = clean(cell(1));
    if (!ref) continue;
    const comp = clean(cell(3));
    const lvl = clean(cell(4));
    const situation = clean(cell(6));
    const status = clean(cell(22)) || "Draft";
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!statuses.includes(status)) {
      out.report.push({ ref, row: r, outcome: "skipped", messages: [`status is '${status}'`], errorCount: 0 });
      continue;
    }
    if (!Object.hasOwn(CODE, comp)) errors.push(`unknown competency '${comp}'`);
    if (!Object.hasOwn(TARGET_ORDER, lvl)) errors.push(`unknown scenario level '${lvl}'`);
    if (!situation) errors.push("situation is empty");
    else if (words(situation) < 50 || words(situation) > 100) warnings.push(`situation is ${words(situation)} words (50 to 100 asked)`);
    const options: ImportOption[] = [];
    "ABCD".split("").forEach((letter, k) => {
      const c = 7 + 3 * k;
      const text = clean(cell(c));
      const level = clean(cell(c + 1));
      const ind = clean(cell(c + 2)).toUpperCase();
      if (!text) errors.push(`response ${letter} is empty`);
      if (!LEVELS.includes(level)) errors.push(`response ${letter} level '${level}' is not one of ${LEVELS.join(", ")}`);
      if (!ind) errors.push(`response ${letter} has no indicator ID`);
      else if (!IND.has(ind)) errors.push(`response ${letter} indicator '${ind}' is not in v3`);
      else {
        const i = IND.get(ind)!;
        if (i.competency !== comp) errors.push(`response ${letter} indicator ${ind} belongs to ${i.competency}`);
        if (i.option_level !== level) errors.push(`response ${letter} indicator ${ind} is ${i.option_level}, not ${level}`);
      }
      options.push({ letter, text, level: level as OptionLevel, indicator_id: ind || null });
    });
    const used = options.map((o) => o.level as string).sort();
    if (used.join("|") !== [...LEVELS].sort().join("|")) {
      errors.push("each level must be used exactly once (Advanced, Proficient, Basic, Counter-evidence)");
    }
    const lens = options.filter((o) => o.text).map((o) => words(o.text));
    if (lens.length === 4 && Math.max(...lens) - Math.min(...lens) > 10) {
      warnings.push(`responses range from ${Math.min(...lens)} to ${Math.max(...lens)} words (keep within about 10)`);
    }
    if (errors.length > 0) {
      out.report.push({ ref, row: r, outcome: "error", messages: [...errors, ...warnings], errorCount: errors.length });
      continue;
    }
    out.report.push({ ref, row: r, outcome: "loaded", messages: warnings, errorCount: 0 });
    loaded.push({
      ref,
      competency_code: CODE[comp],
      target_level: lvl as ImportItem["target_level"],
      situation,
      options,
      sort_order: 0,
      _sort: [compOrder.get(comp)!, TARGET_ORDER[lvl], r],
    });
  }

  const seen = new Map<string, number>();
  for (const x of loaded) seen.set(x.ref, (seen.get(x.ref) ?? 0) + 1);
  const dup = Array.from(seen).filter(([, n]) => n > 1).map(([ref]) => ref).sort();
  if (dup.length > 0) {
    for (const row of out.report) {
      if (row.outcome === "loaded" && dup.includes(row.ref)) {
        row.outcome = "error";
        row.messages = ["Scenario ID used more than once", ...row.messages];
        row.errorCount = 1;
      }
    }
    return { ...out, fatal: `Scenario IDs used more than once: ${dup.join(", ")}` };
  }

  loaded.sort((a, b) => a._sort[0] - b._sort[0] || a._sort[1] - b._sort[1] || a._sort[2] - b._sort[2]);
  out.items = loaded.map(({ _sort, ...it }, n) => ({ ...it, sort_order: n + 1 }));
  for (const it of out.items) out.perCompetency[it.competency_code] = (out.perCompetency[it.competency_code] ?? 0) + 1;
  out.short = COMPS.map((c) => CODE[c.competency]).filter((code) => (out.perCompetency[code] ?? 0) < 3);
  return out;
}

/** Opaque response key: the first 10 hex of sha256("bundle|ref|letter"), as the script makes it. */
export const optionKey = (bundleId: string, ref: string, letter: string) =>
  createHash("sha256").update(`${bundleId}|${ref}|${letter}`, "utf8").digest("hex").slice(0, 10);

export type KeyedImportItem = Omit<ImportItem, "options"> & { options: SjtOption[] };

export function withOptionKeys(bundleId: string, items: ImportItem[]): KeyedImportItem[] {
  return items.map((it) => ({
    ...it,
    options: it.options.map((o) => ({ key: optionKey(bundleId, it.ref, o.letter), text: o.text, level: o.level, indicator_id: o.indicator_id })),
  }));
}

/**
 * Write a parsed workbook to the bundle: upsert the competencies, upsert the
 * scenarios (active again if they were retired), then retire active scenarios
 * whose Scenario ID is not in this load. Candidates who already started keep
 * their order; a retired scenario drops out of their remaining list.
 */
export async function applyScenarioImport(
  bundleId: string,
  parsed: ParsedScenarioWorkbook,
): Promise<{ ok: true; competencies: number; added: number; updated: number; retired: number } | { error: string }> {
  const bundle = bundleId.toLowerCase();
  if (!UUID_RE.test(bundle)) return { error: "Unknown bundle." };
  if (parsed.fatal) return { error: parsed.fatal };
  if (parsed.items.length === 0) return { error: "Nothing to load: no row passed the checks." };
  const sb = createServiceClient();

  const { error: compErr } = await sb.from("bundle_competencies").upsert(
    parsed.competencies.map((c) => ({ bespoke_service_id: bundle, ...c })),
    { onConflict: "bespoke_service_id,code" },
  );
  if (compErr) return { error: `Could not save the competencies: ${compErr.message}` };

  const { data: before, error: readErr } = await sb.from("bundle_sjt_items").select("ref, active").eq("bespoke_service_id", bundle);
  if (readErr) return { error: `Could not read the current scenarios: ${readErr.message}` };
  const existing = new Map(((before ?? []) as Array<{ ref: string; active: boolean }>).map((r) => [r.ref, r.active]));

  const keyed = withOptionKeys(bundle, parsed.items);
  const { error: itemErr } = await sb.from("bundle_sjt_items").upsert(
    keyed.map((it) => ({
      bespoke_service_id: bundle,
      ref: it.ref,
      competency_code: it.competency_code,
      target_level: it.target_level,
      situation: it.situation,
      options: it.options,
      sort_order: it.sort_order,
      active: true,
    })),
    { onConflict: "bespoke_service_id,ref" },
  );
  if (itemErr) return { error: `Could not save the scenarios: ${itemErr.message}` };

  const refs = new Set(keyed.map((it) => it.ref));
  const retire = Array.from(existing).filter(([ref, active]) => active && !refs.has(ref)).map(([ref]) => ref);
  if (retire.length > 0) {
    const { error: retErr } = await sb.from("bundle_sjt_items").update({ active: false }).eq("bespoke_service_id", bundle).eq("active", true).in("ref", retire);
    if (retErr) return { error: `Scenarios saved, but the old ones could not be retired: ${retErr.message}` };
  }

  const added = keyed.filter((it) => !existing.has(it.ref)).length;
  return { ok: true, competencies: parsed.competencies.length, added, updated: keyed.length - added, retired: retire.length };
}
