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
      "Critical Analysis",
      "Sound Judgement",
      "Forward Strategy Setting",
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
      "Proactive Initiative",
      "Outcome Ownership",
      "Planning & Prioritisation",
    ],
  },
  {
    id: "people_collaboration",
    domain: "PEOPLE",
    name_en: "AI Collaboration",
    // "in the field of AI" rather than "with AI" - this factor is about
    // collaborating with PEOPLE about AI adoption, not with the tool itself
    // (SME translation correction from the trial review).
    name_ar: "التعاون في مجال الذكاء الاصطناعي",
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
      "Clear & Adaptive Communication",
      "Persuasion & Buy-in",
      "Coaching & Talent Growth",
      "Relationship Networks",
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
      "Continuous Self-Development",
      "Resilience Under Pressure",
      "Operating Through Uncertainty",
      "Self-Insight",
    ],
  },
];

/**
 * Bilingual label for each AC domain a factor maps to. The factor sections
 * showed the bare English constant ("THINKING" etc.) even in Arabic mode - a
 * trial finding - so the respondent form reads the Arabic label from here.
 */
export const ARA_INDIVIDUAL_DOMAIN_LABELS: Record<
  AraIndividualFactor["domain"],
  { en: string; ar: string }
> = {
  THINKING: { en: "THINKING", ar: "التفكير" },
  RESULTS: { en: "RESULTS", ar: "النتائج" },
  PEOPLE: { en: "PEOPLE", ar: "الأشخاص" },
  SELF: { en: "SELF", ar: "الذات" },
};

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
  /** One-line "how the band is read" shown beneath the band word (R2). */
  definition_en: string;
  definition_ar: string;
  blurb_en: string;
  blurb_ar: string;
};

const STAGE_EMERGING: AraIndividualMaturityStage = {
  id: "emerging",
  name_en: "Emerging",
  name_ar: "ناشئة",
  definition_en: "building foundational habits",
  definition_ar: "بناء العادات الأساسية",
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
  definition_en: "applying AI with growing judgment",
  definition_ar: "تطبيق الذكاء الاصطناعي بحُكم متنامٍ",
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
  definition_en: "AI is a confident, routine part of how you work",
  definition_ar: "الذكاء الاصطناعي جزء واثق ومعتاد من طريقة عملك",
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

// ────────────────────────────────────────────────────────────────
// Talent lens (migration 00134)
// ────────────────────────────────────────────────────────────────
// ARC distinguishes a hiring run ("acquisition") from a development
// run ("development"). The lens is captured from the launching pillar
// via /ara?lens=. NULL means generic framing (legacy / anonymous /
// deep-linked) and must reproduce today's output exactly.

export type AraTalentLens = "acquisition" | "development";

/**
 * Coerce an untrusted value (query param, form field, DB read) to a
 * valid talent lens or null. Anything that isn't exactly one of the
 * two known strings becomes null - the generic, no-regression default.
 */
export function validateTalentLens(value: unknown): AraTalentLens | null {
  return value === "acquisition" || value === "development" ? value : null;
}

/** Bilingual lens label for the report header (R4). */
export const TALENT_LENS_LABELS: Record<AraTalentLens, { en: string; ar: string }> = {
  acquisition: { en: "Talent Acquisition", ar: "استقطاب المواهب" },
  development: { en: "Talent Development", ar: "تطوير المواهب" },
};

/**
 * R6 - hiring (acquisition) per-factor narrative.
 *
 * For a hiring lens the report DESCRIBES how a candidate at the
 * measured stage tends to operate on that factor, rather than coaching
 * them on what to develop next. One descriptive read per factor per
 * stage (4 factors x 3 stages = 12 blurbs), EN + AR.
 *
 * Grounded in each factor's construct (see ARA_INDIVIDUAL_FACTORS
 * above). Descriptive, present-tense, third-person-friendly - no
 * "you should" coaching, no next-steps. Arabic is best-effort MSA and
 * still needs native review per project convention.
 */
export const FACTOR_DESCRIPTIVE: Record<
  AraIndividualFactorId,
  Record<AraIndividualMaturityStageId, { en: string; ar: string }>
> = {
  thinking_sense_check: {
    emerging: {
      en: "Tends to take AI output largely at face value, with limited routine checking of claims, figures, or sources before relying on them.",
      ar: "يميل إلى قبول مخرجات الذكاء الاصطناعي كما هي إلى حد كبير، مع تدقيق محدود للادعاءات والأرقام والمصادر قبل الاعتماد عليها.",
    },
    practising: {
      en: "Treats AI output as a draft to be checked - validates claims against domain knowledge in familiar areas and decides what to keep, edit, or discard.",
      ar: "يتعامل مع مخرجات الذكاء الاصطناعي كمسودة تحتاج إلى مراجعة - يتحقق من الادعاءات في ضوء معرفته المتخصصة في المجالات المألوفة، ويقرر ما يُبقيه أو يعدّله أو يستبعده.",
    },
    embedded: {
      en: "Spots fabricated citations and confidently-wrong facts readily, applies consistent verification even in unfamiliar domains, and can articulate how the checks are made.",
      ar: "يرصد المراجع الملفقة والأخطاء المُقدَّمة بثقة بسهولة، ويطبّق تحققاً متسقاً حتى في المجالات غير المألوفة، ويستطيع توضيح كيفية إجراء هذا التحقق.",
    },
  },
  results_working_practice: {
    emerging: {
      en: "Uses AI tools occasionally and mostly for one-off tasks; prompting and workflow integration are still ad hoc rather than part of a routine.",
      ar: "يستخدم أدوات الذكاء الاصطناعي بين الحين والآخر وفي مهام منفردة غالباً؛ ولا تزال صياغة التعليمات ودمجها في سير العمل عشوائية لا روتيناً ثابتاً.",
    },
    practising: {
      en: "Applies AI to real, recurring work - writes clear prompts, iterates when the first answer misses, and is starting to fold the tools into regular tasks.",
      ar: "يطبّق الذكاء الاصطناعي على عمل فعلي ومتكرر - يصيغ تعليمات واضحة، ويعيد المحاولة عندما لا يصيب الجواب الأول الهدف، ويبدأ بإدخال الأدوات في المهام المعتادة.",
    },
    embedded: {
      en: "Has AI built into how the work gets done, with reusable prompts and workflows that produce faster, better deliverables as a matter of routine.",
      ar: "أدمج الذكاء الاصطناعي في طريقة إنجاز العمل، باستخدام تعليمات وسير عمل قابلة لإعادة الاستخدام تُنتج مخرجات أسرع وأفضل بشكل اعتيادي.",
    },
  },
  people_collaboration: {
    emerging: {
      en: "Mostly uses AI individually; rarely shares prompts or guidance with colleagues or shapes how the team approaches the tools.",
      ar: "يستخدم الذكاء الاصطناعي بشكل فردي في الغالب؛ ونادراً ما يُشارك التعليمات أو الإرشادات مع الزملاء أو يؤثر في كيفية تعامل الفريق مع الأدوات.",
    },
    practising: {
      en: "Shares useful prompts and patterns, explains what the tools can and can't do without overselling, and helps colleagues use AI more soundly.",
      ar: "يُشارك التعليمات والأنماط المفيدة، ويشرح ما تستطيعه الأدوات وما لا تستطيعه دون مبالغة، ويساعد الزملاء على استخدام الذكاء الاصطناعي بشكل أسلم.",
    },
    embedded: {
      en: "Acts as a multiplier on team adoption - sets shared norms, pushes back when output is taken at face value, and lifts the wider group's AI practice.",
      ar: "يعمل كمضاعِف لتبنّي الفريق - يرسي معايير مشتركة، ويعترض حين تُؤخذ المخرجات على ظاهرها، ويرفع مستوى ممارسة المجموعة الأوسع للذكاء الاصطناعي.",
    },
  },
  self_adaptive_mindset: {
    emerging: {
      en: "Cautious about changing established ways of working; engages with new AI capabilities and responsible-use considerations only when prompted.",
      ar: "حذر من تغيير طرق العمل الراسخة؛ ولا يتفاعل مع قدرات الذكاء الاصطناعي الجديدة واعتبارات الاستخدام المسؤول إلا عند الطلب.",
    },
    practising: {
      en: "Stays open as AI changes the work - relearns familiar workflows when something better appears and keeps confidentiality and policy in view.",
      ar: "يظل منفتحاً مع تغيُّر العمل بفعل الذكاء الاصطناعي - يعيد تعلّم المهام المألوفة عند ظهور ما هو أفضل، ويُبقي السرية والسياسة حاضرتين.",
    },
    embedded: {
      en: "Adapts fluidly to new tools and approaches, actively asks where models can fail, and consistently weighs fairness, confidentiality, and policy.",
      ar: "يتكيف بسلاسة مع الأدوات والأساليب الجديدة، ويسأل بنشاط أين يمكن أن تخفق النماذج، ويوازن باستمرار بين الإنصاف والسرية والسياسة.",
    },
  },
};
