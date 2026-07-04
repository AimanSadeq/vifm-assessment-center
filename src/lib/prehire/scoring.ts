// Pre-Hire composite scoring + ranking.
//
// Pure functions (no DB) so they're unit-testable and reusable on server and
// client. The output is a SCREENING SIGNAL only: it produces a composite score,
// per-stage pass/fail against the requisition's cut-scores, and an advisory
// recommendation band. It deliberately never returns "reject" / auto-decline -
// a human always makes the hiring decision (see VIFM Pre-Hire blueprint).

import type {
  PrehireStagePlanEntry,
  PrehireStageKind,
  PrehireStageResult,
} from "@/types/prehire";

/** Advisory band. "hold" means "low signal - human review", never auto-reject. */
export type PrehireRecommendation = "advance" | "review" | "hold" | "incomplete";

export type StageScore = {
  kind: PrehireStageKind;
  weight: number; // normalized weight actually applied (0–1)
  normalized: number | null; // 0–100
  cutScore: number | null;
  required: boolean;
  passed: boolean | null; // null when not yet scored
};

export type CompositeResult = {
  composite: number | null; // 0–100, null until all required stages are scored
  perStage: StageScore[];
  requiredFailures: PrehireStageKind[]; // required stages below their cut-score
  scoredCount: number;
  totalCount: number;
  recommendation: PrehireRecommendation;
};

export type CompositeThresholds = {
  /** composite ≥ advanceAt and no required failures → "advance" */
  advanceAt: number;
  /** composite ≥ reviewAt → "review"; below → "hold" */
  reviewAt: number;
};

export const DEFAULT_THRESHOLDS: CompositeThresholds = { advanceAt: 70, reviewAt: 50 };

const clamp01to100 = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Compute the composite score + advisory recommendation for one candidate.
 *
 * @param plan    the requisition's ordered stage plan (weights + cut-scores)
 * @param results the candidate's stage results (normalized_score per kind)
 */
export function computeComposite(
  plan: PrehireStagePlanEntry[],
  results: Pick<PrehireStageResult, "kind" | "normalized_score">[],
  thresholds: CompositeThresholds = DEFAULT_THRESHOLDS
): CompositeResult {
  const byKind = new Map(results.map((r) => [r.kind, r.normalized_score]));

  // Only stages with a positive weight contribute to the composite.
  const weighted = plan.filter((s) => s.weight > 0);
  const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0) || 1;

  const perStage: StageScore[] = plan.map((s) => {
    const normalized = byKind.has(s.kind) ? byKind.get(s.kind)! : null;
    const passed =
      normalized == null ? null : s.cut_score == null ? true : normalized >= s.cut_score;
    return {
      kind: s.kind,
      weight: s.weight / totalWeight,
      normalized: normalized == null ? null : clamp01to100(normalized),
      cutScore: s.cut_score,
      required: s.required,
      passed,
    };
  });

  const scoredCount = perStage.filter((s) => s.normalized != null).length;
  const totalCount = plan.length;

  const requiredFailures = perStage
    .filter((s) => s.required && s.passed === false)
    .map((s) => s.kind);

  // A REQUIRED stage that has not been scored blocks completion regardless of its
  // weight. A required weight-0 hurdle (e.g. a pass/fail CBI that shouldn't move
  // the number) must still be sat - without this, a candidate could complete only
  // the weighted stages, skip the required one, and still read "advance".
  const requiredUnscored = perStage.some((s) => s.required && s.normalized == null);

  // Composite is only meaningful once every weighted stage AND every required
  // stage has a score.
  const allWeightedScored = perStage
    .filter((s) => weighted.some((w) => w.kind === s.kind))
    .every((s) => s.normalized != null);
  const complete = allWeightedScored && !requiredUnscored;

  let composite: number | null = null;
  if (complete && weighted.length > 0) {
    composite = clamp01to100(
      perStage
        .filter((s) => weighted.some((w) => w.kind === s.kind))
        .reduce((sum, s) => sum + (s.normalized ?? 0) * s.weight, 0)
    );
    composite = Math.round(composite * 10) / 10;
  }

  const recommendation = recommendationFor(
    composite,
    requiredFailures.length > 0,
    complete,
    thresholds
  );

  return { composite, perStage, requiredFailures, scoredCount, totalCount, recommendation };
}

function recommendationFor(
  composite: number | null,
  hasRequiredFailure: boolean,
  complete: boolean,
  t: CompositeThresholds
): PrehireRecommendation {
  if (!complete || composite == null) return "incomplete";
  // A failed required stage caps the signal at "review" - never auto-reject.
  if (hasRequiredFailure) return composite >= t.reviewAt ? "review" : "hold";
  if (composite >= t.advanceAt) return "advance";
  if (composite >= t.reviewAt) return "review";
  return "hold";
}

/** Rank candidates for the shortlist: highest composite first, unscored last. */
export function rankByComposite<T extends { composite: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.composite == null && b.composite == null) return 0;
    if (a.composite == null) return 1;
    if (b.composite == null) return -1;
    return b.composite - a.composite;
  });
}

export const RECOMMENDATION_LABELS: Record<PrehireRecommendation, string> = {
  advance: "Advance",
  review: "Review",
  hold: "Hold for review",
  incomplete: "In progress",
};
