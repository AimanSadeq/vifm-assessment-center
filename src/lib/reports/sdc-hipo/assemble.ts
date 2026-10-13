// SDC High-Potential reports: database rows -> report data. Pure (no server
// imports) so the fixture renders and unit tests take the same path as the
// routes. data.ts does the reads.

import { compRows, fit, reasoning, requiredLevel, type SdcCompetency, type CohortPerson } from "./rules";
import type { SdcCandidateReport, SdcCohortReport } from "./html";

export type CandidateRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  completed_at: string | null;
  status: string;
  bespoke_service_id: string;
  organization_id: string | null;
  cognitive_result_id: string | null;
};
export type RosterLite = {
  bundle_candidate_id: string | null;
  grade: number | null;
  position: string | null;
  business_unit: string | null;
  is_tester: boolean;
};
export type SjtResultLite = { bundle_candidate_id: string; scores: unknown; submitted_at: string | null };
export type PsyLite = { id: string; scales: unknown };

export const DONE_STATUSES = ["completed", "scored"];

/** completed_at as "22 October 2026" in Saudi time. */
export function formatAssessed(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" });
}

type ScoreEntry = { level?: unknown; items?: unknown };
const scoreMap = (scores: unknown): Record<string, ScoreEntry> =>
  scores && typeof scores === "object" && !Array.isArray(scores) ? (scores as Record<string, ScoreEntry>) : {};

/** bundle_sjt_results.scores -> { code: level 0..3 }. */
export function levelsFromScores(scores: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [code, s] of Object.entries(scoreMap(scores))) {
    const n = Number(s?.level);
    out[code] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

/** Scenario questions in total and per competency (null per competency when it varies). */
export function scenarioCounts(scores: unknown, codes: string[]): { total: number; perCompetency: number | null } | null {
  const m = scoreMap(scores);
  const counts = codes.map((c) => Number(m[c]?.items)).filter((n) => Number.isFinite(n) && n > 0);
  if (counts.length !== codes.length) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  return { total, perCompetency: counts.every((n) => n === counts[0]) ? counts[0] : null };
}

const gradeOf = (r: RosterLite | null | undefined): number | null => {
  const g = Number(r?.grade);
  return r?.grade != null && Number.isFinite(g) ? g : null;
};

export type AssembleResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export function assembleCandidate(input: {
  cand: CandidateRow;
  roster: RosterLite | null;
  sjt: SjtResultLite | null;
  psy: PsyLite | null;
  comps: SdcCompetency[];
  orgName: string | null;
}): AssembleResult<SdcCandidateReport> {
  const { cand, roster, sjt, psy, comps } = input;
  if (!DONE_STATUSES.includes(cand.status)) {
    return { ok: false, status: 400, error: "This person has not completed the assessment yet." };
  }
  const grade = gradeOf(roster);
  if (grade == null) return { ok: false, status: 400, error: "No grade on the roster for this person." };
  if (!comps.some((c) => requiredLevel(c, grade) > 0)) {
    return { ok: false, status: 400, error: `The framework has no required levels for Grade ${grade}.` };
  }
  if (!sjt?.submitted_at) return { ok: false, status: 400, error: "The scenario section has not been submitted for this person." };
  const reas = reasoning(psy?.scales);
  if (!reas) return { ok: false, status: 400, error: "No Logica reasoning result for this person." };

  return {
    ok: true,
    data: {
      orgName: input.orgName,
      name: cand.full_name || "Candidate",
      grade,
      position: roster?.position ?? null,
      unit: roster?.business_unit ?? null,
      assessedOn: formatAssessed(cand.completed_at),
      comps,
      rows: compRows(comps, grade, levelsFromScores(sjt.scores)),
      reasoning: reas,
      scenarios: scenarioCounts(sjt.scores, comps.map((c) => c.code)),
    },
  };
}

/**
 * The cohort: completed (or scored) people of the bundle who are on the roster
 * and not testers. Y in "Completed X / Y" is everyone on the roster who is not
 * a tester. A completed person with a missing result is counted as incomplete.
 */
export function assembleCohort(input: {
  cands: CandidateRow[];
  roster: RosterLite[];
  sjt: SjtResultLite[];
  psy: PsyLite[];
  comps: SdcCompetency[];
  orgName: string | null;
}): SdcCohortReport {
  const rosterByCand = new Map(input.roster.filter((r) => r.bundle_candidate_id).map((r) => [r.bundle_candidate_id as string, r]));
  const sjtByCand = new Map(input.sjt.map((s) => [s.bundle_candidate_id, s]));
  const psyById = new Map(input.psy.map((p) => [p.id, p]));
  const people: CohortPerson[] = [];
  let incomplete = 0;
  for (const c of input.cands) {
    if (!DONE_STATUSES.includes(c.status)) continue;
    const r = rosterByCand.get(c.id);
    if (!r || r.is_tester) continue;
    const grade = gradeOf(r);
    const s = sjtByCand.get(c.id);
    const reas = reasoning(c.cognitive_result_id ? psyById.get(c.cognitive_result_id)?.scales : null);
    if (grade == null || !s?.submitted_at || !reas || !input.comps.some((x) => requiredLevel(x, grade) > 0)) {
      incomplete += 1;
      continue;
    }
    const rows = compRows(input.comps, grade, levelsFromScores(s.scores));
    people.push({ id: c.id, name: c.full_name || "Candidate", grade, unit: r.business_unit, fit: fit(rows), reasoning: reas, rows });
  }
  return {
    orgName: input.orgName,
    comps: input.comps,
    people,
    rosterCount: input.roster.filter((r) => !r.is_tester).length,
    incomplete,
  };
}
