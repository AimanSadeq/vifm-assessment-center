// Single source of truth for the "Assessment Fact Sheet" included in ARC
// reports. Bilingual, structured as labelled rows so each rendering surface
// (React-PDF for the personal EN report, Puppeteer HTML for the personal AR
// report and the org report) can lay it out in its own way.

export type FactSheetRow = { label: string; value: string };

const METHODOLOGY_URL = "caliber.viftraining.com/api/ara/methodology/pdf";

/** Personal snapshot / deep-dive fact sheet. */
export function personalFactSheetRows(lang: "en" | "ar"): FactSheetRow[] {
  if (lang === "ar") {
    return [
      { label: "الأداة", value: "بوصلة VIFM للجاهزية للذكاء الاصطناعي® - اللقطة الشخصية" },
      {
        label: "ما الذي تقيسه",
        value:
          "أربعة عوامل فردية للجاهزية: التحقّق من الذكاء الاصطناعي (التقييم النقدي لمخرجاته)، الممارسة العملية (الاستخدام المنتج عمليًا)، التعاون (دعم تبنّي الفريق للذكاء الاصطناعي)، والعقلية المتكيّفة (الفضول والتعلّم المسؤول).",
      },
      {
        label: "الصيغة والبنود",
        value:
          "عبارات تقييم ذاتي بمقياس من 1 إلى 5 (من لا أوافق بشدة إلى أوافق بشدة)؛ ويضيف التشخيص المعمّق بقيادة استشاري بنود سيناريو واختبار معرفي. تُحتسب درجة كل عامل كمتوسط غير مرجّح لبنوده على مقياس 1-5.",
      },
      {
        label: "قراءة الدرجة",
        value:
          "ناشئ (أقل من 3): بناء العادات الأساسية. ممارس (من 3 إلى أقل من 4): تطبيق الذكاء الاصطناعي بحكم متنامٍ. متجذّر (4 فأكثر): الذكاء الاصطناعي جزء واثق ومعتاد من طريقة عملك.",
      },
      {
        label: "حدود صريحة",
        value:
          "تقرير ذاتي (يعكس الإدراك الذاتي لا السلوك المُلاحَظ)؛ المجموعة المعيارية خليجية؛ وهي أداة تطويرية وتشخيصية وليست أداة توظيف أو اختيار.",
      },
      { label: "المنهجية", value: `موجز المنهجية الكامل: ${METHODOLOGY_URL}` },
    ];
  }
  return [
    { label: "Instrument", value: "VIFM AI Readiness Compass® - Personal Snapshot" },
    {
      label: "What it measures",
      value:
        "Four individual AI-readiness factors: AI Sense-Check (critical evaluation of AI output), AI Working Practice (productive hands-on use), AI Collaboration (helping the team adopt AI), and AI Adaptive Mindset (curiosity and responsible relearning).",
    },
    {
      label: "Format & items",
      value:
        "Self-report statements rated 1-5 (Strongly disagree to Strongly agree); the consultant-led deep-dive adds scenario and knowledge-check items. Each factor score is the unweighted mean of its items on a 1-5 scale.",
    },
    {
      label: "Reading the score",
      value:
        "Emerging (below 3): building foundational habits. Practising (3 to below 4): applying AI with growing judgment. Embedded (4 and above): AI is a confident, routine part of how you work.",
    },
    {
      label: "Honest limits",
      value:
        "Self-report (it reflects self-perception, not observed behaviour); the norm group is GCC-based; this is a developmental and diagnostic tool, not a hiring or selection instrument.",
    },
    { label: "Methodology", value: `Full methodology brief: ${METHODOLOGY_URL}` },
  ];
}

/** Organisational (pillar) fact sheet. */
export function orgFactSheetRows(lang: "en" | "ar"): FactSheetRow[] {
  if (lang === "ar") {
    return [
      { label: "الأداة", value: "بوصلة VIFM للجاهزية للذكاء الاصطناعي® - التقييم المؤسسي" },
      {
        label: "ما الذي تقيسه",
        value:
          "جاهزية المؤسسة للذكاء الاصطناعي عبر ثماني ركائز: الاستراتيجية، البيانات، التقنية، المواهب، الثقافة، الحوكمة، العمليات، وإدارة النماذج (يعتمد عدد الركائز على مرحلة التقييم).",
      },
      {
        label: "الصيغة والبنود",
        value:
          "بنود وفق مقياس نضج (مبدئي ← مُحسَّن) إضافة إلى بنود نعم/لا وإجابات قصيرة، وتُحتسب كمستوى نضج لكل ركيزة.",
      },
      {
        label: "قراءة الدرجة",
        value:
          "تُقيَّم كل ركيزة على مقياس نضج من خمسة مستويات: مبدئي، قيد التطوير، مُعرَّف، مُدار، مُحسَّن.",
      },
      {
        label: "حدود صريحة",
        value:
          "تقرير ذاتي (تُخفِّف ورشة التحقق في المرحلة الثانية من أثره)؛ مُعايَر مقابل الأطر التنظيمية في الإمارات والسعودية؛ تُقفل النتائج على نسخة بنك الأسئلة النشطة عند الإنشاء لضمان قابلية التكرار.",
      },
      { label: "المنهجية", value: `موجز المنهجية الكامل: ${METHODOLOGY_URL}` },
    ];
  }
  return [
    { label: "Instrument", value: "VIFM AI Readiness Compass® - Organisational assessment" },
    {
      label: "What it measures",
      value:
        "Organisational AI readiness across eight pillars: Strategy, Data, Technology, Talent, Culture, Governance, Operations, and Model Management (the number in scope depends on the engagement stage).",
    },
    {
      label: "Format & items",
      value:
        "Capability-rubric items (initial through optimised) plus yes/no and short-answer items, scored as a maturity level per pillar.",
    },
    {
      label: "Reading the score",
      value:
        "Each pillar is scored on a 5-level capability scale: initial, developing, defined, managed, optimised.",
    },
    {
      label: "Honest limits",
      value:
        "Self-report (mitigated by the Phase 2 validation workshop); calibrated against UAE and Saudi regulatory frameworks; results lock to the question-bank version active at creation so the report is reproducible.",
    },
    { label: "Methodology", value: `Full methodology brief: ${METHODOLOGY_URL}` },
  ];
}
