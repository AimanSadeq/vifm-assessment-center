// Role Readiness config loader. A "role" = behavioural competency targets (reused
// from role_profiles / role_profile_competencies.target_proficiency, 00097) +
// role-authored technical areas/items (rr_technical_areas / rr_technical_items) +
// the two pass thresholds. Service-role reads (admin + token flows).

import { createServiceClient } from "@/lib/supabase/server";

export type RrCompetencyTarget = {
  competency_id: string;
  name: string;
  name_ar: string | null;
  target_level: number; // 1-5
};

export type RrTechItem = {
  id: string;
  stem_en: string;
  stem_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  sort_order: number;
};

export type RrTechArea = {
  id: string;
  name_en: string;
  name_ar: string | null;
  target_pct: number;
  suggestion_en: string | null;
  suggestion_ar: string | null;
  sort_order: number;
  items: RrTechItem[];
};

export type RoleReadinessConfig = {
  id: string;
  name_en: string;
  name_ar: string | null;
  description: string | null;
  persona_pass_pct: number;
  technical_pass_pct: number;
  role_profile_id: string | null;
  organization_id: string | null;
  status: string;
  is_sample: boolean;
  competencies: RrCompetencyTarget[];
  technicalAreas: RrTechArea[];
  competencySuggestions: Record<string, { en: string | null; ar: string | null }>;
};

// Item with the answer key stripped, for serving to the candidate browser.
export type RrTechItemPublic = Omit<RrTechItem, "correct_index">;

export function stripTechItem(it: RrTechItem): RrTechItemPublic {
  const { correct_index: _drop, ...rest } = it;
  void _drop;
  return rest;
}

const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];

export async function loadRoleConfig(configId: string): Promise<RoleReadinessConfig | null> {
  const svc = createServiceClient();

  const { data: cfg } = await svc
    .from("rr_role_configs")
    .select(
      "id, name_en, name_ar, description, persona_pass_pct, technical_pass_pct, role_profile_id, organization_id, status, is_sample"
    )
    .eq("id", configId)
    .maybeSingle();
  if (!cfg) return null;

  // ── Behavioural competencies + per-competency targets (reuse role_profiles) ──
  const competencies: RrCompetencyTarget[] = [];
  const roleProfileId = (cfg.role_profile_id as string | null) ?? null;
  if (roleProfileId) {
    const { data: rp } = await svc
      .from("role_profiles")
      .select("default_target_proficiency")
      .eq("id", roleProfileId)
      .maybeSingle();
    const fallback = Number(rp?.default_target_proficiency ?? 3);

    const { data: rows } = await svc
      .from("role_profile_competencies")
      .select("competency_id, target_proficiency, competencies(name, name_ar)")
      .eq("role_profile_id", roleProfileId);

    for (const r of (rows ?? []) as unknown as Array<{
      competency_id: string;
      target_proficiency: number | null;
      competencies: { name: string; name_ar: string | null } | null;
    }>) {
      competencies.push({
        competency_id: r.competency_id,
        name: r.competencies?.name ?? "Competency",
        name_ar: r.competencies?.name_ar ?? null,
        target_level: Number(r.target_proficiency ?? fallback),
      });
    }
  }

  // ── Technical areas + items (role-authored, isolated) ──
  const { data: areaRows } = await svc
    .from("rr_technical_areas")
    .select("id, name_en, name_ar, target_pct, suggestion_en, suggestion_ar, sort_order")
    .eq("role_config_id", configId)
    .order("sort_order");
  const areas = (areaRows ?? []) as Array<Omit<RrTechArea, "items">>;

  const areaIds = areas.map((a) => a.id);
  const itemsByArea = new Map<string, RrTechItem[]>();
  if (areaIds.length > 0) {
    const { data: itemRows } = await svc
      .from("rr_technical_items")
      .select("id, area_id, stem_en, stem_ar, options_en, options_ar, correct_index, sort_order")
      .in("area_id", areaIds)
      .eq("status", "active")
      .order("sort_order");
    for (const it of (itemRows ?? []) as Array<{
      id: string; area_id: string; stem_en: string; stem_ar: string | null;
      options_en: unknown; options_ar: unknown; correct_index: number; sort_order: number;
    }>) {
      const arr = itemsByArea.get(it.area_id) ?? [];
      arr.push({
        id: it.id,
        stem_en: it.stem_en,
        stem_ar: it.stem_ar,
        options_en: asStrArr(it.options_en),
        options_ar: it.options_ar == null ? null : asStrArr(it.options_ar),
        correct_index: it.correct_index,
        sort_order: it.sort_order,
      });
      itemsByArea.set(it.area_id, arr);
    }
  }

  const technicalAreas: RrTechArea[] = areas.map((a) => ({ ...a, items: itemsByArea.get(a.id) ?? [] }));

  // ── Per-competency SME suggestion overrides ──
  const competencySuggestions: Record<string, { en: string | null; ar: string | null }> = {};
  const { data: sugg } = await svc
    .from("rr_competency_suggestions")
    .select("competency_id, suggestion_en, suggestion_ar")
    .eq("role_config_id", configId);
  for (const s of (sugg ?? []) as Array<{ competency_id: string; suggestion_en: string | null; suggestion_ar: string | null }>) {
    competencySuggestions[s.competency_id] = { en: s.suggestion_en, ar: s.suggestion_ar };
  }

  return {
    id: cfg.id as string,
    name_en: cfg.name_en as string,
    name_ar: (cfg.name_ar as string | null) ?? null,
    description: (cfg.description as string | null) ?? null,
    persona_pass_pct: Number(cfg.persona_pass_pct ?? 60),
    technical_pass_pct: Number(cfg.technical_pass_pct ?? 60),
    role_profile_id: roleProfileId,
    organization_id: (cfg.organization_id as string | null) ?? null,
    status: cfg.status as string,
    is_sample: !!cfg.is_sample,
    competencies,
    technicalAreas,
    competencySuggestions,
  };
}
