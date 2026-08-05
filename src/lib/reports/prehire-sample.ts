import type { PrehireReportData } from "@/lib/reports/prehire-candidate-html";

type Lang = "en" | "ar";

/**
 * Fictional, fully-populated Pre-Hire screening report data, so staff can show
 * the report from the Scientific Models hub without a completed sitting. Mirrors
 * a real "review"-band candidate: three stages all above cut, a role competency
 * set, and an AI-interview transcript + assessment. No real PII.
 */
export function samplePrehireReportData(generatedAt: Date, lang: Lang = "en"): PrehireReportData {
  const ar = lang === "ar";
  return {
    candidateName: ar ? "سارة العتيبي" : "Sara Al-Otaibi",
    candidateEmail: "candidate@vifm-sample.com",
    employeeId: null,
    requisitionTitle: ar ? "محلل خرّيج" : "Graduate Analyst",
    level: ar ? "خرّيج" : "Graduate",
    orgName: ar ? "مؤسسة تجريبية" : "Sample Organization",
    composite: 68,
    recommendation: "review",
    stages: [
      {
        label: ar ? "اختبار الكفاءات" : "Competency Quiz",
        definition: ar
          ? "أسئلة معرفية مرتبطة بالدور مستمدة من مجموعة كفاءات الدور المحددة."
          : "Role-relevant knowledge questions drawn from the role's selected competency set.",
        normalized: 71, cutScore: 60, passed: true, weightPct: 40, required: true, note: null,
      },
      {
        label: ar ? "الإنجليزية (Fluent)" : "English (Fluent)",
        definition: ar
          ? "تحديد مستوى الإنجليزية وفق الإطار الأوروبي المرجعي (قراءة، استماع، كتابة، محادثة)."
          : "CEFR-aligned English placement (reading, listening, writing, speaking).",
        normalized: 74, cutScore: 50, passed: true, weightPct: 30, required: false,
        note: ar ? "المستوى: B2" : "Level: B2",
      },
      {
        label: ar ? "مقابلة الذكاء الاصطناعي (CBI)" : "AI Interview (CBI)",
        definition: ar
          ? "مقابلة سلوكية منظمة (STAR) على كفاءة واحدة، تُراجَع بشرياً قبل الاعتماد."
          : "Structured STAR behavioural interview on one competency; human-reviewed before it counts.",
        normalized: 60, cutScore: 60, passed: true, weightPct: 30, required: true, note: null,
      },
    ],
    cbi: {
      bars: 3,
      ratingLabel: ar ? "كفؤ" : "Competent",
      rationale: ar
        ? "قدّمت المرشحة مثالاً واضحاً بصيغة STAR مع مسؤولية شخصية ونتيجة قابلة للقياس، مع مجال لتعميق تحليل الخيارات البديلة."
        : "The candidate gave a clear STAR example with personal ownership and a measurable outcome; there is room to deepen the analysis of alternative options.",
      strengths: ar
        ? ["إجابة منظمة وواضحة", "مسؤولية شخصية عن النتيجة"]
        : ["Clear, well-structured response", "Personal ownership of the outcome"],
      developmentAreas: ar
        ? ["تعميق تحليل الخيارات البديلة قبل القرار"]
        : ["Deeper analysis of alternatives before deciding"],
      aiGenerated: true,
      exchanges: [
        {
          who: "interviewer",
          text: ar
            ? "أخبريني عن موقف واجهتِ فيه مشكلة معقّدة في العمل. ما الذي فعلتِه؟"
            : "Tell me about a time you faced a complex problem at work. What did you do?",
        },
        {
          who: "candidate",
          text: ar
            ? "في مشروع تخرّجي، تأخّرت البيانات من مورّد خارجي، فأعدتُ ترتيب الأولويات وبنيتُ نموذجاً مؤقتاً بالبيانات المتاحة."
            : "During my graduation project, data from an external supplier was delayed, so I re-prioritised and built an interim model from the data we already had.",
        },
        {
          who: "interviewer",
          text: ar ? "وما النتيجة التي تحقّقت؟" : "And what was the result?",
        },
        {
          who: "candidate",
          text: ar
            ? "سلّمنا التحليل قبل الموعد بيومين، واعتمدته اللجنة دون تعديلات جوهرية."
            : "We delivered the analysis two days early and the committee approved it with no major changes.",
        },
      ],
    },
    certification: null,
    generatedAt,
    provisional: false,
    competencies: [
      { name: "Analytical Reasoning", nameAr: "التفكير التحليلي", priority: "critical" },
      { name: "Financial Acumen", nameAr: "الفطنة المالية", priority: "high" },
      { name: "Communicates Effectively", nameAr: "التواصل الفعّال", priority: "high" },
      { name: "Action Orientation", nameAr: "التوجه نحو الإنجاز", priority: "medium" },
      { name: "Manages Complexity", nameAr: "إدارة التعقيد", priority: "medium" },
    ],
  };
}
