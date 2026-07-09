// VIFM Reflect 360 vetted framework - the full 41-competency behaviour set.
// Authored by a fan-out author->adversarial-review workflow (one agent pair per
// competency), then seeded as a library template so a Reflect engagement can
// clone the vetted VIFM framework (source-based approval = auto-approved, no
// provisional flag) instead of AI-decomposing the client's own values.
// 41 competencies x 4 observable, frequency-rateable behaviours = 164 behaviours, bilingual EN/AR.
// Arabic is MSA; flag for human review per project convention before high-stakes use.

export type ReflectSeedBehaviour = { text_en: string; text_ar: string };
export type ReflectSeedCompetency = {
  ac_competency_id: string;
  name_en: string;
  name_ar: string;
  display_order: number;
  behaviours: ReflectSeedBehaviour[];
};

export const VIFM_REFLECT_FRAMEWORK: ReflectSeedCompetency[] = [
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000001",
    "name_en": "Forward Strategy Setting",
    "name_ar": "رسم الاستراتيجية المستقبلية",
    "display_order": 1,
    "behaviours": [
      {
        "text_en": "Sets out a clear multi-year direction for the team, linking daily work to longer-term goals.",
        "text_ar": "يرسم توجهاً واضحاً متعدد السنوات للفريق، ويربط العمل اليومي بالأهداف بعيدة المدى."
      },
      {
        "text_en": "Scans market, regulatory and technology trends and factors them into forward plans.",
        "text_ar": "يرصد اتجاهات السوق والجهات التنظيمية والتقنية ويأخذها في الحسبان عند وضع الخطط المستقبلية."
      },
      {
        "text_en": "Weighs several future scenarios before steering the team toward a strategic option.",
        "text_ar": "يوازن بين عدة سيناريوهات مستقبلية قبل أن يوجّه الفريق نحو خيار استراتيجي محدد."
      },
      {
        "text_en": "Articulates the future direction in a way that helps others see where the organization is heading.",
        "text_ar": "يعبّر عن التوجه المستقبلي بأسلوب يساعد الآخرين على إدراك الوجهة التي تسير نحوها المؤسسة."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000002",
    "name_en": "Commercial & Market Awareness",
    "name_ar": "الوعي التجاري ووعي السوق",
    "display_order": 2,
    "behaviours": [
      {
        "text_en": "Cites current market trends, competitor moves, and industry shifts when discussing plans and priorities.",
        "text_ar": "يستشهد باتجاهات السوق الحالية وتحركات المنافسين وتحولات القطاع عند مناقشة الخطط والأولويات."
      },
      {
        "text_en": "Lays out the cost, revenue, and commercial trade-offs of options when recommending a course of action.",
        "text_ar": "يعرض التكلفة والإيرادات والمقايضات التجارية للخيارات المتاحة عند التوصية بمسار عمل معين."
      },
      {
        "text_en": "Connects team activities to the organisation's revenue drivers and how it creates value for clients.",
        "text_ar": "يربط أنشطة الفريق بمصادر إيرادات المؤسسة وبكيفية خلق القيمة للعملاء."
      },
      {
        "text_en": "Spots commercial risks and opportunities early and raises them with the right people.",
        "text_ar": "يرصد المخاطر والفرص التجارية في وقت مبكر ويطرحها على الأشخاص المعنيين."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000003",
    "name_en": "Financial Literacy & Acumen",
    "name_ar": "الإلمام والفطنة المالية",
    "display_order": 3,
    "behaviours": [
      {
        "text_en": "Interprets financial statements and metrics to explain what the numbers mean for the business.",
        "text_ar": "يفسّر القوائم المالية والمؤشرات ويوضح دلالة الأرقام بالنسبة إلى أعمال المؤسسة."
      },
      {
        "text_en": "Quantifies cost, revenue, and risk implications of options before resources are committed.",
        "text_ar": "يقدّر آثار التكلفة والإيراد والمخاطر المترتبة على الخيارات قبل تخصيص الموارد."
      },
      {
        "text_en": "Builds budgets and forecasts on realistic assumptions and tracks performance against them.",
        "text_ar": "يعدّ الموازنات والتوقعات المالية بناءً على افتراضات واقعية ويتابع الأداء مقارنةً بها."
      },
      {
        "text_en": "Links financial decisions to commercial goals such as profitability, value, and return on investment.",
        "text_ar": "يربط القرارات المالية بالأهداف التجارية كالربحية والقيمة والعائد على الاستثمار."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000004",
    "name_en": "Critical Analysis",
    "name_ar": "التحليل النقدي",
    "display_order": 4,
    "behaviours": [
      {
        "text_en": "Breaks complex problems into component parts and examines each element before drawing conclusions.",
        "text_ar": "يُجزّئ المشكلات المعقّدة إلى عناصرها ويفحص كل عنصر قبل الوصول إلى استنتاجات."
      },
      {
        "text_en": "Questions assumptions and tests the evidence behind claims instead of accepting them at face value.",
        "text_ar": "يُساءل الافتراضات ويختبر الأدلة التي تستند إليها الطروحات بدلاً من قبولها كما هي."
      },
      {
        "text_en": "Weighs competing options against explicit criteria and explains the trade-offs behind a recommendation.",
        "text_ar": "يوازن بين الخيارات المتنافسة وفق معايير واضحة ويشرح المفاضلات التي بنى عليها توصيته."
      },
      {
        "text_en": "Points out flaws, gaps, or risks in data and arguments that others miss.",
        "text_ar": "يُشير إلى الثغرات أو النواقص أو المخاطر في البيانات والحجج التي يغفل عنها الآخرون."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000005",
    "name_en": "Sound Judgement",
    "name_ar": "سلامة الحُكم",
    "display_order": 5,
    "behaviours": [
      {
        "text_en": "Weighs the relevant facts, risks, and trade-offs before committing to a course of action.",
        "text_ar": "يوازن بين الحقائق والمخاطر والبدائل ذات الصلة قبل الالتزام بأي مسار عمل."
      },
      {
        "text_en": "Distinguishes critical information from noise, focusing decisions on what genuinely matters.",
        "text_ar": "يميّز المعلومات الجوهرية عن الثانوية، ويركّز قراراته على ما يهم فعلاً."
      },
      {
        "text_en": "Reaches sound conclusions under time pressure or with incomplete information.",
        "text_ar": "يتوصل إلى استنتاجات سليمة رغم ضيق الوقت أو نقص المعلومات."
      },
      {
        "text_en": "Tests assumptions against the evidence and revises conclusions when the facts change.",
        "text_ar": "يختبر افتراضاته في ضوء الأدلة، ويعدّل استنتاجاته عندما تتغير الحقائق."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000006",
    "name_en": "Creative Problem-Solving",
    "name_ar": "حل المشكلات الإبداعي",
    "display_order": 6,
    "behaviours": [
      {
        "text_en": "Reframes a stubborn problem from a different angle when the usual approach stalls.",
        "text_ar": "يعيد صياغة المشكلة المستعصية من زاوية مختلفة عندما يتعثّر الأسلوب المعتاد."
      },
      {
        "text_en": "Generates several distinct options before settling on a solution rather than the first idea.",
        "text_ar": "يطرح عدة خيارات متمايزة قبل الاستقرار على حل بدلاً من الاكتفاء بأول فكرة."
      },
      {
        "text_en": "Borrows ideas from other fields or teams to tackle problems in new ways.",
        "text_ar": "يستعير أفكاراً من مجالات أو فرق أخرى لمعالجة المشكلات بأساليب جديدة."
      },
      {
        "text_en": "Tests unconventional ideas through small experiments to see whether they hold up in practice.",
        "text_ar": "يختبر الأفكار غير التقليدية عبر تجارب صغيرة للتحقق من صلاحيتها عمليًا."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000007",
    "name_en": "Navigating Complexity",
    "name_ar": "التعامل مع التعقيد",
    "display_order": 7,
    "behaviours": [
      {
        "text_en": "Breaks down complex, ambiguous problems into clear parts the team can act on.",
        "text_ar": "يُجزّئ المشكلات المعقّدة والغامضة إلى عناصر واضحة يمكن للفريق العمل عليها."
      },
      {
        "text_en": "Connects information across different sources to make sense of a complex situation.",
        "text_ar": "يربط المعلومات من مصادر مختلفة لفهم المواقف المعقّدة واستيعابها."
      },
      {
        "text_en": "Makes sound decisions and moves forward despite incomplete or conflicting information.",
        "text_ar": "يتّخذ قرارات سليمة ويمضي قُدماً رغم نقص المعلومات أو تعارضها."
      },
      {
        "text_en": "Adjusts plans and approach as new information changes the situation.",
        "text_ar": "يُعدّل الخطط وأسلوب العمل كلّما غيّرت المعلومات الجديدة طبيعة الموقف."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000008",
    "name_en": "Systems & Global Perspective",
    "name_ar": "المنظور النظمي والعالمي",
    "display_order": 8,
    "behaviours": [
      {
        "text_en": "Connects decisions to how different parts of the organization affect one another rather than treating them in isolation.",
        "text_ar": "يربط القرارات بكيفية تأثير أجزاء المؤسسة المختلفة بعضها في بعض بدلاً من التعامل معها بمعزل عن بعضها."
      },
      {
        "text_en": "Traces how a change in one area creates downstream effects across other teams or processes.",
        "text_ar": "يتتبع كيف يُحدث التغيير في مجال واحد آثاراً لاحقة عبر الفرق أو العمليات الأخرى."
      },
      {
        "text_en": "Draws on regional and international market trends when framing plans and priorities.",
        "text_ar": "يستند إلى اتجاهات الأسواق الإقليمية والدولية عند صياغة الخطط والأولويات."
      },
      {
        "text_en": "Factors in how global regulatory, economic, or cultural conditions affect local decisions.",
        "text_ar": "يأخذ في الحسبان كيف تؤثر العوامل التنظيمية والاقتصادية والثقافية العالمية في القرارات المحلية."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000009",
    "name_en": "Digital & Data Fluency",
    "name_ar": "الطلاقة الرقمية والبياناتية",
    "display_order": 9,
    "behaviours": [
      {
        "text_en": "Uses data and dashboards to support recommendations rather than relying on opinion alone.",
        "text_ar": "يستند إلى البيانات ولوحات المعلومات لدعم توصياته بدلاً من الاعتماد على الرأي وحده."
      },
      {
        "text_en": "Adopts new digital tools in daily work and encourages the team to try them.",
        "text_ar": "يتبنى الأدوات الرقمية الجديدة في عمله اليومي ويشجع الفريق على تجربتها."
      },
      {
        "text_en": "Explains data findings in clear terms so non-technical colleagues can act on them.",
        "text_ar": "يشرح نتائج البيانات بلغة واضحة تمكّن الزملاء غير المتخصصين من التصرف بناءً عليها."
      },
      {
        "text_en": "Checks the accuracy and source of data before drawing conclusions from it.",
        "text_ar": "يتحقق من دقة البيانات ومصدرها قبل بناء استنتاجاته عليها."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000010",
    "name_en": "Proactive Initiative",
    "name_ar": "المبادرة الاستباقية",
    "display_order": 10,
    "behaviours": [
      {
        "text_en": "Acts on emerging issues before being asked, addressing them early rather than waiting for instructions.",
        "text_ar": "يتحرك لمعالجة المشكلات الناشئة قبل أن يُطلب منه ذلك، ويعالجها مبكرًا بدلًا من انتظار التعليمات."
      },
      {
        "text_en": "Spots gaps or opportunities others overlook and starts acting on them without waiting.",
        "text_ar": "يلاحظ الثغرات أو الفرص التي يغفل عنها الآخرون ويشرع في العمل عليها دون انتظار."
      },
      {
        "text_en": "Volunteers for tasks and responsibilities beyond the assigned role without being prompted.",
        "text_ar": "يتطوع لمهام ومسؤوليات تتجاوز نطاق دوره المحدد دون أن يُطلب منه ذلك."
      },
      {
        "text_en": "Proposes practical improvements to work methods instead of continuing with the status quo.",
        "text_ar": "يقترح تحسينات عملية على أساليب العمل بدلًا من الاستمرار على الوضع القائم."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000011",
    "name_en": "Outcome Ownership",
    "name_ar": "تملّك النتائج",
    "display_order": 11,
    "behaviours": [
      {
        "text_en": "Takes personal responsibility for committed results rather than blaming others when targets are missed.",
        "text_ar": "يتحمّل المسؤولية الشخصية عن النتائج المتفق عليها بدلاً من إلقاء اللوم على الآخرين عند عدم تحقيق الأهداف."
      },
      {
        "text_en": "Follows commitments through to completion, closing out open items rather than leaving them unfinished.",
        "text_ar": "يتابع التزاماته حتى إنجازها بالكامل، ويُغلق البنود المعلّقة بدلاً من تركها دون إتمام."
      },
      {
        "text_en": "Flags risks to promised outcomes early and proposes corrective action before deadlines slip.",
        "text_ar": "ينبّه مبكراً إلى المخاطر التي تهدّد النتائج الموعودة، ويقترح إجراءات تصحيحية قبل تجاوز المواعيد."
      },
      {
        "text_en": "Tracks progress on the results owned and updates stakeholders on status without being prompted.",
        "text_ar": "يتابع التقدّم في النتائج التي يتولّاها، ويُطلع المعنيين على المستجدّات دون أن يُطلب منه ذلك."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000012",
    "name_en": "Accountability for Commitments",
    "name_ar": "المساءلة عن الالتزامات",
    "display_order": 12,
    "behaviours": [
      {
        "text_en": "Delivers on commitments by the agreed deadline, or flags slippage early when a date is at risk.",
        "text_ar": "يفي بالتزاماته بحلول الموعد المتفق عليه، أو ينبّه مبكراً عند وجود خطر في التأخر."
      },
      {
        "text_en": "Owns mistakes and setbacks openly instead of shifting blame to others or to circumstances.",
        "text_ar": "يتحمّل مسؤولية الأخطاء والإخفاقات بصراحة بدلاً من إلقاء اللوم على الآخرين أو الظروف."
      },
      {
        "text_en": "Gives clear, timely progress updates on assigned tasks without needing to be chased.",
        "text_ar": "يقدّم تحديثات واضحة وفي حينها عن سير المهام الموكلة إليه دون الحاجة إلى متابعته."
      },
      {
        "text_en": "Follows through on agreed action items from meetings and closes them out fully.",
        "text_ar": "ينفّذ بنود العمل المتفق عليها في الاجتماعات ويُنجزها بالكامل."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000013",
    "name_en": "Planning & Prioritisation",
    "name_ar": "التخطيط وترتيب الأولويات",
    "display_order": 13,
    "behaviours": [
      {
        "text_en": "Breaks larger goals into a sequenced plan with clear milestones, owners, and realistic deadlines.",
        "text_ar": "يقسّم الأهداف الكبيرة إلى خطة متسلسلة بمراحل واضحة ومسؤولين محددين ومواعيد نهائية واقعية."
      },
      {
        "text_en": "Ranks competing tasks by importance and urgency, focusing effort on what matters most first.",
        "text_ar": "يرتّب المهام المتزاحمة حسب الأهمية والإلحاح، ويوجّه الجهد نحو الأولويات الأهم أولاً."
      },
      {
        "text_en": "Allocates their time and effort across tasks in proportion to each task's priority and workload.",
        "text_ar": "يوزّع وقته وجهده على المهام بما يتناسب مع أولوية كل مهمة وحجم العمل المطلوب."
      },
      {
        "text_en": "Adjusts plans and re-prioritises promptly when deadlines shift or new demands arise.",
        "text_ar": "يعدّل الخطط ويعيد ترتيب الأولويات بسرعة عند تغيّر المواعيد النهائية أو ظهور متطلبات جديدة."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000014",
    "name_en": "Process Optimisation",
    "name_ar": "تحسين العمليات",
    "display_order": 14,
    "behaviours": [
      {
        "text_en": "Maps existing workflows to pinpoint bottlenecks, duplicated steps, and delays that slow delivery.",
        "text_ar": "يرسم مسار سير العمل القائم لتحديد الاختناقات والخطوات المكررة والتأخيرات التي تبطئ الإنجاز."
      },
      {
        "text_en": "Redesigns processes to remove waste and simplify steps while safeguarding quality standards.",
        "text_ar": "يعيد تصميم العمليات لإزالة الهدر وتبسيط الخطوات مع الحفاظ على معايير الجودة."
      },
      {
        "text_en": "Introduces practical tools or automation that make routine tasks faster and more consistent.",
        "text_ar": "يوظف أدوات عملية أو حلول أتمتة تجعل المهام الروتينية أسرع وأكثر اتساقاً."
      },
      {
        "text_en": "Tracks process performance against clear measures and adjusts methods based on the results.",
        "text_ar": "يتابع أداء العمليات وفق مؤشرات واضحة ويعدّل الأساليب بناءً على النتائج."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000015",
    "name_en": "Operating Through Uncertainty",
    "name_ar": "العمل وسط عدم اليقين",
    "display_order": 15,
    "behaviours": [
      {
        "text_en": "Keeps the team moving forward on priorities even when key information is still missing or unconfirmed.",
        "text_ar": "يواصل دفع الفريق نحو إنجاز الأولويات حتى عندما تظل معلومات أساسية غير مكتملة أو غير مؤكدة."
      },
      {
        "text_en": "Adjusts plans promptly as new information emerges, rather than clinging to the original approach.",
        "text_ar": "يعدّل الخطط بسرعة عند ظهور معلومات جديدة بدلاً من التمسك بالنهج الأصلي."
      },
      {
        "text_en": "Makes clear, timely decisions under ambiguity and explains what would trigger a change of course.",
        "text_ar": "يتخذ قرارات واضحة وفي الوقت المناسب رغم الغموض، ويوضّح ما الذي قد يستدعي تغيير المسار."
      },
      {
        "text_en": "Reassures colleagues and keeps them focused on the work when priorities shift or circumstances change unexpectedly.",
        "text_ar": "يطمئن زملاءه ويبقيهم مركّزين على العمل عند تغيّر الأولويات أو الظروف بشكل غير متوقع."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000016",
    "name_en": "Learning by Doing",
    "name_ar": "التعلّم بالممارسة",
    "display_order": 16,
    "behaviours": [
      {
        "text_en": "Tries new approaches on real tasks instead of waiting until every detail is planned.",
        "text_ar": "يجرّب أساليب جديدة في المهام الفعلية بدلاً من انتظار اكتمال كل التفاصيل قبل البدء."
      },
      {
        "text_en": "Adjusts their approach mid-task based on what earlier attempts showed was working.",
        "text_ar": "يعدّل أسلوبه أثناء أداء المهمة بناءً على ما أظهرته المحاولات السابقة من نجاح."
      },
      {
        "text_en": "Volunteers for unfamiliar assignments to build skills through direct, hands-on experience.",
        "text_ar": "يتطوّع للمهام غير المألوفة لاكتساب المهارات من خلال الخبرة العملية المباشرة."
      },
      {
        "text_en": "Runs a review after a task to capture what worked, then acts on it next time.",
        "text_ar": "يجري مراجعة بعد إنجاز المهمة لرصد ما نجح، ثم يطبّق ذلك في المهمة التالية."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000017",
    "name_en": "Resilience Under Pressure",
    "name_ar": "الصمود تحت الضغط",
    "display_order": 17,
    "behaviours": [
      {
        "text_en": "Stays calm and keeps communicating clearly in stressful situations, helping the team stay focused rather than react.",
        "text_ar": "يظل هادئًا ويواصل التواصل بوضوح في المواقف الضاغطة، مما يساعد الفريق على التركيز بدلًا من الانفعال."
      },
      {
        "text_en": "Recovers quickly from setbacks, refocusing on next steps instead of dwelling on what went wrong.",
        "text_ar": "يستعيد تركيزه بسرعة بعد الإخفاقات، ويتّجه نحو الخطوات التالية بدلًا من الانشغال بما حدث."
      },
      {
        "text_en": "Sustains work quality and reliable delivery even when workload, deadlines, or demands intensify.",
        "text_ar": "يحافظ على جودة عمله والتزامه بالتسليم حتى مع تزايد أعباء العمل والمواعيد والمتطلبات."
      },
      {
        "text_en": "Voices concerns constructively under pressure without transferring stress or blame onto colleagues.",
        "text_ar": "يعبّر عن مخاوفه بطريقة بنّاءة تحت الضغط دون نقل التوتر أو إلقاء اللوم على زملائه."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000018",
    "name_en": "Mobilising Around Purpose",
    "name_ar": "الحشد حول الغاية",
    "display_order": 18,
    "behaviours": [
      {
        "text_en": "Connects the team's day-to-day work to a clear, shared purpose that people can act on.",
        "text_ar": "يربط عمل الفريق اليومي بغاية واضحة ومشتركة يستطيع الأفراد العمل على أساسها."
      },
      {
        "text_en": "Rallies colleagues behind change, translating the reason for it into practical next steps.",
        "text_ar": "يحشد الزملاء حول التغيير ويترجم مبرراته إلى خطوات عملية للمضي قدماً."
      },
      {
        "text_en": "Tailors how the purpose is communicated to keep different groups engaged as circumstances change.",
        "text_ar": "يكيّف طريقة توصيل الغاية للحفاظ على تفاعل المجموعات المختلفة مع تغيّر الظروف."
      },
      {
        "text_en": "Recognises and celebrates progress toward the shared goal to sustain momentum and commitment.",
        "text_ar": "يقدّر ويحتفي بالتقدم نحو الهدف المشترك للحفاظ على الزخم والالتزام."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000019",
    "name_en": "Clear & Adaptive Communication",
    "name_ar": "التواصل الواضح والمرن",
    "display_order": 19,
    "behaviours": [
      {
        "text_en": "Adjusts the level of detail and language to match the audience's role and background.",
        "text_ar": "يكيّف مستوى التفصيل والأسلوب اللغوي بما يتناسب مع دور الجمهور وخلفيته."
      },
      {
        "text_en": "Explains the reasoning behind decisions so others can follow the logic clearly.",
        "text_ar": "يوضّح الأسباب الكامنة وراء القرارات بحيث يتمكّن الآخرون من متابعة المنطق بوضوح."
      },
      {
        "text_en": "Invites questions and confirms that key points were understood before moving on.",
        "text_ar": "يدعو الآخرين إلى طرح الأسئلة ويتأكّد من فهم النقاط الرئيسية قبل الانتقال إلى غيرها."
      },
      {
        "text_en": "States difficult or sensitive messages directly and respectfully without avoiding the point.",
        "text_ar": "يطرح الرسائل الصعبة أو الحسّاسة بصراحة واحترام دون تجنّب صُلب الموضوع."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000020",
    "name_en": "Persuasion & Buy-in",
    "name_ar": "الإقناع وكسب التأييد",
    "display_order": 20,
    "behaviours": [
      {
        "text_en": "Tailors arguments to what each audience cares about, framing proposals around their priorities and concerns.",
        "text_ar": "يصوغ حججه بما يتناسب مع اهتمامات كل فئة من الجمهور، ويعرض مقترحاته بما يخدم أولوياتهم وشواغلهم."
      },
      {
        "text_en": "Supports positions with clear evidence, examples, and data that make the case credible to others.",
        "text_ar": "يدعم مواقفه بأدلة وأمثلة وبيانات واضحة تجعل طرحه مقنعاً وموثوقاً لدى الآخرين."
      },
      {
        "text_en": "Listens to objections and addresses concerns directly to bring hesitant colleagues on board.",
        "text_ar": "ينصت إلى الاعتراضات ويعالج المخاوف بشكل مباشر لكسب تأييد الزملاء المترددين."
      },
      {
        "text_en": "Builds support ahead of key decisions by engaging stakeholders early to secure their commitment.",
        "text_ar": "يبني التأييد قبل القرارات المهمة من خلال إشراك أصحاب المصلحة مبكراً لضمان التزامهم."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000021",
    "name_en": "Constructive Conflict Handling",
    "name_ar": "إدارة الخلاف البنّاءة",
    "display_order": 21,
    "behaviours": [
      {
        "text_en": "Raises disagreements openly and calmly, focusing on the issue rather than the person.",
        "text_ar": "يطرح نقاط الخلاف بصراحة وهدوء، مع التركيز على الموضوع لا على الأشخاص."
      },
      {
        "text_en": "Restates opposing viewpoints accurately before offering their own response.",
        "text_ar": "يعيد صياغة وجهات النظر المخالفة بدقة قبل أن يطرح رده الخاص."
      },
      {
        "text_en": "Steers heated discussions toward practical solutions both sides can accept.",
        "text_ar": "يوجّه النقاشات المحتدمة نحو حلول عملية يقبلها الطرفان."
      },
      {
        "text_en": "Follows up after a dispute to rebuild trust and preserve the working relationship.",
        "text_ar": "يتابع بعد الخلاف لإعادة بناء الثقة والحفاظ على علاقة العمل."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000022",
    "name_en": "Principled Negotiation",
    "name_ar": "التفاوض المبدئي",
    "display_order": 22,
    "behaviours": [
      {
        "text_en": "Separates the people from the problem, addressing issues firmly while keeping working relationships respectful.",
        "text_ar": "يفصل بين الأشخاص والمشكلة، فيعالج القضايا بحزم مع الحفاظ على احترام علاقات العمل."
      },
      {
        "text_en": "Explores the underlying interests behind each party's stated positions before proposing solutions.",
        "text_ar": "يستكشف المصالح الحقيقية الكامنة وراء المواقف المعلنة لكل طرف قبل اقتراح الحلول."
      },
      {
        "text_en": "Generates several options that create value for both sides rather than pushing a single demand.",
        "text_ar": "يطرح عدة خيارات تحقق مكاسب للطرفين بدلاً من الإصرار على مطلب واحد."
      },
      {
        "text_en": "Bases agreements on objective criteria and fair standards rather than pressure or positional bargaining.",
        "text_ar": "يستند في الاتفاقات إلى معايير موضوعية وأسس عادلة بدلاً من الضغط أو المساومة على المواقف."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000023",
    "name_en": "Relationship Networks",
    "name_ar": "شبكات العلاقات",
    "display_order": 23,
    "behaviours": [
      {
        "text_en": "Builds working relationships across departments before needing their help or cooperation.",
        "text_ar": "يبني علاقات عمل مع مختلف الإدارات قبل أن يحتاج إلى مساعدتها أو تعاونها."
      },
      {
        "text_en": "Connects colleagues to useful contacts in their network when it helps them progress work.",
        "text_ar": "يعرّف الزملاء على جهات مفيدة ضمن شبكة علاقاته عندما يساعدهم ذلك على إنجاز أعمالهم."
      },
      {
        "text_en": "Stays in regular contact with key stakeholders outside their immediate team, not only during projects.",
        "text_ar": "يبقى على تواصل منتظم مع الأطراف المعنية الرئيسية خارج فريقه المباشر، وليس فقط أثناء المشاريع."
      },
      {
        "text_en": "Draws on external contacts and industry peers to bring in information or resources the team needs.",
        "text_ar": "يستعين بجهات خارجية وأقران من القطاع لجلب المعلومات أو الموارد التي يحتاجها الفريق."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000024",
    "name_en": "Coaching & Talent Growth",
    "name_ar": "التوجيه وتنمية المواهب",
    "display_order": 24,
    "behaviours": [
      {
        "text_en": "Holds regular development conversations that help team members set and pursue clear growth goals.",
        "text_ar": "يعقد محادثات تطويرية منتظمة تساعد أعضاء الفريق على تحديد أهداف نمو واضحة والسعي إلى تحقيقها."
      },
      {
        "text_en": "Gives specific, timely feedback that helps others improve their performance and build new skills.",
        "text_ar": "يقدّم ملاحظات محددة وفي الوقت المناسب تساعد الآخرين على تحسين أدائهم واكتساب مهارات جديدة."
      },
      {
        "text_en": "Delegates stretch assignments that build team members' capabilities beyond their current role.",
        "text_ar": "يوكل مهامّ صعبة تنمّي قدرات أعضاء الفريق إلى ما يتجاوز أدوارهم الحالية."
      },
      {
        "text_en": "Guides people toward career and advancement opportunities that match their individual strengths.",
        "text_ar": "يوجّه الأشخاص نحو فرص مهنية وفرص للتقدّم تتناسب مع نقاط قوتهم الفردية."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000025",
    "name_en": "Building Cohesive Teams",
    "name_ar": "بناء فرق متماسكة",
    "display_order": 25,
    "behaviours": [
      {
        "text_en": "Sets shared team goals and clarifies how each member's role contributes to them.",
        "text_ar": "يضع أهدافاً مشتركة للفريق ويوضح كيف يسهم دور كل عضو في تحقيقها."
      },
      {
        "text_en": "Addresses tension between team members openly and helps them reach a workable resolution.",
        "text_ar": "يعالج التوتر بين أعضاء الفريق بصراحة ويساعدهم على التوصل إلى حل عملي."
      },
      {
        "text_en": "Creates opportunities for members to collaborate and draw on each other's strengths.",
        "text_ar": "يهيئ فرصاً لأعضاء الفريق للتعاون والاستفادة من نقاط قوة بعضهم بعضاً."
      },
      {
        "text_en": "Publicly recognizes the team's collective achievements rather than singling out individuals.",
        "text_ar": "يشيد علناً بالإنجازات الجماعية للفريق بدلاً من إبراز أفراد بعينهم."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000026",
    "name_en": "Cross-Functional Collaboration",
    "name_ar": "التعاون عبر الوظائف",
    "display_order": 26,
    "behaviours": [
      {
        "text_en": "Shares relevant information and updates proactively with colleagues in other departments rather than waiting to be asked.",
        "text_ar": "يبادر بمشاركة المعلومات والمستجدات ذات الصلة مع الزملاء في الإدارات الأخرى دون انتظار أن يُطلب منه ذلك."
      },
      {
        "text_en": "Involves the right people from other functions early when planning work that affects them.",
        "text_ar": "يُشرك الأشخاص المعنيين من الوظائف الأخرى في وقت مبكر عند التخطيط لأعمال تؤثر عليهم."
      },
      {
        "text_en": "Adjusts own plans and priorities to align with the needs of partner teams toward shared goals.",
        "text_ar": "يعدّل خططه وأولوياته بما يتوافق مع احتياجات الفرق الشريكة لتحقيق الأهداف المشتركة."
      },
      {
        "text_en": "Addresses disagreements between teams openly and works to reach practical solutions together.",
        "text_ar": "يعالج الخلافات بين الفرق بصراحة ويعمل على التوصل إلى حلول عملية بصورة مشتركة."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000027",
    "name_en": "Trust & Credibility",
    "name_ar": "الثقة والمصداقية",
    "display_order": 27,
    "behaviours": [
      {
        "text_en": "Follows through on commitments and delivers what was promised within agreed timeframes.",
        "text_ar": "يفي بالتزاماته ويحقق ما وعد به ضمن الأطر الزمنية المتفق عليها."
      },
      {
        "text_en": "Gives consistent, honest answers even when the message is difficult or unwelcome.",
        "text_ar": "يقدم إجابات صادقة ومتسقة حتى عندما تكون الرسالة صعبة أو غير مستحبة."
      },
      {
        "text_en": "Acknowledges own mistakes openly rather than concealing them or shifting blame.",
        "text_ar": "يعترف بأخطائه بصراحة بدلاً من إخفائها أو إلقاء اللوم على الآخرين."
      },
      {
        "text_en": "Handles sensitive or confidential information discreetly and does not disclose it inappropriately.",
        "text_ar": "يتعامل مع المعلومات الحساسة أو السرية بتكتم ولا يفشيها بشكل غير لائق."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000028",
    "name_en": "Interpersonal Adaptability",
    "name_ar": "المرونة في التعامل",
    "display_order": 28,
    "behaviours": [
      {
        "text_en": "Adjusts communication style and tone to suit different colleagues, seniority levels, and cultural backgrounds.",
        "text_ar": "يكيّف أسلوب تواصله ونبرته بما يناسب مختلف الزملاء والمستويات الوظيفية والخلفيات الثقافية."
      },
      {
        "text_en": "Stays composed and shifts approach when discussions become tense or plans change unexpectedly.",
        "text_ar": "يظل متماسكًا ويعدّل أسلوبه عندما تحتدم النقاشات أو تتغير الخطط بشكل مفاجئ."
      },
      {
        "text_en": "Varies how they delegate and support work to match each team member's needs and readiness.",
        "text_ar": "ينوّع طريقة توزيعه للمهام ودعمه للعمل بما يتناسب مع احتياجات كل فرد في الفريق ومدى جاهزيته."
      },
      {
        "text_en": "Invites differing viewpoints and adjusts their position when others raise valid concerns.",
        "text_ar": "يرحّب بوجهات النظر المختلفة ويعدّل موقفه عندما يطرح الآخرون ملاحظات وجيهة."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000029",
    "name_en": "Self-Insight",
    "name_ar": "الاستبصار الذاتي",
    "display_order": 29,
    "behaviours": [
      {
        "text_en": "Names their own strengths and limitations accurately when discussing their work or decisions.",
        "text_ar": "يحدد نقاط قوته وحدود قدراته بدقة عند مناقشة عمله أو قراراته."
      },
      {
        "text_en": "Acknowledges the impact of their behaviour on others without becoming defensive.",
        "text_ar": "يقر بأثر سلوكه على الآخرين دون أن يتخذ موقفاً دفاعياً."
      },
      {
        "text_en": "Asks others how they come across and refers to that feedback in later conversations.",
        "text_ar": "يسأل الآخرين عن الانطباع الذي يتركه لديهم ويستند إلى ملاحظاتهم في أحاديثه اللاحقة."
      },
      {
        "text_en": "Openly names their own reactions or blind spots as they arise in a discussion.",
        "text_ar": "يذكر بصراحة ردود أفعاله أو جوانب قصوره الخفية عند ظهورها أثناء النقاش."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000030",
    "name_en": "Emotional Regulation & Empathy",
    "name_ar": "تنظيم الانفعالات والتعاطف",
    "display_order": 30,
    "behaviours": [
      {
        "text_en": "Stays composed and speaks calmly when facing pressure, setbacks, or provocation.",
        "text_ar": "يحافظ على هدوئه ويتحدث برويّة عند مواجهة الضغوط أو الانتكاسات أو الاستفزاز."
      },
      {
        "text_en": "Adjusts tone and approach when noticing that a colleague is stressed or upset.",
        "text_ar": "يعدّل أسلوبه ونبرة حديثه عندما يلاحظ أن أحد الزملاء متوتر أو منزعج."
      },
      {
        "text_en": "Listens attentively to others' concerns and names their feelings before responding.",
        "text_ar": "يُصغي باهتمام إلى مخاوف الآخرين ويُعبّر عن تفهّمه لمشاعرهم قبل أن يردّ."
      },
      {
        "text_en": "Pauses to manage own reaction before responding in tense or difficult conversations.",
        "text_ar": "يتمهّل ليضبط ردة فعله قبل الاستجابة في المحادثات المتوترة أو الصعبة."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000031",
    "name_en": "Principled Courage",
    "name_ar": "الشجاعة المبدئية",
    "display_order": 31,
    "behaviours": [
      {
        "text_en": "Raises ethical concerns about a decision even when others in the room stay silent.",
        "text_ar": "يثير المخاوف الأخلاقية بشأن قرار ما حتى عندما يلتزم الآخرون في الاجتماع الصمت."
      },
      {
        "text_en": "Delivers unwelcome news or bad results directly to senior colleagues instead of softening or avoiding them.",
        "text_ar": "ينقل الأخبار غير السارة أو النتائج السلبية بشكل مباشر إلى كبار الزملاء بدلاً من تلطيفها أو تجنبها."
      },
      {
        "text_en": "Maintains the same position under pressure rather than changing it for convenience or approval.",
        "text_ar": "يحافظ على موقفه ذاته تحت الضغط بدلاً من تغييره طلباً للراحة أو لنيل الرضا."
      },
      {
        "text_en": "Speaks up against unfair or improper conduct openly, regardless of the seniority of those involved.",
        "text_ar": "يعترض علناً على السلوك غير العادل أو غير اللائق بغض النظر عن المستوى الوظيفي للأشخاص المعنيين."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000032",
    "name_en": "Ethical Conduct",
    "name_ar": "السلوك الأخلاقي",
    "display_order": 32,
    "behaviours": [
      {
        "text_en": "Reports facts and results truthfully, without overstating, hiding, or spinning inconvenient information.",
        "text_ar": "ينقل الحقائق والنتائج بصدق دون مبالغة أو إخفاء أو تحوير للمعلومات غير المريحة."
      },
      {
        "text_en": "Declares conflicts of interest openly rather than concealing personal stakes in decisions.",
        "text_ar": "يفصح عن تعارض المصالح بشفافية بدلاً من إخفاء مصالحه الشخصية في القرارات."
      },
      {
        "text_en": "Raises concerns about improper conduct even when it is unpopular or risky to do so.",
        "text_ar": "يثير المخاوف بشأن السلوكيات غير السليمة حتى وإن كان ذلك غير مستحب أو محفوفاً بالمخاطر."
      },
      {
        "text_en": "Applies rules and standards consistently to everyone, without favouritism or double standards.",
        "text_ar": "يطبّق القواعد والمعايير على الجميع بشكل متسق دون محاباة أو ازدواجية في المعايير."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000033",
    "name_en": "Cultural & Inclusive Sensitivity",
    "name_ar": "الحساسية الثقافية والشمول",
    "display_order": 33,
    "behaviours": [
      {
        "text_en": "Adapts communication style and etiquette to fit the cultural norms of the people present.",
        "text_ar": "يكيّف أسلوب تواصله وآداب تعامله بما يناسب الأعراف الثقافية للحاضرين."
      },
      {
        "text_en": "Invites input from quieter or minority voices so all backgrounds contribute to discussions.",
        "text_ar": "يدعو أصحاب الأصوات الأقل ظهوراً أو الأقلية إلى الإدلاء بآرائهم ليشارك الجميع باختلاف خلفياتهم في النقاش."
      },
      {
        "text_en": "Accommodates religious observances, national customs, and language differences when scheduling and running work.",
        "text_ar": "يراعي المناسبات الدينية والعادات الوطنية والفروق اللغوية عند تنظيم العمل وإدارته."
      },
      {
        "text_en": "Challenges biased or exclusionary remarks and jokes when they occur among colleagues.",
        "text_ar": "يتصدّى للملاحظات أو النكات المنحازة أو الإقصائية عند صدورها بين الزملاء."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000034",
    "name_en": "Adaptive Learning Capacity",
    "name_ar": "القدرة على التعلّم التكيّفي",
    "display_order": 34,
    "behaviours": [
      {
        "text_en": "Adjusts their approach after receiving feedback rather than repeating the same methods",
        "text_ar": "يعدّل أسلوبه بعد تلقّي الملاحظات بدلاً من تكرار الطرق نفسها"
      },
      {
        "text_en": "Seeks out new skills or knowledge when facing unfamiliar tasks or tools",
        "text_ar": "يسعى إلى اكتساب مهارات أو معارف جديدة عند مواجهة مهام أو أدوات غير مألوفة"
      },
      {
        "text_en": "Applies lessons from past mistakes to improve how they handle later situations",
        "text_ar": "يوظّف الدروس المستفادة من الأخطاء السابقة لتحسين تعامله مع المواقف اللاحقة"
      },
      {
        "text_en": "Tries a different method when an initial approach fails to produce results",
        "text_ar": "يجرّب طريقة مختلفة عندما لا يحقّق النهج الأولي النتائج المرجوة"
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000035",
    "name_en": "Continuous Self-Development",
    "name_ar": "التطوير الذاتي المستمر",
    "display_order": 35,
    "behaviours": [
      {
        "text_en": "Seeks feedback on their performance and acts on it to improve their work.",
        "text_ar": "يطلب ملاحظات حول أدائه ويعمل بها لتحسين عمله."
      },
      {
        "text_en": "Sets aside time to learn new skills or knowledge relevant to their role.",
        "text_ar": "يخصّص وقتاً لاكتساب مهارات أو معارف جديدة تتّصل بمهام عمله."
      },
      {
        "text_en": "Applies lessons from past mistakes to change how they approach similar situations.",
        "text_ar": "يطبّق دروس أخطائه السابقة لتغيير طريقة تعامله مع المواقف المشابهة."
      },
      {
        "text_en": "Takes on unfamiliar tasks or stretch assignments to broaden their capabilities.",
        "text_ar": "يتولّى مهامّ غير مألوفة أو تكليفات تتجاوز قدراته الحالية لتوسيع كفاءاته."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000036",
    "name_en": "Composure Under Stress",
    "name_ar": "رباطة الجأش تحت الضغط",
    "display_order": 36,
    "behaviours": [
      {
        "text_en": "Stays calm and keeps a steady tone when facing tight deadlines, setbacks, or difficult conversations.",
        "text_ar": "يحافظ على هدوئه ونبرة صوته المتزنة عند مواجهة المواعيد النهائية الضيقة أو الإخفاقات أو المحادثات الصعبة."
      },
      {
        "text_en": "Keeps working methodically and stays organized under pressure rather than rushing or becoming flustered.",
        "text_ar": "يواصل العمل بمنهجية ويبقى منظماً تحت الضغط بدلاً من التسرّع أو الارتباك."
      },
      {
        "text_en": "Responds to criticism or provocation without becoming defensive or reacting impulsively.",
        "text_ar": "يتعامل مع النقد أو الاستفزاز دون أن يتخذ موقفاً دفاعياً أو يتصرف باندفاع."
      },
      {
        "text_en": "Reassures and steadies the team during crises, helping others stay focused on the task.",
        "text_ar": "يبثّ الطمأنينة في الفريق ويثبّته أثناء الأزمات، ويساعد الآخرين على البقاء مركّزين على المهمة."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000037",
    "name_en": "Sustainable Wellbeing",
    "name_ar": "العافية المستدامة",
    "display_order": 37,
    "behaviours": [
      {
        "text_en": "Sustains a steady work pace across demanding periods instead of alternating intense crunches with visible exhaustion.",
        "text_ar": "يحافظ على وتيرة عمل ثابتة خلال الفترات الضاغطة بدلاً من التنقل بين نوبات العمل المكثّف وحالات الإنهاك الظاهر."
      },
      {
        "text_en": "Takes and encourages breaks, leave, and recovery time, protecting the team from constant overload.",
        "text_ar": "يأخذ فترات الراحة والإجازات ويشجّع عليها، ويحمي الفريق من الإرهاق المتواصل."
      },
      {
        "text_en": "Sets realistic boundaries on availability and response times, respecting others' personal and family time.",
        "text_ar": "يضع حدوداً واقعية لأوقات التواصل والاستجابة، ويحترم أوقات الآخرين الشخصية والعائلية."
      },
      {
        "text_en": "Openly discusses workload pressures and adjusts commitments to keep demands within healthy limits.",
        "text_ar": "يناقش ضغوط العمل بصراحة ويعدّل الالتزامات لإبقاء المتطلبات ضمن حدود صحية."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000038",
    "name_en": "Resource Mobilisation",
    "name_ar": "حشد الموارد",
    "display_order": 38,
    "behaviours": [
      {
        "text_en": "Secures the budget, people, and tools needed to deliver on commitments before work stalls.",
        "text_ar": "يؤمّن الميزانية والكوادر والأدوات اللازمة لإنجاز الالتزامات قبل أن يتعثّر العمل."
      },
      {
        "text_en": "Draws on contacts across departments to obtain resources that sit outside their direct control.",
        "text_ar": "يستعين بعلاقاته عبر الإدارات المختلفة للحصول على موارد تقع خارج نطاق سيطرته المباشرة."
      },
      {
        "text_en": "Redirects people and funds toward the highest priorities as circumstances change.",
        "text_ar": "يعيد توجيه الكوادر والأموال نحو الأولويات الأهم كلما تغيّرت الظروف."
      },
      {
        "text_en": "Makes a clear, evidence-based case to decision-makers when requesting additional resources.",
        "text_ar": "يقدّم حجة واضحة قائمة على الأدلة لأصحاب القرار عند طلب موارد إضافية."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000039",
    "name_en": "Customer Orientation",
    "name_ar": "التوجّه نحو العميل",
    "display_order": 39,
    "behaviours": [
      {
        "text_en": "Meets with customers to understand their needs before proposing solutions or services.",
        "text_ar": "يجتمع بالعملاء لفهم احتياجاتهم قبل اقتراح الحلول أو الخدمات."
      },
      {
        "text_en": "Responds to customer requests and complaints promptly and follows up until they are resolved.",
        "text_ar": "يستجيب لطلبات العملاء وشكاواهم بسرعة، ويتابعها إلى أن يتم حلها."
      },
      {
        "text_en": "Gathers customer feedback and acts on it to improve services or processes.",
        "text_ar": "يجمع ملاحظات العملاء ويعمل بها لتحسين الخدمات أو الإجراءات."
      },
      {
        "text_en": "Makes realistic commitments to customers and delivers on them as promised.",
        "text_ar": "يقطع التزامات واقعية للعملاء ويفي بها كما وعد."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000040",
    "name_en": "Stakeholder Management",
    "name_ar": "إدارة أصحاب المصلحة",
    "display_order": 40,
    "behaviours": [
      {
        "text_en": "Identifies the stakeholders affected by a decision and maps their interests and level of influence.",
        "text_ar": "يحدد أصحاب المصلحة المتأثرين بأي قرار ويحلل اهتماماتهم ومستوى نفوذهم."
      },
      {
        "text_en": "Keeps stakeholders informed with timely, tailored updates on progress and changes that concern them.",
        "text_ar": "يبقي أصحاب المصلحة على اطلاع من خلال تحديثات منتظمة ومناسبة لكل منهم حول ما يعنيهم من مستجدات وتغييرات."
      },
      {
        "text_en": "Listens to competing stakeholder needs and negotiates workable agreements that balance their priorities.",
        "text_ar": "ينصت إلى احتياجات أصحاب المصلحة المتعارضة ويتفاوض على حلول عملية توازن بين أولوياتهم."
      },
      {
        "text_en": "Follows through on commitments made to stakeholders and addresses their concerns before they escalate.",
        "text_ar": "يفي بالالتزامات التي يقطعها لأصحاب المصلحة ويعالج مخاوفهم قبل أن تتفاقم."
      }
    ]
  },
  {
    "ac_competency_id": "a0000001-0000-0000-0000-000000000041",
    "name_en": "Value Creation",
    "name_ar": "خلق القيمة",
    "display_order": 41,
    "behaviours": [
      {
        "text_en": "Identifies unmet customer or stakeholder needs and turns them into practical service or product improvements.",
        "text_ar": "يحدد احتياجات العملاء وأصحاب المصلحة غير الملبّاة ويحولها إلى تحسينات عملية في الخدمات أو المنتجات."
      },
      {
        "text_en": "Prioritises work that delivers measurable benefit to clients over activity that adds little value.",
        "text_ar": "يعطي الأولوية للأعمال التي تحقق فائدة ملموسة للعملاء بدلاً من الأنشطة قليلة القيمة."
      },
      {
        "text_en": "Spots opportunities to increase value and quantifies the expected benefit when proposing them.",
        "text_ar": "يرصد الفرص المتاحة لزيادة القيمة، ويقدّر الفائدة المتوقعة منها عند اقتراحها."
      },
      {
        "text_en": "Links team decisions to the outcomes and returns that matter most to clients and the organisation.",
        "text_ar": "يربط قرارات الفريق بالنتائج والعوائد الأكثر أهمية للعملاء والمؤسسة."
      }
    ]
  }
];
