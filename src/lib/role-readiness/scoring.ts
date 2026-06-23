/**
 * Role Readiness scoring (pure - no DB).
 *
 * Bundles the Persona behavioural side (self-score vs per-competency target) and
 * the Techno-style technical side (%correct per area vs per-area target) into one
 * verdict: READY iff BOTH sides clear their own pass threshold; otherwise
 * NOT_READY; INCOMPLETE until both sides have something scorable. Mirrors the
 * per-section pass-vs-threshold shape of src/lib/prehire/scoring.ts.
 *
 * Edge cases (deliberate):
 *  - A competency/area with no scorable input is `assessed:false`, excluded from
 *    its side's denominator (never divides by zero) and never counted as a pass.
 *  - A side with zero scorable units → `score_pct:null` → `passed:null` → the
 *    overall verdict is INCOMPLETE, never a false pass.
 *  - Threshold comparison is INCLUSIVE (`>=`): a score exactly on the threshold
 *    passes.
 *  - Unanswered technical items: the caller passes `total` = items SERVED, so an
 *    unanswered item is wrong (lowers %correct). Unanswered persona items: the
 *    caller leaves `self_score:null` for that competency → not assessed (the
 *    candidate flow only completes the persona section when every item is answered).
 */

export type PersonaCompetencyInput = {
  competency_id: string;
  name: string;
  target_level: number; // 1-5 (BARS); <=0 treated as not-scorable
  self_score: number | null; // 1-5 mean self rating; null = not answered
};

export type TechnicalAreaInput = {
  area_id: string;
  name: string;
  target_pct: number; // 0-100
  correct: number; // items answered correctly
  total: number; // items SERVED in the area (0 => not assessed)
};

export type CompetencyResult = {
  competency_id: string;
  name: string;
  target_level: number;
  self_score: number | null;
  attainment_pct: number | null; // min(self/target,1)*100; null if unscored
  below_target: boolean;
  assessed: boolean;
};

export type AreaResult = {
  area_id: string;
  name: string;
  target_pct: number;
  score_pct: number | null; // correct/total*100; null if no items
  below_target: boolean;
  assessed: boolean;
};

export type SideResult = {
  score_pct: number | null; // null when nothing was scorable
  passed: boolean | null; // null when incomplete
  threshold: number;
};

export type Verdict = "ready" | "not_ready" | "incomplete";

export type ReadinessResult = {
  persona: SideResult & { competencies: CompetencyResult[] };
  technical: SideResult & { areas: AreaResult[] };
  verdict: Verdict;
  belowTargetCompetencies: CompetencyResult[];
  belowTargetAreas: AreaResult[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scorePersonaSide(comps: PersonaCompetencyInput[], thresholdPct: number) {
  const results: CompetencyResult[] = comps.map((c) => {
    const assessed = c.self_score != null && c.target_level > 0;
    const attainment = assessed
      ? Math.min((c.self_score as number) / c.target_level, 1) * 100
      : null;
    const below_target = assessed ? (c.self_score as number) < c.target_level : false;
    return {
      competency_id: c.competency_id,
      name: c.name,
      target_level: c.target_level,
      self_score: c.self_score,
      attainment_pct: attainment == null ? null : round1(attainment),
      below_target,
      assessed,
    };
  });
  const scored = results.filter((r) => r.assessed && r.attainment_pct != null);
  const score_pct = scored.length
    ? round1(scored.reduce((s, r) => s + (r.attainment_pct as number), 0) / scored.length)
    : null;
  const passed = score_pct == null ? null : score_pct >= thresholdPct;
  return { side: { score_pct, passed, threshold: thresholdPct } as SideResult, results };
}

export function scoreTechnicalSide(areas: TechnicalAreaInput[], thresholdPct: number) {
  const results: AreaResult[] = areas.map((a) => {
    const assessed = a.total > 0;
    const score_pct = assessed ? round1((a.correct / a.total) * 100) : null;
    const below_target = assessed ? (score_pct as number) < a.target_pct : false;
    return {
      area_id: a.area_id,
      name: a.name,
      target_pct: a.target_pct,
      score_pct,
      below_target,
      assessed,
    };
  });
  // Side score = overall %correct across assessed areas (item-weighted).
  const assessed = areas.filter((a) => a.total > 0);
  const totalItems = assessed.reduce((s, a) => s + a.total, 0);
  const totalCorrect = assessed.reduce((s, a) => s + a.correct, 0);
  const score_pct = totalItems > 0 ? round1((totalCorrect / totalItems) * 100) : null;
  const passed = score_pct == null ? null : score_pct >= thresholdPct;
  return { side: { score_pct, passed, threshold: thresholdPct } as SideResult, results };
}

export function computeReadiness(input: {
  competencies: PersonaCompetencyInput[];
  personaThresholdPct: number;
  areas: TechnicalAreaInput[];
  technicalThresholdPct: number;
}): ReadinessResult {
  const persona = scorePersonaSide(input.competencies, input.personaThresholdPct);
  const technical = scoreTechnicalSide(input.areas, input.technicalThresholdPct);

  let verdict: Verdict;
  if (persona.side.passed == null || technical.side.passed == null) {
    verdict = "incomplete";
  } else if (persona.side.passed && technical.side.passed) {
    verdict = "ready";
  } else {
    verdict = "not_ready";
  }

  return {
    persona: { ...persona.side, competencies: persona.results },
    technical: { ...technical.side, areas: technical.results },
    verdict,
    belowTargetCompetencies: persona.results.filter((r) => r.assessed && r.below_target),
    belowTargetAreas: technical.results.filter((r) => r.assessed && r.below_target),
  };
}

export function verdictLabel(v: Verdict, lang: "en" | "ar" = "en"): string {
  if (lang === "ar") return v === "ready" ? "جاهز" : v === "not_ready" ? "غير جاهز" : "غير مكتمل";
  return v === "ready" ? "Ready" : v === "not_ready" ? "Not ready" : "Incomplete";
}
