import { createServiceClient } from "@/lib/supabase/server";

// ── Functions — the job-level unit of technical assessment ───────────────────
//
// Technical competency is role/function-specific, not department-wide: the AR
// team shares one body of knowledge; a Finance division (AP + AR + audit +
// treasury) does not. So the assessable unit is the FUNCTION (Accounts Payable,
// Treasury, Internal Audit…), defined as a blueprint of the technical skills the
// function requires. A function assessment draws items across those skills (deep
// + per-skill), replacing the old "pick a broad domain → 8 generic Qs".
//
// Functions come from a curated standard library (source='standard') or are
// derived from an imported job description (source='jd'). This loader reads the
// bilingual technical_functions table (migration 00058) via the service client
// (the runner is public; the table is RLS auth-only), and falls back to the
// code-side STANDARD_FUNCTIONS so the runner still works before 00058 lands.

export type TechFunctionSource = "standard" | "jd";

export type StandardFunction = {
  key: string;
  name_en: string;
  name_ar: string;
  category: string;
  skills_en: string[];
  skills_ar: string[];
};

/** Canonical fallback — mirrors the 00058 seed exactly (12 standard finance functions). */
export const STANDARD_FUNCTIONS: StandardFunction[] = [
  {
    key: "accounts_payable",
    name_en: "Accounts Payable",
    name_ar: "الحسابات الدائنة (المدفوعات)",
    category: "accounting",
    skills_en: ["Invoice Processing & 3-Way Match", "Vendor Reconciliation", "Payment Runs & Controls", "Expense & T&E Processing", "Accruals & AP Ledger", "VAT & Withholding on Payables"],
    skills_ar: ["معالجة الفواتير والمطابقة الثلاثية", "تسوية حسابات المورّدين", "دفعات السداد والضوابط", "معالجة المصروفات والسفر", "الاستحقاقات ودفتر الدائنين", "ضريبة القيمة المضافة والاستقطاع على المدفوعات"],
  },
  {
    key: "accounts_receivable",
    name_en: "Accounts Receivable",
    name_ar: "الحسابات المدينة (المقبوضات)",
    category: "accounting",
    skills_en: ["Billing & Invoicing", "Cash Application", "Credit Assessment & Limits", "Collections & Aging", "Bad-Debt Provisioning", "DSO Analytics"],
    skills_ar: ["إصدار الفواتير", "تخصيص المقبوضات", "تقييم الائتمان والحدود", "التحصيل وأعمار الذمم", "مخصصات الديون المعدومة", "تحليل فترة التحصيل (DSO)"],
  },
  {
    key: "general_ledger",
    name_en: "General Ledger",
    name_ar: "الأستاذ العام",
    category: "accounting",
    skills_en: ["Double-Entry & Journals", "Month-End Close & Reconciliations", "Accruals, Prepayments & Provisions", "Intercompany Accounting", "Chart of Accounts Control", "IFRS Fundamentals"],
    skills_ar: ["القيد المزدوج واليوميات", "إقفال نهاية الشهر والتسويات", "الاستحقاقات والمصروفات المدفوعة مقدمًا والمخصصات", "محاسبة الشركات الشقيقة", "ضبط دليل الحسابات", "أساسيات المعايير الدولية (IFRS)"],
  },
  {
    key: "financial_reporting",
    name_en: "Financial Reporting & Consolidation",
    name_ar: "التقارير المالية والتوحيد",
    category: "reporting",
    skills_en: ["IFRS Application & Disclosures", "Consolidation & Eliminations", "FX Translation", "Statutory & Regulatory Reporting", "Narrative & ESG Reporting", "Reporting Controls"],
    skills_ar: ["تطبيق المعايير الدولية والإفصاحات", "التوحيد والاستبعادات", "ترجمة العملات الأجنبية", "التقارير النظامية والرقابية", "التقارير السردية وتقارير الاستدامة (ESG)", "ضوابط إعداد التقارير"],
  },
  {
    key: "management_accounting",
    name_en: "Management Accounting",
    name_ar: "المحاسبة الإدارية",
    category: "accounting",
    skills_en: ["Costing Methods (Standard/ABC/Marginal)", "Variance Analysis", "Budgeting Support", "Profitability & Contribution Analysis", "Cost Allocation", "Management Reporting"],
    skills_ar: ["طرق التكاليف (المعيارية/على الأنشطة/الحدية)", "تحليل الانحرافات", "دعم إعداد الموازنات", "تحليل الربحية والمساهمة", "توزيع التكاليف", "التقارير الإدارية"],
  },
  {
    key: "treasury",
    name_en: "Treasury",
    name_ar: "الخزينة",
    category: "treasury",
    skills_en: ["Cash & Liquidity Management", "FX Risk Management", "Interest-Rate Risk", "Funding & Capital Markets", "Bank Relationship Management", "Cash Forecasting"],
    skills_ar: ["إدارة النقد والسيولة", "إدارة مخاطر الصرف الأجنبي", "مخاطر أسعار الفائدة", "التمويل وأسواق المال", "إدارة العلاقات المصرفية", "التنبؤ بالتدفقات النقدية"],
  },
  {
    key: "fpa",
    name_en: "Financial Planning & Analysis",
    name_ar: "التخطيط والتحليل المالي",
    category: "fpa",
    skills_en: ["Budgeting & Rolling Forecasts", "Driver & Variance Analysis", "Financial Modelling", "Scenario & Sensitivity Analysis", "KPI & Dashboarding", "Business-Partnering Analytics"],
    skills_ar: ["إعداد الموازنات والتنبؤات المتجددة", "تحليل المحركات والانحرافات", "النمذجة المالية", "تحليل السيناريوهات والحساسية", "مؤشرات الأداء ولوحات المعلومات", "تحليلات الشراكة مع الأعمال"],
  },
  {
    key: "tax",
    name_en: "Tax",
    name_ar: "الضرائب",
    category: "tax",
    skills_en: ["Corporate Income Tax", "VAT & Indirect Tax", "Withholding Tax", "Transfer Pricing", "Deferred Tax & Provisioning", "GCC Specifics (Zakat, E-Invoicing)"],
    skills_ar: ["ضريبة دخل الشركات", "ضريبة القيمة المضافة والضرائب غير المباشرة", "ضريبة الاستقطاع", "تسعير المعاملات بين الشركات", "الضريبة المؤجلة والمخصصات", "خصوصيات الخليج (الزكاة، الفوترة الإلكترونية)"],
  },
  {
    key: "internal_audit",
    name_en: "Internal Audit & Controls",
    name_ar: "التدقيق الداخلي والضوابط",
    category: "audit",
    skills_en: ["Risk-Based Audit Planning", "Internal Controls (COSO)", "Walkthroughs & Testing", "Fraud Risk", "Audit Reporting & Follow-up", "Audit Analytics"],
    skills_ar: ["تخطيط التدقيق القائم على المخاطر", "الضوابط الداخلية (COSO)", "اختبارات السير والفحص", "مخاطر الاحتيال", "تقارير التدقيق والمتابعة", "تحليلات التدقيق"],
  },
  {
    key: "external_audit",
    name_en: "External / Statutory Audit",
    name_ar: "التدقيق الخارجي / القانوني",
    category: "audit",
    skills_en: ["Auditing Standards (ISA)", "Materiality & Sampling", "Controls vs Substantive Testing", "Audit Evidence & Documentation", "Going Concern & Opinion", "IFRS Audit Considerations"],
    skills_ar: ["معايير التدقيق الدولية (ISA)", "الأهمية النسبية والعينات", "اختبارات الضوابط مقابل الاختبارات الأساسية", "أدلة التدقيق والتوثيق", "الاستمرارية وإبداء الرأي", "اعتبارات تدقيق المعايير الدولية"],
  },
  {
    key: "payroll",
    name_en: "Payroll",
    name_ar: "الرواتب",
    category: "accounting",
    skills_en: ["Payroll Processing & Controls", "Statutory Deductions (GOSI/WPS)", "End-of-Service & Benefits", "Payroll Reconciliation", "Time & Attendance Integration"],
    skills_ar: ["معالجة الرواتب والضوابط", "الاستقطاعات النظامية (التأمينات/حماية الأجور)", "نهاية الخدمة والمزايا", "تسوية الرواتب", "تكامل الوقت والحضور"],
  },
  {
    key: "fixed_assets",
    name_en: "Fixed Assets",
    name_ar: "الأصول الثابتة",
    category: "accounting",
    skills_en: ["Capitalization & Componentization", "Depreciation Methods", "Impairment (IAS 36)", "Asset Register & Verification", "Disposals & Revaluation"],
    skills_ar: ["الرسملة وتجزئة المكوّنات", "طرق الإهلاك", "انخفاض القيمة (IAS 36)", "سجل الأصول والجرد", "الاستبعادات وإعادة التقييم"],
  },
];

/** The function categories (used by the JD-import picker + grouping). */
export const TECH_FUNCTION_CATEGORIES = ["accounting", "reporting", "treasury", "fpa", "tax", "audit"] as const;
export type TechFunctionCategory = (typeof TECH_FUNCTION_CATEGORIES)[number];

/** Category display labels (for grouping functions in the picker). */
const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  accounting: { en: "Accounting", ar: "المحاسبة" },
  reporting: { en: "Reporting", ar: "التقارير" },
  treasury: { en: "Treasury", ar: "الخزينة" },
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

/** A function localized for the runner: display name + localized + canonical skills. */
export type LocalizedTechFunction = {
  /** Stable handle for the runner: the function `key` (standard) or `id` (custom JD). */
  ref: string;
  id: string | null;
  key: string | null;
  name: string; // localized
  nameEn: string;
  category: string | null;
  categoryLabel: string; // localized
  /** Canonical English skill names — the tag/grading axis (never localized). */
  skillsEn: string[];
  /** Localized skill labels, index-aligned with skillsEn. */
  skills: string[];
  source: TechFunctionSource;
};

type FunctionRow = {
  id: string;
  key: string | null;
  name_en: string;
  name_ar: string | null;
  category: string | null;
  skills_en: string[] | null;
  skills_ar: string[] | null;
  source: string | null;
};

function localizeStandard(f: StandardFunction, locale: "en" | "ar"): LocalizedTechFunction {
  return {
    ref: f.key,
    id: null,
    key: f.key,
    name: locale === "ar" ? f.name_ar || f.name_en : f.name_en,
    nameEn: f.name_en,
    category: f.category,
    categoryLabel: categoryLabel(f.category, locale),
    skillsEn: [...f.skills_en],
    skills: locale === "ar" ? f.skills_ar.map((s, i) => s || f.skills_en[i]) : [...f.skills_en],
    source: "standard",
  };
}

function localizeRow(r: FunctionRow, locale: "en" | "ar"): LocalizedTechFunction {
  const skillsEn = r.skills_en ?? [];
  const skillsAr = r.skills_ar ?? [];
  return {
    ref: r.key ?? r.id,
    id: r.id,
    key: r.key,
    name: locale === "ar" ? r.name_ar || r.name_en : r.name_en,
    nameEn: r.name_en,
    category: r.category,
    categoryLabel: categoryLabel(r.category, locale),
    skillsEn,
    skills: locale === "ar" ? skillsEn.map((s, i) => skillsAr[i] || s) : skillsEn,
    source: r.source === "jd" ? "jd" : "standard",
  };
}

/**
 * All active functions, localized. Reads technical_functions via the service
 * client; falls back to STANDARD_FUNCTIONS if the table is absent or empty (so
 * the runner works before 00058 is applied).
 */
export async function listTechnicalFunctions(locale: "en" | "ar"): Promise<LocalizedTechFunction[]> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("technical_functions")
      .select("id, key, name_en, name_ar, category, skills_en, skills_ar, source")
      .eq("status", "active")
      .order("category")
      .order("name_en");
    if (error || !data || data.length === 0) {
      return STANDARD_FUNCTIONS.map((f) => localizeStandard(f, locale));
    }
    return (data as FunctionRow[]).map((r) => localizeRow(r, locale));
  } catch {
    return STANDARD_FUNCTIONS.map((f) => localizeStandard(f, locale));
  }
}

/**
 * One function by its runner ref (a standard `key` or a custom `id`), localized.
 * Falls back to the code-side standard library on table/lookup miss.
 */
export async function getTechnicalFunctionByRef(
  ref: string,
  locale: "en" | "ar"
): Promise<LocalizedTechFunction | null> {
  const fallback = () => {
    const f = STANDARD_FUNCTIONS.find((x) => x.key === ref);
    return f ? localizeStandard(f, locale) : null;
  };
  try {
    const sb = createServiceClient();
    // ref may be a standard key or a uuid id — try key first, then id.
    let row: FunctionRow | null = null;
    const byKey = await sb
      .from("technical_functions")
      .select("id, key, name_en, name_ar, category, skills_en, skills_ar, source")
      .eq("key", ref)
      .maybeSingle();
    if (byKey.data) {
      row = byKey.data as FunctionRow;
    } else if (/^[0-9a-fA-F-]{36}$/.test(ref)) {
      const byId = await sb
        .from("technical_functions")
        .select("id, key, name_en, name_ar, category, skills_en, skills_ar, source")
        .eq("id", ref)
        .maybeSingle();
      if (byId.data) row = byId.data as FunctionRow;
    }
    if (!row) return fallback();
    return localizeRow(row, locale);
  } catch {
    return fallback();
  }
}

/** English skill name → localized label, for per-skill result/item rendering. */
export function functionSkillLabels(fn: LocalizedTechFunction): Record<string, string> {
  const map: Record<string, string> = {};
  fn.skillsEn.forEach((en, i) => {
    map[en] = fn.skills[i] ?? en;
  });
  return map;
}

/** Distinct English skill names across the given functions — the reuse menu the
 *  JD extractor matches against (so a custom function reuses existing skills). */
export function skillLibraryFrom(functions: LocalizedTechFunction[]): string[] {
  const set = new Set<string>();
  for (const f of functions) for (const s of f.skillsEn) set.add(s);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
