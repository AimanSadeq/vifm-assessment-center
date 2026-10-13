// Fictional rows in the database shapes the SDC reports read, for the unit
// tests and the local render check (scripts/sdc-hipo/check-caliber-reports.ts).
// Nobody here is real.

import v3 from "../../bespoke/frameworks/sdc-v3.json";
import { SDC_CODES, type SdcCompetency } from "./rules";
import type { CandidateRow, RosterLite, SjtResultLite, PsyLite } from "./assemble";

const LV: Record<string, number> = { Basic: 1, Proficient: 2, Advanced: 3 };
const CODE: Record<string, string> = {
  "Innovation": "IN", "Results Oriented": "RO", "Effective Collaboration and Communication": "ECC",
  "Professionalism and Integrity": "PI", "Accountability & Ownership": "AO", "Strategic Mindset": "SM",
  "Drives Sustainable Performance": "DSP", "Makes Effective Decisions and Plans": "EDP",
  "Inspires & Motivates": "IM", "Leads by Example": "LBE",
};

type V3 = {
  indicators: Array<{ competency: string; category: string; definition: string }>;
  grade_header: string[];
  grades: string[][];
};

/** bundle_competencies rows as load-scenarios.py writes them (Grade 4 carries Grade 5 levels). */
export const FIXTURE_COMPETENCIES: SdcCompetency[] = (() => {
  const f = v3 as V3;
  const seen = new Map<string, SdcCompetency>();
  for (const i of f.indicators) {
    if (seen.has(i.competency)) continue;
    const code = CODE[i.competency];
    const required_levels: Record<string, number> = {};
    for (const row of f.grades) required_levels[row[0]] = LV[row[f.grade_header.indexOf(i.competency)]] ?? 0;
    seen.set(i.competency, {
      code, name: i.competency, category: i.category, definition: i.definition, required_levels,
      sort_order: SDC_CODES.indexOf(code as (typeof SDC_CODES)[number]) + 1,
    });
  }
  return [...seen.values()].sort((a, b) => a.sort_order - b.sort_order);
})();

export const FIXTURE_ORG = "Soudah Development Company";
const BUNDLE = "00000000-0000-4000-8000-0000000000b1";

type Spec = {
  name: string; grade: number | null; unit: string; position: string;
  res: number[]; // IN RO ECC PI AO SM DSP EDP IM LBE
  num: number; ind: number;
  status?: string; tester?: boolean;
};

// The individual-report candidate first: Grade 7 with five gaps (PI -2; RO, AO, DSP, IM -1).
const SPECS: Spec[] = [
  { name: "Huda Al-Zahrani", grade: 7, unit: "Commercial", position: "Visitor Experience Manager", res: [3, 2, 3, 1, 2, 2, 0, 2, 0, 1], num: 81, ind: 74 },
  { name: "Faisal Al-Dosari", grade: 8, unit: "Development & Asset Management", position: "Senior Manager, Assets", res: [3, 3, 3, 3, 3, 3, 2, 3, 2, 2], num: 76, ind: 82 },
  { name: "Tariq Al-Ghamdi", grade: 7, unit: "Finance", position: "Finance Manager", res: [2, 3, 2, 3, 3, 2, 2, 2, 1, 2], num: 81, ind: 64 },
  { name: "Hind Al-Mutairi", grade: 7, unit: "Human Capital", position: "HR Manager", res: [2, 2, 2, 3, 2, 1, 1, 1, 1, 1], num: 49, ind: 55 },
  { name: "Nasser Al-Harbi", grade: 6, unit: "Strategy", position: "Senior Specialist, Strategy", res: [3, 3, 3, 3, 3, 2, 1, 2, 1, 1], num: 79, ind: 84 },
  { name: "Maha Al-Otaibi", grade: 6, unit: "Governance, Risk & Compliance", position: "Senior Specialist, Risk", res: [2, 3, 2, 3, 2, 1, 1, 1, 1, 1], num: 66, ind: 61 },
  { name: "Bandar Al-Anazi", grade: 6, unit: "Corporate Services", position: "Senior Specialist, Procurement", res: [2, 2, 2, 2, 2, 1, 1, 1, 0, 1], num: 69, ind: 72 },
  { name: "Yousef Al-Shamrani", grade: 5, unit: "Development & Asset Management", position: "Specialist, Planning", res: [3, 2, 3, 2, 3, 2, 1, 2, 1, 1], num: 74, ind: 79 },
  { name: "Rawan Al-Malki", grade: 5, unit: "Finance", position: "Specialist, Reporting", res: [2, 2, 2, 2, 2, 1, 1, 1, 1, 1], num: 63, ind: 58 },
  { name: "Joud Al-Balawi", grade: 5, unit: "Strategy", position: "Specialist, Research", res: [1, 1, 2, 2, 1, 0, 0, 1, 0, 1], num: 47, ind: 52 },
  { name: "Areej Al-Saadi", grade: 4, unit: "Commercial", position: "Senior Analyst, Sales", res: [3, 2, 2, 3, 3, 1, 1, 1, 1, 1], num: 77, ind: 71 },
  { name: "Dana Al-Hazmi", grade: 4, unit: "Finance", position: "Senior Analyst, Budgeting", res: [2, 2, 2, 2, 1, 1, 0, 1, 0, 1], num: 58, ind: 63 },
  // Left out of the group report: a tester, someone still in progress.
  { name: "Test Account", grade: 6, unit: "VIFM", position: "Tester", res: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], num: 100, ind: 100, tester: true },
  { name: "Omar Al-Qahtani", grade: 5, unit: "Commercial", position: "Specialist, Partnerships", res: [2, 2, 2, 2, 2, 1, 1, 1, 1, 1], num: 60, ind: 60, status: "in_progress" },
];

const uuid = (n: number, kind: string) => `00000000-0000-4000-8${kind}-${String(n).padStart(12, "0")}`;

export const FIXTURE_CANDIDATES: CandidateRow[] = SPECS.map((s, i) => ({
  id: uuid(i + 1, "001"),
  full_name: s.name,
  email: `${s.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
  completed_at: s.status === "in_progress" ? null : `2026-10-${String(10 + (i % 9)).padStart(2, "0")}T21:30:00Z`,
  status: s.status ?? (i % 3 === 0 ? "scored" : "completed"),
  bespoke_service_id: BUNDLE,
  organization_id: uuid(1, "0aa"),
  cognitive_result_id: s.status === "in_progress" ? null : uuid(i + 1, "002"),
}));

export const FIXTURE_ROSTER: RosterLite[] = [
  ...SPECS.map((s, i) => ({ bundle_candidate_id: uuid(i + 1, "001"), grade: s.grade, position: s.position, business_unit: s.unit, is_tester: !!s.tester })),
  // Two approved people who have not started.
  { bundle_candidate_id: null, grade: 5, position: "Specialist", business_unit: "Finance", is_tester: false },
  { bundle_candidate_id: null, grade: 7, position: "Manager", business_unit: "Strategy", is_tester: false },
];

const scoresOf = (res: number[]) =>
  Object.fromEntries(SDC_CODES.map((code, k) => [code, { level: res[k], points: res[k] * 4, max: 12, scaled: res[k] * 4, answered: 3, items: 3 }]));

export const FIXTURE_SJT: SjtResultLite[] = SPECS.flatMap((s, i) =>
  s.status === "in_progress" ? [] : [{ bundle_candidate_id: uuid(i + 1, "001"), scores: scoresOf(s.res), submitted_at: "2026-10-12T08:00:00Z" }],
);

export const FIXTURE_PSY: PsyLite[] = SPECS.flatMap((s, i) =>
  s.status === "in_progress"
    ? []
    : [{ id: uuid(i + 1, "002"), scales: [{ key: "numerical", raw: s.num, band: "x" }, { key: "inductive", raw: s.ind, band: "x" }] }],
);
