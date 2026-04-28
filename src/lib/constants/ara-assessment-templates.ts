import type { AraEngagementStage, AraPillarId, AraRegion, AraSector } from "@/types/ara";

/**
 * Pre-packaged assessment templates - the "catalogue".
 *
 * Industry assessment vendors typically ship a similar bundle library
 * out of the box. This is VIFM's GCC-tuned equivalent: named, role-
 * and sector-specific bundles a consultant can launch in one click
 * instead of configuring everything by hand.
 *
 * Each template is a configuration preset for the assessment-creation
 * wizard. The consultant picks one in the wizard, the wizard pre-fills
 * the stage, region default, sector, language, and pillar weights. The
 * organisation field is still chosen separately because templates are
 * org-agnostic.
 *
 * Adding new templates = appending to this array. No DB migration
 * required.
 */

export interface AraAssessmentTemplate {
  id: string;
  /** Short eyebrow shown above the card title. */
  category: "Executive" | "Sector" | "Function" | "Capability" | "Compliance";
  title_en: string;
  title_ar: string;
  /** One-line plain-English purpose statement shown on the card. */
  description_en: string;
  description_ar: string;
  /** Default stage the template fires for. Override-able in the wizard. */
  default_stage: AraEngagementStage;
  /** Default region. "any" means consultant must pick before launch. */
  default_region: AraRegion | "any";
  /** Default sector. "any" means consultant must pick. */
  default_sector: AraSector | "any";
  /** Pillar weights tuned to where this template's value lives. Sum = 100. */
  pillar_weights: Partial<Record<AraPillarId, number>>;
  /** Recommended typical respondent count for this template. */
  typical_respondents: string;
  /** ~minutes a respondent will spend completing it. */
  estimated_minutes: number;
  /** Use cases / real engagements this fits. */
  use_when: string[];
  /** Tone for the visual chip - matches stages-ts tones. */
  tone: "blue" | "violet" | "teal" | "gold" | "emerald" | "rose";
}

/**
 * Default 12.5% × 8 pillar weights spread, used when a template doesn't
 * specify custom weights.
 */
const EQUAL_WEIGHTS: Record<AraPillarId, number> = {
  strategy: 12.5, data: 12.5, technology: 12.5, talent: 12.5,
  culture: 12.5, governance: 12.5, operations: 12.5, model_management: 12.5,
};

export const ARA_ASSESSMENT_TEMPLATES: ReadonlyArray<AraAssessmentTemplate> = [
  // ─── Executive starters (Stage 1 free) ─────────────────────
  {
    id: "department-quickstart",
    category: "Executive",
    title_en: "Department AI Quickstart",
    title_ar: "البداية السريعة للذكاء الاصطناعي للإدارة",
    description_en: "Complimentary 4-pillar diagnostic for one department - data, talent, culture, operations. Ideal as a first-touch sales conversation with a head of department.",
    description_ar: "تشخيص مجاني من ٤ ركائز لإدارة واحدة - مثالي كمحادثة مبيعات أولى مع رئيس الإدارة.",
    default_stage: "department",
    default_region: "any",
    default_sector: "any",
    pillar_weights: EQUAL_WEIGHTS,
    typical_respondents: "1-2",
    estimated_minutes: 12,
    use_when: ["Free Stage 1 sample", "Sales lead-in", "Single department head"],
    tone: "teal",
  },
  {
    id: "division-deepdive",
    category: "Executive",
    title_en: "Division Deep Dive",
    title_ar: "التحليل العميق للقسم",
    description_en: "Full Stage 2 diagnostic across 6 pillars (adds strategy + governance) for a multi-department division. Includes Phase 2 consultant validation workshop.",
    description_ar: "تشخيص كامل من المرحلة الثانية عبر ٦ ركائز لقسم متعدد الإدارات - يشمل ورشة تحقق المستشار.",
    default_stage: "division",
    default_region: "any",
    default_sector: "any",
    pillar_weights: EQUAL_WEIGHTS,
    typical_respondents: "4-8",
    estimated_minutes: 28,
    use_when: ["Mid-size engagement", "Business unit head sponsorship", "Strategic alignment workshop"],
    tone: "violet",
  },
  {
    id: "enterprise-board",
    category: "Executive",
    title_en: "Enterprise Board Pack",
    title_ar: "الحزمة التنفيذية للمؤسسة",
    description_en: "Full 8-pillar Stage 3 diagnostic with peer benchmarks, year-on-year tracking, regulatory deep-dive, and 60-page bilingual board-grade report.",
    description_ar: "التشخيص الكامل للمرحلة الثالثة بـ ٨ ركائز مع المعايير المرجعية والمقارنات السنوية وتقرير ثنائي اللغة.",
    default_stage: "enterprise",
    default_region: "any",
    default_sector: "any",
    pillar_weights: EQUAL_WEIGHTS,
    typical_respondents: "8-15+",
    estimated_minutes: 38,
    use_when: ["Annual board review", "Strategic AI investment cycle", "Multi-business-unit org"],
    tone: "gold",
  },

  // ─── Sector-specific bundles (Stage 2/3) ───────────────────
  {
    id: "uae-banking-supervisor",
    category: "Sector",
    title_en: "UAE Banking · Supervisory Readiness",
    title_ar: "مصارف الإمارات · جاهزية الإشراف",
    description_en: "Banking-tuned diagnostic emphasising data sovereignty, model risk, and CBUAE / SAMA-style supervisory readiness. Auto-applies UAE PDPL + UAE AI Charter framework filter.",
    description_ar: "تشخيص خاص بالبنوك يركز على سيادة البيانات ومخاطر النماذج وجاهزية الإشراف.",
    default_stage: "enterprise",
    default_region: "uae",
    default_sector: "banking",
    pillar_weights: {
      strategy: 10, data: 18, technology: 14, talent: 8,
      culture: 8, governance: 18, operations: 10, model_management: 14,
    },
    typical_respondents: "10-15",
    estimated_minutes: 38,
    use_when: ["UAE bank facing supervisory cycle", "Pre-audit readiness check", "Risk and compliance focus"],
    tone: "blue",
  },
  {
    id: "saudi-government-vision-2030",
    category: "Sector",
    title_en: "Saudi Government · Vision 2030 AI Audit",
    title_ar: "حكومة المملكة · تدقيق الذكاء الاصطناعي لرؤية ٢٠٣٠",
    description_en: "Government-tuned diagnostic mapped against SDAIA NDGF, NCA ECC, and Vision 2030 AI targets. Heavier weighting on governance, data, and operations.",
    description_ar: "تشخيص حكومي مرتبط بمعايير سدايا والهيئة الوطنية للأمن السيبراني ورؤية ٢٠٣٠.",
    default_stage: "enterprise",
    default_region: "saudi",
    default_sector: "government",
    pillar_weights: {
      strategy: 14, data: 16, technology: 12, talent: 10,
      culture: 8, governance: 18, operations: 14, model_management: 8,
    },
    typical_respondents: "10-15",
    estimated_minutes: 40,
    use_when: ["Saudi ministry digitalisation review", "Vision 2030 contribution audit", "SDAIA registration prep"],
    tone: "emerald",
  },

  // ─── Function-specific bundles ─────────────────────────────
  {
    id: "data-foundations-audit",
    category: "Function",
    title_en: "Data Foundations Audit",
    title_ar: "تدقيق أسس البيانات",
    description_en: "Targeted Stage 1-style diagnostic on the data pillar only - quality, ownership, lineage, classification, shadow AI controls. Ideal for CDO-led discovery.",
    description_ar: "تشخيص موجه على ركيزة البيانات فقط - الجودة والملكية والنسب والتصنيف.",
    default_stage: "department",
    default_region: "any",
    default_sector: "any",
    pillar_weights: { ...EQUAL_WEIGHTS, data: 100, strategy: 0, technology: 0, talent: 0, culture: 0, governance: 0, operations: 0, model_management: 0 },
    typical_respondents: "2-3",
    estimated_minutes: 14,
    use_when: ["CDO-sponsored data audit", "Pre-AI initiative readiness", "Data governance gap-analysis"],
    tone: "violet",
  },
  {
    id: "model-risk-management",
    category: "Function",
    title_en: "Model Risk Management Review",
    title_ar: "مراجعة إدارة مخاطر النماذج",
    description_en: "Banking and insurance-flavoured deep dive on the model_management pillar plus governance. Focuses on registry, drift, fairness, audit trail, retirement.",
    description_ar: "تحليل عميق لإدارة مخاطر النماذج للبنوك والتأمين - السجل والانحراف والعدالة وسجل التدقيق.",
    default_stage: "division",
    default_region: "any",
    default_sector: "banking",
    pillar_weights: { ...EQUAL_WEIGHTS, model_management: 50, governance: 30, technology: 10, data: 10, strategy: 0, talent: 0, culture: 0, operations: 0 },
    typical_respondents: "4-6",
    estimated_minutes: 28,
    use_when: ["Model risk committee prep", "Pre-deployment governance review", "SR 11-7 / regulatory audit prep"],
    tone: "rose",
  },

  // ─── Capability bundles ────────────────────────────────────
  {
    id: "generative-ai-readiness",
    category: "Capability",
    title_en: "Generative AI Readiness",
    title_ar: "الجاهزية للذكاء الاصطناعي التوليدي",
    description_en: "Targeted at organisations rolling out Copilot, ChatGPT Enterprise, or internal LLMs. Probes shadow AI, acceptable-use policy, output watermarking, training, governance.",
    description_ar: "موجه للمنظمات التي تنشر Copilot أو ChatGPT Enterprise أو نماذج لغوية داخلية.",
    default_stage: "division",
    default_region: "any",
    default_sector: "any",
    pillar_weights: { ...EQUAL_WEIGHTS, governance: 22, data: 18, talent: 16, technology: 14, culture: 12, operations: 8, model_management: 8, strategy: 2 },
    typical_respondents: "5-8",
    estimated_minutes: 26,
    use_when: ["Copilot rollout", "Internal LLM platform launch", "GenAI policy refresh"],
    tone: "violet",
  },
  {
    id: "individual-ai-literacy",
    category: "Capability",
    title_en: "Individual AI Literacy",
    title_ar: "الإلمام الفردي بالذكاء الاصطناعي",
    description_en: "Per-employee assessment of AI fluency: tool awareness, data-handling discipline, output-verification habits, deepfake recognition. Complements org-level Compass.",
    description_ar: "تقييم فردي لكل موظف على فهم الذكاء الاصطناعي والانضباط في استخدامه.",
    default_stage: "department",
    default_region: "any",
    default_sector: "any",
    pillar_weights: { ...EQUAL_WEIGHTS, talent: 60, culture: 25, governance: 15, strategy: 0, data: 0, technology: 0, operations: 0, model_management: 0 },
    typical_respondents: "10-100+",
    estimated_minutes: 10,
    use_when: ["Workforce AI-skills baseline", "Pre-training cohort screen", "Individual development planning"],
    tone: "gold",
  },

  // ─── Compliance-led bundles ────────────────────────────────
  {
    id: "compliance-pdpl",
    category: "Compliance",
    title_en: "PDPL Compliance Check",
    title_ar: "فحص الامتثال لقانون حماية البيانات الشخصية",
    description_en: "Cross-region (UAE + Saudi) PDPL-anchored audit. Targets data, governance, and model_management pillars with the regulatory deep-dive enabled.",
    description_ar: "تدقيق متعدد المناطق مرتكز على قوانين حماية البيانات الشخصية في الإمارات والسعودية.",
    default_stage: "enterprise",
    default_region: "any",
    default_sector: "any",
    pillar_weights: { ...EQUAL_WEIGHTS, data: 28, governance: 28, model_management: 20, technology: 12, operations: 6, talent: 4, culture: 2, strategy: 0 },
    typical_respondents: "8-12",
    estimated_minutes: 36,
    use_when: ["DPIA prep", "Annual PDPL compliance review", "Pre-regulator engagement"],
    tone: "rose",
  },
];

export function getAssessmentTemplate(id: string): AraAssessmentTemplate | undefined {
  return ARA_ASSESSMENT_TEMPLATES.find((t) => t.id === id);
}
