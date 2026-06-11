// Technical-function COMPETENCY taxonomy — pure constants + helpers, with NO
// server imports. This lives apart from technical-function.ts (which pulls in
// the Supabase service client → next/headers) so CLIENT components — the runner
// picker and the admin functions library — can import categoryRank / labels
// without dragging server-only code into the browser bundle.

// The competency a function belongs to — the top-level grouping the runner shows
// ("Select a competency"), with the functions listed underneath. Order here is
// the display order in the picker.
export const TECH_FUNCTION_CATEGORIES = [
  "finance",
  "accounting",
  "banking",
  "investment",
  "treasury",
  "analytics",
  "business_intelligence",
  "artificial_intelligence",
  "human_resources",
] as const;
export type TechFunctionCategory = (typeof TECH_FUNCTION_CATEGORIES)[number];

/** Competency display order for the grouped pickers (the "select a competency" list). */
export const CATEGORY_ORDER: readonly string[] = TECH_FUNCTION_CATEGORIES;

/** Rank a category by CATEGORY_ORDER; unknown/legacy categories sort last. */
export function categoryRank(category: string | null): number {
  const i = CATEGORY_ORDER.indexOf(category ?? "");
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** Category (competency) display labels for grouping functions in the picker. */
const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  finance: { en: "Finance", ar: "المالية" },
  accounting: { en: "Accounting", ar: "المحاسبة" },
  banking: { en: "Banking", ar: "الأعمال المصرفية" },
  investment: { en: "Investment", ar: "الاستثمار" },
  treasury: { en: "Treasury", ar: "الخزينة" },
  analytics: { en: "Data Analytics", ar: "تحليلات البيانات" },
  business_intelligence: { en: "Business Intelligence", ar: "ذكاء الأعمال" },
  artificial_intelligence: { en: "Artificial Intelligence", ar: "الذكاء الاصطناعي" },
  human_resources: { en: "Human Resources", ar: "الموارد البشرية" },
  // Legacy categories — kept so any pre-existing JD-derived functions still label.
  reporting: { en: "Reporting", ar: "التقارير" },
  fpa: { en: "FP&A", ar: "التخطيط والتحليل المالي" },
  tax: { en: "Tax", ar: "الضرائب" },
  audit: { en: "Audit", ar: "التدقيق" },
};

export function categoryLabel(category: string | null, locale: "en" | "ar"): string {
  if (!category) return locale === "ar" ? "أخرى" : "Other";
  const m = CATEGORY_LABELS[category];
  if (!m) return category;
  return locale === "ar" ? m.ar : m.en;
}
