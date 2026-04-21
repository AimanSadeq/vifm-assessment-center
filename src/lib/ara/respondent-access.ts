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
 * Load the Layer-1 question set applicable to this respondent — filtered
 * by assessment version, assigned pillars, and (region, sector) match.
 */
export async function loadQuestionsForRespondent(
  ctx: AraRespondentContext
): Promise<AraQuestion[]> {
  const sb = createServiceClient();

  if (!ctx.assessment.question_bank_version_id) return [];
  if (ctx.assignedPillars.length === 0) return [];

  const { data: questions } = await sb
    .from("ara_questions")
    .select("*")
    .eq("version_id", ctx.assessment.question_bank_version_id)
    .eq("layer", 1)
    .eq("is_active", true)
    .in("pillar_id", ctx.assignedPillars)
    .returns<AraQuestion[]>();

  return (questions ?? []).filter((q) => {
    const regionOk = q.region === "both" || q.region === ctx.assessment.region;
    const sectorOk = q.sector === "all" || q.sector === ctx.assessment.sector;
    return regionOk && sectorOk;
  });
}
