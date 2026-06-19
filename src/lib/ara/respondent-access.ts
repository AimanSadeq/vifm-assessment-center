import { createServiceClient } from "@/lib/supabase/server";
import { getPillarsForAssessment } from "@/lib/constants/ara-stages";
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
 * needed to render their assessment form (or their results page).
 *
 * Returns null only when the token is invalid or the assessment row is missing.
 * It deliberately does NOT gate on assessment status: a completed respondent on
 * a frozen/archived assessment must still load to VIEW their results/PDF.
 * Write-locking for frozen/archived is enforced at the write paths instead
 * (saveAraAnswer + markAraRespondentComplete both refuse those statuses), which
 * is the correct place to stop further answers without breaking results access.
 * (AUTHZ-04: docstring corrected to match behaviour.)
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

  // Effective pillar set. Defense-in-depth: a respondent should normally have
  // explicit assignment rows (the add / bulk-import paths set them), but legacy
  // rows or a missed path can leave them empty - which would serve a blank test
  // (the "department test not working" bug). When pillar questions are wanted
  // and no assignments exist, fall back to the assessment's resolved in-scope
  // pillars (department=4, division=6, enterprise=8; honours pillars_in_scope).
  const effectivePillars: AraPillarId[] =
    ctx.assignedPillars.length > 0
      ? ctx.assignedPillars
      : (getPillarsForAssessment({
          engagement_stage: ctx.assessment.engagement_stage,
          pillars_in_scope: ctx.assessment.pillars_in_scope,
        } as Parameters<typeof getPillarsForAssessment>[0]) as AraPillarId[]);

  // Pillar assignment is required when serving pillar questions.
  if (wantsPillar && effectivePillars.length === 0) {
    // No pillar questions; if also no individual layer there's nothing to serve.
    if (!wantsIndividual) return [];
  }

  const collected: AraQuestion[] = [];

  // ── Pillar questions (Mode B without individual_only, Mode C) ──
  if (wantsPillar && effectivePillars.length > 0) {
    const { data } = await sb
      .from("ara_questions")
      .select("*")
      .eq("version_id", versionId)
      .eq("layer", 1)
      .eq("is_active", true)
      .in("pillar_id", effectivePillars)
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
