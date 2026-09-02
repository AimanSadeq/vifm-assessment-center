import type { AraEngagementStage, AraPillarId } from "@/types/ara";
import { ARA_PILLARS } from "./ara-pillars";

/** Canonical set of the 8 pillar ids - used to validate a stored
 *  pillars_in_scope override so a stale/junk value can't slip through. */
const ARA_PILLAR_ID_SET: ReadonlySet<AraPillarId> = new Set(ARA_PILLARS.map((p) => p.id));

/**
 * Stage tiers for the AI Readiness Compass.
 *
 *   Stage 1 - Department  | complimentary | 4 pillars
 *   Stage 2 - Division    | fee-based     | 6 pillars
 *   Stage 3 - Enterprise  | fee-based     | 8 pillars (full)
 *   Personal              | self-served   | 4 individual factors (not pillars)
 *
 * Pillar applicability is defined here and consulted by the report
 * generator, the assessment detail page, and the seed script. Keep
 * this file as the single source of truth for what each stage covers.
 *
 * Note on Personal: it doesn't use the org-side pillar model - the
 * applicable_pillars array stays empty because the respondent flow
 * keys off individual_factor_id instead. The entry exists so the
 * Record<AraEngagementStage, ...> type is exhaustive.
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
  /**
   * Approximate length of the deliverable PDF report.
   *
   * Not a fixed number: it grows with the pillar set, the framework count and
   * the cohort size - NOT with the tier, which no longer withholds any
   * section. MEASURED on standard-scope runs, 2026-08-31 (Saudi / general,
   * cohort small enough that the roster fits the profile page):
   * Department 4 pillars = 21 pages, Division 6 = 23, Enterprise 8 = 25. A
   * Department run at custom 8-pillar scope with 40 respondents renders 26.
   * The old figures (8 / 27 / 27-60) were guesses and were far off.
   */
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
    // The first department is complimentary - it is the land; every further
    // unit is priced per unit assessed (client decision 2026-09-02).
    price_label_en: "First department complimentary",
    price_label_ar: "الإدارة الأولى مجاناً",
    cta_en: "Start complimentary",
    cta_ar: "ابدأ مجاناً",
    tone: "teal",
    applicable_pillars: ["data", "talent", "culture", "operations"],
    typical_respondents: "1-2",
    report_pages: "~21+",
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
    // Pricing model (client decision 2026-09-02): per unit assessed plus one
    // consolidation deliverable - a division is N departments + the
    // cross-unit consolidation, so the price follows what is actually done.
    price_label_en: "Per department assessed + consolidation",
    price_label_ar: "لكل إدارة مقيَّمة + التقرير الموحّد",
    cta_en: "Contact for engagement",
    cta_ar: "اتصل للتعاقد",
    tone: "violet",
    applicable_pillars: [
      "strategy", "data", "talent", "culture", "operations", "governance",
    ],
    typical_respondents: "4-8",
    report_pages: "~23+",
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
    // Same model one level up: every division's units, plus the organisation-
    // level consolidation.
    price_label_en: "Per unit assessed + consolidation",
    price_label_ar: "لكل وحدة مقيَّمة + التقرير الموحّد",
    cta_en: "Contact for engagement",
    cta_ar: "اتصل للتعاقد",
    tone: "gold",
    applicable_pillars: [
      "strategy", "data", "technology", "talent", "culture",
      "governance", "operations", "model_management",
    ],
    typical_respondents: "8-15+",
    report_pages: "~25+",
  },
  {
    id: "individual",
    number: 1,
    label_en: "Personal",
    label_ar: "شخصي",
    scope_en: "One person - self-assessment of AI behaviours",
    scope_ar: "شخص واحد - تقييم ذاتي لسلوكيات الذكاء الاصطناعي",
    tagline_en: "How AI-ready are you, personally?",
    tagline_ar: "ما مدى جاهزيتك الشخصية للذكاء الاصطناعي؟",
    is_pro_bono: true,
    price_label_en: "Complimentary",
    price_label_ar: "مجاني",
    cta_en: "Take the snapshot",
    cta_ar: "ابدأ اللقطة",
    tone: "teal",
    // Personal stage uses 4 individual factors instead of org pillars.
    // Empty array keeps any pillar-applicability check from over-counting.
    applicable_pillars: [],
    typical_respondents: "1",
    report_pages: "1",
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
 * Resolves the pillars in scope for a specific assessment.
 *
 * Honors `pillars_in_scope` (per-assessment override, migration 00029)
 * when present. Falls back to the stage default for legacy assessments
 * created before the column existed, or for stages where the choice is
 * fixed (Enterprise = always all 8). Always validates the stored array
 * against ARA_PILLAR_IDS so a stale or malformed value can't slip a
 * non-pillar string into the rendering.
 *
 * Use this everywhere the renderer / scorer / respondent loader needs
 * to know "which pillars matter for THIS assessment" - instead of
 * looking up ARA_STAGE_MAP[stage].applicable_pillars directly.
 */
export function getPillarsForAssessment(args: {
  engagement_stage: AraEngagementStage;
  pillars_in_scope: AraPillarId[] | null;
}): ReadonlyArray<AraPillarId> {
  const stageDefault = ARA_STAGE_MAP[args.engagement_stage].applicable_pillars;
  // Enterprise is always all 8 - ignore any stored override.
  if (args.engagement_stage === "enterprise") return stageDefault;
  if (!args.pillars_in_scope || args.pillars_in_scope.length === 0) return stageDefault;
  // Sanity-filter against the canonical pillar ids so a stale or malformed
  // value can't slip a junk string into the scorer / renderer.
  const valid = args.pillars_in_scope.filter((p) => ARA_PILLAR_ID_SET.has(p));
  return valid.length > 0 ? valid : stageDefault;
}

/**
 * Stage cardinality - how many pillars the consultant must select.
 * Enterprise is fixed at all 8 (no UI shown); Department and Division
 * use this number as the must-equal constraint on the picker.
 */
export const PILLAR_PICK_COUNT: Record<AraEngagementStage, number | null> = {
  department: 4,
  division: 6,
  enterprise: 8,
  individual: null, // n/a - individual stage doesn't use pillars
};

/**
 * Capability matrix for the public comparison page. Each row is one row
 * in the comparison table; each cell maps the stage id to whether the
 * capability is included. Order here is the visual order on the page.
 */
export const ARA_STAGE_CAPABILITIES: ReadonlyArray<{
  group: string;
  feature_en: string;
  feature_ar: string;
  individual: boolean | string;
  department: boolean | string;
  division: boolean | string;
  enterprise: boolean | string;
}> = [
  // ─────────────────────────────────────────────────────────────────────
  // KEEP THIS TABLE TRUE. It is the public comparison page, so every cell is
  // a commercial promise. It had drifted badly from the product (client review
  // 2026-08-31): it claimed Department reports had no Shadow AI alert, no
  // year-on-year, no use-case portfolio and only the "top 3" regulatory
  // frameworks, while the report shipped all four.
  //
  // The report now contains NO stage gates at all. Every section renders at
  // every tier; what still varies is gated by DATA (is there a prior
  // assessment, are there use cases, is the peer sample big enough) or by
  // SCOPE (how many pillars, how many respondents). The one thing a Department
  // engagement does not include is the Phase 2 consultant workshop, which is
  // consultant time rather than report content and is offered as a paid
  // addition.
  //
  // So: before setting any cell to false, point at the code that enforces it.
  // If nothing enforces it, the cell is true and the tiering has to be built
  // first.
  // ─────────────────────────────────────────────────────────────────────

  // Scope
  { group: "Scope", feature_en: "Pillars assessed", feature_ar: "الركائز المقيّمة",
    individual: "4 personal factors",
    // Standard scope is exactly the stage's pillar count; the wizard's
    // custom-scope toggle allows any set of 1+ pillars with a per-pillar
    // question budget. Enterprise always resolves to all 8.
    department: "4 of 8 · any set on custom scope",
    division: "6 of 8 · any set on custom scope",
    enterprise: "All 8" },
  { group: "Scope", feature_en: "Typical stakeholders", feature_ar: "المستجيبون النموذجيون",
    individual: "1", department: "1-2", division: "4-8", enterprise: "8-15+" },
  { group: "Scope", feature_en: "Bilingual EN / AR", feature_ar: "ثنائي اللغة",
    individual: true, department: true, division: true, enterprise: true },

  // Diagnostic
  { group: "Diagnostic", feature_en: "Layer 1 self-assessment questions", feature_ar: "أسئلة الطبقة الأولى",
    individual: true, department: true, division: true, enterprise: true },
  // The Phase 2 guide tab (and its Layer 2 items) is available on every org
  // assessment - no stage gate on the tab or the query.
  { group: "Diagnostic", feature_en: "Layer 2 consultant guide questions", feature_ar: "أسئلة الطبقة الثانية",
    individual: false, department: true, division: true, enterprise: true },
  { group: "Diagnostic", feature_en: "Supporting evidence upload", feature_ar: "رفع الأدلة الداعمة",
    individual: false, department: true, division: true, enterprise: true },
  // Portfolio tab is available at every org stage; the report section renders
  // whenever use cases have been logged, regardless of tier.
  { group: "Diagnostic", feature_en: "AI use-case portfolio review", feature_ar: "مراجعة محفظة حالات الاستخدام",
    individual: false, department: true, division: true, enterprise: true },

  // Validation
  { group: "Validation", feature_en: "Auto-scored maturity bands", feature_ar: "تصنيف نضج تلقائي",
    individual: true, department: true, division: true, enterprise: true },
  { group: "Validation", feature_en: "Phase 2 consultant validation workshop", feature_ar: "ورشة تحقق المستشار",
    individual: false, department: false, division: true, enterprise: true },
  { group: "Validation", feature_en: "Perception vs Reality analysis", feature_ar: "تحليل التصور مقابل الواقع",
    individual: false, department: false, division: true, enterprise: true },

  // Regulatory
  { group: "Regulatory", feature_en: "Regulatory framework mapping", feature_ar: "ربط الأطر التنظيمية",
    // No "top 3" limit exists in compliance.ts. A framework is scored when its
    // requirements touch a pillar in scope, so coverage scales with the pillar
    // set rather than with the tier. Measured on Saudi / general standard runs
    // (2026-08-31): Department 5 frameworks, Division 6, Enterprise 7.
    individual: false,
    department: "Frameworks touching your 4 pillars",
    division: "Frameworks touching your 6 pillars",
    enterprise: "All applicable + sectoral" },
  { group: "Regulatory", feature_en: "Shadow AI alert detection", feature_ar: "كشف تنبيهات الذكاء الاصطناعي الخفي",
    individual: false, department: true, division: true, enterprise: true },

  // Strategic outputs
  // Ungated 2026-08-31 (commercial decision): most demand is departmental, so
  // the Department deliverable IS the product and ships complete. Tiers now
  // differ by SCOPE - how many units are assessed and who answers - not by
  // which sections the client is allowed to see.
  { group: "Strategic outputs", feature_en: "Investment priority matrix", feature_ar: "مصفوفة أولويات الاستثمار",
    individual: false, department: true, division: true, enterprise: true },
  { group: "Strategic outputs", feature_en: "12-month action roadmap", feature_ar: "خارطة طريق ١٢ شهراً",
    individual: false, department: true, division: true, enterprise: true },
  // Rendered on every org report; the column fills in once enough comparable
  // engagements exist. It is a data threshold, not a tier.
  { group: "Strategic outputs", feature_en: "Peer benchmarks (sector medians)", feature_ar: "مقارنة بالنظراء",
    individual: false, department: "Once 3+ peers", division: "Once 3+ peers", enterprise: "Once 3+ peers" },
  // The section is always rendered so the contents stay stable run to run;
  // it shows a baseline message until a comparable prior assessment exists.
  { group: "Strategic outputs", feature_en: "Year-on-year reassessment", feature_ar: "إعادة التقييم السنوية",
    individual: false, department: true, division: true, enterprise: true },

  // Deliverable
  { group: "Deliverable", feature_en: "Branded PDF report", feature_ar: "تقرير PDF مع علامتنا",
    // Length = 13 fixed pages + one per in-scope pillar + compliance pages +
    // roster pages (+2 for the strategic outputs on Division/Enterprise), so
    // it grows with scope and cohort size rather than being a fixed number.
    individual: "1-page snapshot", department: "From ~19 pages", division: "From ~23 pages", enterprise: "From ~25 pages" },
  // ?language=bilingual is accepted for any org assessment - no stage check.
  { group: "Deliverable", feature_en: "Side-by-side bilingual landscape report", feature_ar: "تقرير ثنائي اللغة أفقي",
    individual: false, department: true, division: true, enterprise: true },
  { group: "Deliverable", feature_en: "Consultant report walkthrough", feature_ar: "جلسة عرض التقرير",
    individual: false, department: "Optional", division: true, enterprise: true },

  // Outputs unique to Personal
  { group: "Personal-only", feature_en: "VIFM training course recommendations", feature_ar: "توصيات دورات VIFM",
    individual: true, department: true, division: true, enterprise: true },
  { group: "Personal-only", feature_en: "Maturity-stage narrative (Emerging / Practising / Embedded)", feature_ar: "وصف مرحلة النضج",
    individual: true, department: false, division: false, enterprise: false },
];
