// Report-specific translations. Open-text answer content is never
// translated per handover §5.4 — only static UI labels live here.

export type ReportLang = "en" | "ar";

type Dict = Record<string, string>;

const EN: Dict = {
  confidential_internal: "Confidential — For Internal VIFM Use",
  confidential_sample: "Confidential — Sample — Not for Client Distribution",
  report_title: "AI Readiness Assessment Report",
  report_generated: "Report generated",
  org_suffix: "Virginia Institute of Finance and Management",

  exec_summary: "Executive Summary",
  how_to_read: "How to Read This Report",
  maturity_scale: "Maturity Scale",
  overall_interpretation: "Overall Score Interpretation",
  compliance_status: "Compliance Status",
  org_profile: "Organization Profile",
  client_details: "Client details",
  methodology: "Methodology",
  respondents: "Respondents",
  pillar_overview: "Pillar Overview",
  pillar_deep_dive: "Pillar Deep Dive",
  recommendations_suffix: "Recommendations",
  key_findings: "Key findings",
  suggested_actions: "Suggested actions",
  strengths_gaps: "Strengths & Gaps Summary",
  traffic_light: "Traffic-light grid",
  benchmark_comparison: "Benchmark comparison",
  gap_heatmap: "Gap analysis heatmap",
  investment_matrix: "Investment priority matrix",
  roadmap: "AI Readiness Roadmap",
  compliance_summary: "Regulatory Compliance Summary",
  supporting_materials: "Supporting Materials",
  next_steps: "Next Steps with VIFM",
  appendix: "Appendix",

  overall_readiness: "Overall AI Readiness",
  headline_strengths: "Headline strengths",
  critical_gaps: "Critical gaps",
  raw_score: "Raw score",
  vs_benchmark: "Score vs benchmark",
  ai_ready_benchmark: "AI Ready benchmark",
  perception_vs_reality: "Perception vs Reality",
  client_rated: "Client rated",
  consultant_validated: "Consultant validated",
  gap: "Gap",

  level: "Level",
  label: "Label",
  score_range: "Score range",
  interpretation: "Interpretation",

  compliant: "Compliant",
  partially_compliant: "Partially Compliant",
  action_required: "Action Required",
  needs_verification: "Needs Verification",

  shadow_ai_alert: "Shadow AI Alert",
  shadow_ai_body: "Assessment responses indicate employees may be using public AI tools without formal organizational approval. This creates potential violations of data protection and cybersecurity regulations. Immediate action required.",

  quick_wins: "Quick Wins",
  build_horizon: "Build",
  transform_horizon: "Transform",
  months_0_3: "0–3 months",
  months_3_9: "3–9 months",
  months_9_12: "9–12 months",

  scoring_methodology: "Scoring methodology",
  weights_used: "Pillar weights used",
  disclaimer: "Disclaimer",
  retention_notice: "Data retention notice",

  name: "Name",
  role: "Role",
  pillars_assigned: "Pillars assigned",
  status: "Status",
  completed: "Completed",
  in_progress: "In progress",

  pillar: "Pillar",
  current: "Current",
  ai_ready: "AI Ready",
  gcc_best: "GCC Best",
  gap_col: "Gap",

  type_col: "Type",
  name_col: "Name",
  submitted_by: "Submitted by",

  maturity_l1: "No AI activity or understanding.",
  maturity_l2: "Early discovery; ad-hoc pilots.",
  maturity_l3: "Active development; policies emerging.",
  maturity_l4: "AI-ready; systematic deployment.",
  maturity_l5: "Leading practice; embedded at scale.",
};

const AR: Dict = {
  confidential_internal: "سري — لاستخدام VIFM الداخلي",
  confidential_sample: "سري — عينة — غير مخصص للتوزيع على العميل",
  report_title: "تقرير تقييم الاستعداد للذكاء الاصطناعي",
  report_generated: "تاريخ إصدار التقرير",
  org_suffix: "معهد فرجينيا للتمويل والإدارة",

  exec_summary: "الملخص التنفيذي",
  how_to_read: "كيفية قراءة هذا التقرير",
  maturity_scale: "مقياس النضج",
  overall_interpretation: "تفسير النتيجة الإجمالية",
  compliance_status: "حالة الامتثال",
  org_profile: "ملف المنظمة",
  client_details: "بيانات العميل",
  methodology: "المنهجية",
  respondents: "المستجيبون",
  pillar_overview: "نظرة عامة على الركائز",
  pillar_deep_dive: "تحليل تفصيلي للركيزة",
  recommendations_suffix: "التوصيات",
  key_findings: "النتائج الرئيسية",
  suggested_actions: "الإجراءات المقترحة",
  strengths_gaps: "ملخص نقاط القوة والفجوات",
  traffic_light: "شبكة إشارة المرور",
  benchmark_comparison: "مقارنة المعايير",
  gap_heatmap: "خريطة حرارية لتحليل الفجوات",
  investment_matrix: "مصفوفة أولويات الاستثمار",
  roadmap: "خارطة طريق الاستعداد للذكاء الاصطناعي",
  compliance_summary: "ملخص الامتثال التنظيمي",
  supporting_materials: "المواد الداعمة",
  next_steps: "الخطوات التالية مع VIFM",
  appendix: "الملحق",

  overall_readiness: "الاستعداد الإجمالي للذكاء الاصطناعي",
  headline_strengths: "نقاط القوة الرئيسية",
  critical_gaps: "الفجوات الحرجة",
  raw_score: "النتيجة الخام",
  vs_benchmark: "النتيجة مقارنةً بالمعيار",
  ai_ready_benchmark: "معيار الجاهزية للذكاء الاصطناعي",
  perception_vs_reality: "التصور مقابل الواقع",
  client_rated: "تقييم العميل",
  consultant_validated: "تحقق المستشار",
  gap: "الفجوة",

  level: "المستوى",
  label: "التسمية",
  score_range: "نطاق النتيجة",
  interpretation: "التفسير",

  compliant: "ممتثل",
  partially_compliant: "ممتثل جزئياً",
  action_required: "يتطلب إجراء",
  needs_verification: "يحتاج تحقق",

  shadow_ai_alert: "تنبيه الذكاء الاصطناعي الخفي",
  shadow_ai_body: "تشير استجابات التقييم إلى أن الموظفين قد يستخدمون أدوات الذكاء الاصطناعي العامة دون موافقة رسمية. يُعدّ هذا انتهاكاً محتملاً للوائح حماية البيانات والأمن السيبراني. يلزم اتخاذ إجراء فوري.",

  quick_wins: "مكاسب سريعة",
  build_horizon: "البناء",
  transform_horizon: "التحول",
  months_0_3: "٠–٣ أشهر",
  months_3_9: "٣–٩ أشهر",
  months_9_12: "٩–١٢ شهراً",

  scoring_methodology: "منهجية التقييم",
  weights_used: "أوزان الركائز المستخدمة",
  disclaimer: "إخلاء المسؤولية",
  retention_notice: "إشعار الاحتفاظ بالبيانات",

  name: "الاسم",
  role: "الدور",
  pillars_assigned: "الركائز المعينة",
  status: "الحالة",
  completed: "مكتمل",
  in_progress: "قيد التنفيذ",

  pillar: "الركيزة",
  current: "الحالي",
  ai_ready: "جاهز للذكاء الاصطناعي",
  gcc_best: "أفضل ممارسة خليجية",
  gap_col: "الفجوة",

  type_col: "النوع",
  name_col: "الاسم",
  submitted_by: "مُقدَّم من",

  maturity_l1: "لا يوجد نشاط أو فهم للذكاء الاصطناعي.",
  maturity_l2: "اكتشاف مبكر؛ تجارب متفرقة.",
  maturity_l3: "تطوير نشط؛ سياسات ناشئة.",
  maturity_l4: "جاهز للذكاء الاصطناعي؛ نشر منهجي.",
  maturity_l5: "ممارسة رائدة؛ مدمجة على نطاق واسع.",
};

export function tr(lang: ReportLang, key: keyof typeof EN): string {
  return (lang === "ar" ? AR : EN)[key] ?? (EN[key] as string);
}
