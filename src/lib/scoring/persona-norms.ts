// ─────────────────────────────────────────────────────────────
// Persona competency norms (item 11, Tier 2).
//
// Turns a raw 1-5 self-rating into a percentile against a named comparison
// group (migration 00127). Pure percentile math + a tolerant service-role
// loader. If no norm group is set or the tables are absent, the report omits
// percentiles silently (loaders return null / empty map).
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";

/** The norm group used when a sitting has no explicit norm_group_id. */
export const DEFAULT_NORM_GROUP_CODE = "gcc_all_2026";

export type NormGroup = {
  id: string;
  code: string;
  labelEn: string;
  labelAr: string | null;
  isProvisional: boolean;
};

export type CompetencyNorm = { mean: number; sd: number; n: number };

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 rational
 * approximation (max abs error ~7.5e-8). No new dependency.
 */
export function normalCdf(z: number): number {
  const k = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    k * (0.319381530 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  const approx = 1 - 0.3989422804014327 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? approx : 1 - approx;
}

/**
 * Percentile of `self` against a normal(mean, sd), clamped to 1..99 (a
 * self-report percentile of exactly 0 or 100 overstates precision). Returns
 * null when sd is not usable.
 */
export function percentile(self: number, mean: number, sd: number): number | null {
  if (!(sd > 0)) return null;
  const z = (self - mean) / sd;
  return Math.min(99, Math.max(1, Math.round(normalCdf(z) * 100)));
}

/** Resolve a norm group by id, else by the default code. Tolerant -> null. */
export async function resolveNormGroup(normGroupId?: string | null): Promise<NormGroup | null> {
  try {
    const sb = createServiceClient();
    let q = sb.from("persona_norm_groups").select("id, code, label_en, label_ar, is_provisional");
    q = normGroupId ? q.eq("id", normGroupId) : q.eq("code", DEFAULT_NORM_GROUP_CODE);
    const { data, error } = await q.maybeSingle<{
      id: string;
      code: string;
      label_en: string;
      label_ar: string | null;
      is_provisional: boolean;
    }>();
    if (error || !data) return null;
    return {
      id: data.id,
      code: data.code,
      labelEn: data.label_en,
      labelAr: data.label_ar,
      isProvisional: data.is_provisional,
    };
  } catch {
    return null;
  }
}

/** Per-competency norms for a group. Tolerant -> empty map (report omits pct). */
export async function loadNorms(normGroupId: string): Promise<Map<string, CompetencyNorm>> {
  const out = new Map<string, CompetencyNorm>();
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("persona_competency_norms")
      .select("competency_id, mean, sd, n")
      .eq("norm_group_id", normGroupId);
    if (error || !data) return out;
    for (const r of data) {
      out.set(r.competency_id as string, {
        mean: Number(r.mean),
        sd: Number(r.sd),
        n: Number(r.n),
      });
    }
    return out;
  } catch {
    return out;
  }
}
