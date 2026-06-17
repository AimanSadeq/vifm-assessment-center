import { createServiceClient } from "@/lib/supabase/server";
import { getPillarsForAssessment } from "@/lib/constants/ara-stages";
import type {
  AraAssessment, AraComplianceStatus, AraEngagementStage, AraPillarId,
  AraRegulatoryFramework, AraRegulatoryRequirement,
} from "@/types/ara";

// ─────────────────────────────────────────────────────────────
// Resolve the effective scope for an assessment's compliance:
//   - region + sector: read from the assessment row, which is the single
//     source of truth across the module (report header, detail badges,
//     peer-benchmark cohort matching, respondent question filtering all
//     read it). The row is kept correct at WRITE time - the create paths
//     (createAraAssessment / createReassessmentFromPrior) stamp it from
//     the owning org, updateAraOrganization re-stamps draft assessments
//     on an org edit, and a one-time backfill (migration 00115) fixes any
//     legacy mis-pick. Deriving it from the org HERE instead would split-
//     brain compliance against those other surfaces (and would move a
//     historical assessment's region even though its answers were drawn
//     from the original region's question set), so we keep it on the row.
//   - pillarsInScope: the pillars actually measured at this stage /
//     selection, so requirements mapped to out-of-scope pillars are
//     neither persisted nor counted (they'd otherwise sit as permanent
//     "unknown" and inflate the requirement total).
// ─────────────────────────────────────────────────────────────
type AssessmentScope = {
  region: AraAssessment["region"];
  sector: AraAssessment["sector"];
  pillarsInScope: ReadonlyArray<AraPillarId>;
};

async function resolveAssessmentScope(
  sb: ReturnType<typeof createServiceClient>,
  assessmentId: string
): Promise<AssessmentScope | null> {
  const { data: a } = await sb
    .from("ara_assessments")
    .select("id, region, sector, engagement_stage, pillars_in_scope")
    .eq("id", assessmentId)
    .maybeSingle<{
      id: string;
      region: AraAssessment["region"];
      sector: AraAssessment["sector"];
      engagement_stage: AraEngagementStage;
      pillars_in_scope: AraPillarId[] | null;
    }>();
  if (!a) return null;

  const pillarsInScope = getPillarsForAssessment({
    engagement_stage: a.engagement_stage,
    pillars_in_scope: a.pillars_in_scope ?? null,
  });

  return { region: a.region, sector: a.sector, pillarsInScope };
}

// Extra type - requirements have extra fields not in AraRegulatoryFramework
export type AraRegulatoryRequirementRow = {
  id: string;
  framework_id: string;
  requirement_code: string;
  requirement_text_en: string;
  requirement_text_ar: string;
  requirement_category: string | null;
  pillar_id: string | null;
  applies_to_sectors: string[];
  severity: "mandatory" | "recommended" | "advisory";
  display_order: number;
};

// ─────────────────────────────────────────────────────────────
// Filter: which frameworks apply to a given (region, sector)?
// ─────────────────────────────────────────────────────────────
export function frameworkApplies(
  framework: Pick<AraRegulatoryFramework, "region" | "applies_to_sectors">,
  assessment: Pick<AraAssessment, "region" | "sector">
): boolean {
  if (framework.region !== assessment.region) return false;
  const sectors = framework.applies_to_sectors ?? ["all"];
  if (sectors.includes("all") || sectors.length === 0) return true;
  return sectors.includes(assessment.sector);
}

export function requirementApplies(
  requirement: Pick<AraRegulatoryRequirementRow, "applies_to_sectors">,
  assessment: Pick<AraAssessment, "sector">
): boolean {
  const sectors = requirement.applies_to_sectors ?? ["all"];
  if (sectors.includes("all") || sectors.length === 0) return true;
  return sectors.includes(assessment.sector);
}

// ─────────────────────────────────────────────────────────────
// Derive compliance status from response scores in the mapped pillar.
//
// Policy (question-driven Method 1, handover Section 11.3):
//   no scored responses in pillar    → unknown
//   avg score >= 4.0                 → met       (1.0)
//   2.5 <= avg score < 4.0           → partial   (0.5)
//   avg score < 2.5                  → not_met   (0.0)
//
// This is a starting policy. Consultants can always override in Phase 2.
// ─────────────────────────────────────────────────────────────
export function deriveComplianceStatus(
  pillarScores: number[]
): { status: AraComplianceStatus; score: number | null; evidenceCount: number } {
  if (pillarScores.length === 0) {
    return { status: "unknown", score: null, evidenceCount: 0 };
  }
  const avg = pillarScores.reduce((a, b) => a + b, 0) / pillarScores.length;
  if (avg >= 4.0) return { status: "met", score: 1.0, evidenceCount: pillarScores.length };
  if (avg >= 2.5) return { status: "partial", score: 0.5, evidenceCount: pillarScores.length };
  return { status: "not_met", score: 0.0, evidenceCount: pillarScores.length };
}

const STATUS_LABELS: Record<AraComplianceStatus, { en: string; ar: string }> = {
  met: { en: "Compliant", ar: "ممتثل" },
  partial: { en: "Partially Compliant", ar: "ممتثل جزئياً" },
  not_met: { en: "Action Required", ar: "يتطلب إجراء" },
  unknown: { en: "Needs Verification", ar: "يحتاج تحقق" },
};

export function complianceStatusLabel(status: AraComplianceStatus) {
  return STATUS_LABELS[status];
}

// ─────────────────────────────────────────────────────────────
// Full recalculation for an assessment. Idempotent. Preserves
// consultant overrides (rows with evidence_note set manually are
// not overwritten by the auto-derive).
// ─────────────────────────────────────────────────────────────
export async function recalculateAssessmentCompliance(assessmentId: string): Promise<void> {
  const sb = createServiceClient();

  const scope = await resolveAssessmentScope(sb, assessmentId);
  if (!scope) return;
  // frameworkApplies / requirementApplies key off region + sector only.
  const assessment = { region: scope.region, sector: scope.sector };

  // Load applicable frameworks + their requirements
  const { data: frameworks } = await sb
    .from("ara_regulatory_frameworks")
    .select("id, region, applies_to_sectors")
    .eq("region", assessment.region)
    .eq("is_active", true);

  if (!frameworks || frameworks.length === 0) return;

  const applicableFrameworkIds = frameworks
    .filter((f) => frameworkApplies(f as any, assessment))
    .map((f) => f.id);

  if (applicableFrameworkIds.length === 0) return;

  const { data: requirements } = await sb
    .from("ara_regulatory_requirements")
    .select("*")
    .in("framework_id", applicableFrameworkIds)
    .returns<AraRegulatoryRequirementRow[]>();

  if (!requirements || requirements.length === 0) return;

  // Load all scored responses with their question's pillar.
  const { data: responseRows } = await sb
    .from("ara_responses")
    .select("question_score, question:ara_questions(pillar_id)")
    .eq("assessment_id", assessmentId);

  type RespRow = {
    question_score: number | null;
    question: { pillar_id: string | null } | null;
  };
  const responses = ((responseRows ?? []) as unknown as RespRow[]).filter(
    (r) => r.question_score != null && r.question?.pillar_id
  );

  // Group scored responses by pillar
  const byPillar = new Map<string, number[]>();
  for (const r of responses) {
    const p = r.question!.pillar_id!;
    const arr = byPillar.get(p) ?? [];
    arr.push(Number(r.question_score));
    byPillar.set(p, arr);
  }

  // Upsert compliance result per applicable requirement, skipping ones
  // with an existing consultant-override (non-null evidence_note).
  for (const req of requirements) {
    if (!requirementApplies(req, assessment)) continue;

    // Pillar-scope gate: a requirement mapped to a pillar that isn't measured
    // at this stage/selection can never be scored, so don't persist a row for
    // it (it would sit as a permanent "unknown" and inflate the framework's
    // requirement total). Requirements with no pillar are always kept. Skipped
    // for the individual stage / legacy rows where the scope set is empty.
    if (
      scope.pillarsInScope.length > 0 &&
      req.pillar_id &&
      !scope.pillarsInScope.includes(req.pillar_id as AraPillarId)
    ) {
      continue;
    }

    const { data: existing } = await sb
      .from("ara_compliance_results")
      .select("id, evidence_note")
      .eq("assessment_id", assessmentId)
      .eq("requirement_id", req.id)
      .maybeSingle<{ id: string; evidence_note: string | null }>();

    // Skip overwrite when a consultant has manually provided evidence.
    if (existing?.evidence_note) continue;

    const pillarScores = req.pillar_id ? byPillar.get(req.pillar_id) ?? [] : [];
    const derived = deriveComplianceStatus(pillarScores);
    const labels = complianceStatusLabel(derived.status);

    await sb
      .from("ara_compliance_results")
      .upsert(
        {
          assessment_id: assessmentId,
          requirement_id: req.id,
          status: derived.status,
          compliance_score: derived.score,
          status_label_en: labels.en,
          status_label_ar: labels.ar,
          source_question_ids: null,
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: "assessment_id,requirement_id" }
      );
  }
}

// Aggregate compliance % per framework for dashboard.
export type FrameworkComplianceSummary = {
  framework_id: string;
  framework_code: string;
  framework_name_en: string;
  framework_name_ar: string;
  tier: 1 | 2 | 3;
  total: number;
  met: number;
  partial: number;
  not_met: number;
  unknown: number;
  percent: number | null;
  /** False when no compliance results exist yet for this framework (the
   *  consultant hasn't run Recalculate and no respondent has completed),
   *  so the UI can show a "not yet calculated" state instead of a
   *  misleading "-" / all-zero card. */
  calculated: boolean;
};

export async function summarizeComplianceByFramework(
  assessmentId: string
): Promise<FrameworkComplianceSummary[]> {
  const sb = createServiceClient();

  const scope = await resolveAssessmentScope(sb, assessmentId);
  if (!scope) return [];
  const assessment = { region: scope.region, sector: scope.sector };

  const { data: frameworks } = await sb
    .from("ara_regulatory_frameworks")
    .select("id, framework_code, framework_name_en, framework_name_ar, region, applies_to_sectors, tier")
    .eq("region", assessment.region)
    .eq("is_active", true)
    .order("tier");

  if (!frameworks) return [];

  const applicable = frameworks.filter((f) => frameworkApplies(f as any, assessment));

  const summaries: FrameworkComplianceSummary[] = [];
  for (const f of applicable) {
    const { data: reqs } = await sb
      .from("ara_regulatory_requirements")
      .select("id, pillar_id")
      .eq("framework_id", f.id);
    // Count only requirements whose pillar is in scope for this stage/selection
    // (matches recalc's gate), so the total reflects what was actually
    // measured. Requirements with no pillar are always included.
    const reqIds = (reqs ?? [])
      .filter(
        (r) =>
          scope.pillarsInScope.length === 0 ||
          !r.pillar_id ||
          scope.pillarsInScope.includes(r.pillar_id as AraPillarId)
      )
      .map((r) => r.id);
    if (reqIds.length === 0) continue;

    const { data: results } = await sb
      .from("ara_compliance_results")
      .select("status")
      .eq("assessment_id", assessmentId)
      .in("requirement_id", reqIds);

    const counts = { met: 0, partial: 0, not_met: 0, unknown: 0 };
    for (const r of results ?? []) {
      counts[r.status as keyof typeof counts] =
        (counts[r.status as keyof typeof counts] ?? 0) + 1;
    }
    const scored = counts.met + counts.partial + counts.not_met;
    const percent = scored === 0 ? null : Math.round(((counts.met + counts.partial * 0.5) / scored) * 100);

    summaries.push({
      framework_id: f.id,
      framework_code: f.framework_code,
      framework_name_en: f.framework_name_en,
      framework_name_ar: f.framework_name_ar,
      tier: f.tier as 1 | 2 | 3,
      total: reqIds.length,
      met: counts.met,
      partial: counts.partial,
      not_met: counts.not_met,
      unknown: counts.unknown,
      percent,
      // No result rows at all => compliance hasn't been calculated yet.
      calculated: (results ?? []).length > 0,
    });
  }

  return summaries;
}
