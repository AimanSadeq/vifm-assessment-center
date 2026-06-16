// ─────────────────────────────────────────────────────────────
// Persona role-fit scoring (pure, no DB).
//
// For the HIRING purpose: compare a self-profile (per-competency 1-5) against a
// target role's required competencies (target proficiency + weight) and produce
// a single fit percentage + the biggest gaps. Self-report only - a screening
// signal, never an auto-decision (mirrors the Pre-Hire guardrail).
// ─────────────────────────────────────────────────────────────

export type RoleCompReq = {
  competencyId: string;
  name: string;
  target: number;   // 1-5 target proficiency for this role
  weight: number;   // relative importance (>0)
};

export type FitGap = {
  competencyId: string;
  name: string;
  target: number;
  self: number | null;  // null = not covered by the assessment
  gap: number;          // max(0, target - self); 0 when met or unmeasured
  weight: number;
};

export type FitBandKey = "strong" | "moderate" | "limited";
export type FitResult = {
  fitPct: number;            // 0-100 weighted match
  band: FitBandKey;
  bandLabel: string;
  bandLabelAr: string;
  gaps: FitGap[];            // sorted: biggest weighted gap first
  measuredCount: number;     // role comps with a self score
  totalCount: number;        // role comps total
};

export function fitBand(pct: number): { key: FitBandKey; label: string; labelAr: string } {
  if (pct >= 80) return { key: "strong", label: "Strong fit", labelAr: "ملاءمة قوية" };
  if (pct >= 60) return { key: "moderate", label: "Moderate fit", labelAr: "ملاءمة متوسطة" };
  return { key: "limited", label: "Limited fit", labelAr: "ملاءمة محدودة" };
}

export const FIT_BAND_TW: Record<FitBandKey, string> = {
  strong: "bg-emerald-100 text-emerald-800",
  moderate: "bg-amber-100 text-amber-800",
  limited: "bg-rose-100 text-rose-800",
};
export const FIT_BAND_HEX: Record<FitBandKey, string> = {
  strong: "#059669",
  moderate: "#D97706",
  limited: "#E11D48",
};

/**
 * Weighted match: each role competency contributes clamp(self/target, 0..1).
 * Unmeasured competencies count as a zero contribution against their weight
 * (a conservative read - the role asks for it, we have no signal).
 */
export function computeFit(
  selfByCompetency: Map<string, number>,
  roleComps: RoleCompReq[],
): FitResult | null {
  if (roleComps.length === 0) return null;
  let weightSum = 0;
  let matchSum = 0;
  let measured = 0;
  const gaps: FitGap[] = [];

  for (const rc of roleComps) {
    const w = rc.weight > 0 ? rc.weight : 1;
    const self = selfByCompetency.get(rc.competencyId);
    const target = rc.target > 0 ? rc.target : 3;
    weightSum += w;
    if (self != null) {
      measured += 1;
      const match = Math.max(0, Math.min(1, self / target));
      matchSum += w * match;
      gaps.push({ competencyId: rc.competencyId, name: rc.name, target, self, gap: Math.max(0, target - self), weight: w });
    } else {
      gaps.push({ competencyId: rc.competencyId, name: rc.name, target, self: null, gap: 0, weight: w });
    }
  }

  const fitPct = weightSum > 0 ? Math.round((matchSum / weightSum) * 100) : 0;
  const b = fitBand(fitPct);
  // Sort: biggest weighted gap first; unmeasured (self=null) sink to the bottom.
  gaps.sort((a, z) => {
    const ag = a.self == null ? -1 : a.gap * a.weight;
    const zg = z.self == null ? -1 : z.gap * z.weight;
    return zg - ag;
  });

  return {
    fitPct,
    band: b.key,
    bandLabel: b.label,
    bandLabelAr: b.labelAr,
    gaps,
    measuredCount: measured,
    totalCount: roleComps.length,
  };
}
