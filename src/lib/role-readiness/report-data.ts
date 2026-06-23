// Shared result/report data for a completed (or in-progress) Role Readiness
// sitting. Used by both the on-screen result route and the PDF renderer, so the
// two never diverge. Reads the per-section breakdowns persisted by sitting.ts.

import { createServiceClient } from "@/lib/supabase/server";
import { loadRoleConfig } from "./config";
import type { CompetencyResult, AreaResult, Verdict } from "./scoring";

export type RrDevItem = { name: string; nameAr: string | null; suggestionEn: string; suggestionAr: string | null };

export type RrReportData = {
  candidateName: string;
  candidateEmail: string;
  roleNameEn: string;
  roleNameAr: string | null;
  organizationName: string | null;
  verdict: Verdict;
  persona: { scorePct: number | null; passed: boolean | null; threshold: number; competencies: CompetencyResult[] };
  technical: { scorePct: number | null; passed: boolean | null; threshold: number; areas: AreaResult[] };
  developmentPlan: { competencies: RrDevItem[]; areas: RrDevItem[] };
  generatedAt: Date;
};

const GENERIC_COMP = (name: string) => `Prioritise development on ${name} to reach the target level.`;
const GENERIC_AREA = (name: string) => `Strengthen ${name}: targeted practice and review to close the gap.`;

export async function loadReadinessReportData(candidateId: string): Promise<RrReportData | null> {
  const svc = createServiceClient();
  const { data: cand } = await svc
    .from("rr_candidates")
    .select("id, full_name, email, verdict, role_config_id, organization_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return null;

  const config = await loadRoleConfig(cand.role_config_id as string);
  if (!config) return null;

  const { data: sections } = await svc
    .from("rr_section_results")
    .select("section, score_pct, passed, breakdown")
    .eq("candidate_id", candidateId);
  const bySection = new Map(
    ((sections ?? []) as Array<{ section: string; score_pct: number | null; passed: boolean | null; breakdown: unknown }>).map(
      (s) => [s.section, s],
    ),
  );
  const personaRow = bySection.get("persona");
  const techRow = bySection.get("technical");
  const personaComps = (personaRow?.breakdown ?? []) as CompetencyResult[];
  const techAreas = (techRow?.breakdown ?? []) as AreaResult[];

  let organizationName: string | null = null;
  if (cand.organization_id) {
    const { data: org } = await svc.from("organizations").select("name").eq("id", cand.organization_id as string).maybeSingle();
    organizationName = (org?.name as string | null) ?? null;
  }

  // Dev plan: below-target competencies + areas, each with SME-editable suggestion
  // (override / area field) or a sensible generic default.
  const areaSuggById = new Map(config.technicalAreas.map((a) => [a.id, a]));
  const compNameById = new Map(config.competencies.map((c) => [c.competency_id, c]));

  const devComps: RrDevItem[] = personaComps
    .filter((c) => c.assessed && c.below_target)
    .map((c) => {
      const over = config.competencySuggestions[c.competency_id];
      const cm = compNameById.get(c.competency_id);
      return {
        name: c.name,
        nameAr: cm?.name_ar ?? null,
        suggestionEn: (over?.en && over.en.trim()) || GENERIC_COMP(c.name),
        suggestionAr: over?.ar ?? null,
      };
    });

  const devAreas: RrDevItem[] = techAreas
    .filter((a) => a.assessed && a.below_target)
    .map((a) => {
      const area = areaSuggById.get(a.area_id);
      return {
        name: a.name,
        nameAr: area?.name_ar ?? null,
        suggestionEn: (area?.suggestion_en && area.suggestion_en.trim()) || GENERIC_AREA(a.name),
        suggestionAr: area?.suggestion_ar ?? null,
      };
    });

  return {
    candidateName: cand.full_name as string,
    candidateEmail: cand.email as string,
    roleNameEn: config.name_en,
    roleNameAr: config.name_ar,
    organizationName,
    verdict: cand.verdict as Verdict,
    persona: {
      scorePct: personaRow?.score_pct ?? null,
      passed: personaRow?.passed ?? null,
      threshold: config.persona_pass_pct,
      competencies: personaComps,
    },
    technical: {
      scorePct: techRow?.score_pct ?? null,
      passed: techRow?.passed ?? null,
      threshold: config.technical_pass_pct,
      areas: techAreas,
    },
    developmentPlan: { competencies: devComps, areas: devAreas },
    generatedAt: new Date(),
  };
}
