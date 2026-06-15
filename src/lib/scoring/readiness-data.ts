// ─────────────────────────────────────────────────────────────
// Succession Readiness — server integration layer (Slice 1, §4.3).
//
// Assembles the inputs for the pure `computeReadiness` engine and runs it:
//   1. Resolve the admin config (per-org override -> global default).
//   2. Build the target-role competency requirements from the candidate's
//      bound role profile.
//   3. Find the candidate's Reflect 360 participant (candidate_id, else email).
//   4. Score the 360 via the existing `computeParticipantScoring`.
//   5. Map each Reflect competency onto its AC catalogue competency
//      (ac_competency_id, else case-insensitive name match).
//   6. Pick the self source per the engagement's assessment_mode lever.
//   7. Run the engine.
//   8. Best-effort snapshot into `readiness_results`.
//
// Server-only: uses the service-role client. The engine itself stays pure.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { computeParticipantScoring } from "@/lib/reflect/scoring";
import {
  computeReadiness,
  DEFAULT_READINESS_CONFIG,
  type ReadinessConfig,
  type RoleCompetencyPriority,
  type ReadinessTier,
  type RoleCompetencyReq,
  type ObservedCompetency,
  type ReadinessResult,
} from "@/lib/scoring/readiness";

type Sb = ReturnType<typeof createServiceClient>;

/** Raw `readiness_index_config` row (snake_case, as stored). */
export type ReadinessConfigRow = {
  id: string;
  organization_id: string | null;
  ready_now_gap_cut: number | string;
  ready_soon_gap_cut: number | string;
  developing_gap_cut: number | string;
  knockout_enabled: boolean;
  knockout_priority: RoleCompetencyPriority;
  knockout_gap: number | string;
  knockout_cap_tier: ReadinessTier;
  use_weights: boolean;
  min_others_per_competency: number | string;
  coverage_min_pct: number | string;
  year_layer_enabled: boolean;
  year_map: Record<string, string> | null;
  updated_by: string | null;
  updated_at: string;
};

const CONFIG_COLUMNS =
  "id, organization_id, ready_now_gap_cut, ready_soon_gap_cut, developing_gap_cut, " +
  "knockout_enabled, knockout_priority, knockout_gap, knockout_cap_tier, use_weights, " +
  "min_others_per_competency, coverage_min_pct, year_layer_enabled, year_map, updated_by, updated_at";

const TIERS: ReadinessTier[] = ["ready_now", "ready_soon", "developing", "not_ready"];

/** Map a stored config row to the engine's `ReadinessConfig`. Falls back to the
 *  engine defaults for any missing field so a partially-populated row is safe. */
export function rowToConfig(row: ReadinessConfigRow | null): ReadinessConfig {
  if (!row) return DEFAULT_READINESS_CONFIG;
  const num = (v: number | string | null | undefined, d: number) => {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : d;
  };
  const ym = (row.year_map ?? {}) as Record<string, string>;
  const yearMap = {
    ready_now: ym.ready_now ?? DEFAULT_READINESS_CONFIG.yearMap.ready_now,
    ready_soon: ym.ready_soon ?? DEFAULT_READINESS_CONFIG.yearMap.ready_soon,
    developing: ym.developing ?? DEFAULT_READINESS_CONFIG.yearMap.developing,
    not_ready: ym.not_ready ?? DEFAULT_READINESS_CONFIG.yearMap.not_ready,
  } satisfies Record<ReadinessTier, string>;
  return {
    readyNowGapCut: num(row.ready_now_gap_cut, DEFAULT_READINESS_CONFIG.readyNowGapCut),
    readySoonGapCut: num(row.ready_soon_gap_cut, DEFAULT_READINESS_CONFIG.readySoonGapCut),
    developingGapCut: num(row.developing_gap_cut, DEFAULT_READINESS_CONFIG.developingGapCut),
    knockoutEnabled: row.knockout_enabled ?? DEFAULT_READINESS_CONFIG.knockoutEnabled,
    knockoutPriority: (row.knockout_priority ?? DEFAULT_READINESS_CONFIG.knockoutPriority) as RoleCompetencyPriority,
    knockoutGap: num(row.knockout_gap, DEFAULT_READINESS_CONFIG.knockoutGap),
    knockoutCapTier: (TIERS.includes(row.knockout_cap_tier) ? row.knockout_cap_tier : DEFAULT_READINESS_CONFIG.knockoutCapTier),
    useWeights: row.use_weights ?? DEFAULT_READINESS_CONFIG.useWeights,
    minOthersPerCompetency: Math.max(1, Math.round(num(row.min_others_per_competency, DEFAULT_READINESS_CONFIG.minOthersPerCompetency))),
    coverageMinPct: num(row.coverage_min_pct, DEFAULT_READINESS_CONFIG.coverageMinPct),
    yearLayerEnabled: row.year_layer_enabled ?? DEFAULT_READINESS_CONFIG.yearLayerEnabled,
    yearMap,
  };
}

/** Effective config for a scope: per-org override if present, else the global
 *  default row, else the engine's built-in defaults (table not yet migrated). */
export async function loadEffectiveConfig(
  sb: Sb,
  organizationId: string | null,
): Promise<{ config: ReadinessConfig; row: ReadinessConfigRow | null; scope: "org" | "global" | "default" }> {
  try {
    if (organizationId) {
      const { data: orgRow } = await sb
        .from("readiness_index_config")
        .select(CONFIG_COLUMNS)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (orgRow) return { config: rowToConfig(orgRow as unknown as ReadinessConfigRow), row: orgRow as unknown as ReadinessConfigRow, scope: "org" };
    }
    const { data: globalRow } = await sb
      .from("readiness_index_config")
      .select(CONFIG_COLUMNS)
      .is("organization_id", null)
      .maybeSingle();
    if (globalRow) return { config: rowToConfig(globalRow as unknown as ReadinessConfigRow), row: globalRow as unknown as ReadinessConfigRow, scope: "global" };
  } catch {
    // table not migrated yet — fall through to engine defaults
  }
  return { config: DEFAULT_READINESS_CONFIG, row: null, scope: "default" };
}

/** Convenience for the admin panel: the global default config row (+ mapped config). */
export async function loadGlobalReadinessConfig(): Promise<{ config: ReadinessConfig; row: ReadinessConfigRow | null }> {
  const sb = createServiceClient();
  const { config, row } = await loadEffectiveConfig(sb, null);
  return { config, row };
}

/** Sum of distinct Others raters across a competency's rater groups (excludes self). */
function othersCountFromGroups(byGroup: Array<{ rater_role: string; rater_count: number }> | undefined): number {
  if (!byGroup) return 0;
  return byGroup.filter((g) => g.rater_role !== "self").reduce((a, g) => a + (g.rater_count ?? 0), 0);
}

/**
 * Compute a candidate's succession readiness for their target role.
 * Pure engine + DB assembly; optionally snapshots into readiness_results.
 */
export async function computeCandidateReadiness(
  engagementId: string,
  candidateId: string,
  computedBy?: string | null,
): Promise<ReadinessResult> {
  const sb = createServiceClient();

  // Engagement: organization (config scope) + the self lever.
  let organizationId: string | null = null;
  let assessmentMode: "standalone" | "combined" = "standalone";
  try {
    const { data: eng } = await sb
      .from("engagements")
      .select("id, organization_id, assessment_mode")
      .eq("id", engagementId)
      .maybeSingle();
    organizationId = (eng?.organization_id as string | null) ?? null;
    if (eng?.assessment_mode === "combined") assessmentMode = "combined";
  } catch {
    /* assessment_mode column may not be migrated yet — default standalone */
  }

  // 1) Config.
  const { config } = await loadEffectiveConfig(sb, organizationId);

  // Candidate: role binding + email (the 360 fallback matcher).
  const { data: cand } = await sb
    .from("candidates")
    .select("id, email, role_profile_id")
    .eq("id", candidateId)
    .maybeSingle();
  const roleProfileId = (cand?.role_profile_id as string | null) ?? null;

  // 2) Role competency requirements (weight, priority, target).
  const role: RoleCompetencyReq[] = [];
  if (roleProfileId) {
    const { data: rp } = await sb
      .from("role_profiles")
      .select("default_target_proficiency")
      .eq("id", roleProfileId)
      .maybeSingle();
    const target = Number(rp?.default_target_proficiency ?? 3) || 3;
    const { data: rpcs } = await sb
      .from("role_profile_competencies")
      .select("competency_id, weight, priority")
      .eq("role_profile_id", roleProfileId);
    const compIds = (rpcs ?? []).map((r) => r.competency_id as string);
    const nameById = new Map<string, string>();
    if (compIds.length) {
      const { data: comps } = await sb.from("competencies").select("id, name").in("id", compIds);
      for (const c of comps ?? []) nameById.set(c.id as string, (c.name as string) ?? "");
    }
    for (const r of rpcs ?? []) {
      const priority = (["high", "medium", "low"].includes(r.priority as string) ? r.priority : "medium") as RoleCompetencyPriority;
      role.push({
        competencyId: r.competency_id as string,
        name: nameById.get(r.competency_id as string) ?? "",
        weight: Number(r.weight ?? 1) || 1,
        priority,
        target,
      });
    }
  }

  // 3) Find the candidate's Reflect 360 participant.
  let participantId: string | null = null;
  try {
    const { data: byCand } = await sb
      .from("reflect_participants")
      .select("id, created_at")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (byCand && byCand.length) participantId = byCand[0].id as string;
  } catch {
    /* candidate_id column not migrated yet — fall back to email below */
  }
  if (!participantId && cand?.email) {
    const { data: byEmail } = await sb
      .from("reflect_participants")
      .select("id, created_at")
      .ilike("email", cand.email as string)
      .order("created_at", { ascending: false })
      .limit(1);
    if (byEmail && byEmail.length) participantId = byEmail[0].id as string;
  }

  // 4) Score the 360 (reuses the Reflect scorer; already excludes self + applies anonymity).
  const scoring = participantId ? await computeParticipantScoring(participantId) : null;

  // 6 (self source). In combined mode the self comes from the behavioral
  // self-assessment (Slice 3); until that lands the map is empty and self
  // flags simply won't render. In standalone mode we use the 360 self-rater.
  const behavioralSelfByAc = new Map<string, number>();
  // TODO(Slice 3): populate behavioralSelfByAc from the behavioral self-assessment
  // per AC competency when assessmentMode === "combined".

  // 5) Map Reflect competencies -> AC catalogue competencies; build observed[].
  const observed: ObservedCompetency[] = [];
  if (scoring) {
    const reflectIds = scoring.competencies.map((c) => c.competency_id);
    const acById = new Map<string, string | null>();
    let needNameFallback = false;
    try {
      const { data: rcs } = await sb
        .from("reflect_competencies")
        .select("id, ac_competency_id, name_en")
        .in("id", reflectIds);
      for (const rc of rcs ?? []) {
        const ac = (rc.ac_competency_id as string | null) ?? null;
        acById.set(rc.id as string, ac);
        if (!ac) needNameFallback = true;
      }
    } catch {
      // ac_competency_id column not migrated yet — use name fallback for all.
      needNameFallback = true;
    }
    let acByName = new Map<string, string>();
    if (needNameFallback) {
      const { data: allComps } = await sb.from("competencies").select("id, name");
      acByName = new Map((allComps ?? []).map((c) => [String(c.name).trim().toLowerCase(), c.id as string]));
    }
    for (const cs of scoring.competencies) {
      let acId = acById.get(cs.competency_id) ?? null;
      if (!acId) acId = acByName.get((cs.name_en ?? "").trim().toLowerCase()) ?? null;
      if (!acId) continue; // unmapped Reflect competency — not part of the role match
      const selfMean =
        assessmentMode === "combined" ? behavioralSelfByAc.get(acId) ?? null : cs.self_mean;
      observed.push({
        competencyId: acId,
        othersMean: cs.others_mean,
        selfMean,
        othersCount: othersCountFromGroups(cs.by_group),
      });
    }
  }

  // 7) Run the engine.
  const result = computeReadiness(role, observed, config);

  // 8) Best-effort snapshot (tolerant of readiness_results not being migrated).
  try {
    const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    await sb.from("readiness_results").upsert(
      {
        engagement_id: engagementId,
        candidate_id: candidateId,
        role_profile_id: roleProfileId,
        status: result.status,
        tier: result.tier,
        weighted_others: r2(result.weightedOthers),
        weighted_target: r2(result.weightedTarget),
        overall_gap: r2(result.overallGap),
        coverage_pct: r3(result.coveragePct),
        knockout_applied: result.knockoutApplied,
        year_label: result.yearLabel,
        per_competency: result.competencies,
        config_snapshot: config,
        computed_by: computedBy ?? null,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "engagement_id,candidate_id" },
    );
  } catch {
    /* readiness_results not migrated — the computed result is still returned */
  }

  return result;
}
