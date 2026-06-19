/**
 * Technical-assessment aggregation - metric computation (pure, no I/O).
 *
 * Operates on the normalised `RawTechResult[]` for ONE level (a company's full
 * set, or a single project's subset) and returns participation, per-domain skill
 * profiles, and skill gaps. Pure + deterministic so it is trivially unit-tested
 * and reused at both the company and project levels.
 */
import type {
  RawTechResult,
  ParticipationMetrics,
  DomainProfile,
  SkillGap,
  LevelMetrics,
} from "./types";
import { DEFAULT_BASELINE_PCT } from "./types";

/** Total invited vs started vs completed for a set of results (distinct people). */
export function computeParticipation(results: RawTechResult[]): ParticipationMetrics {
  const invitedSet = new Set<string>();
  const startedSet = new Set<string>();
  const completedSet = new Set<string>();
  for (const r of results) {
    invitedSet.add(r.candidateKey);
    if (r.completed || r.takenAt) startedSet.add(r.candidateKey);
    if (r.completed) completedSet.add(r.candidateKey);
  }
  const invited = invitedSet.size;
  const completed = completedSet.size;
  return {
    invited,
    started: startedSet.size,
    completed,
    completionRate: invited > 0 ? completed / invited : 0,
  };
}

/**
 * Average / highest / lowest score per domain across COMPLETED, scored results.
 * Deduplicates to one score per (candidate, domain) - the latest completed
 * attempt - so a retake never double-counts. Sorted by average ascending so the
 * weakest domains lead (they drive the gaps + recommendations).
 */
export function computeSkillProfiles(results: RawTechResult[]): DomainProfile[] {
  // domainKey -> (candidateKey -> { score, takenAt }) keeping the latest attempt.
  const byDomain = new Map<string, { label: string; perCandidate: Map<string, { score: number; at: string }> }>();
  for (const r of results) {
    if (!r.completed || r.scorePct == null) continue;
    const at = r.takenAt ?? "";
    const entry = byDomain.get(r.domainKey) ?? { label: r.domainLabel, perCandidate: new Map() };
    const existing = entry.perCandidate.get(r.candidateKey);
    if (!existing || at >= existing.at) {
      entry.perCandidate.set(r.candidateKey, { score: r.scorePct, at });
    }
    byDomain.set(r.domainKey, entry);
  }

  const profiles: DomainProfile[] = [];
  for (const [domainKey, entry] of byDomain) {
    const scores = Array.from(entry.perCandidate.values()).map((v) => v.score);
    if (scores.length === 0) continue;
    const sum = scores.reduce((a, b) => a + b, 0);
    profiles.push({
      domainKey,
      domainLabel: entry.label,
      n: scores.length,
      averagePct: round1(sum / scores.length),
      highestPct: round1(Math.max(...scores)),
      lowestPct: round1(Math.min(...scores)),
    });
  }
  return profiles.sort((a, b) => a.averagePct - b.averagePct);
}

/**
 * Domains whose average sits below the baseline threshold (Decision 3: a flat
 * default of 70, overridable per domain via `baselineByDomain`). Biggest gap first.
 */
export function computeSkillGaps(
  profiles: DomainProfile[],
  baselinePct: number = DEFAULT_BASELINE_PCT,
  baselineByDomain?: Record<string, number>
): SkillGap[] {
  const gaps: SkillGap[] = [];
  for (const p of profiles) {
    const baseline = baselineByDomain?.[p.domainKey] ?? baselinePct;
    if (p.averagePct < baseline) {
      gaps.push({
        domainKey: p.domainKey,
        domainLabel: p.domainLabel,
        averagePct: p.averagePct,
        baselinePct: baseline,
        gapPct: round1(baseline - p.averagePct),
        n: p.n,
      });
    }
  }
  return gaps.sort((a, b) => b.gapPct - a.gapPct);
}

/** All three metric blocks for one level. */
export function computeLevelMetrics(
  results: RawTechResult[],
  baselinePct: number = DEFAULT_BASELINE_PCT,
  baselineByDomain?: Record<string, number>
): LevelMetrics {
  const skill_profiles = computeSkillProfiles(results);
  return {
    participation: computeParticipation(results),
    skill_profiles,
    skill_gaps: computeSkillGaps(skill_profiles, baselinePct, baselineByDomain),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
