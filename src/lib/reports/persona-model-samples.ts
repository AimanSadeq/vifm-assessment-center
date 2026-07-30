// Deterministic demo data for the three Persona-derived model reports
// (Leadership / DARE / EQ) - powers the "View sample report" buttons on the
// Scientific Models hub so staff can show each report without a completed
// sitting. Reuses the REAL scoring path (compute*Profile); only the raw
// per-competency self-scores are fabricated. Fictional throughout.

import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { computeLeadershipProfile } from "@/lib/reports/persona-leadership-dimensions";
import { computeDareProfile, DARE_ROLES, type DareRole } from "@/lib/reports/persona-dare-dimensions";
import { computeEqProfile, type EqQuadrant } from "@/lib/reports/persona-eq-dimensions";
import type { LeadershipPdfData } from "@/lib/reports/persona-leadership-data";
import type { DarePdfData } from "@/lib/reports/persona-dare-data";
import type { EqPdfData } from "@/lib/reports/persona-eq-data";

const SAMPLE_NAME = "Sample Candidate";

// A couple of generic development suggestions so the sample's focus cards are
// not empty (the live reports pull competency-specific tips from the DB).
const GENERIC_TIPS = [
  "Agree one specific, observable goal for this competency with your manager this quarter and review progress monthly.",
  "Seek a stretch task that forces this competency into daily practice, and ask a trusted peer for candid feedback.",
];

/** Synthetic per-competency self-scores across all 41 - varied (2.8-4.7) so the
 *  profiles have real spread. Deterministic (index-driven; no randomness). */
function sampleScoreById(): { scoreById: Map<string, number>; nameById: Map<string, string> } {
  const scoreById = new Map<string, number>();
  const nameById = new Map<string, string>();
  BEHAVIORAL_COMPETENCIES.forEach((c, i) => {
    const score = Math.round((2.8 + ((i * 7) % 20) / 10) * 100) / 100; // 2.80 .. 4.70
    scoreById.set(c.acCompetencyId, score);
    nameById.set(c.acCompetencyId, c.nameEn);
  });
  return { scoreById, nameById };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const withTips = <T extends { id: string }>(rows: T[]) =>
  rows.map((r) => ({ ...r, tips: [...GENERIC_TIPS] }));

export function sampleLeadershipData(generatedAt: string): LeadershipPdfData {
  const { scoreById, nameById } = sampleScoreById();
  const profile = computeLeadershipProfile(scoreById, nameById, new Map());
  const all = [...scoreById.values()];
  return {
    takerName: SAMPLE_NAME,
    generatedAt,
    overall: round2(all.reduce((a, b) => a + b, 0) / all.length),
    overallCount: all.length,
    profile,
    developmentPlan: profile.topDevelopment.map((r) => ({
      name: r.name,
      dimension: r.dimension,
      score: r.score,
      tips: [...GENERIC_TIPS],
    })),
  };
}

export function sampleDareData(generatedAt: string): DarePdfData {
  const { scoreById, nameById } = sampleScoreById();
  const profile = computeDareProfile(scoreById, nameById, new Map());
  const all = [...scoreById.values()];
  const measuredRoles = DARE_ROLES.filter((r) => profile.counts[r] > 0);
  const weakestRole = (measuredRoles.length ? measuredRoles : [...DARE_ROLES]).sort(
    (a, b) => profile.scores[a] - profile.scores[b],
  )[0] as DareRole;
  const lowest = (role: DareRole) => [...profile.rowsByRole[role]].sort((a, b) => a.score - b.score).slice(0, 3);
  const primaryRows = lowest(profile.primary);
  const weakestRows = weakestRole === profile.primary ? [] : lowest(weakestRole);
  return {
    takerName: SAMPLE_NAME,
    generatedAt,
    overall: round2(all.reduce((a, b) => a + b, 0) / all.length),
    profile,
    primaryFocus: withTips(primaryRows),
    weakestRole,
    weakestFocus: withTips(weakestRows),
  };
}

export function sampleEqData(generatedAt: string): EqPdfData {
  const { scoreById, nameById } = sampleScoreById();
  const profile = computeEqProfile(scoreById, nameById, new Map());
  const inScopeAnswered = Object.values(profile.counts).reduce((a, b) => a + b, 0);
  const lowest = (q: EqQuadrant, n: number) =>
    [...profile.rowsByQuadrant[q]].sort((a, b) => a.score - b.score).slice(0, n);
  const priorityRows = lowest(profile.priority, 3);
  const runnerUpRows = profile.runnerUp === profile.priority ? [] : lowest(profile.runnerUp, 2);
  return {
    takerName: SAMPLE_NAME,
    generatedAt,
    profile,
    inScopeAnswered,
    priorityFocus: withTips(priorityRows),
    runnerUpFocus: withTips(runnerUpRows),
  };
}
