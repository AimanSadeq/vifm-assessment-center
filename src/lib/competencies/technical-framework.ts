// Technical Competency Framework — the third pillar (with behavioural + language).
//
// A curated 2-level taxonomy (Domain → Skill) of the hard, functional capabilities
// VIFM trains, kept SEPARATE from the 38 behavioural competencies and the 4
// language skills. Domain keys match the course `vertical` enum so Academy
// completions map straight onto a domain. Tax is intentionally excluded;
// leadership / strategy / project_management stay in the behavioural framework.
//
// Pure constants + helpers (no DB, no AI) so the taxonomy is stable, auditable,
// and free of hallucination — the assessment + Academy evidence measure AGAINST
// this fixed framework.

export type TechDomainKey =
  | "finance"
  | "investment"
  | "treasury"
  | "accounting"
  | "banking"
  | "analytics"
  | "business_intelligence"
  | "artificial_intelligence"
  | "business_reporting"
  | "real_estate";

export type TechDomain = { key: TechDomainKey; name: string; skills: string[] };

export const TECH_DOMAINS: TechDomain[] = [
  {
    key: "finance",
    name: "Finance",
    skills: ["Financial Modelling", "Capital Budgeting", "Cost of Capital (WACC)", "Working Capital Management", "Financial Statement Analysis"],
  },
  {
    key: "investment",
    name: "Investment",
    skills: ["Valuation (DCF & Multiples)", "Portfolio Management", "Equity Analysis", "Fixed Income", "Risk, Return & CAPM"],
  },
  {
    key: "treasury",
    name: "Treasury",
    skills: ["Cash & Liquidity Management", "FX Risk Management", "Interest-Rate Risk", "Funding & Capital Markets", "Bank Relationship Management"],
  },
  {
    key: "accounting",
    name: "Accounting",
    skills: ["Financial Accounting", "IFRS", "Management Accounting", "Consolidation", "Revenue Recognition"],
  },
  {
    key: "banking",
    name: "Banking",
    skills: ["Credit Analysis", "Loan Structuring", "Basel & Capital Adequacy", "Islamic Banking", "Retail & Commercial Products"],
  },
  {
    key: "analytics",
    name: "Analytics",
    skills: ["Financial Data Analysis", "Forecasting & Modelling", "Statistics for Finance", "Scenario & Sensitivity Analysis", "Spreadsheet Engineering"],
  },
  {
    key: "business_intelligence",
    name: "Business Intelligence",
    skills: ["Dashboarding & Visualization", "KPI Design", "Data Modelling", "Reporting Automation", "BI Tools (Power BI / Tableau)"],
  },
  {
    key: "artificial_intelligence",
    name: "Artificial Intelligence",
    skills: ["AI & ML Foundations", "Applied AI in Finance", "GenAI Tools & Prompting", "Data Readiness for AI", "AI Risk & Governance"],
  },
  {
    key: "business_reporting",
    name: "Business Reporting",
    skills: ["Financial Reporting & Disclosures", "Management Reporting", "Regulatory Reporting", "Narrative & ESG Reporting", "Board Reporting"],
  },
  {
    key: "real_estate",
    name: "Real Estate",
    skills: ["Real Estate Finance", "Property Valuation", "REITs & Funds", "Development Feasibility", "Investment Analysis"],
  },
];

export const techDomainByKey = (k: string): TechDomain | null =>
  TECH_DOMAINS.find((d) => d.key === k) ?? null;

// ── Proficiency scale (1–5) ──────────────────────────────────────
// Deliberately coarse: a short assessment yields an INDICATIVE band, not a
// certified grade. The label set is the single source of truth for display.
export const TECH_LEVELS = ["Awareness", "Foundational", "Working", "Proficient", "Expert"] as const;
export type TechLevel = 1 | 2 | 3 | 4 | 5;

export type TechProficiency = { level: TechLevel; label: string; normalized: number };

/** Map an assessment score (0–100) to an indicative 1–5 proficiency band. */
export function proficiencyFromPercent(pct: number): TechProficiency {
  const p = Math.max(0, Math.min(100, pct));
  const level: TechLevel = p >= 85 ? 5 : p >= 70 ? 4 : p >= 55 ? 3 : p >= 40 ? 2 : 1;
  return { level, label: TECH_LEVELS[level - 1], normalized: Math.round(p) };
}

/** Normalized 0–100 for a 1–5 level (for blending onto the golden thread). */
export function normalizedFromLevel(level: number): number {
  const l = Math.max(1, Math.min(5, Math.round(level)));
  return Math.round(((l - 1) / 4) * 100);
}
