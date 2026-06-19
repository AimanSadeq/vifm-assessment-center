/**
 * Technical-assessment aggregation - automated insight engine (pure).
 *
 * Turns computed metrics into qualitative insight lines for the client report:
 *   - Key strengths: top domains the cohort/company excels in.
 *   - Critical vulnerabilities: systemic skill gaps (below baseline across
 *     multiple projects, not just one cohort).
 *   - Actionable training recommendations: each gap domain -> a targeted-training
 *     line (the orchestrator later attaches matched VIFM course codes).
 *
 * Deterministic + thresholded (no AI) so the output is reproducible and
 * defensible. The course wiring lives in aggregate.ts (it needs DB I/O).
 */
import type { DomainProfile, SkillGap, Insight } from "./types";

/** Average at/above this is a "strength". Mirrors the Advanced band floor. */
export const STRENGTH_PCT = 85;

/** Derive up to `limit` strength insights from the level's domain profiles. */
export function deriveStrengths(profiles: DomainProfile[], limit = 3): Insight[] {
  return profiles
    .filter((p) => p.averagePct >= STRENGTH_PCT && p.n > 0)
    .sort((a, b) => b.averagePct - a.averagePct)
    .slice(0, limit)
    .map((p) => ({
      kind: "strength" as const,
      title: p.domainLabel,
      detail: `Strong cohort performance - average ${p.averagePct}% across ${p.n} assessed (high ${p.highestPct}%, low ${p.lowestPct}%). Leverage these people as mentors and protect the capability.`,
      domainKey: p.domainKey,
    }));
}

/**
 * Critical vulnerabilities: company-level skill gaps, flagged "systemic" when
 * the domain is below baseline in at least half the projects (when there is more
 * than one project). Biggest gap first.
 */
export function deriveVulnerabilities(
  companyGaps: SkillGap[],
  projectGaps: SkillGap[][],
  limit = 5
): Insight[] {
  const totalProjects = projectGaps.length;
  // Count, per domain, how many projects show it as a gap.
  const gapProjectCount = new Map<string, number>();
  for (const gaps of projectGaps) {
    for (const g of gaps) gapProjectCount.set(g.domainKey, (gapProjectCount.get(g.domainKey) ?? 0) + 1);
  }
  return companyGaps.slice(0, limit).map((g) => {
    const inProjects = gapProjectCount.get(g.domainKey) ?? 0;
    const systemic = totalProjects > 1 && inProjects >= Math.ceil(totalProjects / 2);
    const scope =
      totalProjects > 1
        ? ` Seen in ${inProjects} of ${totalProjects} projects${systemic ? " - a systemic gap" : ""}.`
        : "";
    return {
      kind: "vulnerability" as const,
      title: `${systemic ? "Systemic gap: " : ""}${g.domainLabel}`,
      detail: `Average ${g.averagePct}% is ${g.gapPct} points below the ${g.baselinePct}% baseline (${g.n} assessed).${scope}`,
      domainKey: g.domainKey,
    };
  });
}

/**
 * Actionable training recommendations - one per gap domain (biggest first).
 * Course codes are attached by the orchestrator from the recommender; this
 * produces the deterministic gap-driven text (e.g. "AP at 62% -> targeted
 * Accounts Payable training").
 */
export function deriveTrainingRecommendations(gaps: SkillGap[], limit = 5): Insight[] {
  return gaps.slice(0, limit).map((g) => ({
    kind: "recommendation" as const,
    title: `Targeted ${g.domainLabel} training`,
    detail: `${g.domainLabel} averages ${g.averagePct}% (below the ${g.baselinePct}% baseline). Prioritise a focused ${g.domainLabel} programme to close the ${g.gapPct}-point gap.`,
    domainKey: g.domainKey,
    courseCodes: [],
  }));
}
