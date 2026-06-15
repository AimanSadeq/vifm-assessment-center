// AUTO-GENERATED - behavioural self-assessment item bank (Slice 4).
// 38 competencies x 4 first-person Likert items (EN + AR), with reverse flags,
// grouped by cluster. Source: docs/competency-self-report-*.md. Regenerate via
// the Slice 4 build step; do not hand-edit. Arabic is best-effort pending review.

export type BehavioralItem = {
  itemKey: string;
  acCompetencyId: string;
  ord: number;
  reverse: boolean;
  textEn: string;
  textAr: string;
};
export type BehavioralCompetency = {
  acCompetencyId: string;
  nameEn: string;
  nameAr: string;
  clusterOrder: number;
  clusterNameEn: string;
  clusterNameAr: string;
  items: BehavioralItem[];
};

export const BEHAVIORAL_COMPETENCIES: BehavioralCompetency[] = [
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000001",
    "nameEn": "Forward Strategy Setting",
    "nameAr": "رسم الاستراتيجية المستقبلية",
    "clusterOrder": 1,
    "clusterNameEn": "Strategic & Commercial Reasoning",
    "clusterNameAr": "التفكير الاستراتيجي والتجاري",
    "items": [
      {
        "itemKey": "01-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000001",
        "ord": 1,
        "reverse": false,
        "textEn": "I think several years ahead about how my market could change.",
        "textAr": "أفكّر قبل سنوات في كيفية تغيّر سوقي."
      },
      {
        "itemKey": "01-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000001",
        "ord": 2,
        "reverse": false,
        "textEn": "I connect day-to-day decisions to a longer-term direction.",
        "textAr": "أربط القرارات اليومية بتوجّه أطول أمدًا."
      },
      {
        "itemKey": "01-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000001",
        "ord": 3,
        "reverse": true,
        "textEn": "I focus on immediate targets rather than future shifts.",
        "textAr": "أركّز على المستهدفات الآنية أكثر من التحوّلات المستقبلية."
      },
      {
        "itemKey": "01-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000001",
        "ord": 4,
        "reverse": false,
        "textEn": "I anticipate how regulation or competition might reshape my area.",
        "textAr": "أستشرف كيف قد تعيد التشريعات أو المنافسة تشكيل مجالي."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000002",
    "nameEn": "Commercial & Market Awareness",
    "nameAr": "الوعي التجاري ووعي السوق",
    "clusterOrder": 1,
    "clusterNameEn": "Strategic & Commercial Reasoning",
    "clusterNameAr": "التفكير الاستراتيجي والتجاري",
    "items": [
      {
        "itemKey": "02-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000002",
        "ord": 1,
        "reverse": false,
        "textEn": "I keep close track of competitor and market moves in my industry.",
        "textAr": "أتابع عن كثب تحرّكات المنافسين والسوق في صناعتي."
      },
      {
        "itemKey": "02-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000002",
        "ord": 2,
        "reverse": false,
        "textEn": "I factor the wider economic climate into business decisions.",
        "textAr": "أُدخل المناخ الاقتصادي الأوسع في قرارات الأعمال."
      },
      {
        "itemKey": "02-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000002",
        "ord": 3,
        "reverse": true,
        "textEn": "I find it hard to see how external trends affect my work.",
        "textAr": "يصعب عليّ رؤية كيف تؤثّر الاتجاهات الخارجية في عملي."
      },
      {
        "itemKey": "02-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000002",
        "ord": 4,
        "reverse": false,
        "textEn": "I spot commercial opportunities that others miss.",
        "textAr": "ألتقط فرصًا تجارية يغفل عنها غيري."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000003",
    "nameEn": "Financial Literacy & Acumen",
    "nameAr": "الإلمام والفطنة المالية",
    "clusterOrder": 1,
    "clusterNameEn": "Strategic & Commercial Reasoning",
    "clusterNameAr": "التفكير الاستراتيجي والتجاري",
    "items": [
      {
        "itemKey": "03-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000003",
        "ord": 1,
        "reverse": false,
        "textEn": "I am comfortable interpreting financial statements and ratios.",
        "textAr": "أرتاح في تفسير القوائم والنسب المالية."
      },
      {
        "itemKey": "03-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000003",
        "ord": 2,
        "reverse": false,
        "textEn": "I use financial data to weigh trade-offs in decisions.",
        "textAr": "أستخدم البيانات المالية لموازنة المفاضلات في القرارات."
      },
      {
        "itemKey": "03-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000003",
        "ord": 3,
        "reverse": true,
        "textEn": "I rely on others to explain the financial implications of choices.",
        "textAr": "أعتمد على غيري لشرح الآثار المالية للخيارات."
      },
      {
        "itemKey": "03-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000003",
        "ord": 4,
        "reverse": false,
        "textEn": "I can quickly read what a set of financial indicators is signalling.",
        "textAr": "أقرأ بسرعة ما تشير إليه مجموعة من المؤشرات المالية."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000004",
    "nameEn": "Critical Analysis",
    "nameAr": "التحليل النقدي",
    "clusterOrder": 1,
    "clusterNameEn": "Strategic & Commercial Reasoning",
    "clusterNameAr": "التفكير الاستراتيجي والتجاري",
    "items": [
      {
        "itemKey": "04-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000004",
        "ord": 1,
        "reverse": false,
        "textEn": "I test the assumptions behind a conclusion before accepting it.",
        "textAr": "أختبر الافتراضات الكامنة خلف استنتاج قبل قبوله."
      },
      {
        "itemKey": "04-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000004",
        "ord": 2,
        "reverse": false,
        "textEn": "I break complex problems into parts to understand them.",
        "textAr": "أُفكّك المشكلات المعقّدة إلى أجزاء لفهمها."
      },
      {
        "itemKey": "04-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000004",
        "ord": 3,
        "reverse": true,
        "textEn": "I tend to accept reports at face value.",
        "textAr": "أميل إلى قبول التقارير كما هي دون تمحيص."
      },
      {
        "itemKey": "04-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000004",
        "ord": 4,
        "reverse": false,
        "textEn": "I weigh evidence carefully before forming a view.",
        "textAr": "أوازن الأدلة بعناية قبل تكوين رأي."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000005",
    "nameEn": "Sound Judgement",
    "nameAr": "سلامة الحُكم",
    "clusterOrder": 1,
    "clusterNameEn": "Strategic & Commercial Reasoning",
    "clusterNameAr": "التفكير الاستراتيجي والتجاري",
    "items": [
      {
        "itemKey": "05-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000005",
        "ord": 1,
        "reverse": false,
        "textEn": "I make balanced decisions even when information is incomplete.",
        "textAr": "أتّخذ قرارات متوازنة حتى حين تكون المعلومات ناقصة."
      },
      {
        "itemKey": "05-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000005",
        "ord": 2,
        "reverse": false,
        "textEn": "I consider the knock-on consequences of my decisions.",
        "textAr": "أراعي التبعات غير المباشرة لقراراتي."
      },
      {
        "itemKey": "05-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000005",
        "ord": 3,
        "reverse": true,
        "textEn": "I delay decisions until I have complete certainty.",
        "textAr": "أؤجّل القرارات حتى يكتمل اليقين تمامًا."
      },
      {
        "itemKey": "05-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000005",
        "ord": 4,
        "reverse": false,
        "textEn": "People trust my judgement on difficult calls.",
        "textAr": "يثق الناس بحُكمي في القرارات الصعبة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000006",
    "nameEn": "Creative Problem-Solving",
    "nameAr": "حل المشكلات الإبداعي",
    "clusterOrder": 2,
    "clusterNameEn": "Innovation & Complexity",
    "clusterNameAr": "الابتكار والتعامل مع التعقيد",
    "items": [
      {
        "itemKey": "06-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000006",
        "ord": 1,
        "reverse": false,
        "textEn": "I look for new and better ways to do things.",
        "textAr": "أبحث عن طرق جديدة وأفضل لإنجاز الأمور."
      },
      {
        "itemKey": "06-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000006",
        "ord": 2,
        "reverse": false,
        "textEn": "I challenge \"the way it's always been done.\"",
        "textAr": "أتحدّى \"الطريقة التي اعتدنا عليها دائمًا\"."
      },
      {
        "itemKey": "06-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000006",
        "ord": 3,
        "reverse": true,
        "textEn": "I prefer to stick with proven methods.",
        "textAr": "أفضّل التمسّك بالأساليب المجرَّبة."
      },
      {
        "itemKey": "06-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000006",
        "ord": 4,
        "reverse": false,
        "textEn": "I generate original ideas to solve problems.",
        "textAr": "أبتكر أفكارًا أصيلة لحلّ المشكلات."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000007",
    "nameEn": "Navigating Complexity",
    "nameAr": "التعامل مع التعقيد",
    "clusterOrder": 2,
    "clusterNameEn": "Innovation & Complexity",
    "clusterNameAr": "الابتكار والتعامل مع التعقيد",
    "items": [
      {
        "itemKey": "07-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000007",
        "ord": 1,
        "reverse": false,
        "textEn": "I can make sense of messy, conflicting information.",
        "textAr": "أستطيع فهم المعلومات المتشابكة والمتضاربة."
      },
      {
        "itemKey": "07-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000007",
        "ord": 2,
        "reverse": false,
        "textEn": "I find the key issue inside a complicated situation.",
        "textAr": "أجد القضية الجوهرية داخل موقف معقّد."
      },
      {
        "itemKey": "07-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000007",
        "ord": 3,
        "reverse": true,
        "textEn": "I get overwhelmed when problems have many moving parts.",
        "textAr": "أُرهَق حين تكون للمشكلات أجزاء متحرّكة كثيرة."
      },
      {
        "itemKey": "07-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000007",
        "ord": 4,
        "reverse": false,
        "textEn": "I structure complex problems into manageable parts.",
        "textAr": "أُهيكل المشكلات المعقّدة إلى أجزاء قابلة للإدارة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000008",
    "nameEn": "Systems & Global Perspective",
    "nameAr": "المنظور النظمي والعالمي",
    "clusterOrder": 2,
    "clusterNameEn": "Innovation & Complexity",
    "clusterNameAr": "الابتكار والتعامل مع التعقيد",
    "items": [
      {
        "itemKey": "08-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000008",
        "ord": 1,
        "reverse": false,
        "textEn": "I consider the bigger picture beyond my own area.",
        "textAr": "أراعي الصورة الأكبر بما يتجاوز مجالي."
      },
      {
        "itemKey": "08-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000008",
        "ord": 2,
        "reverse": false,
        "textEn": "I think about how parts of a system connect.",
        "textAr": "أفكّر في كيفية ترابط أجزاء النظام."
      },
      {
        "itemKey": "08-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000008",
        "ord": 3,
        "reverse": true,
        "textEn": "I focus only on my immediate remit.",
        "textAr": "أركّز فقط على نطاق مسؤوليتي المباشر."
      },
      {
        "itemKey": "08-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000008",
        "ord": 4,
        "reverse": false,
        "textEn": "I take a broad, cross-boundary view of issues.",
        "textAr": "أتبنّى نظرة واسعة عابرة للحدود للقضايا."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000009",
    "nameEn": "Digital & Data Fluency",
    "nameAr": "الطلاقة الرقمية والبياناتية",
    "clusterOrder": 2,
    "clusterNameEn": "Innovation & Complexity",
    "clusterNameAr": "الابتكار والتعامل مع التعقيد",
    "items": [
      {
        "itemKey": "09-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000009",
        "ord": 1,
        "reverse": false,
        "textEn": "I use digital tools to work more effectively.",
        "textAr": "أستخدم الأدوات الرقمية لأعمل بفاعلية أكبر."
      },
      {
        "itemKey": "09-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000009",
        "ord": 2,
        "reverse": false,
        "textEn": "I am comfortable working with data and analytics.",
        "textAr": "أرتاح في العمل بالبيانات والتحليلات."
      },
      {
        "itemKey": "09-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000009",
        "ord": 3,
        "reverse": true,
        "textEn": "I avoid new technology when I can.",
        "textAr": "أتجنّب التقنية الجديدة متى أمكن."
      },
      {
        "itemKey": "09-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000009",
        "ord": 4,
        "reverse": false,
        "textEn": "I look for ways to automate or improve work with technology.",
        "textAr": "أبحث عن سُبُل أتمتة العمل أو تحسينه بالتقنية."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000010",
    "nameEn": "Proactive Initiative",
    "nameAr": "المبادرة الاستباقية",
    "clusterOrder": 3,
    "clusterNameEn": "Delivery & Execution",
    "clusterNameAr": "الإنجاز والتنفيذ",
    "items": [
      {
        "itemKey": "10-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000010",
        "ord": 1,
        "reverse": false,
        "textEn": "I act on problems without waiting to be told.",
        "textAr": "أتصرّف تجاه المشكلات دون انتظار التوجيه."
      },
      {
        "itemKey": "10-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000010",
        "ord": 2,
        "reverse": false,
        "textEn": "I take the initiative to improve things.",
        "textAr": "أبادر إلى تحسين الأمور."
      },
      {
        "itemKey": "10-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000010",
        "ord": 3,
        "reverse": true,
        "textEn": "I wait for direction before acting.",
        "textAr": "أنتظر التوجيه قبل التصرّف."
      },
      {
        "itemKey": "10-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000010",
        "ord": 4,
        "reverse": false,
        "textEn": "I look for opportunities and act on them.",
        "textAr": "أبحث عن الفرص وأتحرّك تجاهها."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000011",
    "nameEn": "Outcome Ownership",
    "nameAr": "تملّك النتائج",
    "clusterOrder": 3,
    "clusterNameEn": "Delivery & Execution",
    "clusterNameAr": "الإنجاز والتنفيذ",
    "items": [
      {
        "itemKey": "11-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000011",
        "ord": 1,
        "reverse": false,
        "textEn": "I see things through to a result.",
        "textAr": "أمضي بالأمور حتى تحقيق نتيجة."
      },
      {
        "itemKey": "11-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000011",
        "ord": 2,
        "reverse": false,
        "textEn": "I keep pushing even when it's hard.",
        "textAr": "أواصل الدفع حتى حين يصعب الأمر."
      },
      {
        "itemKey": "11-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000011",
        "ord": 3,
        "reverse": true,
        "textEn": "I ease off when obstacles appear.",
        "textAr": "أتراخى عند ظهور العقبات."
      },
      {
        "itemKey": "11-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000011",
        "ord": 4,
        "reverse": false,
        "textEn": "I take personal responsibility for outcomes.",
        "textAr": "أتحمّل المسؤولية الشخصية عن النتائج."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000012",
    "nameEn": "Accountability for Commitments",
    "nameAr": "المساءلة عن الالتزامات",
    "clusterOrder": 3,
    "clusterNameEn": "Delivery & Execution",
    "clusterNameAr": "الإنجاز والتنفيذ",
    "items": [
      {
        "itemKey": "12-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000012",
        "ord": 1,
        "reverse": false,
        "textEn": "I do what I say I will do.",
        "textAr": "أفعل ما أقول إنني سأفعله."
      },
      {
        "itemKey": "12-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000012",
        "ord": 2,
        "reverse": false,
        "textEn": "I own up quickly when I can't meet a commitment.",
        "textAr": "أعترف بسرعة حين يتعذّر عليّ الوفاء بالتزام."
      },
      {
        "itemKey": "12-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000012",
        "ord": 3,
        "reverse": true,
        "textEn": "I make excuses when things slip.",
        "textAr": "أختلق الأعذار حين تتعثّر الأمور."
      },
      {
        "itemKey": "12-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000012",
        "ord": 4,
        "reverse": false,
        "textEn": "I hold myself to my promises.",
        "textAr": "أُلزِم نفسي بوعودي."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000013",
    "nameEn": "Planning & Prioritisation",
    "nameAr": "التخطيط وترتيب الأولويات",
    "clusterOrder": 3,
    "clusterNameEn": "Delivery & Execution",
    "clusterNameAr": "الإنجاز والتنفيذ",
    "items": [
      {
        "itemKey": "13-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000013",
        "ord": 1,
        "reverse": false,
        "textEn": "I plan my work around what matters most.",
        "textAr": "أخطّط عملي حول الأهمّ."
      },
      {
        "itemKey": "13-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000013",
        "ord": 2,
        "reverse": false,
        "textEn": "I prioritise by impact and deadline.",
        "textAr": "أرتّب الأولويات بحسب الأثر والموعد."
      },
      {
        "itemKey": "13-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000013",
        "ord": 3,
        "reverse": true,
        "textEn": "I tackle tasks in whatever order they arrive.",
        "textAr": "أتناول المهام بأي ترتيب تصل به."
      },
      {
        "itemKey": "13-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000013",
        "ord": 4,
        "reverse": false,
        "textEn": "I organise my work to meet key commitments.",
        "textAr": "أنظّم عملي للوفاء بالالتزامات الرئيسة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000014",
    "nameEn": "Process Optimisation",
    "nameAr": "تحسين العمليات",
    "clusterOrder": 3,
    "clusterNameEn": "Delivery & Execution",
    "clusterNameAr": "الإنجاز والتنفيذ",
    "items": [
      {
        "itemKey": "14-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000014",
        "ord": 1,
        "reverse": false,
        "textEn": "I look for ways to make processes more efficient.",
        "textAr": "أبحث عن سُبُل لجعل العمليات أكثر كفاءة."
      },
      {
        "itemKey": "14-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000014",
        "ord": 2,
        "reverse": false,
        "textEn": "I fix the root cause of recurring problems.",
        "textAr": "أعالج السبب الجذري للمشكلات المتكرّرة."
      },
      {
        "itemKey": "14-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000014",
        "ord": 3,
        "reverse": true,
        "textEn": "I leave inefficient processes as they are.",
        "textAr": "أترك العمليات غير الكفؤة كما هي."
      },
      {
        "itemKey": "14-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000014",
        "ord": 4,
        "reverse": false,
        "textEn": "I improve how work gets done.",
        "textAr": "أُحسّن طريقة إنجاز العمل."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000015",
    "nameEn": "Operating Through Uncertainty",
    "nameAr": "العمل وسط عدم اليقين",
    "clusterOrder": 4,
    "clusterNameEn": "Adaptability & Change",
    "clusterNameAr": "التكيّف والتغيير",
    "items": [
      {
        "itemKey": "15-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000015",
        "ord": 1,
        "reverse": false,
        "textEn": "I stay effective when things are unclear.",
        "textAr": "أبقى فاعلًا حين تكون الأمور غير واضحة."
      },
      {
        "itemKey": "15-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000015",
        "ord": 2,
        "reverse": false,
        "textEn": "I make progress without complete information.",
        "textAr": "أُحرز تقدّمًا دون معلومات كاملة."
      },
      {
        "itemKey": "15-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000015",
        "ord": 3,
        "reverse": true,
        "textEn": "I struggle when the way forward isn't clear.",
        "textAr": "أتعثّر حين لا يكون الطريق للأمام واضحًا."
      },
      {
        "itemKey": "15-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000015",
        "ord": 4,
        "reverse": false,
        "textEn": "I'm comfortable acting amid uncertainty.",
        "textAr": "أرتاح في التصرّف وسط عدم اليقين."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000016",
    "nameEn": "Learning by Doing",
    "nameAr": "التعلّم بالممارسة",
    "clusterOrder": 4,
    "clusterNameEn": "Adaptability & Change",
    "clusterNameAr": "التكيّف والتغيير",
    "items": [
      {
        "itemKey": "16-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000016",
        "ord": 1,
        "reverse": false,
        "textEn": "I learn quickly by trying things.",
        "textAr": "أتعلّم بسرعة بتجربة الأشياء."
      },
      {
        "itemKey": "16-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000016",
        "ord": 2,
        "reverse": false,
        "textEn": "I treat mistakes as a way to learn.",
        "textAr": "أتعامل مع الأخطاء كوسيلة للتعلّم."
      },
      {
        "itemKey": "16-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000016",
        "ord": 3,
        "reverse": true,
        "textEn": "I avoid tasks until I've been fully trained.",
        "textAr": "أتجنّب المهام حتى أتدرّب تدريبًا كاملًا."
      },
      {
        "itemKey": "16-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000016",
        "ord": 4,
        "reverse": false,
        "textEn": "I adjust my approach as I learn.",
        "textAr": "أعدّل نهجي وأنا أتعلّم."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000017",
    "nameEn": "Resilience Under Pressure",
    "nameAr": "الصمود تحت الضغط",
    "clusterOrder": 4,
    "clusterNameEn": "Adaptability & Change",
    "clusterNameAr": "التكيّف والتغيير",
    "items": [
      {
        "itemKey": "17-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000017",
        "ord": 1,
        "reverse": false,
        "textEn": "I bounce back from setbacks.",
        "textAr": "أنهض من الانتكاسات."
      },
      {
        "itemKey": "17-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000017",
        "ord": 2,
        "reverse": false,
        "textEn": "I keep performing through adversity.",
        "textAr": "أواصل الأداء خلال الشدائد."
      },
      {
        "itemKey": "17-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000017",
        "ord": 3,
        "reverse": true,
        "textEn": "Setbacks knock me off course for a long time.",
        "textAr": "تُخرجني الانتكاسات عن مساري وقتًا طويلًا."
      },
      {
        "itemKey": "17-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000017",
        "ord": 4,
        "reverse": false,
        "textEn": "I recover quickly when things go wrong.",
        "textAr": "أتعافى بسرعة حين تسوء الأمور."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000018",
    "nameEn": "Mobilising Around Purpose",
    "nameAr": "الحشد حول الغاية",
    "clusterOrder": 4,
    "clusterNameEn": "Adaptability & Change",
    "clusterNameAr": "التكيّف والتغيير",
    "items": [
      {
        "itemKey": "18-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000018",
        "ord": 1,
        "reverse": false,
        "textEn": "I give people a clear sense of direction.",
        "textAr": "أمنح الناس إحساسًا واضحًا بالوجهة."
      },
      {
        "itemKey": "18-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000018",
        "ord": 2,
        "reverse": false,
        "textEn": "I connect people's work to a bigger purpose.",
        "textAr": "أربط عمل الناس بغاية أكبر."
      },
      {
        "itemKey": "18-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000018",
        "ord": 3,
        "reverse": true,
        "textEn": "I struggle to get others energised behind a goal.",
        "textAr": "يصعب عليّ حشد الآخرين خلف هدف."
      },
      {
        "itemKey": "18-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000018",
        "ord": 4,
        "reverse": false,
        "textEn": "I motivate people toward a shared goal.",
        "textAr": "أحفّز الناس نحو هدف مشترك."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000019",
    "nameEn": "Clear & Adaptive Communication",
    "nameAr": "التواصل الواضح والمرن",
    "clusterOrder": 5,
    "clusterNameEn": "Influence & Communication",
    "clusterNameAr": "التأثير والتواصل",
    "items": [
      {
        "itemKey": "19-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000019",
        "ord": 1,
        "reverse": false,
        "textEn": "I explain complex things clearly.",
        "textAr": "أشرح الأمور المعقّدة بوضوح."
      },
      {
        "itemKey": "19-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000019",
        "ord": 2,
        "reverse": false,
        "textEn": "I tailor my message to the audience.",
        "textAr": "أكيّف رسالتي وفق الجمهور."
      },
      {
        "itemKey": "19-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000019",
        "ord": 3,
        "reverse": true,
        "textEn": "I struggle to get my point across simply.",
        "textAr": "يصعب عليّ إيصال فكرتي ببساطة."
      },
      {
        "itemKey": "19-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000019",
        "ord": 4,
        "reverse": false,
        "textEn": "I communicate in a way people understand.",
        "textAr": "أتواصل بطريقة يفهمها الناس."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000020",
    "nameEn": "Persuasion & Buy-in",
    "nameAr": "الإقناع وكسب التأييد",
    "clusterOrder": 5,
    "clusterNameEn": "Influence & Communication",
    "clusterNameAr": "التأثير والتواصل",
    "items": [
      {
        "itemKey": "20-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000020",
        "ord": 1,
        "reverse": false,
        "textEn": "I win people's genuine support for ideas.",
        "textAr": "أكسب تأييد الناس الحقيقي للأفكار."
      },
      {
        "itemKey": "20-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000020",
        "ord": 2,
        "reverse": false,
        "textEn": "I build a convincing case.",
        "textAr": "أبني حجّة مقنعة."
      },
      {
        "itemKey": "20-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000020",
        "ord": 3,
        "reverse": true,
        "textEn": "I find it hard to bring others around.",
        "textAr": "يصعب عليّ استمالة الآخرين."
      },
      {
        "itemKey": "20-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000020",
        "ord": 4,
        "reverse": false,
        "textEn": "I gain commitment, not just compliance.",
        "textAr": "أكسب التزامًا لا مجرّد امتثال."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000021",
    "nameEn": "Constructive Conflict Handling",
    "nameAr": "إدارة الخلاف البنّاءة",
    "clusterOrder": 5,
    "clusterNameEn": "Influence & Communication",
    "clusterNameAr": "التأثير والتواصل",
    "items": [
      {
        "itemKey": "21-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000021",
        "ord": 1,
        "reverse": false,
        "textEn": "I address disagreements directly and calmly.",
        "textAr": "أتناول الخلافات بصراحة وهدوء."
      },
      {
        "itemKey": "21-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000021",
        "ord": 2,
        "reverse": false,
        "textEn": "I keep conflict focused on the issue, not the person.",
        "textAr": "أُبقي الخلاف على القضية لا الشخص."
      },
      {
        "itemKey": "21-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000021",
        "ord": 3,
        "reverse": true,
        "textEn": "I avoid dealing with conflict.",
        "textAr": "أتجنّب التعامل مع الخلاف."
      },
      {
        "itemKey": "21-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000021",
        "ord": 4,
        "reverse": false,
        "textEn": "I resolve tensions without drama.",
        "textAr": "أحلّ التوتّرات دون ضجّة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000022",
    "nameEn": "Principled Negotiation",
    "nameAr": "التفاوض المبدئي",
    "clusterOrder": 5,
    "clusterNameEn": "Influence & Communication",
    "clusterNameAr": "التأثير والتواصل",
    "items": [
      {
        "itemKey": "22-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000022",
        "ord": 1,
        "reverse": false,
        "textEn": "I find agreements that work for both sides.",
        "textAr": "أجد اتفاقات تناسب الطرفين."
      },
      {
        "itemKey": "22-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000022",
        "ord": 2,
        "reverse": false,
        "textEn": "I look for the other party's underlying needs.",
        "textAr": "أبحث عن احتياجات الطرف الآخر الكامنة."
      },
      {
        "itemKey": "22-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000022",
        "ord": 3,
        "reverse": true,
        "textEn": "I either give in or dig in when negotiating.",
        "textAr": "إمّا أستسلم وإمّا أتعنّت عند التفاوض."
      },
      {
        "itemKey": "22-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000022",
        "ord": 4,
        "reverse": false,
        "textEn": "I reach durable, fair agreements.",
        "textAr": "أتوصّل إلى اتفاقات مستدامة وعادلة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000023",
    "nameEn": "Relationship Networks",
    "nameAr": "شبكات العلاقات",
    "clusterOrder": 5,
    "clusterNameEn": "Influence & Communication",
    "clusterNameAr": "التأثير والتواصل",
    "items": [
      {
        "itemKey": "23-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000023",
        "ord": 1,
        "reverse": false,
        "textEn": "I build relationships across the organisation.",
        "textAr": "أبني علاقات عبر المنظمة."
      },
      {
        "itemKey": "23-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000023",
        "ord": 2,
        "reverse": false,
        "textEn": "I invest in connections before I need them.",
        "textAr": "أستثمر في الصلات قبل أن أحتاجها."
      },
      {
        "itemKey": "23-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000023",
        "ord": 3,
        "reverse": true,
        "textEn": "I keep to my own team and contacts.",
        "textAr": "ألتزم بفريقي وصلاتي وحدها."
      },
      {
        "itemKey": "23-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000023",
        "ord": 4,
        "reverse": false,
        "textEn": "I maintain a strong network of relationships.",
        "textAr": "أصون شبكة علاقات قوية."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000024",
    "nameEn": "Coaching & Talent Growth",
    "nameAr": "التوجيه وتنمية المواهب",
    "clusterOrder": 6,
    "clusterNameEn": "Leading & Developing Others",
    "clusterNameAr": "قيادة الآخرين وتطويرهم",
    "items": [
      {
        "itemKey": "24-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000024",
        "ord": 1,
        "reverse": false,
        "textEn": "I help others develop their skills.",
        "textAr": "أساعد الآخرين على تنمية مهاراتهم."
      },
      {
        "itemKey": "24-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000024",
        "ord": 2,
        "reverse": false,
        "textEn": "I coach people to find their own solutions.",
        "textAr": "أُوجّه الناس لإيجاد حلولهم بأنفسهم."
      },
      {
        "itemKey": "24-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000024",
        "ord": 3,
        "reverse": true,
        "textEn": "I solve people's problems for them rather than developing them.",
        "textAr": "أحلّ مشكلات الناس بدلًا منهم بدل أن أطوّرهم."
      },
      {
        "itemKey": "24-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000024",
        "ord": 4,
        "reverse": false,
        "textEn": "I support people's growth.",
        "textAr": "أدعم نمو الناس."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000025",
    "nameEn": "Building Cohesive Teams",
    "nameAr": "بناء فرق متماسكة",
    "clusterOrder": 6,
    "clusterNameEn": "Leading & Developing Others",
    "clusterNameAr": "قيادة الآخرين وتطويرهم",
    "items": [
      {
        "itemKey": "25-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000025",
        "ord": 1,
        "reverse": false,
        "textEn": "I build teams that work well together.",
        "textAr": "أبني فرقًا تعمل معًا جيدًا."
      },
      {
        "itemKey": "25-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000025",
        "ord": 2,
        "reverse": false,
        "textEn": "I create a shared sense of purpose in teams.",
        "textAr": "أصنع إحساسًا مشتركًا بالغاية في الفرق."
      },
      {
        "itemKey": "25-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000025",
        "ord": 3,
        "reverse": true,
        "textEn": "I leave team dynamics to sort themselves out.",
        "textAr": "أترك ديناميات الفريق تحلّ نفسها بنفسها."
      },
      {
        "itemKey": "25-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000025",
        "ord": 4,
        "reverse": false,
        "textEn": "I bring people together around common goals.",
        "textAr": "أجمع الناس حول أهداف مشتركة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000026",
    "nameEn": "Cross-Functional Collaboration",
    "nameAr": "التعاون عبر الوظائف",
    "clusterOrder": 6,
    "clusterNameEn": "Leading & Developing Others",
    "clusterNameAr": "قيادة الآخرين وتطويرهم",
    "items": [
      {
        "itemKey": "26-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000026",
        "ord": 1,
        "reverse": false,
        "textEn": "I work well across departments.",
        "textAr": "أعمل بكفاءة عبر الإدارات."
      },
      {
        "itemKey": "26-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000026",
        "ord": 2,
        "reverse": false,
        "textEn": "I put shared goals ahead of my own unit's interests.",
        "textAr": "أُقدّم الأهداف المشتركة على مصالح وحدتي."
      },
      {
        "itemKey": "26-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000026",
        "ord": 3,
        "reverse": true,
        "textEn": "I focus on my own area's results over joint ones.",
        "textAr": "أركّز على نتائج مجالي قبل المشتركة."
      },
      {
        "itemKey": "26-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000026",
        "ord": 4,
        "reverse": false,
        "textEn": "I partner effectively with other teams.",
        "textAr": "أتشارك بفاعلية مع الفرق الأخرى."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000027",
    "nameEn": "Trust & Credibility",
    "nameAr": "الثقة والمصداقية",
    "clusterOrder": 6,
    "clusterNameEn": "Leading & Developing Others",
    "clusterNameAr": "قيادة الآخرين وتطويرهم",
    "items": [
      {
        "itemKey": "27-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000027",
        "ord": 1,
        "reverse": false,
        "textEn": "People rely on me to follow through.",
        "textAr": "يعتمد الناس عليّ في الوفاء."
      },
      {
        "itemKey": "27-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000027",
        "ord": 2,
        "reverse": false,
        "textEn": "I am honest and consistent in what I do.",
        "textAr": "أنا صادق ومتّسق فيما أفعل."
      },
      {
        "itemKey": "27-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000027",
        "ord": 3,
        "reverse": true,
        "textEn": "People are sometimes unsure they can count on me.",
        "textAr": "لا يتيقّن الناس أحيانًا أن بإمكانهم الاعتماد عليّ."
      },
      {
        "itemKey": "27-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000027",
        "ord": 4,
        "reverse": false,
        "textEn": "I earn others' trust.",
        "textAr": "أكسب ثقة الآخرين."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000028",
    "nameEn": "Interpersonal Adaptability",
    "nameAr": "المرونة في التعامل",
    "clusterOrder": 6,
    "clusterNameEn": "Leading & Developing Others",
    "clusterNameAr": "قيادة الآخرين وتطويرهم",
    "items": [
      {
        "itemKey": "28-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000028",
        "ord": 1,
        "reverse": false,
        "textEn": "I adapt my style to different people.",
        "textAr": "أكيّف أسلوبي مع مختلف الناس."
      },
      {
        "itemKey": "28-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000028",
        "ord": 2,
        "reverse": false,
        "textEn": "I read situations and adjust my approach.",
        "textAr": "أقرأ المواقف وأعدّل نهجي."
      },
      {
        "itemKey": "28-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000028",
        "ord": 3,
        "reverse": true,
        "textEn": "I use the same approach with everyone.",
        "textAr": "أستخدم النهج نفسه مع الجميع."
      },
      {
        "itemKey": "28-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000028",
        "ord": 4,
        "reverse": false,
        "textEn": "I flex how I work to fit the person.",
        "textAr": "أُرَوِّن طريقة عملي لتناسب الشخص."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000029",
    "nameEn": "Self-Insight",
    "nameAr": "الاستبصار الذاتي",
    "clusterOrder": 7,
    "clusterNameEn": "Integrity & Character",
    "clusterNameAr": "النزاهة والشخصية",
    "items": [
      {
        "itemKey": "29-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000029",
        "ord": 1,
        "reverse": false,
        "textEn": "I understand my own strengths and limits.",
        "textAr": "أفهم نقاط قوّتي وحدودي."
      },
      {
        "itemKey": "29-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000029",
        "ord": 2,
        "reverse": false,
        "textEn": "I act on feedback about myself.",
        "textAr": "أتصرّف بناءً على التغذية الراجعة عن نفسي."
      },
      {
        "itemKey": "29-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000029",
        "ord": 3,
        "reverse": true,
        "textEn": "I'm unaware of how I come across to others.",
        "textAr": "لا أدرك كيف أبدو للآخرين."
      },
      {
        "itemKey": "29-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000029",
        "ord": 4,
        "reverse": false,
        "textEn": "I reflect on my impact on others.",
        "textAr": "أتأمّل أثري في الآخرين."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000030",
    "nameEn": "Emotional Regulation & Empathy",
    "nameAr": "تنظيم الانفعالات والتعاطف",
    "clusterOrder": 7,
    "clusterNameEn": "Integrity & Character",
    "clusterNameAr": "النزاهة والشخصية",
    "items": [
      {
        "itemKey": "30-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000030",
        "ord": 1,
        "reverse": false,
        "textEn": "I manage my emotions well under pressure.",
        "textAr": "أُحسن إدارة انفعالاتي تحت الضغط."
      },
      {
        "itemKey": "30-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000030",
        "ord": 2,
        "reverse": false,
        "textEn": "I pick up on how others are feeling.",
        "textAr": "ألتقط مشاعر الآخرين."
      },
      {
        "itemKey": "30-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000030",
        "ord": 3,
        "reverse": true,
        "textEn": "I let my emotions get the better of me.",
        "textAr": "أدع انفعالاتي تتغلّب عليّ."
      },
      {
        "itemKey": "30-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000030",
        "ord": 4,
        "reverse": false,
        "textEn": "I respond to others' emotions appropriately.",
        "textAr": "أستجيب لمشاعر الآخرين بما يناسب."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000031",
    "nameEn": "Principled Courage",
    "nameAr": "الشجاعة المبدئية",
    "clusterOrder": 7,
    "clusterNameEn": "Integrity & Character",
    "clusterNameAr": "النزاهة والشخصية",
    "items": [
      {
        "itemKey": "31-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000031",
        "ord": 1,
        "reverse": false,
        "textEn": "I speak up about difficult issues.",
        "textAr": "أتكلّم عن القضايا الصعبة."
      },
      {
        "itemKey": "31-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000031",
        "ord": 2,
        "reverse": false,
        "textEn": "I say what needs to be said, even if unpopular.",
        "textAr": "أقول ما يجب قوله ولو كان غير محبّب."
      },
      {
        "itemKey": "31-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000031",
        "ord": 3,
        "reverse": true,
        "textEn": "I stay quiet to avoid standing out.",
        "textAr": "ألزم الصمت لئلّا أبرز."
      },
      {
        "itemKey": "31-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000031",
        "ord": 4,
        "reverse": false,
        "textEn": "I raise concerns others avoid.",
        "textAr": "أطرح المخاوف التي يتجنّبها غيري."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000032",
    "nameEn": "Ethical Conduct",
    "nameAr": "السلوك الأخلاقي",
    "clusterOrder": 7,
    "clusterNameEn": "Integrity & Character",
    "clusterNameAr": "النزاهة والشخصية",
    "items": [
      {
        "itemKey": "32-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000032",
        "ord": 1,
        "reverse": false,
        "textEn": "I act honestly and fairly.",
        "textAr": "أتصرّف بأمانة وعدل."
      },
      {
        "itemKey": "32-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000032",
        "ord": 2,
        "reverse": false,
        "textEn": "I uphold standards even under pressure.",
        "textAr": "أُرسي المعايير حتى تحت الضغط."
      },
      {
        "itemKey": "32-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000032",
        "ord": 3,
        "reverse": true,
        "textEn": "I bend the rules when it's convenient.",
        "textAr": "أُليّن القواعد متى ناسبني ذلك."
      },
      {
        "itemKey": "32-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000032",
        "ord": 4,
        "reverse": false,
        "textEn": "I do the right thing even when it's hard.",
        "textAr": "أفعل الصواب حتى حين يصعب."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000033",
    "nameEn": "Cultural & Inclusive Sensitivity",
    "nameAr": "الحساسية الثقافية والشمول",
    "clusterOrder": 7,
    "clusterNameEn": "Integrity & Character",
    "clusterNameAr": "النزاهة والشخصية",
    "items": [
      {
        "itemKey": "33-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000033",
        "ord": 1,
        "reverse": false,
        "textEn": "I respect different cultural norms and views.",
        "textAr": "أحترم الأعراف ووجهات النظر الثقافية المختلفة."
      },
      {
        "itemKey": "33-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000033",
        "ord": 2,
        "reverse": false,
        "textEn": "I work inclusively with diverse people.",
        "textAr": "أعمل بروح الشمول مع المتنوّعين."
      },
      {
        "itemKey": "33-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000033",
        "ord": 3,
        "reverse": true,
        "textEn": "I expect others to fit my way of doing things.",
        "textAr": "أتوقّع من الآخرين أن يتبعوا طريقتي."
      },
      {
        "itemKey": "33-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000033",
        "ord": 4,
        "reverse": false,
        "textEn": "I adapt to work well across backgrounds.",
        "textAr": "أتكيّف لأعمل جيدًا عبر الخلفيات."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000034",
    "nameEn": "Adaptive Learning Capacity",
    "nameAr": "القدرة على التعلّم التكيّفي",
    "clusterOrder": 8,
    "clusterNameEn": "Growth & Personal Effectiveness",
    "clusterNameAr": "النمو والفاعلية الشخصية",
    "items": [
      {
        "itemKey": "34-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000034",
        "ord": 1,
        "reverse": false,
        "textEn": "I learn fast in unfamiliar situations.",
        "textAr": "أتعلّم بسرعة في المواقف غير المألوفة."
      },
      {
        "itemKey": "34-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000034",
        "ord": 2,
        "reverse": false,
        "textEn": "I apply lessons to new conditions.",
        "textAr": "أطبّق الدروس على ظروف جديدة."
      },
      {
        "itemKey": "34-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000034",
        "ord": 3,
        "reverse": true,
        "textEn": "I rely on what worked before, even when things change.",
        "textAr": "أعتمد على ما نجح سابقًا حتى مع تغيّر الأمور."
      },
      {
        "itemKey": "34-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000034",
        "ord": 4,
        "reverse": false,
        "textEn": "I adapt quickly to new demands.",
        "textAr": "أتكيّف بسرعة مع المتطلّبات الجديدة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000035",
    "nameEn": "Continuous Self-Development",
    "nameAr": "التطوير الذاتي المستمر",
    "clusterOrder": 8,
    "clusterNameEn": "Growth & Personal Effectiveness",
    "clusterNameAr": "النمو والفاعلية الشخصية",
    "items": [
      {
        "itemKey": "35-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000035",
        "ord": 1,
        "reverse": false,
        "textEn": "I actively seek to grow and improve.",
        "textAr": "أسعى بنشاط إلى النمو والتحسّن."
      },
      {
        "itemKey": "35-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000035",
        "ord": 2,
        "reverse": false,
        "textEn": "I look for development opportunities.",
        "textAr": "أبحث عن فرص التطوير."
      },
      {
        "itemKey": "35-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000035",
        "ord": 3,
        "reverse": true,
        "textEn": "I wait for others to develop me.",
        "textAr": "أنتظر أن يطوّرني غيري."
      },
      {
        "itemKey": "35-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000035",
        "ord": 4,
        "reverse": false,
        "textEn": "I work on getting better at what I do.",
        "textAr": "أعمل على التحسّن فيما أفعله."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000036",
    "nameEn": "Composure Under Stress",
    "nameAr": "رباطة الجأش تحت الضغط",
    "clusterOrder": 8,
    "clusterNameEn": "Growth & Personal Effectiveness",
    "clusterNameAr": "النمو والفاعلية الشخصية",
    "items": [
      {
        "itemKey": "36-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000036",
        "ord": 1,
        "reverse": false,
        "textEn": "I stay calm under pressure.",
        "textAr": "أبقى هادئًا تحت الضغط."
      },
      {
        "itemKey": "36-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000036",
        "ord": 2,
        "reverse": false,
        "textEn": "I think clearly in stressful moments.",
        "textAr": "أفكّر بوضوح في اللحظات العصيبة."
      },
      {
        "itemKey": "36-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000036",
        "ord": 3,
        "reverse": true,
        "textEn": "I get rattled when the pressure is on.",
        "textAr": "أرتبك حين يشتدّ الضغط."
      },
      {
        "itemKey": "36-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000036",
        "ord": 4,
        "reverse": false,
        "textEn": "I keep my composure in tough situations.",
        "textAr": "أحافظ على رباطة جأشي في المواقف الصعبة."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000037",
    "nameEn": "Sustainable Wellbeing",
    "nameAr": "العافية المستدامة",
    "clusterOrder": 8,
    "clusterNameEn": "Growth & Personal Effectiveness",
    "clusterNameAr": "النمو والفاعلية الشخصية",
    "items": [
      {
        "itemKey": "37-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000037",
        "ord": 1,
        "reverse": false,
        "textEn": "I manage my energy to perform over time.",
        "textAr": "أُدير طاقتي لأؤدّي عبر الزمن."
      },
      {
        "itemKey": "37-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000037",
        "ord": 2,
        "reverse": false,
        "textEn": "I balance work demands with recovery.",
        "textAr": "أوازن متطلّبات العمل مع التعافي."
      },
      {
        "itemKey": "37-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000037",
        "ord": 3,
        "reverse": true,
        "textEn": "I run myself into the ground when busy.",
        "textAr": "أُنهك نفسي حتى الإرهاق حين أنشغل."
      },
      {
        "itemKey": "37-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000037",
        "ord": 4,
        "reverse": false,
        "textEn": "I sustain my performance without burning out.",
        "textAr": "أُديم أدائي دون احتراق وظيفي."
      }
    ]
  },
  {
    "acCompetencyId": "a0000001-0000-0000-0000-000000000038",
    "nameEn": "Resource Mobilisation",
    "nameAr": "حشد الموارد",
    "clusterOrder": 8,
    "clusterNameEn": "Growth & Personal Effectiveness",
    "clusterNameAr": "النمو والفاعلية الشخصية",
    "items": [
      {
        "itemKey": "38-1",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000038",
        "ord": 1,
        "reverse": false,
        "textEn": "I get the resources needed to deliver.",
        "textAr": "أحصل على الموارد اللازمة للإنجاز."
      },
      {
        "itemKey": "38-2",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000038",
        "ord": 2,
        "reverse": false,
        "textEn": "I make the most of what I have.",
        "textAr": "أستثمر ما لديّ على أفضل وجه."
      },
      {
        "itemKey": "38-3",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000038",
        "ord": 3,
        "reverse": true,
        "textEn": "I get stuck when resources are tight.",
        "textAr": "أتعثّر حين تشحّ الموارد."
      },
      {
        "itemKey": "38-4",
        "acCompetencyId": "a0000001-0000-0000-0000-000000000038",
        "ord": 4,
        "reverse": false,
        "textEn": "I deploy people and tools effectively.",
        "textAr": "أوظّف الأفراد والأدوات بفاعلية."
      }
    ]
  }
];
