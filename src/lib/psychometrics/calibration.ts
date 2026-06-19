// VIFM Psychometrics Tier 2 - calibration math (pure, dependency-free).
//
// The Tier-1 → Tier-2 substrate: internal-consistency reliability (Cronbach's α),
// norm-referencing (raw → z → percentile → sten against a norm group), and the
// honest gate that decides whether an instrument is still INDICATIVE (Tier 1) or
// CALIBRATED (Tier 2). None of this runs until pilot/norm data exists - with no
// norms, results stay exactly Tier-1 indicative.

import type { PsyResult, ScaleScore } from "./scoring";

// ── Standard normal CDF (Zelen & Severo, A&S 26.2.17; |err| < 7.5e-8) ──
function normalCdf(z: number): number {
  const b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
  const p = 0.2316419, c = 0.39894228;
  const az = Math.abs(z);
  const t = 1 / (1 + p * az);
  const tail = c * Math.exp((-az * az) / 2) * t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
  return z >= 0 ? 1 - tail : tail; // P(Z ≤ z)
}

function variance(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / n;
}

/** A norm group's raw-score distribution for one scale. */
export type ScaleNorm = { mean: number; sd: number; n: number };

/** Raw score → standardized position within the norm group. */
export function standardize(raw: number, norm: ScaleNorm): { z: number; percentile: number; sten: number } {
  const z = (raw - norm.mean) / norm.sd;
  return {
    z: Math.round(z * 100) / 100,
    percentile: Math.max(0.1, Math.min(99.9, Math.round(normalCdf(z) * 1000) / 10)),
    sten: Math.max(1, Math.min(10, Math.round(z * 2 + 5.5))), // sten: mean 5.5, sd 2
  };
}

/**
 * Cronbach's α from a respondent × item matrix of SCORED responses (reverse-keying
 * already applied; same item order per row). Returns 0 with too little data.
 */
export function cronbachAlpha(responsesByRespondent: number[][]): number {
  const N = responsesByRespondent.length;
  const k = responsesByRespondent[0]?.length ?? 0;
  if (N < 2 || k < 2) return 0;
  let sumItemVar = 0;
  for (let i = 0; i < k; i++) sumItemVar += variance(responsesByRespondent.map((r) => r[i]));
  const totalVar = variance(responsesByRespondent.map((r) => r.reduce((a, b) => a + b, 0)));
  if (totalVar <= 0) return 0;
  return Math.round((k / (k - 1)) * (1 - sumItemVar / totalVar) * 1000) / 1000;
}

// ── Tier gate ─────────────────────────────────────────────────────
export type PsyTier = "indicative" | "calibrated";

/** Defensibility thresholds for the Tier-1 → Tier-2 promotion. */
export const PSY_TIER = {
  minApprovedPerScale: 8, // SME-approved items per scale (content)
  minAlpha: 0.7,          // acceptable internal consistency
  minNormN: 200,          // minimum norm sample for percentile claims
} as const;

/** Admin-facing gate: is the instrument fully calibrated (content + reliability + norms)? */
export function instrumentTier(ev: { approvedPerScale: number; minAlpha: number; normN: number }): PsyTier {
  return ev.approvedPerScale >= PSY_TIER.minApprovedPerScale &&
    ev.minAlpha >= PSY_TIER.minAlpha &&
    ev.normN >= PSY_TIER.minNormN
    ? "calibrated"
    : "indicative";
}

/**
 * Norm-reference a computed result. A norm is only APPLIED when its sample clears
 * the minimum (PSY_TIER.minNormN) - sub-threshold pilot norms are ignored, so
 * they can accumulate in psy_norms without ever leaking premature percentiles to
 * a taker. A scale with an adequate norm gets z + percentile + norm-referenced
 * sten; the result is `calibrated` only when EVERY scale (and g, if present) is
 * adequately normed. With no adequate norms the result is unchanged (Tier 1).
 */
export function applyNorms(result: PsyResult, norms: Record<string, ScaleNorm>): PsyResult {
  const adequate = (norm: ScaleNorm | undefined): norm is ScaleNorm => !!norm && norm.n >= PSY_TIER.minNormN;
  let applied = 0;
  let needed = result.scales.length;

  const scales = result.scales.map((s): ScaleScore => {
    const norm = norms[s.key];
    if (!adequate(norm)) return s;
    applied += 1;
    const { z, percentile, sten } = standardize(s.raw, norm);
    return { ...s, z, percentile, sten };
  });

  let overall = result.overall;
  if (overall) {
    needed += 1;
    if (adequate(norms.g)) {
      applied += 1;
      overall = { ...overall, percentile: standardize(overall.normalized, norms.g).percentile };
    }
  }

  if (applied === 0) return result;
  return { ...result, scales, overall, tier: applied >= needed ? "calibrated" : "indicative" };
}
