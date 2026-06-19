/**
 * Technical-assessment aggregation - shared types.
 *
 * One mechanism aggregates individual TECHNICAL results across portals into a
 * hierarchical Company -> Project client report. The portal-specific loaders
 * (sources.ts) normalise every result into the single `RawTechResult` shape
 * below, so the metric + insight engines never care which portal a result came
 * from. "Domain" = a technical function / skill area (e.g. FP&A, L&D, Accounts
 * Payable); a delegate's result carries one domain + one 0-100 score.
 */

/** Which portal a normalised result originated from. */
export type TechPortal = "sandbox" | "mcq";

/**
 * A single individual's technical result, normalised across portals.
 * `completed=false` rows represent invited-but-not-finished delegates (used for
 * participation); their `scorePct` is null and they are excluded from score
 * profiles.
 */
export type RawTechResult = {
  portal: TechPortal;
  /** Dedup key for a person within a company (lowercased email, else name). */
  candidateKey: string;
  candidateName: string;
  candidateEmail: string | null;
  /** Normalised company grouping key (see normalizeKey). */
  companyKey: string;
  /** Display company name (original casing of first sighting). */
  companyLabel: string;
  /** Stable project/cohort key within the company. */
  projectKey: string;
  /** Display project/cohort name. */
  projectLabel: string;
  /** Technical function / skill area key (the "domain"). */
  domainKey: string;
  /** Display domain name. */
  domainLabel: string;
  /** 0-100 score; null when not completed. */
  scorePct: number | null;
  /** True when the delegate finished (submitted / has a result row). */
  completed: boolean;
  /** ISO completion (or last-activity) timestamp; null when not completed. */
  takenAt: string | null;
};

/** Total invited vs started vs completed for a level. */
export type ParticipationMetrics = {
  invited: number;
  started: number;
  completed: number;
  /** completed / invited, 0-1 (0 when invited is 0). */
  completionRate: number;
};

/** Average / highest / lowest score for one domain across the cohort. */
export type DomainProfile = {
  domainKey: string;
  domainLabel: string;
  /** Number of completed, scored results in this domain. */
  n: number;
  averagePct: number;
  highestPct: number;
  lowestPct: number;
};

/** A domain whose average falls below the baseline threshold. */
export type SkillGap = {
  domainKey: string;
  domainLabel: string;
  averagePct: number;
  baselinePct: number;
  /** baselinePct - averagePct (always > 0 for a gap). */
  gapPct: number;
  n: number;
};

/** A generated qualitative insight line for the report. */
export type Insight = {
  kind: "strength" | "vulnerability" | "recommendation";
  title: string;
  detail: string;
  /** Optional domain this insight is anchored to. */
  domainKey?: string;
  /** Recommendation only: course ids/codes surfaced by the recommender. */
  courseCodes?: string[];
};

export type LevelMetrics = {
  participation: ParticipationMetrics;
  skill_profiles: DomainProfile[];
  skill_gaps: SkillGap[];
};

export type ProjectReport = {
  project_id: string;
  project_label: string;
  project_metrics: LevelMetrics;
  project_insights: Insight[];
};

/** The structured payload handed to the reporting template. */
export type ClientReportPayload = {
  company_id: string;
  company_label: string;
  generated_at: string;
  /** Portals that contributed data to this company. */
  portals: TechPortal[];
  company_metrics: LevelMetrics;
  projects: ProjectReport[];
  company_overall_insights: Insight[];
};

/** Lightweight company summary for the picker (no scoring). */
export type TechCompanySummary = {
  companyKey: string;
  companyLabel: string;
  invited: number;
  completed: number;
  projects: number;
  domains: number;
  lastActivity: string | null;
};

/** The default baseline below which a domain average is a gap (Decision 3). */
export const DEFAULT_BASELINE_PCT = 70;
