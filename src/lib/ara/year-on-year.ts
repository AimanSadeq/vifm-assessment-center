import { createServiceClient } from "@/lib/supabase/server";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

export type YoYComparisonPillar = {
  pillar_id: AraPillarId;
  pillar_name_en: string;
  current_raw: number | null;
  prior_raw: number | null;
  delta: number | null;
};

export type YoYComparison = {
  compatible: boolean;
  incompatibleReason?: string;
  prior_assessment_id?: string;
  prior_year?: number;
  prior_overall?: number | null;
  current_overall?: number | null;
  pillars: YoYComparisonPillar[];
};

/**
 * Find the most recent prior assessment for this organization that uses
 * the same MAJOR question bank version, and return pillar-level deltas.
 * Per handover §9.7 the year-on-year comparison is only valid inside a
 * major version; bumping the major version starts a new baseline.
 */
export async function computeYoYComparison(
  assessmentId: string
): Promise<YoYComparison | null> {
  const sb = createServiceClient();

  const { data: current } = await sb
    .from("ara_assessments")
    .select("id, organization_id, question_bank_version_id, assessment_year")
    .eq("id", assessmentId)
    .maybeSingle<{
      id: string;
      organization_id: string | null;
      question_bank_version_id: string | null;
      assessment_year: number;
    }>();
  if (!current || !current.organization_id || !current.question_bank_version_id) return null;

  const { data: currentVersion } = await sb
    .from("ara_question_bank_versions")
    .select("version_number")
    .eq("id", current.question_bank_version_id)
    .maybeSingle<{ version_number: string }>();
  if (!currentVersion) return null;
  const currentMajor = currentVersion.version_number.split(".")[0];

  // Find other assessments for this org with a scored overall.
  const { data: candidates } = await sb
    .from("ara_assessments")
    .select(
      "id, question_bank_version_id, assessment_year, completed_at, frozen_at, archived_at"
    )
    .eq("organization_id", current.organization_id)
    .neq("id", current.id)
    .in("status", ["completed", "frozen", "archived"])
    .order("assessment_year", { ascending: false })
    .limit(10);

  if (!candidates || candidates.length === 0) return null;

  // Filter to same major version
  const versionIds = Array.from(
    new Set(candidates.map((c) => c.question_bank_version_id).filter(Boolean) as string[])
  );
  const { data: versions } = await sb
    .from("ara_question_bank_versions")
    .select("id, version_number")
    .in("id", versionIds);
  const majorByVersion = new Map<string, string>();
  (versions ?? []).forEach((v) => majorByVersion.set(v.id, v.version_number.split(".")[0]));

  const compatibleCandidates = candidates.filter(
    (c) => c.question_bank_version_id && majorByVersion.get(c.question_bank_version_id) === currentMajor
  );
  if (compatibleCandidates.length === 0) {
    return {
      compatible: false,
      incompatibleReason:
        "Prior assessments exist for this organization but use a different major question bank version — a new baseline has been established.",
      pillars: [],
    };
  }

  // Pick the most recent one
  const prior = compatibleCandidates[0];

  const [{ data: priorPillars }, { data: currentPillars }, { data: priorOverall }, { data: currentOverall }] = await Promise.all([
    sb.from("ara_pillar_scores")
      .select("pillar_id, raw_score")
      .eq("assessment_id", prior.id),
    sb.from("ara_pillar_scores")
      .select("pillar_id, raw_score")
      .eq("assessment_id", current.id),
    sb.from("ara_assessment_scores")
      .select("overall_score")
      .eq("assessment_id", prior.id)
      .maybeSingle<{ overall_score: number | null }>(),
    sb.from("ara_assessment_scores")
      .select("overall_score")
      .eq("assessment_id", current.id)
      .maybeSingle<{ overall_score: number | null }>(),
  ]);

  const priorMap = new Map<string, number | null>();
  (priorPillars ?? []).forEach((p) => priorMap.set(p.pillar_id, p.raw_score != null ? Number(p.raw_score) : null));
  const currentMap = new Map<string, number | null>();
  (currentPillars ?? []).forEach((p) => currentMap.set(p.pillar_id, p.raw_score != null ? Number(p.raw_score) : null));

  const pillars: YoYComparisonPillar[] = ARA_PILLARS.map((p) => {
    const prev = priorMap.get(p.id) ?? null;
    const curr = currentMap.get(p.id) ?? null;
    const delta = prev != null && curr != null ? Number((curr - prev).toFixed(2)) : null;
    return {
      pillar_id: p.id,
      pillar_name_en: p.name_en,
      prior_raw: prev,
      current_raw: curr,
      delta,
    };
  });

  return {
    compatible: true,
    prior_assessment_id: prior.id,
    prior_year: prior.assessment_year,
    prior_overall: priorOverall?.overall_score != null ? Number(priorOverall.overall_score) : null,
    current_overall: currentOverall?.overall_score != null ? Number(currentOverall.overall_score) : null,
    pillars,
  };
}
