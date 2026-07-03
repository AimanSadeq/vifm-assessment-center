// ─────────────────────────────────────────────────────────────
// Reflect 360 → VIFM DARE + EQ lens (B1/B2).
//
// Re-reads a participant's per-competency SELF and OTHERS means through the
// VIFM DARE decision roles and Goleman EQ quadrants. Reflect competencies are
// engagement-specific rows matched to the AC catalogue BY NAME (current names
// resolve directly; the 00034 template's legacy names via aliases); custom
// client competencies that don't match are listed as unmapped, never guessed.
// Pure computation over an already-computed ParticipantScoring - anonymity
// filtering has already been applied upstream (others_mean is null when the
// rater group fell below the engagement's anonymity threshold).
// ─────────────────────────────────────────────────────────────

import type { ParticipantScoring } from "@/lib/reflect/scoring";
import {
  computeDareLens,
  computeEqLens,
  resolveAcCompetencyIdByName,
  type LensGroupRead,
} from "@/lib/reports/lens-shared";

export type ReflectLens = {
  dare: LensGroupRead[]; // only groups with inInstrument > 0
  eq: LensGroupRead[];
  mappedCount: number;
  totalCount: number;
  unmapped: string[]; // competency names that don't match the VIFM catalogue
  hasAny: boolean;
};

export function computeReflectLens(scoring: ParticipantScoring): ReflectLens {
  const self = new Map<string, number>();
  const others = new Map<string, number>();
  const instrumentIds: string[] = [];
  const unmapped: string[] = [];

  for (const c of scoring.competencies) {
    const acId = resolveAcCompetencyIdByName(c.name_en);
    if (!acId) {
      unmapped.push(c.name_en);
      continue;
    }
    instrumentIds.push(acId);
    if (c.self_mean != null) self.set(acId, c.self_mean);
    if (c.others_mean != null) others.set(acId, c.others_mean);
  }

  const dare = computeDareLens({ instrumentIds, self, others }).filter((g) => g.inInstrument > 0);
  const eq = computeEqLens({ instrumentIds, self, others }).filter((g) => g.inInstrument > 0);

  return {
    dare,
    eq,
    mappedCount: instrumentIds.length,
    totalCount: scoring.competencies.length,
    unmapped,
    hasAny: dare.length > 0 || eq.length > 0,
  };
}
