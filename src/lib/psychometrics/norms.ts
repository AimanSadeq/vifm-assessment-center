// VIFM Psychometrics - pilot norm-group computation. Reads the distribution of
// completed results for an instrument and writes per-scale {n, mean, sd} into
// psy_norms (migration 00067), so raw scores can be standardized to percentiles.
//
// These are PILOT norms - provisional, computed from whatever has accumulated.
// applyNorms() ignores a scale's norm until n ≥ PSY_TIER.minNormN, so pilot norms
// never leak premature percentiles to takers; they simply accumulate until the
// sample is adequate. Validated norms still need a representative sample + a
// psychometrician's sign-off (the non-code science). Service-role; server-only.

import { createServiceClient } from "@/lib/supabase/server";
import { COGNITIVE_SUBTEST_KEYS } from "./framework";
import type { PsyKind } from "./bank";

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export type NormSummary = { scaleKey: string; n: number; mean: number; sd: number };
export type ComputeNormsResult =
  | { ok: true; norms: NormSummary[] }
  | { ok: false; error: string };

/**
 * Compute pilot norms for the cognitive instrument from `psy_results`. Per-scale
 * mean is the average raw score (% correct), SD is the sample SD (n−1). Cognitive
 * also norms the `g` composite from overall.normalized.
 * A scale is skipped when n < 2 or SD = 0 (no spread). Upserts on (kind, scale_key).
 */
export async function computePilotNorms(kind: PsyKind): Promise<ComputeNormsResult> {
  const svc = createServiceClient();
  const { data, error } = await svc.from("psy_results").select("scales, overall").eq("kind", kind);
  if (error) return { ok: false, error: error.message };

  const byKey = new Map<string, number[]>();
  for (const row of (data ?? []) as { scales: unknown; overall: unknown }[]) {
    const scales = Array.isArray(row.scales) ? row.scales : [];
    const subtestKeys = new Set<string>();
    for (const s of scales as { key?: unknown; raw?: unknown }[]) {
      if (typeof s?.key === "string" && typeof s?.raw === "number") {
        const arr = byKey.get(s.key) ?? [];
        arr.push(s.raw);
        byKey.set(s.key, arr);
        subtestKeys.add(s.key);
      }
    }
    // g composite: pool ONLY full-battery sittings. A partial sitting (e.g. a
    // numerical-only voucher) has overall.normalized = that single subtest's %,
    // which is NOT a g across the four subtests; pooling it would bias the g norm.
    const isFullBattery = COGNITIVE_SUBTEST_KEYS.every((k) => subtestKeys.has(k));
    const overall = row.overall as { normalized?: unknown } | null;
    if (kind === "cognitive" && isFullBattery && overall && typeof overall.normalized === "number") {
      const arr = byKey.get("g") ?? [];
      arr.push(overall.normalized);
      byKey.set("g", arr);
    }
  }

  const norms: NormSummary[] = [];
  const upserts: Record<string, unknown>[] = [];
  const nowIso = new Date().toISOString();
  for (const [scaleKey, vals] of Array.from(byKey.entries())) {
    if (vals.length < 2) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
    if (!(sd > 0)) continue;
    const summary = { scaleKey, n: vals.length, mean: round3(mean), sd: round3(sd) };
    norms.push(summary);
    upserts.push({
      kind, scale_key: scaleKey, n: summary.n, mean: summary.mean, sd: summary.sd,
      source: `pilot (${summary.n} collected results)`, method: "parametric", computed_at: nowIso,
    });
  }

  if (!upserts.length) {
    return { ok: false, error: "Not enough completed results yet (need ≥2 per scale with spread)." };
  }
  const { error: upErr } = await svc.from("psy_norms").upsert(upserts, { onConflict: "kind,scale_key" });
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, norms };
}

/** Remove all norm rows for one instrument (reverts it to Tier-1 indicative). */
export async function clearNorms(kind: PsyKind): Promise<{ ok: boolean; error?: string }> {
  const svc = createServiceClient();
  const { error } = await svc.from("psy_norms").delete().eq("kind", kind);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
