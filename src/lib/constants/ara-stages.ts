import type { AraEngagementStage, AraPillarId } from "@/types/ara";

/**
 * Three-stage product line for the AI Readiness Compass.
 *
 *   Stage 1 - Department  | complimentary | 4 pillars
 *   Stage 2 - Division    | fee-based     | 6 pillars
 *   Stage 3 - Enterprise  | fee-based     | 8 pillars (full)
 *
 * Pillar applicability is defined here and consulted by the report
 * generator, the assessment detail page, and the seed script. Keep
 * this file as the single source of truth for what each stage covers.
 */

export const ARA_STAGE_DEFINITIONS: ReadonlyArray<{
  id: AraEngagementStage;
  number: 1 | 2 | 3;
  label_en: string;
  label_ar: string;
  scope_en: string;
  scope_ar: string;
  tagline_en: string;
  tagline_ar: string;
  is_pro_bono: boolean;
  price_label_en: string;
  price_label_ar: string;
  cta_en: string;
  cta_ar: string;
  /** Color token name (matches ara-icon-* utilities in globals.css) */
  tone: "teal" | "violet" | "gold";
  /** Pillar ids active at this stage. Stages are cumulative. */
  applicable_pillars: ReadonlyArray<AraPillarId>;
  /** Typical stakeholder count - shown on the comparison page. */
  typical_respondents: string;
  /** Page count of the deliverable PDF report. */
  report_pages: string;
}> = [
  {
    id: "department",
    number: 1,
    label_en: "Department",
    label_ar: "إدارة",
    scope_en: "One department",
    scope_ar: "إدارة واحدة",
    tagline_en: "Where does your department stand on AI?",
    tagline_ar: "أين تقف إدارتك من الذكاء الاصطناعي؟",
    is_pro_bono: true,
    price_label_en: "Complimentary",
    price_label_ar: "مجاني",
    cta_en: "Start complimentary",
    cta_ar: "ابدأ مجاناً",
    tone: "teal",
    applicable_pillars: ["data", "talent", "culture", "operations"],
    typical_respondents: "1-2",
    report_pages: "8",
  },
  {
    id: "division",
    number: 2,
    label_en: "Division",
    label_ar: "قسم",
    scope_en: "A division spanning several departments",
    scope_ar: "قسم يضم عدة إدارات",
    tagline_en: "Where does your division stand on AI?",
    tagline_ar: "أين يقف قسمك من الذكاء الاصطناعي؟",
    is_pro_bono: false,
    price_label_en: "Fee-based engagement",
    price_label_ar: "خدمة مدفوعة",
    cta_en: "Contact for engagement",
    cta_ar: "اتصل للتعاقد",
    tone: "violet",
    applicable_pillars: [
      "strategy", "data", "talent", "culture", "operations", "governance",
    ],
    typical_respondents: "4-8",
    report_pages: "27",
  },
  {
    id: "enterprise",
    number: 3,
    label_en: "Enterprise",
    label_ar: "مؤسسة",
    scope_en: "The whole organisation, board-level",
    scope_ar: "المنظمة بأكملها، على مستوى مجلس الإدارة",
    tagline_en: "Where does the whole organisation stand on AI?",
    tagline_ar: "أين تقف المنظمة بأكملها من الذكاء الاصطناعي؟",
    is_pro_bono: false,
    price_label_en: "Fee-based engagement",
    price_label_ar: "خدمة مدفوعة",
    cta_en: "Contact for engagement",
    cta_ar: "اتصل للتعاقد",
    tone: "gold",
    applicable_pillars: [
      "strategy", "data", "technology", "talent", "culture",
      "governance", "operations", "model_management",
    ],
    typical_respondents: "8-15+",
    report_pages: "27-60",
  },
] as const;

export const ARA_STAGE_MAP: Readonly<
  Record<AraEngagementStage, (typeof ARA_STAGE_DEFINITIONS)[number]>
> = Object.fromEntries(ARA_STAGE_DEFINITIONS.map((s) => [s.id, s])) as Readonly<
  Record<AraEngagementStage, (typeof ARA_STAGE_DEFINITIONS)[number]>
>;

/**
 * Returns true when the pillar is in scope for the given engagement stage.
 * Used to filter the radar chart, pillar deep-dive pages, and aggregate
 * scoring so a Stage 1 client only sees the four pillars they were
 * actually assessed against.
 */
export function isPillarApplicableForStage(
  pillarId: AraPillarId,
  stage: AraEngagementStage
): boolean {
  return ARA_STAGE_MAP[stage].applicable_pillars.includes(pillarId);
}

/**
 * Capability matrix for the public comparison page. Each row is one row
 * in the comparison table; each cell maps the stage id to whether the
 * capability is included. Order here is the visual order on the page.
 */
export const ARA_STAGE_CAPABILITIES: ReadonlyArray<{
  group: string;
  feature_en: string;
  feature_ar: string;
  department: boolean | string;
  division: boolean | string;
  enterprise: boolean | string;
}> = [
  // Scope
  { group: "Scope", feature_en: "Pillars assessed", feature_ar: "الركائز المقيّمة",
    department: "4 of 8", division: "6 of 8", enterprise: "All 8" },
  { group: "Scope", feature_en: "Typical stakeholders", feature_ar: "المستجيبون النموذجيون",
    department: "1-2", division: "4-8", enterprise: "8-15+" },
  { group: "Scope", feature_en: "Bilingual EN / AR", feature_ar: "ثنائي اللغة",
    department: true, division: true, enterprise: true },

  // Diagnostic
  { group: "Diagnostic", feature_en: "Layer 1 self-assessment questions", feature_ar: "أسئلة الطبقة الأولى",
    department: true, division: true, enterprise: true },
  { group: "Diagnostic", feature_en: "Layer 2 consultant guide questions", feature_ar: "أسئلة الطبقة الثانية",
    department: false, division: true, enterprise: true },
  { group: "Diagnostic", feature_en: "Supporting evidence upload", feature_ar: "رفع الأدلة الداعمة",
    department: true, division: true, enterprise: true },
  { group: "Diagnostic", feature_en: "AI use-case portfolio review", feature_ar: "مراجعة محفظة حالات الاستخدام",
    department: false, division: true, enterprise: true },

  // Validation
  { group: "Validation", feature_en: "Auto-scored maturity bands", feature_ar: "تصنيف نضج تلقائي",
    department: true, division: true, enterprise: true },
  { group: "Validation", feature_en: "Phase 2 consultant validation workshop", feature_ar: "ورشة تحقق المستشار",
    department: false, division: true, enterprise: true },
  { group: "Validation", feature_en: "Perception vs Reality analysis", feature_ar: "تحليل التصور مقابل الواقع",
    department: false, division: true, enterprise: true },

  // Regulatory
  { group: "Regulatory", feature_en: "Regulatory framework mapping", feature_ar: "ربط الأطر التنظيمية",
    department: "Top 3 frameworks", division: "All applicable", enterprise: "All applicable + sectoral" },
  { group: "Regulatory", feature_en: "Shadow AI alert detection", feature_ar: "كشف تنبيهات الذكاء الاصطناعي الخفي",
    department: false, division: true, enterprise: true },

  // Strategic outputs
  { group: "Strategic outputs", feature_en: "Investment priority matrix", feature_ar: "مصفوفة أولويات الاستثمار",
    department: false, division: true, enterprise: true },
  { group: "Strategic outputs", feature_en: "12-month action roadmap", feature_ar: "خارطة طريق ١٢ شهراً",
    department: false, division: true, enterprise: true },
  { group: "Strategic outputs", feature_en: "Peer benchmarks (sector medians)", feature_ar: "مقارنة بالنظراء",
    department: false, division: false, enterprise: true },
  { group: "Strategic outputs", feature_en: "Year-on-year reassessment", feature_ar: "إعادة التقييم السنوية",
    department: false, division: false, enterprise: true },

  // Deliverable
  { group: "Deliverable", feature_en: "Branded PDF report", feature_ar: "تقرير PDF مع علامتنا",
    department: "8 pages", division: "27 pages", enterprise: "27-60 pages" },
  { group: "Deliverable", feature_en: "Side-by-side bilingual landscape report", feature_ar: "تقرير ثنائي اللغة أفقي",
    department: false, division: false, enterprise: true },
  { group: "Deliverable", feature_en: "Consultant report walkthrough", feature_ar: "جلسة عرض التقرير",
    department: "Optional", division: true, enterprise: true },
];
