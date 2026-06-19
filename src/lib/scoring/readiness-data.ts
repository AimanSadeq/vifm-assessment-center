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
  type ReadinessEvidenceSource,
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
  // v2 advisory-confidence columns (migration 00096). Optional: a pre-migration
  // row won't have them, so rowToConfig falls back to the engine defaults.
  borderline_band?: number | string | null;
  rater_agreement_spread_max?: number | string | null;
};

const CONFIG_COLUMNS_BASE =
  "id, organization_id, ready_now_gap_cut, ready_soon_gap_cut, developing_gap_cut, " +
  "knockout_enabled, knockout_priority, knockout_gap, knockout_cap_tier, use_weights, " +
  "min_others_per_competency, coverage_min_pct, year_layer_enabled, year_map, updated_by, updated_at";
const CONFIG_COLUMNS_V2 = CONFIG_COLUMNS_BASE + ", borderline_band, rater_agreement_spread_max";

/** Load the config row for a scope, tolerant of the v2 columns not being
 *  migrated yet (retries with the base column list on a missing-column error). */
async function loadConfigRow(sb: Sb, orgId: string | null): Promise<ReadinessConfigRow | null> {
  const build = (cols: string) => {
    const q = sb.from("readiness_index_config").select(cols);
    return (orgId ? q.eq("organization_id", orgId) : q.is("organization_id", null)).maybeSingle();
  };
  let { data, error } = await build(CONFIG_COLUMNS_V2);
  if (error) ({ data, error } = await build(CONFIG_COLUMNS_BASE));
  if (error) return null;
  return (data ?? null) as unknown as ReadinessConfigRow | null;
}

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
    borderlineBand: num(row.borderline_band, DEFAULT_READINESS_CONFIG.borderlineBand),
    raterAgreementSpreadMax: num(row.rater_agreement_spread_max, DEFAULT_READINESS_CONFIG.raterAgreementSpreadMax),
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
  if (organizationId) {
    const orgRow = await loadConfigRow(sb, organizationId);
    if (orgRow) return { config: rowToConfig(orgRow), row: orgRow, scope: "org" };
  }
  const globalRow = await loadConfigRow(sb, null);
  if (globalRow) return { config: rowToConfig(globalRow), row: globalRow, scope: "global" };
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

/** Spread of the Others view = max−min across rater-group means (excludes self).
 *  Feeds the engine's low-agreement flag (v2). Null when <2 groups have a mean. */
function othersSpreadFromGroups(
  byGroup: Array<{ rater_role: string; mean: number | null }> | undefined,
): number | null {
  if (!byGroup) return null;
  const means = byGroup
    .filter((g) => g.rater_role !== "self" && typeof g.mean === "number")
    .map((g) => g.mean as number);
  if (means.length < 2) return null;
  return Math.max(...means) - Math.min(...means);
}

/**
 * Compute a candidate's succession readiness for their target role.
 * Pure engine + DB assembly; optionally snapshots into readiness_results.
 */
export async function computeCandidateReadiness(
  engagementId: string,
  candidateId: string,
  computedBy?: string | null,
  /** Persist a readiness_results snapshot (default true). The cohort view
   *  passes false to compute read-only without write amplification. */
  persist: boolean = true,
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
    const defaultTarget = Number(rp?.default_target_proficiency ?? 3) || 3;
    // Per-competency target (handover C, migration 00097) overrides the role
    // default when set. Tolerant: retry without the column if not yet migrated.
    let rpcs: Array<Record<string, unknown>> | null = null;
    {
      const v2 = await sb
        .from("role_profile_competencies")
        .select("competency_id, weight, priority, target_proficiency")
        .eq("role_profile_id", roleProfileId);
      if (v2.error) {
        const base = await sb
          .from("role_profile_competencies")
          .select("competency_id, weight, priority")
          .eq("role_profile_id", roleProfileId);
        rpcs = (base.data as Array<Record<string, unknown>>) ?? [];
      } else {
        rpcs = (v2.data as Array<Record<string, unknown>>) ?? [];
      }
    }
    const compIds = (rpcs ?? []).map((r) => r.competency_id as string);
    const nameById = new Map<string, string>();
    // Domain (RESULTS / PEOPLE / THINKING / SELF) per competency, for the 9-box
    // axes. competencies -> competency_clusters -> competency_domains(name).
    const domainById = new Map<string, string | null>();
    if (compIds.length) {
      const { data: comps } = await sb
        .from("competencies")
        .select("id, name, competency_clusters(competency_domains(name))")
        .in("id", compIds);
      for (const c of comps ?? []) {
        nameById.set(c.id as string, (c.name as string) ?? "");
        // PostgREST embeds to-one relations as arrays under some configs; guard both.
        const cluster = Array.isArray((c as Record<string, unknown>).competency_clusters)
          ? ((c as Record<string, unknown>).competency_clusters as Array<Record<string, unknown>>)[0]
          : ((c as Record<string, unknown>).competency_clusters as Record<string, unknown> | null);
        const domainRel = cluster
          ? Array.isArray(cluster.competency_domains)
            ? (cluster.competency_domains as Array<Record<string, unknown>>)[0]
            : (cluster.competency_domains as Record<string, unknown> | null)
          : null;
        domainById.set(c.id as string, (domainRel?.name as string | undefined) ?? null);
      }
    }
    for (const r of rpcs ?? []) {
      const priority = (["high", "medium", "low"].includes(r.priority as string) ? r.priority : "medium") as RoleCompetencyPriority;
      const perComp = r.target_proficiency == null ? null : Number(r.target_proficiency);
      role.push({
        competencyId: r.competency_id as string,
        name: nameById.get(r.competency_id as string) ?? "",
        weight: Number(r.weight ?? 1) || 1,
        priority,
        target: perComp != null && Number.isFinite(perComp) ? perComp : defaultTarget,
        domain: domainById.get(r.competency_id as string) ?? null,
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
  // self-assessment (Slice 4: behavioral_competency_scores, keyed by AC
  // competency). In standalone mode we use the 360 self-rater. Tolerant of the
  // table not being migrated (map stays empty -> self flags just won't render).
  // Load the candidate's Persona (behavioral) self-scores unconditionally: they
  // serve as the self source in combined mode AND as the readiness DRIVER in a
  // Persona-only succession run where no 360 exists (SD-2 / Pilot 3).
  const behavioralSelfByAc = new Map<string, number>();
  try {
    const { data: bx } = await sb
      .from("behavioral_competency_scores")
      .select("competency_id, self_score")
      .eq("engagement_id", engagementId)
      .eq("candidate_id", candidateId);
    for (const row of bx ?? []) behavioralSelfByAc.set(row.competency_id as string, Number(row.self_score));
  } catch {
    /* behavioral_competency_scores not migrated yet */
  }

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
        othersSpread: othersSpreadFromGroups(cs.by_group),
      });
    }
  }

  // 6b) Persona-as-driver fallback (SD-2 / Pilot 3). When there is no 360
  // "Others" evidence, drive the tier from the candidate's Persona self-ratings
  // over the role competencies. The report labels this as self-reported so it
  // is never mistaken for multi-rater 360 evidence.
  let evidenceSource: ReadinessEvidenceSource = "others_360";
  if (observed.length === 0 && behavioralSelfByAc.size > 0) {
    for (const req of role) {
      const self = behavioralSelfByAc.get(req.competencyId);
      if (self == null || !Number.isFinite(self)) continue;
      observed.push({
        competencyId: req.competencyId,
        othersMean: self, // Persona self drives the tier when no 360 exists
        selfMean: null, // no separate "others" to difference against
        othersCount: 1,
        othersSpread: null,
      });
    }
    if (observed.length > 0) evidenceSource = "persona_self";
  }

  // 7) Run the engine.
  const result = computeReadiness(role, observed, config, evidenceSource);

  // 8) Best-effort snapshot (tolerant of readiness_results not being migrated).
  if (!persist) return result;
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
