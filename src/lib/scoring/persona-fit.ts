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

/**
 * A short, defensible narrative interpreting a self-rating for one competency.
 * Deterministic (derived from the actual self-rating + role target, not AI), so
 * it is safe for a hiring report. For HIRING, pass the role target to interpret
 * the score relative to it; otherwise it gives a band read. Self-report framing
 * throughout - it describes what the candidate's answers suggest, to corroborate.
 */
export function competencyNarrative(self: number, target?: number | null, lang: "en" | "ar" = "en"): string {
  const s = self.toFixed(1);
  const ar = lang === "ar";
  if (target != null) {
    const t = target.toFixed(1);
    const gap = target - self;
    if (gap <= 0)
      return ar
        ? `يقيّم نفسه عند المستهدف أو أعلى (${s} مقابل ${t}) - قوة محتملة للاستثمار فيها.`
        : `Self-rates at or above the role target (${s} vs ${t}) - a likely strength to leverage.`;
    if (gap <= 0.5)
      return ar
        ? `يقيّم نفسه أقل قليلاً من المستهدف (${s} مقابل ${t}) - يلبّي المتطلب عمومًا مع هامش تطوير بسيط.`
        : `Self-rates just below the role target (${s} vs ${t}) - broadly meets the requirement, with minor development upside.`;
    if (gap <= 1.5)
      return ar
        ? `يقيّم نفسه أقل من المستهدف (${s} مقابل ${t}) - مجال تطوير لهذا الدور؛ استقصِ بأمثلة محددة في المقابلة.`
        : `Self-rates below the role target (${s} vs ${t}) - a development area for this role; probe with concrete examples at interview.`;
    return ar
      ? `يقيّم نفسه أقل بكثير من المستهدف (${s} مقابل ${t}) - فجوة ذات أولوية لهذا الدور؛ وازن بعناية وتحقّق في المقابلة.`
      : `Self-rates well below the role target (${s} vs ${t}) - a priority gap for this role; weigh carefully and corroborate at interview.`;
  }
  if (self >= 4) return ar ? `قوة ذاتية (${s}/5) - مُطبّقة باتساق وفق التقييم الذاتي.` : `A self-assessed strength (${s}/5) - reported as applied consistently.`;
  if (self >= 3) return ar ? `كفاءة ذاتية (${s}/5) - جيدة مع مجال للتعميق.` : `Self-assessed as competent (${s}/5) - solid, with room to deepen.`;
  return ar ? `قيد التطوير (${s}/5) - مجال نمو محتمل.` : `Self-assessed as developing (${s}/5) - a likely growth area.`;
}

/**
 * A growth-framed narrative for a DEVELOPMENT report (deterministic fallback for
 * when AI insights aren't available). Describes the self-rating relative to the
 * role target as a development opportunity - forward-looking, never a verdict.
 */
export function developmentNarrative(self: number, target?: number | null, lang: "en" | "ar" = "en"): string {
  const s = self.toFixed(1);
  const ar = lang === "ar";
  if (target != null) {
    const t = target.toFixed(1);
    const gap = target - self;
    if (gap <= 0)
      return ar
        ? `قوة ذاتية لهذا الدور (${s} مقابل المستهدف ${t}) - حافظ عليها ووظّفها في إرشاد الآخرين.`
        : `A self-assessed strength for this role (${s} vs target ${t}) - keep it sharp and use it to coach others.`;
    if (gap <= 0.5)
      return ar
        ? `قريب من مستهدف الدور (${s} مقابل ${t}) - ممارسة مركّزة ستغلق الفجوة المتبقّية سريعًا.`
        : `Close to the role target (${s} vs ${t}) - focused practice will close the remaining gap quickly.`;
    if (gap <= 1.5)
      return ar
        ? `مجال نمو واضح لهذا الدور (${s} مقابل ${t}) - مرشّح قوي لتدريب موجّه ومهام تطويرية.`
        : `A clear growth area for this role (${s} vs ${t}) - a strong candidate for targeted training plus on-the-job stretch.`;
    return ar
      ? `مجال نمو ذو أولوية لهذا الدور (${s} مقابل ${t}) - ابنِ الأساسيات بتعلّم منظّم ثم طبّق بوعي.`
      : `A priority growth area for this role (${s} vs ${t}) - build the foundations with structured learning, then apply deliberately.`;
  }
  if (self >= 4) return ar ? `قوة ذاتية (${s}/5) - وظّفها وتوسّع نحو تطبيقات أصعب.` : `A self-assessed strength (${s}/5) - leverage it and stretch into harder applications.`;
  if (self >= 3) return ar ? `كفاءة ذاتية (${s}/5) - عمّقها بممارسة مركّزة نحو الإتقان.` : `Self-assessed as competent (${s}/5) - deepen with focused practice toward mastery.`;
  return ar ? `مجال قيد التطوير (${s}/5) - مرشّح قوي للتعلّم المنظّم.` : `A developing area (${s}/5) - a strong candidate for structured learning.`;
}

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
