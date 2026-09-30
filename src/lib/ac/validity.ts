/**
 * Validity evidence for an assessment centre (BPS 3.10, 3.20, 4.6, 9.6-9.10).
 *
 * The standard asks a provider to be able to show that a centre works:
 * reliability (do assessors agree), validity (do ratings relate to later
 * performance), diversity (do outcomes fall evenly), participant impact and
 * utility. Reliability and diversity already have their own modules; this one
 * adds the criterion measure (outcome follow-ups), the correlation between
 * centre rating and later performance, the check for overlapping criteria
 * (4.6), and the evaluation calendar (9.8).
 *
 * Everything here is pure. Two rules run through it:
 *   - power is stated with every number. 9.10 says about 100 participants are
 *     needed for a validation study to have reasonable power, so a correlation
 *     from 12 people is shown with that caveat, never as a headline;
 *   - nothing is imputed. A follow-up with no rating contributes nothing.
 */

export const FOLLOWUP_WAVES = [
  { wave: "6m", months: 6, label: "6 months" },
  { wave: "12m", months: 12, label: "12 months" },
] as const;

export type FollowupWave = (typeof FOLLOWUP_WAVES)[number]["wave"] | "custom";

/** The standard's guide: about 100 participants for reasonable power (9.10.1). */
export const VALIDATION_ADEQUATE_N = 100;
/** Below this, a correlation is reported as an early indication only. */
export const VALIDATION_MIN_N = 30;
/** Below this, no correlation is reported at all: it would be noise. */
export const VALIDATION_COMPUTE_N = 10;
/** 4.6.1: consider merging criteria that correlate above this. */
export const OVERLAP_R = 0.7;
/** Criteria overlap needs this many co-rated participants to be worth reading. */
export const OVERLAP_MIN_N = 10;

const DAY_MS = 86_400_000;

function addMonths(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  // Clamp to the last day of the target month (31 Jan + 1 month = 28/29 Feb).
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return target.toISOString().slice(0, 10);
}

/** When each follow-up falls due, counted from the last day of the centre. */
export function followupDueDates(centreEndDate: string): { wave: FollowupWave; dueOn: string }[] {
  return FOLLOWUP_WAVES.map((w) => ({ wave: w.wave, dueOn: addMonths(centreEndDate, w.months) }));
}

/** Pearson correlation, or null when it cannot be computed (n < 3 or no variance). */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export type ValidityPower = "none" | "too_small" | "early" | "adequate";

export type CriterionValidity = {
  /** Participants with both a centre rating and a performance rating. */
  n: number;
  /** Rated participants who went into the role (the population the criterion exists for). */
  inRole: number;
  r: number | null;
  power: ValidityPower;
  /** One sentence a client can read, stating what the number does and does not show. */
  statement: string;
};

/**
 * Criterion-related validity: the centre's overall rating against later
 * performance in the role. `pairs` are participants with both numbers.
 */
export function criterionValidity(input: {
  pairs: { centreScore: number; performance: number }[];
  inRole: number;
}): CriterionValidity {
  const n = input.pairs.length;
  const r = n >= VALIDATION_COMPUTE_N
    ? pearson(input.pairs.map((p) => p.centreScore), input.pairs.map((p) => p.performance))
    : null;
  const round = (v: number) => Math.round(v * 100) / 100;
  if (n === 0) {
    return {
      n, inRole: input.inRole, r: null, power: "none",
      statement: "No performance follow-ups have been collected yet, so there is no evidence either way on how the centre's ratings relate to later performance.",
    };
  }
  if (n < VALIDATION_COMPUTE_N || r === null) {
    return {
      n, inRole: input.inRole, r: null, power: "too_small",
      statement: `${n} participant${n === 1 ? " has" : "s have"} both a centre rating and a performance rating. That is too few to compute a meaningful correlation; at least ${VALIDATION_COMPUTE_N} are needed before one is shown.`,
    };
  }
  if (n < VALIDATION_MIN_N) {
    return {
      n, inRole: input.inRole, r: round(r), power: "too_small",
      statement: `Across ${n} participants the correlation between centre rating and later performance is ${round(r)}. With fewer than ${VALIDATION_MIN_N} participants this is an early indication only and should not be quoted as evidence of validity.`,
    };
  }
  if (n < VALIDATION_ADEQUATE_N) {
    return {
      n, inRole: input.inRole, r: round(r), power: "early",
      statement: `Across ${n} participants the correlation between centre rating and later performance is ${round(r)}. The standard's guide is about ${VALIDATION_ADEQUATE_N} participants for a validation study with reasonable power, so treat this as provisional.`,
    };
  }
  return {
    n, inRole: input.inRole, r: round(r), power: "adequate",
    statement: `Across ${n} participants the correlation between centre rating and later performance is ${round(r)}, a sample large enough for the study to carry reasonable power.`,
  };
}

export type CriteriaOverlap = {
  a: string;
  b: string;
  n: number;
  r: number;
  /** Above the 4.6.1 threshold: consider merging. */
  merge: boolean;
};

/**
 * Overlap between assessment criteria (4.6): the correlation between each pair
 * of competencies across the participants rated on both. Pairs with fewer than
 * OVERLAP_MIN_N shared participants are left out rather than shown as noise.
 */
export function criteriaOverlap(
  ratings: { candidateId: string; competencyId: string; score: number }[],
  names: Record<string, string> = {}
): CriteriaOverlap[] {
  const byCompetency = new Map<string, Map<string, number>>();
  for (const r of ratings) {
    const m = byCompetency.get(r.competencyId) ?? new Map<string, number>();
    m.set(r.candidateId, r.score);
    byCompetency.set(r.competencyId, m);
  }
  const ids = Array.from(byCompetency.keys()).sort();
  const out: CriteriaOverlap[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const ma = byCompetency.get(ids[i])!;
      const mb = byCompetency.get(ids[j])!;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [cand, sa] of Array.from(ma.entries())) {
        const sb = mb.get(cand);
        if (sb !== undefined) { xs.push(sa); ys.push(sb); }
      }
      if (xs.length < OVERLAP_MIN_N) continue;
      const r = pearson(xs, ys);
      if (r === null) continue;
      const rr = Math.round(r * 100) / 100;
      out.push({ a: names[ids[i]] ?? ids[i], b: names[ids[j]] ?? ids[j], n: xs.length, r: rr, merge: rr > OVERLAP_R });
    }
  }
  return out.sort((p, q) => q.r - p.r);
}

export type FollowupSummary = {
  total: number;
  due: number;
  overdue: number;
  collected: number;
  notAvailable: number;
  inRole: number;
};

export function summariseFollowups(
  rows: { status: string; due_on: string; in_role?: boolean | null }[],
  today: string
): FollowupSummary {
  const t = today.slice(0, 10);
  const s: FollowupSummary = { total: rows.length, due: 0, overdue: 0, collected: 0, notAvailable: 0, inRole: 0 };
  for (const r of rows) {
    if (r.status === "collected") s.collected++;
    else if (r.status === "not_available") s.notAvailable++;
    else if (r.due_on.slice(0, 10) < t) s.overdue++;
    else s.due++;
    if (r.in_role === true) s.inRole++;
  }
  return s;
}

export type EvaluationCalendar = {
  /** When the next annual evaluation falls due (9.8), or null with no start point. */
  annualDueOn: string | null;
  annualOverdue: boolean;
  /** When the next major review falls due: three years after the last one, or after the first centre. */
  majorDueOn: string | null;
  majorOverdue: boolean;
};

/**
 * The evaluation calendar (9.8): annually from the last evaluation, or from
 * the first centre if none; a major review three years on.
 */
export function evaluationCalendar(input: {
  firstCentreOn: string | null;
  lastEvaluationOn: string | null;
  lastMajorOn: string | null;
  today: string;
}): EvaluationCalendar {
  const base = input.lastEvaluationOn ?? input.firstCentreOn;
  const majorBase = input.lastMajorOn ?? input.firstCentreOn;
  const annualDueOn = base ? addMonths(base, 12) : null;
  const majorDueOn = majorBase ? addMonths(majorBase, 36) : null;
  const t = input.today.slice(0, 10);
  return {
    annualDueOn,
    annualOverdue: annualDueOn !== null && annualDueOn < t,
    majorDueOn,
    majorOverdue: majorDueOn !== null && majorDueOn < t,
  };
}

/** Days until a date (negative when past). */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
}
