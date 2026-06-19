/**
 * Technical-assessment aggregation - the orchestrator.
 *
 * buildClientReport(companyKey) is the single entry point: it loads every
 * normalised technical result, scopes to one company, subdivides by project,
 * computes per-level metrics, runs the insight engine, attaches matched VIFM
 * courses to the training recommendations, and returns the structured payload.
 *
 * Service-role I/O (loaders + recommender); the metric + insight engines it
 * calls are pure. Best-effort throughout - a company with no data returns null,
 * and the recommender enrichment never throws into the payload.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { recommendCoursesForTechnical } from "@/lib/recommender/courses";
import { proficiencyTier } from "@/lib/competencies/proficiency-tier";
import { loadAllTechResults, normalizeKey } from "./sources";
import { computeLevelMetrics } from "./metrics";
import { deriveStrengths, deriveVulnerabilities, deriveTrainingRecommendations } from "./insights";
import {
  DEFAULT_BASELINE_PCT,
  type RawTechResult,
  type ClientReportPayload,
  type ProjectReport,
  type TechCompanySummary,
  type TechPortal,
  type Insight,
} from "./types";

export type BuildReportOptions = {
  /** Baseline below which a domain average is a gap (default 70). */
  baselinePct?: number;
  /** ISO timestamp to stamp the report with (Date.now() is unavailable here). */
  generatedAt?: string;
};

/** Enumerate every company with technical results, for the picker. */
export async function listTechCompanies(): Promise<TechCompanySummary[]> {
  const all = await loadAllTechResults();
  const byKey = new Map<
    string,
    { label: string; invited: Set<string>; completed: Set<string>; projects: Set<string>; domains: Set<string>; last: string | null }
  >();
  for (const r of all) {
    const e =
      byKey.get(r.companyKey) ??
      { label: r.companyLabel, invited: new Set<string>(), completed: new Set<string>(), projects: new Set<string>(), domains: new Set<string>(), last: null as string | null };
    e.invited.add(r.candidateKey);
    if (r.completed) e.completed.add(r.candidateKey);
    e.projects.add(r.projectKey);
    e.domains.add(r.domainKey);
    if (r.takenAt && (!e.last || r.takenAt > e.last)) e.last = r.takenAt;
    byKey.set(r.companyKey, e);
  }
  return Array.from(byKey.entries())
    .map(([companyKey, e]) => ({
      companyKey,
      companyLabel: e.label,
      invited: e.invited.size,
      completed: e.completed.size,
      projects: e.projects.size,
      domains: e.domains.size,
      lastActivity: e.last,
    }))
    .sort((a, b) => b.invited - a.invited);
}

/** function_id -> the function's domain_key (finance/hr/...), for course matching. */
async function loadFunctionDomainKeys(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("technical_functions").select("id, domain_key");
    for (const f of (data ?? []) as Array<{ id: string; domain_key: string | null }>) {
      if (f.domain_key) map.set(f.id, f.domain_key);
    }
  } catch {
    /* table absent - sandbox course recs fall back to empty */
  }
  return map;
}

/**
 * Resolve the course-catalogue vertical key for a gap's domain. Sandbox domains
 * are "fn:<function_id>" (resolve via the function's domain_key); MCQ domains are
 * already a domain_key. Null when it can't be resolved (no course match).
 */
function courseVerticalFor(domainKey: string, fnDomainKeys: Map<string, string>): string | null {
  if (domainKey.startsWith("fn:")) return fnDomainKeys.get(domainKey.slice(3)) ?? null;
  return domainKey;
}

/** Build the full Company -> Project client report payload, or null if no data. */
export async function buildClientReport(
  companyKey: string,
  opts: BuildReportOptions = {}
): Promise<ClientReportPayload | null> {
  const wantKey = normalizeKey(companyKey);
  if (!wantKey) return null;
  const baselinePct = opts.baselinePct ?? DEFAULT_BASELINE_PCT;

  const all = await loadAllTechResults();
  const companyResults = all.filter((r) => r.companyKey === wantKey);
  if (companyResults.length === 0) return null;

  const companyLabel =
    companyResults.find((r) => r.companyLabel.trim())?.companyLabel ?? wantKey;
  const portals = Array.from(new Set(companyResults.map((r) => r.portal))) as TechPortal[];

  // ── Group by project ──
  const byProject = new Map<string, { label: string; results: RawTechResult[] }>();
  for (const r of companyResults) {
    const e = byProject.get(r.projectKey) ?? { label: r.projectLabel, results: [] };
    e.results.push(r);
    byProject.set(r.projectKey, e);
  }

  // ── Company-level metrics + insights ──
  const company_metrics = computeLevelMetrics(companyResults, baselinePct);

  // ── Per-project ──
  const projects: ProjectReport[] = Array.from(byProject.entries())
    .map(([project_id, { label, results }]) => {
      const project_metrics = computeLevelMetrics(results, baselinePct);
      const project_insights: Insight[] = [
        ...deriveStrengths(project_metrics.skill_profiles),
        ...deriveVulnerabilities(project_metrics.skill_gaps, [project_metrics.skill_gaps]),
      ];
      return { project_id, project_label: label, project_metrics, project_insights };
    })
    .sort((a, b) => b.project_metrics.participation.completed - a.project_metrics.participation.completed);

  // ── Company-overall insights (strengths + systemic vulnerabilities + recs) ──
  const projectGapLists = projects.map((p) => p.project_metrics.skill_gaps);
  const strengths = deriveStrengths(company_metrics.skill_profiles);
  const vulnerabilities = deriveVulnerabilities(company_metrics.skill_gaps, projectGapLists);
  const recommendations = await enrichRecommendations(company_metrics.skill_gaps, company_metrics.skill_profiles);

  return {
    company_id: wantKey,
    company_label: companyLabel,
    generated_at: opts.generatedAt ?? "",
    portals,
    company_metrics,
    projects,
    company_overall_insights: [...strengths, ...vulnerabilities, ...recommendations],
  };
}

/**
 * Turn the deterministic training-recommendation lines into course-backed ones
 * by asking the VIFM course recommender for matched programmes per gap domain.
 * Best-effort: a domain with no course match keeps the text-only recommendation.
 */
async function enrichRecommendations(
  gaps: ReturnType<typeof computeLevelMetrics>["skill_gaps"],
  profiles: ReturnType<typeof computeLevelMetrics>["skill_profiles"]
): Promise<Insight[]> {
  const recs = deriveTrainingRecommendations(gaps);
  if (recs.length === 0) return recs;
  const fnDomainKeys = await loadFunctionDomainKeys();
  const profileByDomain = new Map(profiles.map((p) => [p.domainKey, p]));

  return Promise.all(
    recs.map(async (rec) => {
      const domainKey = rec.domainKey;
      if (!domainKey) return rec;
      const vertical = courseVerticalFor(domainKey, fnDomainKeys);
      if (!vertical) return rec;
      const avg = profileByDomain.get(domainKey)?.averagePct ?? 0;
      const band = proficiencyTier(avg).tier; // basic/intermediate/advanced
      try {
        const courses = await recommendCoursesForTechnical({
          domainKey: vertical,
          overallBand: band,
          weakestAreaEn: profileByDomain.get(domainKey)?.domainLabel ?? null,
          limit: 3,
        });
        const codes = courses.map((c) => c.code).filter((c): c is string => !!c);
        return codes.length > 0 ? { ...rec, courseCodes: codes } : rec;
      } catch {
        return rec;
      }
    })
  );
}
