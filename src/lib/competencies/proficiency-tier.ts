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

/**
 * SD-7 (ask c): a one-line capability MEANING per band, so the report legend
 * defines what Basic / Intermediate / Advanced actually mean, not just the
 * numeric thresholds. Single source of truth for the PDF + on-screen legend.
 */
export function proficiencyTierMeaning(tier: ProficiencyTier, locale: "en" | "ar"): string {
  const en: Record<ProficiencyTier, string> = {
    basic: "Foundational ability with significant room to develop - core concepts in place, application still building.",
    intermediate: "Solid, working proficiency with clear areas to strengthen - performs reliably on routine demands.",
    advanced: "Strong and consistent across the assessed areas - handles complex demands with little support.",
  };
  const ar: Record<ProficiencyTier, string> = {
    basic: "قدرة تأسيسية مع مجال واسع للتطوير - المفاهيم الأساسية موجودة والتطبيق قيد البناء.",
    intermediate: "إتقان عملي جيّد مع مجالات واضحة للتعزيز - أداء موثوق في المتطلبات الاعتيادية.",
    advanced: "قوي ومتسق عبر المجالات المقيّمة - يتعامل مع المتطلبات المعقدة بدعم محدود.",
  };
  return locale === "ar" ? ar[tier] : en[tier];
}
