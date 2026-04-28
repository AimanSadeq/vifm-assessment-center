/**
 * VIFM-native individual / personal AI readiness factors.
 *
 * Four factors mapped to VIFM's existing 4-domain AC framework
 * (THINKING / RESULTS / PEOPLE / SELF) so the structure stays
 * consistent across the AC and ARA portals. Each factor groups
 * 4-5 self-assessment items in the seed (migration 00026).
 *
 * Naming and structure are VIFM original — not derived from any
 * external assessment vendor's framework.
 */

export type AraIndividualFactorId =
  | "thinking_sense_check"
  | "results_working_practice"
  | "people_collaboration"
  | "self_adaptive_mindset";

export type AraIndividualFactor = {
  id: AraIndividualFactorId;
  /** VIFM AC domain this factor maps to (THINKING / RESULTS / PEOPLE / SELF). */
  domain: "THINKING" | "RESULTS" | "PEOPLE" | "SELF";
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  /** Hex tone aligned to the AC domain palette used elsewhere. */
  color: string;
  /**
   * VIFM AC behavioural competency *names* this factor maps to —
   * used by the recommender to surface VIFM courses that develop
   * the underlying capability. Empty string entries are filtered
   * out at lookup time, so it's safe to edit this list as the AC
   * competency catalogue evolves.
   */
  ac_competency_names: string[];
};

export const ARA_INDIVIDUAL_FACTORS: AraIndividualFactor[] = [
  {
    id: "thinking_sense_check",
    domain: "THINKING",
    name_en: "AI Sense-Check",
    name_ar: "تحقّق الذكاء الاصطناعي",
    description_en:
      "How critically you evaluate AI output — spotting hallucinations, " +
      "validating against your own domain expertise, and applying human " +
      "judgment before relying on AI-generated work.",
    description_ar:
      "مدى نقدك لمخرجات الذكاء الاصطناعي - رصد الهلوسة، والتحقق من خبرتك " +
      "في مجالك، وتطبيق الحكم البشري قبل الاعتماد على ما ينتجه الذكاء " +
      "الاصطناعي.",
    color: "#5391D5", // THINKING blue
    ac_competency_names: [
      "Analytical Reasoning",
      "Decision Quality",
      "Strategic Thinking",
    ],
  },
  {
    id: "results_working_practice",
    domain: "RESULTS",
    name_en: "AI Working Practice",
    name_ar: "ممارسة العمل بالذكاء الاصطناعي",
    description_en:
      "How fluently you use AI tools to deliver work outcomes — prompt " +
      "craft, integrating AI into your workflow, and turning it into real " +
      "productivity rather than novelty.",
    description_ar:
      "مدى إتقانك لاستخدام أدوات الذكاء الاصطناعي لتحقيق نتائج العمل - " +
      "صياغة التعليمات، ودمج الذكاء الاصطناعي في سير عملك، وتحويله إلى " +
      "إنتاجية حقيقية بدلاً من مجرد تجربة.",
    color: "#047857", // RESULTS emerald
    ac_competency_names: [
      "Action Orientation",
      "Drive for Results",
      "Plans and Aligns",
    ],
  },
  {
    id: "people_collaboration",
    domain: "PEOPLE",
    name_en: "AI Collaboration",
    name_ar: "التعاون مع الذكاء الاصطناعي",
    description_en:
      "How you lead or support team adoption of AI — communicating " +
      "what AI can and can't do, helping colleagues build confidence, " +
      "and shaping shared norms for responsible use.",
    description_ar:
      "كيف تقود أو تدعم تبني الفريق للذكاء الاصطناعي - التواصل حول ما " +
      "يستطيع الذكاء الاصطناعي وما لا يستطيع، ومساعدة الزملاء على بناء " +
      "الثقة، وتشكيل معايير مشتركة للاستخدام المسؤول.",
    color: "#c2410c", // PEOPLE orange
    ac_competency_names: [
      "Communicates",
      "Influences",
      "Develops Talent",
      "Builds Networks",
    ],
  },
  {
    id: "self_adaptive_mindset",
    domain: "SELF",
    name_en: "AI Adaptive Mindset",
    name_ar: "العقلية المتكيفة مع الذكاء الاصطناعي",
    description_en:
      "Your openness, curiosity, and willingness to relearn workflows " +
      "as AI changes how work gets done — plus the responsible posture " +
      "(ethics, privacy, organisational policy) that goes with it.",
    description_ar:
      "انفتاحك وفضولك واستعدادك لإعادة تعلم سير العمل مع تغيير الذكاء " +
      "الاصطناعي لطريقة إنجاز العمل - بالإضافة إلى الموقف المسؤول " +
      "(الأخلاق، الخصوصية، سياسة المنظمة) الذي يصاحبه.",
    color: "#6d28d9", // SELF violet
    ac_competency_names: [
      "Self-Development",
      "Resilience",
      "Manages Ambiguity",
      "Self-Awareness",
    ],
  },
];

export const ARA_INDIVIDUAL_FACTOR_MAP: Record<AraIndividualFactorId, AraIndividualFactor> =
  Object.fromEntries(
    ARA_INDIVIDUAL_FACTORS.map((f) => [f.id, f])
  ) as Record<AraIndividualFactorId, AraIndividualFactor>;

export const ARA_INDIVIDUAL_FACTOR_IDS: AraIndividualFactorId[] = [
  "thinking_sense_check",
  "results_working_practice",
  "people_collaboration",
  "self_adaptive_mindset",
];
