// ─────────────────────────────────────────────────────────────
// AC observed-evidence → VIFM DARE + EQ lens (B3).
//
// Re-reads a candidate's wash-up consensus ratings (the OBSERVED evidence -
// the strongest tier in the layered measurement model) through the VIFM DARE
// decision roles and Goleman EQ quadrants. consensus_ratings.competency_id is
// already an AC catalogue id, so no name resolution is needed. The instrument
// coverage is the engagement's exercise-competency design (an AC observes a
// handful of the 41, so the "n of N" coverage badge is the honesty rail);
// group means are computed only from competencies that actually received a
// consensus score.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import { computeDareLens, computeEqLens, type LensGroupRead } from "@/lib/reports/lens-shared";

export type AcObservedLens = {
  dare: LensGroupRead[]; // only groups with inInstrument > 0
  eq: LensGroupRead[];
  /** Competencies with a consensus score for this candidate. */
  ratedCount: number;
  /** Distinct competencies in the engagement's exercise design. */
  designCount: number;
};

export async function computeAcObservedLens(
  engagementId: string,
  candidateId: string
): Promise<AcObservedLens | null> {
  const sb = await createClient();
  const [matrixRes, consRes] = await Promise.all([
    sb
      .from("exercise_competency_matrix")
      .select("competency_id")
      .eq("engagement_id", engagementId),
    sb
      .from("consensus_ratings")
      .select("competency_id, final_score")
      .eq("engagement_id", engagementId)
      .eq("candidate_id", candidateId),
  ]);

  const observed = new Map<string, number>();
  for (const r of consRes.data ?? []) {
    const score = r.final_score as number | null;
    if (score != null) observed.set(r.competency_id as string, Number(score));
  }
  if (observed.size === 0) return null; // nothing scored yet - panel stays hidden

  const design = Array.from(
    new Set((matrixRes.data ?? []).map((r) => r.competency_id as string))
  );
  // Instrument = the engagement design; fall back to the rated set for legacy
  // engagements whose matrix rows are missing.
  const instrumentIds = design.length > 0 ? design : Array.from(observed.keys());

  return {
    dare: computeDareLens({ instrumentIds, others: observed }).filter((g) => g.inInstrument > 0),
    eq: computeEqLens({ instrumentIds, others: observed }).filter((g) => g.inInstrument > 0),
    ratedCount: observed.size,
    designCount: instrumentIds.length,
  };
}
