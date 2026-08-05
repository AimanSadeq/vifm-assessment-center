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
    fluent: {
      overallCefr: "B2",
      skills: [
        { key: "reading", cefr: "B2", correct: 8, total: 10 },
        { key: "listening", cefr: "B1", correct: 6, total: 10 },
        {
          key: "writing", cefr: "B2",
          feedback: ar
            ? "كتابة واضحة ومنظّمة تعرض وجهة النظر بسببين مدعومين، مع بعض الأخطاء النحوية البسيطة التي لا تعيق الفهم. الأسلوب مناسب للسياق المهني."
            : "Clear, well-organised writing that states a position with two supported reasons; a few minor grammar slips that do not impede understanding. Register is appropriate for a professional context.",
        },
        {
          key: "speaking", cefr: "B2",
          feedback: ar
            ? "تحدّث بطلاقة جيدة ونطق مفهوم، مع مفردات كافية للتعبير عن الأفكار. مجال للتحسين في ربط الجمل المعقّدة."
            : "Good fluency and clear pronunciation, with vocabulary sufficient to express ideas; room to improve linking of more complex sentences.",
        },
      ],
    },
    certification: null,
    generatedAt,
    provisional: false,
    competencies: [
      {
        name: "Analytical Reasoning", nameAr: "التفكير التحليلي", priority: "critical",
        definition: ar
          ? "يحلّل المعلومات بدقّة، ويفكّك المشكلات المعقّدة إلى عناصرها، ويصل إلى استنتاجات مبنيّة على الأدلة."
          : "Analyses information rigorously, breaks complex problems into parts, and reaches evidence-based conclusions.",
        indicators: ar
          ? ["يفكّك المشكلات المعقّدة إلى عناصرها", "يميّز الأنماط والعلاقات في البيانات", "يستند في استنتاجاته إلى الأدلة"]
          : ["Breaks complex problems into their parts", "Spots patterns and relationships in data", "Grounds conclusions in evidence"],
        examCorrect: 2, examTotal: 2,
      },
      {
        name: "Communicates Effectively", nameAr: "التواصل الفعّال", priority: "high",
        definition: ar
          ? "ينقل الأفكار بوضوح ويكيّف رسالته حسب الجمهور، وينصت باهتمام ليتأكّد من الفهم المشترك."
          : "Conveys ideas clearly, adapts the message to the audience, and listens actively to confirm shared understanding.",
        indicators: ar
          ? ["يوصل الأفكار بوضوح", "يكيّف الرسالة حسب الجمهور", "ينصت باهتمام ويستوضح"]
          : ["Conveys ideas clearly", "Tailors the message to the audience", "Listens actively and checks understanding"],
        examCorrect: 2, examTotal: 2,
      },
      {
        name: "Financial Acumen", nameAr: "الفطنة المالية", priority: "high",
        definition: ar
          ? "يفهم البيانات والتقارير المالية، ويربط القرارات بأثرها المالي، ويوازن بين المخاطر والعوائد."
          : "Understands financial data and reports, links decisions to their financial impact, and weighs risk against return.",
        indicators: ar
          ? ["يفسّر البيانات والتقارير المالية", "يربط القرارات بأثرها المالي", "يقيّم المخاطر والعوائد"]
          : ["Interprets financial data and reports", "Links decisions to their financial impact", "Weighs risk against return"],
        examCorrect: 1, examTotal: 2,
      },
      {
        name: "Action Orientation", nameAr: "التوجه نحو الإنجاز", priority: "medium",
        definition: ar
          ? "يبادر دون انتظار التوجيه، ويحافظ على وتيرة إنجاز عالية، ويتابع العمل حتى إتمامه."
          : "Takes initiative without waiting to be told, keeps a strong pace of delivery, and follows through to completion.",
        indicators: ar
          ? ["يبادر دون انتظار التوجيه", "يحافظ على وتيرة إنجاز عالية", "يتابع حتى إتمام العمل"]
          : ["Takes initiative without waiting to be told", "Maintains a strong pace of delivery", "Follows through to completion"],
        examCorrect: 0, examTotal: 1,
      },
      {
        name: "Manages Complexity", nameAr: "إدارة التعقيد", priority: "medium",
        definition: ar
          ? "يوازن بين عدّة أولويات متنافسة، ويتعامل مع الغموض بثبات، ويبسّط ما هو معقّد للآخرين."
          : "Balances several competing priorities, stays steady amid ambiguity, and simplifies the complex for others.",
        indicators: ar
          ? ["يوازن بين عدة أولويات متنافسة", "يتعامل مع الغموض بثبات", "يبسّط ما هو معقّد للآخرين"]
          : ["Balances several competing priorities", "Stays steady amid ambiguity", "Simplifies the complex for others"],
        examCorrect: null, examTotal: null,
      },
    ],
  };
}
