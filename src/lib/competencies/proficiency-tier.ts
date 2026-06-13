/**
 * 3-band proficiency classifier for the technical assessment (P2.3).
 *
 * Thresholds (agreed): Basic < 60, Intermediate 60-84, Advanced >= 85.
 * This is a separate, additive layer over the existing 1-5 proficiency model
 * (which still drives cut-scores / credentials). Pure + server-free so both the
 * runner UI (Tailwind tone) and report generation (hex) can use it.
 */
export type ProficiencyTier = "basic" | "intermediate" | "advanced";

export type ProficiencyTierInfo = {
  tier: ProficiencyTier;
  label: string;
  /** Brand hex (no #) for PDFs / inline styles. */
  hex: string;
  /** Tailwind badge classes for the runner UI. */
  tone: string;
};

export const PROFICIENCY_TIER_THRESHOLDS = { advanced: 85, intermediate: 60 } as const;

export function proficiencyTier(pct: number): ProficiencyTierInfo {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  if (p >= PROFICIENCY_TIER_THRESHOLDS.advanced) {
    return { tier: "advanced", label: "Advanced", hex: "047857", tone: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  }
  if (p >= PROFICIENCY_TIER_THRESHOLDS.intermediate) {
    return { tier: "intermediate", label: "Intermediate", hex: "5391D5", tone: "bg-sky-100 text-sky-800 border-sky-300" };
  }
  return { tier: "basic", label: "Basic", hex: "C2410C", tone: "bg-amber-100 text-amber-800 border-amber-300" };
}

/** Localized tier label (EN/AR). */
export function proficiencyTierLabel(tier: ProficiencyTier, locale: "en" | "ar"): string {
  const ar: Record<ProficiencyTier, string> = { basic: "أساسي", intermediate: "متوسط", advanced: "متقدم" };
  const en: Record<ProficiencyTier, string> = { basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" };
  return locale === "ar" ? ar[tier] : en[tier];
}
