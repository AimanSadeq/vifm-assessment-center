import { createServiceClient } from "@/lib/supabase/server";
import type { EvidenceMetrics } from "./types";

export type { EvidenceMetrics } from "./types";

/**
 * Live evidence/validity metrics for the admin Evidence & Validity Map.
 *
 * Every count is defensive: a missing table or column (the schema spans
 * many migrations and a few thresholds were noted as "unclear" during
 * inventory) yields `null` rather than throwing, so the map renders even
 * when an instrument hasn't shipped its data layer yet. `null` is shown
 * as "no data" / "n/a" in the UI.
 *
 * Uses the service-role client: this is an admin-only server page and we
 * want true platform-wide totals, not RLS-scoped subsets.
 */

type SB = ReturnType<typeof createServiceClient>;

async function count(
  sb: SB,
  table: string,
  build?: (q: any) => any
): Promise<number | null> {
  try {
    let q: any = sb.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count: c, error } = await q;
    if (error) return null;
    return c ?? 0;
  } catch {
    return null;
  }
}

/** Sum of two nullable counts; null only if both are null. */
function add(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

/** Threshold constants used by the matrix + dashboard (from the methodology brief). */
export const THRESHOLDS = {
  arcIndividualN: 200, // CFA / Cronbach alpha (individual factors)
  arcOrgN: 50, // org-side reliability
  alphaN: 200, // psychometrics Cronbach alpha sample
  normsN: 200, // norm group minimum
} as const;

export async function gatherEvidenceMetrics(): Promise<EvidenceMetrics> {
  const sb = createServiceClient();

  const verifiedFilter = (q: any) => q.eq("validation_evidence->>review_status", "verified");
  const editedFilter = (q: any) => q.eq("validation_evidence->>review_status", "edited");
  const proposedFilter = (q: any) => q.eq("validation_evidence->>review_status", "ai_proposed");

  const [
    acTotal, acVerified, acEdited, acProposed, acIndicators, acExercises, acRatings,
    arcTotal, arcVerified, arcEdited, arcProposed, arcResponses, arcAssessments, arcRespDone,
    flItems, flLive, flCal, flHuman, flResults, flAnchVer, flAnchEd, flAnchProp,
    tcItems, tcApproved, tcCal, tcCut, tcResults, tcAnchVer, tcAnchEd, tcAnchProp,
    rfComp, rfBeh, rfBehAi, rfResp, rfAnchVer, rfAnchEd, rfAnchProp,
    psyItems, psyApproved, psyNorms, psyItemResp, psyResults, psyScales, psyAnchVer, psyAnchEd, psyAnchProp,
  ] = await Promise.all([
    // AC
    count(sb, "competencies"),
    count(sb, "competencies", verifiedFilter),
    count(sb, "competencies", editedFilter),
    count(sb, "competencies", proposedFilter),
    count(sb, "behavioral_indicators"),
    count(sb, "exercises"),
    count(sb, "ratings"),
    // ARC
    count(sb, "ara_questions"),
    count(sb, "ara_questions", verifiedFilter),
    count(sb, "ara_questions", editedFilter),
    count(sb, "ara_questions", proposedFilter),
    count(sb, "ara_responses"),
    count(sb, "ara_assessments"),
    count(sb, "ara_respondents", (q: any) => q.not("completed_at", "is", null)),
    // Fluent
    count(sb, "eng_fluent_items"),
    count(sb, "eng_fluent_items", (q: any) => q.eq("status", "live")),
    count(sb, "eng_fluent_items", (q: any) => q.not("irt_b", "is", null)),
    count(sb, "eng_fluent_human_ratings"),
    count(sb, "eng_fluent_results"),
    count(sb, "eng_fluent_items", verifiedFilter),
    count(sb, "eng_fluent_items", editedFilter),
    count(sb, "eng_fluent_items", proposedFilter),
    // Technical
    count(sb, "tech_assessment_items"),
    count(sb, "tech_assessment_items", (q: any) => q.eq("status", "approved")),
    count(sb, "tech_assessment_items", (q: any) => q.not("calibrated_at", "is", null)),
    count(sb, "tech_assessment_cut_scores"),
    count(sb, "tech_assessment_results"),
    count(sb, "tech_assessment_items", verifiedFilter),
    count(sb, "tech_assessment_items", editedFilter),
    count(sb, "tech_assessment_items", proposedFilter),
    // Reflect
    count(sb, "reflect_competencies"),
    count(sb, "reflect_behaviors"),
    count(sb, "reflect_behaviors", (q: any) => q.eq("source", "ai_generated")),
    count(sb, "reflect_responses"),
    count(sb, "reflect_competencies", verifiedFilter),
    count(sb, "reflect_competencies", editedFilter),
    count(sb, "reflect_competencies", proposedFilter),
    // Psychometrics
    count(sb, "psy_items"),
    count(sb, "psy_items", (q: any) => q.eq("status", "approved")),
    count(sb, "psy_norms"),
    count(sb, "psy_item_responses"),
    count(sb, "psy_results"),
    count(sb, "psy_scales"),
    count(sb, "psy_scales", verifiedFilter),
    count(sb, "psy_scales", editedFilter),
    count(sb, "psy_scales", proposedFilter),
  ]);

  return {
    ac: {
      competenciesTotal: acTotal,
      competenciesVerified: add(acVerified, acEdited),
      competenciesProposed: acProposed,
      indicators: acIndicators,
      exercises: acExercises,
      ratings: acRatings,
    },
    arc: {
      questionsTotal: arcTotal,
      questionsVerified: add(arcVerified, arcEdited),
      questionsProposed: arcProposed,
      responses: arcResponses,
      assessments: arcAssessments,
      respondentsCompleted: arcRespDone,
    },
    fluent: { items: flItems, live: flLive, calibrated: flCal, humanRatings: flHuman, results: flResults, anchorsVerified: add(flAnchVer, flAnchEd), anchorsProposed: flAnchProp },
    technical: { items: tcItems, approved: tcApproved, calibrated: tcCal, cutScores: tcCut, results: tcResults, anchorsVerified: add(tcAnchVer, tcAnchEd), anchorsProposed: tcAnchProp },
    reflect: { competencies: rfComp, behaviors: rfBeh, behaviorsAi: rfBehAi, responses: rfResp, anchorsVerified: add(rfAnchVer, rfAnchEd), anchorsProposed: rfAnchProp },
    psy: { items: psyItems, approved: psyApproved, norms: psyNorms, itemResponses: psyItemResp, results: psyResults, scalesTotal: psyScales, anchorsVerified: add(psyAnchVer, psyAnchEd), anchorsProposed: psyAnchProp },
  };
}
