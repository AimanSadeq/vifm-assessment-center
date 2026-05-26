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
 * Three deployment modes:
 *
 *   A) Individual stage (engagement_stage === 'individual')
 *      Personal AI Readiness only - no pillar assignments needed.
 *      Filter by individual_factor_id IS NOT NULL.
 *      assessment_tier='snapshot' → only tier='snapshot' (24 items)
 *      assessment_tier='deep_dive' → all individual items (48 items)
 *
 *   B) Org stage with include_individual_layer=true
 *      Respondent answers their assigned pillar questions PLUS the
 *      individual-factor items (24 or 48 depending on assessment_tier).
 *      Unless respondent.individual_only=true - then they skip pillar
 *      questions and only do the individual layer.
 *
 *   C) Org stage with include_individual_layer=false (the original behaviour)
 *      Pillar questions only, individual-factor items excluded.
 */
export async function loadQuestionsForRespondent(
  ctx: AraRespondentContext
): Promise<AraQuestion[]> {
  const sb = createServiceClient();
  const versionId = ctx.assessment.question_bank_version_id;
  if (!versionId) return [];

  const isIndividualStage = ctx.assessment.engagement_stage === "individual";
  const includeIndividualLayer = !!ctx.assessment.include_individual_layer;
  const includeAgenticLayer = !!ctx.assessment.include_agentic_layer;
  const respondentIndividualOnly = !!ctx.respondent.individual_only;

  const wantsPillar = !isIndividualStage && !respondentIndividualOnly;
  const wantsIndividual = isIndividualStage || includeIndividualLayer;
  // Agentic-AI Readiness is an org-level construct - served to org
  // respondents (never the personal-only ones, never on a personal
  // individual-stage assessment).
  const wantsAgentic = !isIndividualStage && includeAgenticLayer && !respondentIndividualOnly;

  if (!wantsPillar && !wantsIndividual && !wantsAgentic) return [];

  // Pillar assignment is required when serving pillar questions.
  if (wantsPillar && ctx.assignedPillars.length === 0) {
    // No pillar questions; if also no individual layer there's nothing to serve.
    if (!wantsIndividual) return [];
  }

  const collected: AraQuestion[] = [];

  // ── Pillar questions (Mode B without individual_only, Mode C) ──
  if (wantsPillar && ctx.assignedPillars.length > 0) {
    const { data } = await sb
      .from("ara_questions")
      .select("*")
      .eq("version_id", versionId)
      .eq("layer", 1)
      .eq("is_active", true)
      .in("pillar_id", ctx.assignedPillars)
      .is("individual_factor_id", null)
      .is("agentic_dimension_id", null)
      .returns<AraQuestion[]>();
    collected.push(...(data ?? []));
  }

  // ── Individual layer (Mode A, Mode B) ──
  if (wantsIndividual) {
    let q = sb
      .from("ara_questions")
      .select("*")
      .eq("version_id", versionId)
      .eq("layer", 1)
      .eq("is_active", true)
      .not("individual_factor_id", "is", null);

    if (ctx.assessment.assessment_tier === "snapshot") {
      q = q.eq("tier", "snapshot");
    }
    // 'deep_dive' includes both 'snapshot' and 'deep_dive_extra'

    const { data } = await q.returns<AraQuestion[]>();
    collected.push(...(data ?? []));
  }

  // ── Agentic-AI Readiness layer (org opt-in via include_agentic_layer) ──
  // Identified purely by agentic_dimension_id, so it is layer-agnostic and
  // the layer-1 pillar query above never picks these items up.
  if (wantsAgentic) {
    const { data } = await sb
      .from("ara_questions")
      .select("*")
      .eq("version_id", versionId)
      .eq("is_active", true)
      .not("agentic_dimension_id", "is", null)
      .returns<AraQuestion[]>();
    collected.push(...(data ?? []));
  }

  // Region/sector filter applies to all questions uniformly.
  return collected.filter((qq) => {
    const regionOk = qq.region === "both" || qq.region === ctx.assessment.region;
    const sectorOk = qq.sector === "all" || qq.sector === ctx.assessment.sector;
    return regionOk && sectorOk;
  });
}
