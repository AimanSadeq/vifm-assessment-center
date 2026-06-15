"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import type { ReadinessTier, RoleCompetencyPriority } from "@/lib/scoring/readiness";

export type ReadinessConfigInput = {
  readyNowGapCut: number;
  readySoonGapCut: number;
  developingGapCut: number;
  knockoutEnabled: boolean;
  knockoutPriority: RoleCompetencyPriority;
  knockoutGap: number;
  knockoutCapTier: ReadinessTier;
  useWeights: boolean;
  minOthersPerCompetency: number;
  coverageMinPct: number;
  yearLayerEnabled: boolean;
  yearMap: { ready_now: string; ready_soon: string; developing: string; not_ready: string };
};

const TIERS: ReadinessTier[] = ["ready_now", "ready_soon", "developing", "not_ready"];

/** Validate + persist the GLOBAL readiness config (organization_id IS NULL). */
export async function saveReadinessConfigAction(
  input: ReadinessConfigInput,
): Promise<{ ok: true } | { error: string }> {
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  // ── Validation (DB CHECKs enforce these too; we give a friendly message). ──
  const inBand = (n: number) => Number.isFinite(n) && n >= -5 && n <= 5;
  if (![input.readyNowGapCut, input.readySoonGapCut, input.developingGapCut, input.knockoutGap].every(inBand)) {
    return { error: "Gap values must be numbers between -5 and 5." };
  }
  if (!(input.readyNowGapCut >= input.readySoonGapCut && input.readySoonGapCut >= input.developingGapCut)) {
    return { error: "Tier cutoffs must be descending: Ready Now ≥ Ready Soon ≥ Developing." };
  }
  if (!(Number.isFinite(input.coverageMinPct) && input.coverageMinPct >= 0 && input.coverageMinPct <= 1)) {
    return { error: "Coverage minimum must be between 0 and 1." };
  }
  if (!(Number.isInteger(input.minOthersPerCompetency) && input.minOthersPerCompetency >= 1)) {
    return { error: "Minimum Others per competency must be a whole number ≥ 1." };
  }
  if (!TIERS.includes(input.knockoutCapTier)) return { error: "Invalid knockout cap tier." };
  if (!["high", "medium", "low"].includes(input.knockoutPriority)) return { error: "Invalid knockout priority." };
  for (const k of ["ready_now", "ready_soon", "developing", "not_ready"] as const) {
    if (!input.yearMap?.[k]?.trim()) return { error: "Every year-layer label must be filled in." };
  }

  const sb = createServiceClient();
  const patch = {
    ready_now_gap_cut: input.readyNowGapCut,
    ready_soon_gap_cut: input.readySoonGapCut,
    developing_gap_cut: input.developingGapCut,
    knockout_enabled: input.knockoutEnabled,
    knockout_priority: input.knockoutPriority,
    knockout_gap: input.knockoutGap,
    knockout_cap_tier: input.knockoutCapTier,
    use_weights: input.useWeights,
    min_others_per_competency: Math.round(input.minOthersPerCompetency),
    coverage_min_pct: input.coverageMinPct,
    year_layer_enabled: input.yearLayerEnabled,
    year_map: {
      ready_now: input.yearMap.ready_now.trim(),
      ready_soon: input.yearMap.ready_soon.trim(),
      developing: input.yearMap.developing.trim(),
      not_ready: input.yearMap.not_ready.trim(),
    },
    // Real admin in prod; dev caller has a non-persisted stub uid, so null it.
    updated_by: caller.isDev ? null : caller.uid,
  };

  const { error } = await sb
    .from("readiness_index_config")
    .update(patch)
    .is("organization_id", null);
  if (error) return { error: error.message || "Could not save (apply migration 00087)." };

  revalidatePath("/admin/readiness/config");
  return { ok: true };
}
