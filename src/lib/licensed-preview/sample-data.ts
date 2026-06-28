// Deterministic sample-data engine for the Licensed Portal Preview. Given a
// prospect's org name + sector + region, it produces a stable, realistic-looking
// "tenant" dataset (headcount, per-module stats, departments, people) so a pitch
// of "Caliber for {Org}" always renders the same bespoke-feeling numbers. NO DB
// access and NO real data - this is a sales/demo surface only.

export type Sector = "government" | "banking" | "general";
export type Region = "uae" | "saudi";

export type Brand = {
  org: string;
  sector: Sector;
  region: Region;
  accent: string; // hex, drives the tenant's accent colour
};

export type Cohort = { name: string; size: number; score: number };
export type Person = { name: string; department: string; role: string; readiness: number; band: string };
export type DeptStat = { name: string; readiness: number; headcount: number };

export type ModuleStat = {
  assessed: number;
  coverage: number; // % of headcount assessed
  avgScore: number; // 0-100
  band: string;
  trend: number; // +/- vs prior cycle
  topStrength: string;
  topGap: string;
  cohorts: Cohort[];
};

export type TenantData = {
  brand: Brand;
  headcount: number;
  workforceReadiness: number; // 0-100 composite
  credentialsIssued: number;
  programmesActive: number;
  assessmentsRun: number;
  departments: DeptStat[];
  people: Person[];
  modules: Record<string, ModuleStat>;
};

// ── deterministic PRNG (mulberry32) seeded from the org name ──
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ahmed", "Sara", "Mohammed", "Fatima", "Khalid", "Noura", "Omar", "Aisha", "Yousef", "Maryam", "Abdullah", "Hessa", "Saeed", "Latifa", "Tariq", "Reem", "Faisal", "Huda", "Nasser", "Salma"];
const LAST = ["Al-Mansoori", "Al-Qahtani", "Al-Farsi", "Al-Otaibi", "Al-Hashimi", "Al-Dosari", "Al-Balushi", "Al-Ghamdi", "Al-Suwaidi", "Al-Harbi"];
const ROLES = ["Analyst", "Senior Analyst", "Team Lead", "Manager", "Senior Manager", "Director", "Specialist", "Officer"];

const DEPTS_BY_SECTOR: Record<Sector, string[]> = {
  government: ["Strategy & Planning", "Digital Transformation", "Human Capital", "Finance", "Policy & Regulation", "Operations", "Internal Audit", "Data & AI"],
  banking: ["Treasury", "Risk Management", "Retail Banking", "Corporate Credit", "Compliance", "Wealth Management", "Finance", "Digital Banking"],
  general: ["Finance", "Operations", "Human Resources", "Strategy", "Commercial", "Technology", "Supply Chain", "Internal Audit"],
};

const MODULE_PROFILES: Record<string, { strengths: string[]; gaps: string[]; base: number }> = {
  ac: { strengths: ["Strategic Thinking", "Decision Quality", "Drive for Results"], gaps: ["Manages Ambiguity", "Cultivates Innovation"], base: 68 },
  techno: { strengths: ["Financial Modelling", "Data Analytics", "SQL & Reporting"], gaps: ["Advanced Forecasting", "Python Automation"], base: 63 },
  logica: { strengths: ["Numerical Reasoning", "Abstract Reasoning"], gaps: ["Verbal Reasoning under time"], base: 71 },
  persona: { strengths: ["Resilience", "Action Orientation"], gaps: ["Manages Ambiguity", "Self-Development"], base: 66 },
  fluent: { strengths: ["Reading (B2)", "Listening (B2)"], gaps: ["Speaking fluency (B1)", "Business Writing"], base: 64 },
  arc: { strengths: ["AI Working Practice", "AI Sense-Check"], gaps: ["AI Collaboration", "Governance readiness"], base: 58 },
  reflect: { strengths: ["Communicates", "Builds Networks"], gaps: ["Develops Talent", "Courage"], base: 70 },
  psychometrics: { strengths: ["Conscientiousness", "Emotional Stability"], gaps: ["Openness to change"], base: 67 },
  prehire: { strengths: ["Role-fit screening", "Language readiness"], gaps: ["Technical depth at junior bands"], base: 72 },
  academy: { strengths: ["Completion rate", "Knowledge-check pass rate"], gaps: ["Time-to-completion"], base: 74 },
  credentials: { strengths: ["Verified issuance", "Renewal compliance"], gaps: ["Expiry follow-up"], base: 80 },
  succession: { strengths: ["Bench strength (Director)", "Ready-now pipeline"], gaps: ["Critical-role coverage"], base: 61 },
};

function bandFor(score: number): string {
  if (score >= 80) return "Significant Strength";
  if (score >= 67) return "Strength";
  if (score >= 50) return "Competent";
  if (score >= 35) return "Development Needed";
  return "Significant Development";
}

export function buildSampleTenant(brand: Brand): TenantData {
  const rnd = mulberry32(hashSeed(`${brand.org}|${brand.sector}|${brand.region}`));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));

  const headcount = between(900, 5200);
  const deptNames = DEPTS_BY_SECTOR[brand.sector];

  const departments: DeptStat[] = deptNames.map((name) => ({
    name,
    readiness: between(48, 86),
    headcount: between(40, Math.max(60, Math.floor(headcount / deptNames.length) + 120)),
  }));

  const people: Person[] = Array.from({ length: 12 }, () => {
    const readiness = between(42, 93);
    return {
      name: `${pick(FIRST)} ${pick(LAST)}`,
      department: pick(deptNames),
      role: pick(ROLES),
      readiness,
      band: bandFor(readiness),
    };
  }).sort((a, b) => b.readiness - a.readiness);

  const modules: Record<string, ModuleStat> = {};
  for (const [id, p] of Object.entries(MODULE_PROFILES)) {
    const avgScore = Math.min(94, Math.max(40, p.base + between(-6, 8)));
    const assessed = between(Math.floor(headcount * 0.25), Math.floor(headcount * 0.85));
    modules[id] = {
      assessed,
      coverage: Math.round((assessed / headcount) * 100),
      avgScore,
      band: bandFor(avgScore),
      trend: between(-3, 7),
      topStrength: p.strengths[0],
      topGap: p.gaps[0],
      cohorts: deptNames.slice(0, 4).map((name) => ({ name, size: between(18, 140), score: between(45, 90) })),
    };
  }

  const workforceReadiness = Math.round(
    departments.reduce((s, d) => s + d.readiness, 0) / departments.length,
  );

  return {
    brand,
    headcount,
    workforceReadiness,
    credentialsIssued: between(Math.floor(headcount * 0.18), Math.floor(headcount * 0.5)),
    programmesActive: between(6, 22),
    assessmentsRun: between(Math.floor(headcount * 0.8), Math.floor(headcount * 2.4)),
    departments,
    people,
    modules,
  };
}

export const SECTOR_LABEL: Record<Sector, string> = {
  government: "Government",
  banking: "Banking & Finance",
  general: "Enterprise",
};
export const REGION_LABEL: Record<Region, string> = { uae: "United Arab Emirates", saudi: "Saudi Arabia" };
