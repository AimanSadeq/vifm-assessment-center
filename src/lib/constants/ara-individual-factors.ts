/**
 * VIFM-native individual / personal AI readiness factors.
 *
 * Four factors mapped to VIFM's existing 4-domain AC framework
 * (THINKING / RESULTS / PEOPLE / SELF) so the structure stays
 * consistent across the AC and ARA portals. Each factor groups
 * 4-5 self-assessment items in the seed (migration 00026).
 *
 * Naming and structure are VIFM original - not derived from any
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
   * VIFM AC behavioural competency *names* this factor maps to -
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
      "Treats AI output as a draft to be checked, not a finished answer. " +
      "Tests claims against domain knowledge, catches fabricated citations " +
      "and confidently-wrong facts, and decides what to keep, edit, or " +
      "discard before it leaves your hands.",
    description_ar:
      "تتعامل مع مخرجات الذكاء الاصطناعي كمسودة تحتاج إلى مراجعة، لا كإجابة " +
      "نهائية. تختبر الادعاءات في ضوء معرفتك المتخصصة، وترصد المراجع " +
      "الملفقة والأخطاء المُقدَّمة بثقة، وتقرر ما تُبقي عليه أو تعدّله أو " +
      "تستبعده قبل تسليمه.",
    color: "#5391D5", // THINKING blue
    ac_competency_names: [
      "Analytical Reasoning",
      "Decision Quality",
      "Strategic Mindset",
    ],
  },
  {
    id: "results_working_practice",
    domain: "RESULTS",
    name_en: "AI Working Practice",
    name_ar: "ممارسة العمل بالذكاء الاصطناعي",
    description_en:
      "Builds AI into the way you already work - writes clear prompts, " +
      "iterates when the first answer misses, and folds the tool into " +
      "recurring tasks. Measures success by faster, better deliverables, " +
      "not by how often the tool is opened.",
    description_ar:
      "تدمج الذكاء الاصطناعي في أسلوب عملك الحالي - تصيغ تعليمات واضحة، " +
      "وتعيد المحاولة عندما لا يصيب الجواب الأول الهدف، وتُدخل الأداة في " +
      "المهام المتكررة. تقيس النجاح بسرعة وجودة المخرجات، لا بعدد مرات " +
      "استخدام الأداة.",
    color: "#047857", // RESULTS emerald
    ac_competency_names: [
      "Action Oriented",
      "Drives Results",
      "Plans and Aligns",
    ],
  },
  {
    id: "people_collaboration",
    domain: "PEOPLE",
    name_en: "AI Collaboration",
    name_ar: "التعاون مع الذكاء الاصطناعي",
    description_en:
      "Helps the team move with AI rather than around it. Explains what " +
      "the tools can and can't do without overselling, shares prompts " +
      "and patterns that worked, and pushes back when teammates take an " +
      "output at face value or use it where they shouldn't.",
    description_ar:
      "تساعد الفريق على التحرّك مع الذكاء الاصطناعي بدلاً من تجاوزه. تشرح " +
      "ما يستطيع وما لا يستطيع دون مبالغة، وتُشارك التعليمات والأنماط التي " +
      "نجحت، وتعترض حين يأخذ الزملاء المخرجات على ظاهرها أو يستخدمونها في " +
      "غير موضعها.",
    color: "#c2410c", // PEOPLE orange
    ac_competency_names: [
      "Communicates Effectively",
      "Persuades",
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
      "Stays open as AI changes how the work gets done - relearns " +
      "familiar workflows when something better appears, asks where " +
      "models can fail you, and keeps confidentiality, fairness, and " +
      "policy in view when deciding what to feed into a system.",
    description_ar:
      "تظل منفتحاً مع تغيُّر طريقة إنجاز العمل بفعل الذكاء الاصطناعي - " +
      "تعيد تعلّم المهام المألوفة عند ظهور ما هو أفضل، وتسأل أين يمكن أن " +
      "تخفق النماذج، وتُبقي السرية والإنصاف وسياسة المنظمة حاضرةً عند " +
      "اختيار ما تُدخله إلى النظام.",
    color: "#6d28d9", // SELF violet
    ac_competency_names: [
      "Self-Development",
      "Being Resilient",
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

/**
 * Three narrative stages for an individual's overall AI-readiness score.
 * Aligns with the rose/amber/emerald tone tiers used elsewhere
 * (<3 / 3–3.99 / ≥4) so the stage label and the visual tone agree.
 *
 * Names are VIFM-original; thresholds are tuned to the 1–5 scoring scale.
 */
export type AraIndividualMaturityStageId = "emerging" | "practising" | "embedded";

export type AraIndividualMaturityStage = {
  id: AraIndividualMaturityStageId;
  name_en: string;
  name_ar: string;
  blurb_en: string;
  blurb_ar: string;
};

const STAGE_EMERGING: AraIndividualMaturityStage = {
  id: "emerging",
  name_en: "Emerging",
  name_ar: "ناشئة",
  blurb_en:
    "Foundation-laying - early exposure to AI tools, with room to build " +
    "the core habits and judgment that turn experiments into impact.",
  blurb_ar:
    "مرحلة التأسيس - انكشاف مبكر على أدوات الذكاء الاصطناعي، وفسحة " +
    "لبناء العادات والحُكم الأساسي اللازم لتحويل التجريب إلى أثر.",
};

const STAGE_PRACTISING: AraIndividualMaturityStage = {
  id: "practising",
  name_en: "Practising",
  name_ar: "ممارَسة",
  blurb_en:
    "Building rhythm - using AI on real work, sharpening prompts and " +
    "review habits, and starting to feel where the tools help and where " +
    "they don't.",
  blurb_ar:
    "بناء الإيقاع - استخدام الذكاء الاصطناعي في العمل الفعلي، وصقل " +
    "التعليمات وعادات المراجعة، والبدء في إدراك مواضع نفع الأدوات " +
    "ومواضع قصورها.",
};

const STAGE_EMBEDDED: AraIndividualMaturityStage = {
  id: "embedded",
  name_en: "Embedded",
  name_ar: "راسخة",
  blurb_en:
    "Operating fluently - AI is part of how you work, with confident " +
    "judgment about when to lean on it, when to push back on its " +
    "output, and when not to use it at all.",
  blurb_ar:
    "إتقان متمكّن - الذكاء الاصطناعي جزء من طريقة عملك، مع حُكم واثق " +
    "بشأن متى تعتمد عليه، ومتى ترفض مخرجاته، ومتى لا تستخدمه أصلاً.",
};

/**
 * Bucket an overall 1–5 readiness score into one of three narrative
 * stages. Returns Emerging for any score below 3 (including 0 from
 * "no data" - caller should suppress the badge in that case).
 */
export function getIndividualMaturityStage(score: number): AraIndividualMaturityStage {
  if (score >= 4) return STAGE_EMBEDDED;
  if (score >= 3) return STAGE_PRACTISING;
  return STAGE_EMERGING;
}

export const ARA_INDIVIDUAL_MATURITY_STAGES = [
  STAGE_EMERGING,
  STAGE_PRACTISING,
  STAGE_EMBEDDED,
];
