import { createServiceClient } from "@/lib/supabase/server";
import type {
  AraAssessment,
  AraOrganization,
  AraPillarId,
  AraQuestion,
  AraRespondent,
} from "@/types/ara";

export type AraRespondentContext = {
  respondent: AraRespondent;
  assessment: AraAssessment & {
    organization: Pick<AraOrganization, "id" | "name" | "name_ar"> | null;
  };
  assignedPillars: AraPillarId[];
};

/**
 * Look up a respondent by their access token and return the full context
 * needed to render their assessment form. Returns null if the token is
 * invalid or the assessment is archived / frozen / locked to further answers.
 */
export async function loadRespondentByToken(
  token: string
): Promise<AraRespondentContext | null> {
  const sb = createServiceClient();

  const { data: respondent } = await sb
    .from("ara_respondents")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<AraRespondent>();

  if (!respondent) return null;

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar)")
    .eq("id", respondent.assessment_id)
    .maybeSingle<
      AraAssessment & {
        organization: Pick<AraOrganization, "id" | "name" | "name_ar"> | null;
      }
    >();

  if (!assessment) return null;

  const { data: assignments } = await sb
    .from("ara_respondent_pillar_assignments")
    .select("pillar_id")
    .eq("respondent_id", respondent.id);

  return {
    respondent,
    assessment,
    assignedPillars: (assignments ?? []).map((a) => a.pillar_id as AraPillarId),
  };
}

/**
 * Load the Layer-1 question set applicable to this respondent.
 *
 * Two modes:
 *
 *   Individual stage — assessment.engagement_stage === 'individual'
 *     Returns the 16 self-assessment items where individual_factor_id
 *     IS NOT NULL. Pillar assignment is ignored (the respondent is the
 *     person themselves; there's no consultant-curated pillar set).
 *
 *   Org-side stages — department / division / enterprise
 *     Returns the original behaviour: filter by assessment version,
 *     respondent's assigned pillars, region, sector. EXCLUDES the
 *     individual-factor items (added by migration 00026) so org-side
 *     respondents never see them, even when assigned to the talent
 *     pillar where the seed lives.
 */
export async function loadQuestionsForRespondent(
  ctx: AraRespondentContext
): Promise<AraQuestion[]> {
  const sb = createServiceClient();

  if (!ctx.assessment.question_bank_version_id) return [];

  const isIndividual = ctx.assessment.engagement_stage === "individual";

  // For individual stage we don't need pillar assignments — the bank
  // is keyed off individual_factor_id.
  if (!isIndividual && ctx.assignedPillars.length === 0) return [];

  let query = sb
    .from("ara_questions")
    .select("*")
    .eq("version_id", ctx.assessment.question_bank_version_id)
    .eq("layer", 1)
    .eq("is_active", true);

  if (isIndividual) {
    query = query.not("individual_factor_id", "is", null);
  } else {
    query = query
      .in("pillar_id", ctx.assignedPillars)
      .is("individual_factor_id", null);
  }

  const { data: questions } = await query.returns<AraQuestion[]>();

  return (questions ?? []).filter((q) => {
    const regionOk = q.region === "both" || q.region === ctx.assessment.region;
    const sectorOk = q.sector === "all" || q.sector === ctx.assessment.sector;
    return regionOk && sectorOk;
  });
}
