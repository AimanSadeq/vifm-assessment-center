/**
 * ============================================================
 *  seed-compass-promo.ts
 *  -----------------------------------------------------------
 *  Purpose: seed a camera-ready "hero org" for the VIFM AI
 *  Readiness Compass 30-second promo video. Hands the video
 *  producer a portal that is already populated with realistic,
 *  photogenic numbers at every screen the video needs to show.
 *
 *  See: VIFM_Compass_Promo_Handover.md §9.2 for the spec.
 *
 *  Run:
 *    npx tsx scripts/seed-compass-promo.ts
 *
 *  Idempotent: re-running wipes the promo assessment and its
 *  children, then recreates everything from scratch. The demo
 *  organization is kept across runs (so its id stays stable).
 * ============================================================
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// ─── Connection ────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "\n[seed-compass-promo] Missing NEXT_PUBLIC_SUPABASE_URL or " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local. Aborting.\n"
  );
  process.exit(1);
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Demo content ──────────────────────────────────────────────

const ORG_NAME_EN = "Al Noor Bank";
const ORG_NAME_AR = "مصرف النور";

/**
 * Pillar scores chosen to hit overall 4.08 ("Advanced") with
 * enough variance to give the radar chart a distinctive shape
 * and the report credible "strengths vs. gaps" moments.
 *
 * Targets are 0.2-step increments so they are exactly reproducible
 * from 5 integer responses per pillar (the responses also seeded
 * below). This keeps aggregate displays coherent with the response
 * heatmap.
 *
 *   (4.6 + 4.4 + 4.0 + 3.6 + 3.8 + 4.6 + 4.0 + 3.6) / 8 = 4.075 → 4.08
 */
const PILLAR_SCORES: Array<{
  pillar_id: string;
  raw_score: number;
  maturity_level: 1 | 2 | 3 | 4 | 5;
  maturity_label_en: string;
  maturity_label_ar: string;
}> = [
  { pillar_id: "strategy",         raw_score: 4.6, maturity_level: 5, maturity_label_en: "Leading",    maturity_label_ar: "رائد" },
  { pillar_id: "data",             raw_score: 4.4, maturity_level: 4, maturity_label_en: "Advancing",  maturity_label_ar: "يتقدم" },
  { pillar_id: "technology",       raw_score: 4.0, maturity_level: 4, maturity_label_en: "Advancing",  maturity_label_ar: "يتقدم" },
  { pillar_id: "talent",           raw_score: 3.6, maturity_level: 3, maturity_label_en: "Developing", maturity_label_ar: "يطور" },
  { pillar_id: "culture",          raw_score: 3.8, maturity_level: 3, maturity_label_en: "Developing", maturity_label_ar: "يطور" },
  { pillar_id: "governance",       raw_score: 4.6, maturity_level: 5, maturity_label_en: "Leading",    maturity_label_ar: "رائد" },
  { pillar_id: "operations",       raw_score: 4.0, maturity_level: 4, maturity_label_en: "Advancing",  maturity_label_ar: "يتقدم" },
  { pillar_id: "model_management", raw_score: 3.6, maturity_level: 3, maturity_label_en: "Developing", maturity_label_ar: "يطور" },
];

// ─── Question bank (Layer 1, 5 per pillar = 40 total) ──────────
//
// Seeded into a dedicated "promo-demo" question bank version so
// this never touches whatever is live in the real version. The
// assessment is linked to this promo version.

const PROMO_VERSION_NUMBER = "1.0-promo-demo";
const PROMO_VERSION_LABEL = "Al Noor Bank Demo Bank";

const LIKERT_OPTIONS_EN = [
  "1 - Not at all",
  "2 - Early exploration",
  "3 - In progress",
  "4 - Mostly in place",
  "5 - Comprehensive",
];
const LIKERT_OPTIONS_AR = [
  "١ - ليس بعد",
  "٢ - استكشاف مبكر",
  "٣ - قيد التقدم",
  "٤ - قائم غالباً",
  "٥ - شامل",
];
const LIKERT_SCORE_MAP: Record<string, number> = {
  "1 - Not at all":       1.0,
  "2 - Early exploration": 2.0,
  "3 - In progress":      3.0,
  "4 - Mostly in place":  4.0,
  "5 - Comprehensive":    5.0,
};

const PILLAR_QUESTIONS: Record<string, Array<{ en: string; ar: string }>> = {
  strategy: [
    {
      en: "Our organization has a documented AI strategy with a named executive sponsor and approved budget.",
      ar: "لدى منظمتنا استراتيجية موثقة للذكاء الاصطناعي مع راعٍ تنفيذي مسمى وميزانية معتمدة.",
    },
    {
      en: "AI use cases are prioritized against business value and risk on a regular cadence.",
      ar: "يتم ترتيب أولويات حالات استخدام الذكاء الاصطناعي وفق القيمة التجارية والمخاطر بشكل منتظم.",
    },
    {
      en: "The AI strategy is aligned with the organization's broader digital transformation and national AI goals.",
      ar: "استراتيجية الذكاء الاصطناعي متوافقة مع أهداف التحول الرقمي وأهداف الدولة للذكاء الاصطناعي.",
    },
    {
      en: "Board-level reviews of AI progress happen at least quarterly.",
      ar: "تُعقد مراجعات مجلس الإدارة لتقدم الذكاء الاصطناعي على الأقل كل ربع سنوي.",
    },
    {
      en: "The organization benchmarks its AI maturity against regional peers.",
      ar: "تقارن المنظمة نضج الذكاء الاصطناعي لديها مع النظراء الإقليميين.",
    },
  ],
  data: [
    {
      en: "Data quality is measured with defined KPIs across critical sources.",
      ar: "تُقاس جودة البيانات بمؤشرات أداء محددة عبر المصادر الحرجة.",
    },
    {
      en: "Data ownership is clearly assigned through a data steward model.",
      ar: "تُسند ملكية البيانات بوضوح من خلال نموذج المشرف على البيانات.",
    },
    {
      en: "Sensitive data is classified and protected according to policy and regulation.",
      ar: "تُصنف البيانات الحساسة وتُحمى وفق السياسات واللوائح.",
    },
    {
      en: "Data lineage from source systems to AI model inputs is documented and traceable.",
      ar: "نسب البيانات من الأنظمة المصدر إلى مدخلات نماذج الذكاء الاصطناعي موثق وقابل للتتبع.",
    },
    {
      en: "The organization has defined controls against 'shadow AI' (staff using unapproved AI tools on work data).",
      ar: "لدى المنظمة ضوابط محددة ضد الذكاء الاصطناعي الخفي (استخدام الموظفين لأدوات غير معتمدة).",
    },
  ],
  technology: [
    {
      en: "AI workloads run on approved cloud infrastructure with data sovereignty controls.",
      ar: "تعمل أحمال الذكاء الاصطناعي على بنية سحابية معتمدة مع ضوابط سيادة البيانات.",
    },
    {
      en: "A formal AI tool approval process governs which tools staff may use.",
      ar: "تحكم عملية اعتماد رسمية لأدوات الذكاء الاصطناعي في ما يُسمح للموظفين باستخدامه.",
    },
    {
      en: "MLOps practices (CI/CD, versioning, monitoring) are in place for production AI.",
      ar: "ممارسات MLOps (التكامل المستمر والتحكم بالإصدارات والمراقبة) مطبقة في الإنتاج.",
    },
    {
      en: "A sandbox environment exists for safe AI experimentation.",
      ar: "توجد بيئة تجريبية آمنة للتجارب على الذكاء الاصطناعي.",
    },
    {
      en: "Infrastructure can scale to support AI workloads without procurement delays.",
      ar: "البنية التحتية قابلة للتوسع لدعم أحمال الذكاء الاصطناعي دون تأخير في الشراء.",
    },
  ],
  talent: [
    {
      en: "Staff at all levels have completed AI awareness training.",
      ar: "أكمل الموظفون على جميع المستويات تدريب الوعي بالذكاء الاصطناعي.",
    },
    {
      en: "Role-based AI learning paths exist for technical and business roles.",
      ar: "توجد مسارات تعلم قائمة على الأدوار للأدوار التقنية وأدوار الأعمال.",
    },
    {
      en: "The organization has a named AI centre of excellence or equivalent.",
      ar: "لدى المنظمة مركز تميز للذكاء الاصطناعي مسمى أو ما يعادله.",
    },
    {
      en: "Hiring pipelines explicitly include AI/ML skills for relevant roles.",
      ar: "تشمل قنوات التوظيف بوضوح مهارات الذكاء الاصطناعي والتعلم الآلي للأدوار المعنية.",
    },
    {
      en: "Employee sentiment on AI adoption is regularly surveyed.",
      ar: "يُستطلع رأي الموظفين حول تبني الذكاء الاصطناعي بشكل منتظم.",
    },
  ],
  culture: [
    {
      en: "Leadership communicates AI vision and progress regularly to all staff.",
      ar: "تبلغ القيادة رؤية وتقدم الذكاء الاصطناعي لجميع الموظفين بانتظام.",
    },
    {
      en: "The organization celebrates AI wins and learns publicly from failures.",
      ar: "تحتفل المنظمة بنجاحات الذكاء الاصطناعي وتتعلم علنياً من الإخفاقات.",
    },
    {
      en: "Cross-functional teams collaborate on AI projects without silos.",
      ar: "تتعاون الفرق متعددة الوظائف على مشاريع الذكاء الاصطناعي دون حواجز.",
    },
    {
      en: "Change management accompanies every major AI rollout.",
      ar: "إدارة التغيير ترافق كل إطلاق رئيسي للذكاء الاصطناعي.",
    },
    {
      en: "Employees feel empowered to propose AI use cases from the ground up.",
      ar: "يشعر الموظفون بالقدرة على اقتراح حالات استخدام للذكاء الاصطناعي من القاعدة.",
    },
  ],
  governance: [
    {
      en: "An AI governance committee is formally chartered with defined membership and cadence.",
      ar: "لجنة حوكمة الذكاء الاصطناعي مُشكلة رسمياً بعضوية وتواتر محددين.",
    },
    {
      en: "An acceptable-use policy for AI tools is published and acknowledged by staff.",
      ar: "سياسة الاستخدام المقبول لأدوات الذكاء الاصطناعي منشورة ومُقرّة من الموظفين.",
    },
    {
      en: "AI systems are audited for compliance with applicable regulations.",
      ar: "تُدقق أنظمة الذكاء الاصطناعي للامتثال للوائح المعمول بها.",
    },
    {
      en: "An incident response playbook covers AI-specific scenarios.",
      ar: "كتيب الاستجابة للحوادث يغطي سيناريوهات خاصة بالذكاء الاصطناعي.",
    },
    {
      en: "Third-party AI tools are vetted against security, privacy, and ethics criteria.",
      ar: "تُفحص أدوات الذكاء الاصطناعي من أطراف ثالثة وفق معايير الأمن والخصوصية والأخلاقيات.",
    },
  ],
  operations: [
    {
      en: "A central inventory lists all AI use cases with status, owner, and business value.",
      ar: "مخزون مركزي يسرد جميع حالات استخدام الذكاء الاصطناعي مع الحالة والمالك والقيمة التجارية.",
    },
    {
      en: "ROI is measured and reported for production AI use cases.",
      ar: "يُقاس العائد على الاستثمار ويُبلَّغ عن حالات الاستخدام الإنتاجية.",
    },
    {
      en: "Failed pilots are retired on a defined timeline with lessons captured.",
      ar: "التجارب الفاشلة تُوقَف وفق جدول زمني محدد مع توثيق الدروس المستفادة.",
    },
    {
      en: "AI use cases are mapped to specific business outcomes or KPIs.",
      ar: "تُرتبط حالات استخدام الذكاء الاصطناعي بنتائج أعمال أو مؤشرات أداء محددة.",
    },
    {
      en: "Cross-department AI portfolio reviews happen at least biannually.",
      ar: "مراجعات محفظة الذكاء الاصطناعي عبر الإدارات تُعقد على الأقل نصف سنوية.",
    },
  ],
  model_management: [
    {
      en: "All production models are versioned and tracked in a model registry.",
      ar: "جميع نماذج الإنتاج لها إصدارات ومتتبعة في سجل نماذج.",
    },
    {
      en: "Model performance (accuracy, drift, bias) is continuously monitored.",
      ar: "أداء النماذج (الدقة والانحراف والتحيز) يُراقب باستمرار.",
    },
    {
      en: "Human review is mandatory for high-stakes model decisions.",
      ar: "المراجعة البشرية إلزامية لقرارات النماذج عالية المخاطر.",
    },
    {
      en: "Models undergo periodic fairness and bias testing.",
      ar: "تخضع النماذج لاختبار دوري للعدالة والتحيز.",
    },
    {
      en: "A retirement process removes stale or underperforming models from production.",
      ar: "عملية إيقاف محددة تزيل النماذج القديمة أو ضعيفة الأداء من الإنتاج.",
    },
  ],
};

/**
 * Integer ratings the respondent "gave" in the simulated consultancy.
 * Each array averages exactly to the corresponding PILLAR_SCORES target,
 * so the Overview tab pillar averages match these responses exactly.
 *
 *   strategy         [5, 5, 5, 4, 4] → 4.6
 *   data             [5, 4, 4, 4, 5] → 4.4
 *   technology       [4, 4, 4, 4, 4] → 4.0
 *   talent           [4, 4, 3, 3, 4] → 3.6
 *   culture          [4, 4, 3, 4, 4] → 3.8
 *   governance       [5, 5, 5, 4, 4] → 4.6
 *   operations       [4, 4, 4, 4, 4] → 4.0
 *   model_management [4, 4, 3, 3, 4] → 3.6
 */
const PILLAR_ANSWER_RATINGS: Record<string, number[]> = {
  strategy:         [5, 5, 5, 4, 4],
  data:             [5, 4, 4, 4, 5],
  technology:       [4, 4, 4, 4, 4],
  talent:           [4, 4, 3, 3, 4],
  culture:          [4, 4, 3, 4, 4],
  governance:       [5, 5, 5, 4, 4],
  operations:       [4, 4, 4, 4, 4],
  model_management: [4, 4, 3, 3, 4],
};

/**
 * Which respondent answered which pillar's questions. Each pillar is
 * owned by exactly one respondent (mirrors the assignments seeded below).
 */
const PILLAR_RESPONDENT_EMAIL: Record<string, string> = {
  strategy:         "fatima.alsayegh@alnoorbank.ae",
  model_management: "fatima.alsayegh@alnoorbank.ae",
  data:             "ali.almansouri@alnoorbank.ae",
  technology:       "ali.almansouri@alnoorbank.ae",
  governance:       "khalid.binsultan@alnoorbank.ae",
  culture:          "khalid.binsultan@alnoorbank.ae",
  operations:       "mariam.alhashimi@alnoorbank.ae",
  talent:           "mariam.alhashimi@alnoorbank.ae",
};

const OVERALL_SCORE = 4.08;
const OVERALL_LABEL_EN = "Advanced";
const OVERALL_LABEL_AR = "متقدم";
const AI_READY_BENCHMARK = 4.0;

/**
 * Four plausible Gulf-banking respondents, each covering a pair
 * of pillars so the respondents table looks varied and believable.
 */
const RESPONDENTS: Array<{
  name: string;
  name_ar: string;
  email: string;
  role_key: string;
  role_label_en: string;
  role_label_ar: string;
  language_preference: "en" | "ar";
  pillars: string[];
}> = [
  {
    name: "Ali Al-Mansouri",
    name_ar: "علي المنصوري",
    email: "ali.almansouri@alnoorbank.ae",
    role_key: "cdo",
    role_label_en: "Chief Data Officer",
    role_label_ar: "مدير البيانات التنفيذي",
    language_preference: "en",
    pillars: ["data", "technology"],
  },
  {
    name: "Fatima Al-Sayegh",
    name_ar: "فاطمة الصايغ",
    email: "fatima.alsayegh@alnoorbank.ae",
    role_key: "head_ai",
    role_label_en: "Head of AI & Innovation",
    role_label_ar: "رئيس الذكاء الاصطناعي والابتكار",
    language_preference: "en",
    pillars: ["strategy", "model_management"],
  },
  {
    name: "Khalid bin Sultan",
    name_ar: "خالد بن سلطان",
    email: "khalid.binsultan@alnoorbank.ae",
    role_key: "head_risk",
    role_label_en: "Director of Risk & Compliance",
    role_label_ar: "مدير المخاطر والامتثال",
    language_preference: "ar",
    pillars: ["governance", "culture"],
  },
  {
    name: "Mariam Al-Hashimi",
    name_ar: "مريم الهاشمي",
    email: "mariam.alhashimi@alnoorbank.ae",
    role_key: "head_digital",
    role_label_en: "Head of Digital Strategy",
    role_label_ar: "رئيس الاستراتيجية الرقمية",
    language_preference: "en",
    pillars: ["operations", "talent"],
  },
];

/**
 * Three supporting materials of varied types. URL type uses a
 * real-looking link_url; file types use plausible file_url paths
 * (non-functional downloads, but they pass the CHECK constraint
 * and render with correct icons on the UI). The video never
 * actually clicks download, so paths don't need to resolve.
 */
const MATERIALS: Array<{
  material_type: "url" | "pdf" | "word" | "powerpoint";
  material_name: string;
  file_name: string | null;
  link_url: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  respondent_email: string;
}> = [
  {
    material_type: "pdf",
    material_name: "Al Noor AI Strategy 2025-2027",
    file_name: "ai-strategy-2025-2027.pdf",
    file_url: "promo/al-noor/ai-strategy-2025-2027.pdf",
    link_url: null,
    file_size_bytes: 2_845_120,
    respondent_email: "fatima.alsayegh@alnoorbank.ae",
  },
  {
    material_type: "word",
    material_name: "Data Governance Policy (v3.2)",
    file_name: "data-governance-policy-v3.2.docx",
    file_url: "promo/al-noor/data-governance-policy-v3.2.docx",
    link_url: null,
    file_size_bytes: 412_800,
    respondent_email: "ali.almansouri@alnoorbank.ae",
  },
  {
    material_type: "url",
    material_name: "UAE AI Charter Compliance Checklist",
    file_name: null,
    file_url: null,
    link_url: "https://ai.gov.ae/resources/ai-charter-2024",
    file_size_bytes: null,
    respondent_email: "khalid.binsultan@alnoorbank.ae",
  },
  {
    material_type: "powerpoint",
    material_name: "AI Governance Committee Charter (Board-approved)",
    file_name: "ai-governance-charter-board.pptx",
    file_url: "promo/al-noor/ai-governance-charter-board.pptx",
    link_url: null,
    file_size_bytes: 5_271_040,
    respondent_email: "khalid.binsultan@alnoorbank.ae",
  },
  {
    material_type: "pdf",
    material_name: "AI Acceptable Use Policy v1.3",
    file_name: "ai-acceptable-use-policy-v1.3.pdf",
    file_url: "promo/al-noor/ai-acceptable-use-policy-v1.3.pdf",
    link_url: null,
    file_size_bytes: 1_124_352,
    respondent_email: "khalid.binsultan@alnoorbank.ae",
  },
  {
    material_type: "pdf",
    material_name: "Model Risk Management Framework 2025",
    file_name: "mrm-framework-2025.pdf",
    file_url: "promo/al-noor/mrm-framework-2025.pdf",
    link_url: null,
    file_size_bytes: 3_928_576,
    respondent_email: "fatima.alsayegh@alnoorbank.ae",
  },
  {
    material_type: "url",
    material_name: "SDAIA National Data Governance Framework (reference)",
    file_name: null,
    file_url: null,
    link_url: "https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx",
    file_size_bytes: null,
    respondent_email: "ali.almansouri@alnoorbank.ae",
  },
];

/**
 * Five AI use cases across the portfolio lifecycle stages.
 * Intentionally spread across risk/value quadrants so the
 * investment-matrix visual has something to plot.
 */
const USE_CASES: Array<{
  name: string;
  description: string;
  stage: "ideation" | "piloting" | "production" | "retired";
  pillar_id: string;
  risk_level: "low" | "medium" | "high" | "critical";
  value_level: "low" | "medium" | "high";
  business_owner: string;
  technical_owner: string;
}> = [
  {
    name: "Real-time Fraud Detection",
    description: "ML model scoring incoming transactions against behavioural patterns to flag high-risk activity within 200ms.",
    stage: "production",
    pillar_id: "model_management",
    risk_level: "high",
    value_level: "high",
    business_owner: "Fraud Operations",
    technical_owner: "Data Science Team",
  },
  {
    name: "Customer Service Chatbot (Arabic + English)",
    description: "Bilingual LLM-based assistant handling tier-1 retail banking enquiries, escalating to human agents on complex issues.",
    stage: "piloting",
    pillar_id: "operations",
    risk_level: "high",
    value_level: "high",
    business_owner: "Retail Banking",
    technical_owner: "Digital Channels",
  },
  {
    name: "Credit Scoring Assistant",
    description: "Supplementary model advising loan officers on creditworthiness for SME applications below AED 500k.",
    stage: "production",
    pillar_id: "model_management",
    risk_level: "critical",
    value_level: "high",
    business_owner: "SME Lending",
    technical_owner: "Risk Analytics",
  },
  {
    name: "Regulatory Reporting Auto-summary",
    description: "Draft weekly CBUAE compliance summaries from raw transaction logs; human review before submission.",
    stage: "ideation",
    pillar_id: "governance",
    risk_level: "medium",
    value_level: "high",
    business_owner: "Compliance Office",
    technical_owner: "Reporting Team",
  },
  {
    name: "Developer Code Assistant",
    description: "Internal rollout of a code-completion assistant for the engineering team, scoped to approved repositories only.",
    stage: "piloting",
    pillar_id: "talent",
    risk_level: "medium",
    value_level: "medium",
    business_owner: "Engineering",
    technical_owner: "Platform Team",
  },
];

/**
 * Consultant notes written in a post-workshop voice - the kind of
 * findings a senior VIFM consultant would capture during Phase 2
 * and surface in the client's report. 3-4 notes per pillar so every
 * Pillar Deep Dive page has substantive "Key findings" content,
 * plus two cross-pillar overall observations.
 */
const NOTES: Array<{
  pillar_id: string | null;
  note_text: string;
  include_in_report: boolean;
}> = [
  // ─── Overall (cross-pillar) ───
  {
    pillar_id: null,
    note_text: "Overall posture is Advanced (4.08). Leadership alignment on AI is unusually strong for a regional bank - governance and strategy scores reflect board-level sponsorship established in Q3 2024.",
    include_in_report: true,
  },
  {
    pillar_id: null,
    note_text: "Primary areas for investment are talent development (3.60) and model management cadence (3.60). Both are closable within one to two quarters without new headcount.",
    include_in_report: true,
  },

  // ─── Strategy (4.6 - Leading) ───
  {
    pillar_id: "strategy",
    note_text: "Documented AI strategy (v2.1, February 2025) is approved by the board and sponsored by the Chief Digital Officer with a ring-fenced AED 14M three-year budget.",
    include_in_report: true,
  },
  {
    pillar_id: "strategy",
    note_text: "Strategy is explicitly aligned to the UAE National AI Strategy 2031 and Emirates AI Office programmes, with mapped contribution KPIs against three of the nine national priority sectors.",
    include_in_report: true,
  },
  {
    pillar_id: "strategy",
    note_text: "Quarterly board reviews of the AI portfolio have been running consistently since Q3 2024 with documented decisions. Recommend publishing an annual external AI transparency report to translate this strength into brand equity.",
    include_in_report: true,
  },

  // ─── Data (4.4 - Advancing) ───
  {
    pillar_id: "data",
    note_text: "Data quality KPIs are tracked on 11 of 13 critical source systems. The two unmeasured systems (core banking tier-2 and trade-finance ledger) are scheduled for onboarding by end of Q2 2026.",
    include_in_report: true,
  },
  {
    pillar_id: "data",
    note_text: "Data stewardship model is mature: 34 named stewards across 9 business domains, governed by the Data Office under the CDO.",
    include_in_report: true,
  },
  {
    pillar_id: "data",
    note_text: "Shadow AI controls are policy-level only; technical enforcement (DLP for AI endpoints, approved-tools allowlist at the proxy layer) is scheduled but not yet live. Near-term risk vector for UAE PDPL Article 8 compliance.",
    include_in_report: true,
  },

  // ─── Technology (4.0 - Advancing) ───
  {
    pillar_id: "technology",
    note_text: "AI workloads run on a UAE-sovereign cloud tenancy (G42 / Microsoft Azure Abu Dhabi region). Data residency controls are validated and auditable.",
    include_in_report: true,
  },
  {
    pillar_id: "technology",
    note_text: "MLOps pipeline is operational for the two production models, with CI/CD and versioned model registry. Monitoring dashboards track accuracy and drift but not yet fairness metrics.",
    include_in_report: true,
  },
  {
    pillar_id: "technology",
    note_text: "Approved-tools list exists for generative AI assistants (Copilot for M365, internal Claude workspace). Adoption monitoring is in place. Sandbox environment is usable but under-promoted - consider internal launch campaign.",
    include_in_report: true,
  },

  // ─── Talent (3.6 - Developing, GAP) ───
  {
    pillar_id: "talent",
    note_text: "Primary gap identified. Technical AI literacy is concentrated in a 12-person centre of excellence. The remaining ~1,400 staff have received awareness training only. Recommend tiered role-based upskilling within 6 months.",
    include_in_report: true,
  },
  {
    pillar_id: "talent",
    note_text: "No formal AI-role hiring pipeline. Current talent acquisition for the data team relies on general-purpose data-science reqs without AI/ML specialisation tagging. Correct by Q3 2026.",
    include_in_report: true,
  },
  {
    pillar_id: "talent",
    note_text: "Employee AI-sentiment survey is ad-hoc (two pulses run to date). Recommend moving to a quarterly cadence with segmentation by function so training investment can be targeted.",
    include_in_report: true,
  },
  {
    pillar_id: "talent",
    note_text: "Leadership AI literacy is notably stronger than middle-management - creates a 'frozen middle' risk where strategic intent doesn't cascade into day-to-day decision-making.",
    include_in_report: true,
  },

  // ─── Culture (3.8 - Developing) ───
  {
    pillar_id: "culture",
    note_text: "Mixed signals. Employee survey shows 76% of staff are 'curious or excited' about AI, but only 34% feel their department has a clear AI plan. Opportunity rather than resistance - the appetite is there.",
    include_in_report: true,
  },
  {
    pillar_id: "culture",
    note_text: "CEO has publicly backed the AI agenda in two all-staff communications, but cascade to mid-level leaders is inconsistent. Recommend quarterly AI town-halls with live Q&A format.",
    include_in_report: true,
  },
  {
    pillar_id: "culture",
    note_text: "Change management is attached to tooling rollouts (Copilot, fraud model) but not yet to the broader cultural shift. No structured 'AI-ready leader' programme exists today.",
    include_in_report: true,
  },
  {
    pillar_id: "culture",
    note_text: "Cross-functional collaboration is strong on the two flagship AI initiatives (Risk+Data, Retail+Digital). Silos re-emerge outside those projects - a 'communities of practice' structure would help.",
    include_in_report: true,
  },

  // ─── Governance (4.6 - Leading) ───
  {
    pillar_id: "governance",
    note_text: "Notable strength. The AI Governance Committee is formally chartered, meets monthly, and has documented decisions since January 2025. This exceeds GCC peer median and is a competitive differentiator.",
    include_in_report: true,
  },
  {
    pillar_id: "governance",
    note_text: "AI Acceptable Use Policy (v1.3, March 2025) is published and acknowledged by 96% of eligible staff. Third-party AI tool vetting is handled by a joint Risk-IT-Compliance panel with documented review criteria.",
    include_in_report: true,
  },
  {
    pillar_id: "governance",
    note_text: "Incident response playbook covers three AI-specific scenarios (model drift breach, generative-AI output liability, training-data exposure). Tabletop exercise scheduled for Q2 2026.",
    include_in_report: true,
  },
  {
    pillar_id: "governance",
    note_text: "Recommend extending the governance committee charter to include a rotating external advisor (academic or regulator liaison) to maintain independence as the portfolio scales.",
    include_in_report: true,
  },

  // ─── Operations (4.0 - Advancing) ───
  {
    pillar_id: "operations",
    note_text: "Central AI use-case inventory is live and current (last updated 14 April 2026). 17 use cases tracked across the portfolio with owners, business value, and lifecycle stage.",
    include_in_report: true,
  },
  {
    pillar_id: "operations",
    note_text: "ROI measurement is in place for the two production use cases (fraud: 4.2x first-year ROI; credit scoring: 1.8x first-year). Pilot-stage ROI hypothesis is captured but not yet validated post-launch.",
    include_in_report: true,
  },
  {
    pillar_id: "operations",
    note_text: "Portfolio-retirement discipline is weak: two unsuccessful 2024 pilots remain in 'on hold' status without an explicit sunset decision. Recommend a quarterly portfolio cleanse with documented lessons-learned.",
    include_in_report: true,
  },

  // ─── Model management (3.6 - Developing, GAP) ───
  {
    pillar_id: "model_management",
    note_text: "The two production models (fraud detection, credit scoring) have strong monitoring for accuracy and drift but NO formal bias-testing cadence. SDAIA NDGF Article 4.2 and UAE AI Charter Principle 6 both expect periodic fairness reviews.",
    include_in_report: true,
  },
  {
    pillar_id: "model_management",
    note_text: "Model registry exists (MLflow on the Azure tenancy) with version history, but does not yet capture dataset lineage, approval sign-off, or retirement decisions in a single artefact.",
    include_in_report: true,
  },
  {
    pillar_id: "model_management",
    note_text: "Human-in-the-loop is mandatory for credit scoring decisions above AED 500k (policy-level) but not consistently logged as audit evidence. Recommend instrumenting the override step by Q3 2026.",
    include_in_report: true,
  },
  {
    pillar_id: "model_management",
    note_text: "No formal model-retirement process. Two 2023 pilot models remain 'inactive but deployed' in the staging cluster. Low risk today; becomes a compliance finding as portfolio scales.",
    include_in_report: true,
  },
];

// ─── Helpers ───────────────────────────────────────────────────

function log(msg: string) {
  const now = new Date().toISOString().slice(11, 19);
  console.log(`[${now}] ${msg}`);
}

async function die(prefix: string, err: { message: string } | null): Promise<never> {
  console.error(`\n[seed-compass-promo] ${prefix}: ${err?.message ?? "unknown error"}\n`);
  process.exit(1);
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  log("VIFM AI Readiness Compass - promo demo seed");
  log("-------------------------------------------");

  // ────────────────────────────────────────────────────────
  // 1. Organization: find-or-create
  // ────────────────────────────────────────────────────────
  log("Ensuring organization...");
  let orgId: string;
  {
    const { data: existing, error: findErr } = await sb
      .from("ara_organizations")
      .select("id")
      .eq("name", ORG_NAME_EN)
      .maybeSingle<{ id: string }>();
    if (findErr) await die("organization lookup", findErr);

    if (existing) {
      orgId = existing.id;
      log(`  - reused existing org ${orgId}`);
    } else {
      const { data: created, error: createErr } = await sb
        .from("ara_organizations")
        .insert({
          name: ORG_NAME_EN,
          name_ar: ORG_NAME_AR,
          region: "uae",
          sector: "banking",
        })
        .select("id")
        .single();
      if (createErr || !created) await die("organization create", createErr);
      orgId = created!.id;
      log(`  + created org ${orgId}`);
    }
  }

  // ────────────────────────────────────────────────────────
  // 2. Promo question bank version — find-or-create a dedicated
  //    demo version so we don't pollute the real "1.0" bank.
  //    The promo version stays is_active=false; admins never see it
  //    in their dropdown. The assessment links directly to it.
  // ────────────────────────────────────────────────────────
  log("Ensuring promo question bank version...");
  let promoVersionId: string;
  {
    const { data: existing } = await sb
      .from("ara_question_bank_versions")
      .select("id")
      .eq("version_number", PROMO_VERSION_NUMBER)
      .maybeSingle<{ id: string }>();

    if (existing) {
      promoVersionId = existing.id;
      log(`  - reused promo version ${PROMO_VERSION_NUMBER}`);
    } else {
      const { data: created, error: createErr } = await sb
        .from("ara_question_bank_versions")
        .insert({
          version_number: PROMO_VERSION_NUMBER,
          version_label: PROMO_VERSION_LABEL,
          is_active: false,
          release_notes: "Seeded by scripts/seed-compass-promo.ts. Demo/sandbox use only.",
        })
        .select("id")
        .single();
      if (createErr || !created) await die("promo version create", createErr);
      promoVersionId = created!.id;
      log(`  + created promo version ${PROMO_VERSION_NUMBER}`);
    }
  }

  // ────────────────────────────────────────────────────────
  // 2b. Wipe and re-seed 40 Layer 1 questions on the promo
  //     version (5 per pillar × 8 pillars).
  // ────────────────────────────────────────────────────────
  log("Re-seeding Layer 1 questions on promo version...");
  const questionIdMap = new Map<string, string>(); // key: `${pillar}:${number}`
  {
    // Wipe any prior questions on this version so we start clean.
    // This cascades to any responses that referenced them - but those
    // are already gone because we wipe the assessment below.
    const { error: delErr } = await sb
      .from("ara_questions")
      .delete()
      .eq("version_id", promoVersionId);
    if (delErr) await die("promo questions delete", delErr);

    const rows: Array<Record<string, unknown>> = [];
    for (const pillarId of Object.keys(PILLAR_QUESTIONS)) {
      PILLAR_QUESTIONS[pillarId].forEach((q, idx) => {
        rows.push({
          version_id: promoVersionId,
          pillar_id: pillarId,
          question_number: idx + 1,
          question_text_en: q.en,
          question_text_ar: q.ar,
          question_type: "multiple_choice",
          options_en: LIKERT_OPTIONS_EN,
          options_ar: LIKERT_OPTIONS_AR,
          score_map: LIKERT_SCORE_MAP,
          region: "both",
          sector: "all",
          layer: 1,
          display_order: idx + 1,
          is_active: true,
        });
      });
    }

    const { data: created, error: insErr } = await sb
      .from("ara_questions")
      .insert(rows)
      .select("id, pillar_id, question_number");
    if (insErr || !created) await die("questions insert", insErr);

    for (const q of created as Array<{ id: string; pillar_id: string; question_number: number }>) {
      questionIdMap.set(`${q.pillar_id}:${q.question_number}`, q.id);
    }
    log(`  + seeded ${created!.length} questions across ${Object.keys(PILLAR_QUESTIONS).length} pillars`);
  }

  // ────────────────────────────────────────────────────────
  // 3. Assessment: wipe any previous promo assessment,
  //    then create a fresh one for this run.
  // ────────────────────────────────────────────────────────
  log("Wiping any prior promo assessment for this org...");
  {
    // Find existing promo assessments (identified by being against this
    // org and having a specific marker in created_by left as null and
    // the same sandbox flag). Simplest: delete all assessments for the
    // demo org. The ON DELETE CASCADE on child tables cleans up the rest.
    const { data: previous, error: prevErr } = await sb
      .from("ara_assessments")
      .select("id")
      .eq("organization_id", orgId);
    if (prevErr) await die("previous assessment lookup", prevErr);

    if (previous && previous.length > 0) {
      const ids = previous.map((p) => p.id);
      const { error: delErr } = await sb.from("ara_assessments").delete().in("id", ids);
      if (delErr) await die("previous assessment delete", delErr);
      log(`  - wiped ${ids.length} prior assessment(s) and cascaded children`);
    } else {
      log("  - no prior assessments to wipe");
    }
  }

  log("Creating fresh promo assessment (Stage 3 Enterprise)...");
  let assessmentId: string;
  {
    const { data: created, error: createErr } = await sb
      .from("ara_assessments")
      .insert({
        organization_id: orgId,
        region: "uae",
        sector: "banking",
        default_language: "en",
        status: "frozen",
        phase: "phase2",
        is_sandbox: true,
        question_bank_version_id: promoVersionId,
        engagement_stage: "enterprise",
        scope_label: null,
        completed_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        frozen_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (createErr || !created) await die("assessment create", createErr);
    assessmentId = created!.id;
    log(`  + created Stage 3 Enterprise assessment ${assessmentId}`);
  }

  // ────────────────────────────────────────────────────────
  // 4. Respondents - all completed
  // ────────────────────────────────────────────────────────
  log("Seeding respondents (all completed)...");
  const respondentIdByEmail = new Map<string, string>();
  for (const r of RESPONDENTS) {
    const completedOffsetDays = 5 + Math.floor(Math.random() * 3);
    const { data: created, error } = await sb
      .from("ara_respondents")
      .insert({
        assessment_id: assessmentId,
        name: r.name,
        name_ar: r.name_ar,
        email: r.email,
        role_key: r.role_key,
        role_label_en: r.role_label_en,
        role_label_ar: r.role_label_ar,
        language_preference: r.language_preference,
        invited_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        first_opened_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        last_active_at: new Date(Date.now() - completedOffsetDays * 24 * 3600 * 1000).toISOString(),
        completed_at: new Date(Date.now() - completedOffsetDays * 24 * 3600 * 1000).toISOString(),
      })
      .select("id, access_token")
      .single<{ id: string; access_token: string }>();
    if (error || !created) await die(`respondent ${r.email}`, error);

    respondentIdByEmail.set(r.email, created!.id);

    // Pillar assignments
    const assignmentRows = r.pillars.map((p) => ({
      respondent_id: created!.id,
      pillar_id: p,
    }));
    const { error: aErr } = await sb
      .from("ara_respondent_pillar_assignments")
      .insert(assignmentRows);
    if (aErr) await die(`pillar assignments for ${r.email}`, aErr);

    log(`  + ${r.name} (${r.role_label_en})  token=${created!.access_token.slice(0, 8)}...`);
  }

  // ────────────────────────────────────────────────────────
  // 5. Pillar scores - the eight bars of the radar chart
  // ────────────────────────────────────────────────────────
  log("Seeding pillar scores...");
  {
    const rows = PILLAR_SCORES.map((p) => {
      const weight = 12.5; // equal weights per assessment default
      const weighted = Number(((p.raw_score * weight) / 100).toFixed(2));
      // Self-assessment deliberately a touch higher than consultant-
      // validated for a realistic "perception vs reality" gap story.
      const selfAssessment = Math.min(5.0, Number((p.raw_score + 0.25).toFixed(2)));
      const consultantValidated = p.raw_score;
      const perceptionGap = Number((selfAssessment - consultantValidated).toFixed(2));
      const benchmarkGap = Number((AI_READY_BENCHMARK - p.raw_score).toFixed(2));
      return {
        assessment_id: assessmentId,
        pillar_id: p.pillar_id,
        raw_score: p.raw_score,
        weighted_score: weighted,
        pillar_weight: weight,
        maturity_level: p.maturity_level,
        maturity_label_en: p.maturity_label_en,
        maturity_label_ar: p.maturity_label_ar,
        self_assessment_score: selfAssessment,
        consultant_validated_score: consultantValidated,
        perception_gap: perceptionGap,
        benchmark_gap: benchmarkGap,
      };
    });
    const { error } = await sb.from("ara_pillar_scores").insert(rows);
    if (error) await die("pillar scores insert", error);
    log(`  + seeded ${rows.length} pillar scores`);
  }

  // ────────────────────────────────────────────────────────
  // 6. Overall assessment score
  // ────────────────────────────────────────────────────────
  log("Seeding overall score...");
  {
    const { error } = await sb.from("ara_assessment_scores").insert({
      assessment_id: assessmentId,
      overall_score: OVERALL_SCORE,
      overall_label_en: OVERALL_LABEL_EN,
      overall_label_ar: OVERALL_LABEL_AR,
      score_frozen_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    });
    if (error) await die("overall score insert", error);
    log(`  + overall ${OVERALL_SCORE} (${OVERALL_LABEL_EN})`);
  }

  // ────────────────────────────────────────────────────────
  // 7. Supporting materials
  // ────────────────────────────────────────────────────────
  log("Seeding supporting materials...");
  {
    const rows = MATERIALS.map((m) => ({
      assessment_id: assessmentId,
      respondent_id: respondentIdByEmail.get(m.respondent_email) ?? null,
      material_type: m.material_type,
      material_name: m.material_name,
      file_name: m.file_name,
      file_url: m.file_url,
      link_url: m.link_url,
      file_size_bytes: m.file_size_bytes,
      consultant_reviewed: true,
      consultant_reviewed_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    }));
    const { error } = await sb.from("ara_supporting_materials").insert(rows);
    if (error) await die("materials insert", error);
    log(`  + seeded ${rows.length} materials`);
  }

  // ────────────────────────────────────────────────────────
  // 8. AI use case portfolio
  // ────────────────────────────────────────────────────────
  log("Seeding AI use case portfolio...");
  {
    const rows = USE_CASES.map((u) => ({
      assessment_id: assessmentId,
      respondent_id: respondentIdByEmail.get("fatima.alsayegh@alnoorbank.ae") ?? null,
      name: u.name,
      description: u.description,
      stage: u.stage,
      pillar_id: u.pillar_id,
      risk_level: u.risk_level,
      value_level: u.value_level,
      business_owner: u.business_owner,
      technical_owner: u.technical_owner,
    }));
    const { error } = await sb.from("ara_use_cases").insert(rows);
    if (error) await die("use cases insert", error);
    log(`  + seeded ${rows.length} use cases`);
  }

  // ────────────────────────────────────────────────────────
  // 9. Consultant notes
  // ────────────────────────────────────────────────────────
  log("Seeding consultant notes (Phase 2)...");
  {
    const rows = NOTES.map((n) => ({
      assessment_id: assessmentId,
      pillar_id: n.pillar_id,
      note_text: n.note_text,
      include_in_report: n.include_in_report,
      note_language: "en" as const,
    }));
    const { error } = await sb.from("ara_consultant_notes").insert(rows);
    if (error) await die("notes insert", error);
    log(`  + seeded ${rows.length} notes (${rows.filter((r) => r.include_in_report).length} flagged for report)`);
  }

  // ────────────────────────────────────────────────────────
  // 10. Layer 1 responses — the consultancy simulation.
  //
  // For each pillar, the designated respondent "answered" all 5
  // questions with ratings that average to the pillar's target
  // raw_score. This populates:
  //   • the respondent form (if you reopen a respondent token)
  //   • the gap-analysis heatmap on the report
  //   • the internal scoring engine's recompute-from-responses
  //     path (so if scores are ever recalculated, they stay
  //     identical to the values seeded in step 5)
  // ────────────────────────────────────────────────────────
  log("Seeding Layer 1 responses (consultancy simulation)...");
  {
    const rows: Array<Record<string, unknown>> = [];
    let totalScoreSum = 0;
    let totalScoreCount = 0;

    for (const pillarId of Object.keys(PILLAR_QUESTIONS)) {
      const email = PILLAR_RESPONDENT_EMAIL[pillarId];
      const respondentId = respondentIdByEmail.get(email);
      if (!respondentId) {
        log(`  ! no respondent for pillar ${pillarId} (email: ${email}) - skipped`);
        continue;
      }

      const ratings = PILLAR_ANSWER_RATINGS[pillarId];
      ratings.forEach((rating, i) => {
        const qNumber = i + 1;
        const questionId = questionIdMap.get(`${pillarId}:${qNumber}`);
        if (!questionId) {
          log(`  ! no question ${pillarId}:${qNumber} - skipped`);
          return;
        }

        const answerValue = LIKERT_OPTIONS_EN[rating - 1];
        const score = LIKERT_SCORE_MAP[answerValue];
        totalScoreSum += score;
        totalScoreCount += 1;

        rows.push({
          assessment_id: assessmentId,
          respondent_id: respondentId,
          question_id: questionId,
          answer_value: answerValue,
          answer_text: null,
          question_score: score,
          needs_verification: false,
          answered_at: new Date(
            Date.now() - (5 + Math.floor(Math.random() * 3)) * 24 * 3600 * 1000
          ).toISOString(),
        });
      });
    }

    const { error } = await sb.from("ara_responses").insert(rows);
    if (error) await die("responses insert", error);

    const rawAvg = totalScoreCount > 0 ? totalScoreSum / totalScoreCount : 0;
    log(
      `  + seeded ${rows.length} responses across ${Object.keys(PILLAR_QUESTIONS).length} pillars ` +
        `(mean question score ${rawAvg.toFixed(2)})`
    );
  }

  // ────────────────────────────────────────────────────────
  // Final summary
  // ────────────────────────────────────────────────────────
  console.log("\n======================================================");
  console.log("  PROMO DEMO READY");
  console.log("======================================================");
  console.log(`  Organization  : ${ORG_NAME_EN}  (${orgId})`);
  console.log(`  Assessment    : ${assessmentId}`);
  console.log(`  Overall score : ${OVERALL_SCORE} - ${OVERALL_LABEL_EN}`);
  console.log(`  Respondents   : ${RESPONDENTS.length} (all completed)`);
  console.log(`  Materials     : ${MATERIALS.length}`);
  console.log(`  Use cases     : ${USE_CASES.length}`);
  console.log(`  Consultant    : ${NOTES.filter((n) => n.include_in_report).length} notes flagged for report`);
  const responseCount = Object.values(PILLAR_ANSWER_RATINGS).reduce((a, arr) => a + arr.length, 0);
  console.log(`  Questions     : 5 per pillar × 8 pillars = 40 (Layer 1, multiple-choice Likert)`);
  console.log(`  Responses     : ${responseCount} answered (consultancy simulation)`);
  console.log("");
  console.log("  URLs to capture (port 3000):");
  console.log(`    /ara/consultant/assessments/${assessmentId}          (Overview tab)`);
  console.log(`    /ara/consultant/assessments/${assessmentId}?tab=phase-2`);
  console.log(`    /ara/consultant/assessments/${assessmentId}?tab=respondents`);
  console.log(`    /ara/consultant/assessments/${assessmentId}/report?lang=en`);
  console.log(`    /ara/consultant/assessments/${assessmentId}/report?lang=ar`);
  console.log(`    /ara/consultant/assessments/${assessmentId}/report?lang=bilingual`);
  console.log("");
  console.log("  Respondent access tokens (for the bilingual welcome clip):");
  const emails = Array.from(respondentIdByEmail.keys());
  for (const email of emails) {
    const { data: row } = await sb
      .from("ara_respondents")
      .select("access_token, name, language_preference")
      .eq("email", email)
      .maybeSingle<{ access_token: string; name: string; language_preference: string }>();
    if (row) {
      console.log(
        `    ${row.language_preference.toUpperCase()}  ${row.name.padEnd(22)}  /ara/respond/${row.access_token}`
      );
    }
  }
  // ────────────────────────────────────────────────────────
  // 11. Stage 1 Department companion demo
  //
  // Creates a second sandbox assessment for the SAME organisation but
  // scoped to "Risk Management Department" with engagement_stage=
  // 'department'. Only 4 pillars are seeded (data, talent, culture,
  // operations) - the 4 in-scope for Stage 1 - so the report cleanly
  // demonstrates the abbreviated deliverable.
  // ────────────────────────────────────────────────────────
  log("Creating Stage 1 Department companion demo...");
  let stage1Id: string;
  {
    const { data: created, error: createErr } = await sb
      .from("ara_assessments")
      .insert({
        organization_id: orgId,
        region: "uae",
        sector: "banking",
        default_language: "en",
        status: "frozen",
        phase: "phase2",
        is_sandbox: true,
        question_bank_version_id: promoVersionId,
        engagement_stage: "department",
        scope_label: "Risk Management Department",
        completed_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        frozen_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (createErr || !created) await die("stage 1 assessment create", createErr);
    stage1Id = created!.id;
    log(`  + created Stage 1 Department assessment ${stage1Id}`);
  }

  // Single respondent for Stage 1 (typical 1-2 stakeholders)
  const STAGE1_RESPONDENT = {
    name: "Khalid bin Sultan",
    name_ar: "خالد بن سلطان",
    email: "khalid.binsultan+stage1@alnoorbank.ae",
    role_label_en: "Director of Risk & Compliance",
    role_label_ar: "مدير المخاطر والامتثال",
    language_preference: "en" as const,
    pillars: ["data", "talent", "culture", "operations"],
  };
  const { data: s1Resp } = await sb
    .from("ara_respondents")
    .insert({
      assessment_id: stage1Id,
      name: STAGE1_RESPONDENT.name,
      name_ar: STAGE1_RESPONDENT.name_ar,
      email: STAGE1_RESPONDENT.email,
      role_label_en: STAGE1_RESPONDENT.role_label_en,
      role_label_ar: STAGE1_RESPONDENT.role_label_ar,
      language_preference: STAGE1_RESPONDENT.language_preference,
      invited_at: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
      first_opened_at: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString(),
      last_active_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
    })
    .select("id, access_token")
    .single<{ id: string; access_token: string }>();

  // 4 in-scope pillars only - department-relevant questions answered
  const STAGE1_RATINGS: Record<string, number[]> = {
    data: [4, 3, 4, 3, 4],            // avg 3.6
    talent: [4, 4, 3, 3, 3],          // avg 3.4
    culture: [4, 4, 3, 4, 4],         // avg 3.8
    operations: [4, 4, 4, 4, 4],      // avg 4.0
  };

  const stage1Rows: Array<Record<string, unknown>> = [];
  for (const pillarId of Object.keys(STAGE1_RATINGS)) {
    STAGE1_RATINGS[pillarId].forEach((rating, i) => {
      const qid = questionIdMap.get(`${pillarId}:${i + 1}`);
      if (!qid || !s1Resp) return;
      const answerValue = LIKERT_OPTIONS_EN[rating - 1];
      stage1Rows.push({
        assessment_id: stage1Id,
        respondent_id: s1Resp.id,
        question_id: qid,
        answer_value: answerValue,
        answer_text: null,
        question_score: LIKERT_SCORE_MAP[answerValue],
        needs_verification: false,
        answered_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
      });
    });
  }
  if (stage1Rows.length > 0) {
    await sb.from("ara_responses").insert(stage1Rows);
    log(`  + seeded ${stage1Rows.length} Stage 1 responses (4 pillars)`);
  }

  // Pillar scores for Stage 1 (4 pillars only)
  const STAGE1_PILLARS: Array<{ id: string; raw: number; level: 1|2|3|4|5; en: string; ar: string }> = [
    { id: "data",       raw: 3.6, level: 3, en: "Developing", ar: "يطور" },
    { id: "talent",     raw: 3.4, level: 3, en: "Developing", ar: "يطور" },
    { id: "culture",    raw: 3.8, level: 3, en: "Developing", ar: "يطور" },
    { id: "operations", raw: 4.0, level: 4, en: "Advancing",  ar: "يتقدم" },
  ];
  await sb.from("ara_pillar_scores").insert(STAGE1_PILLARS.map((p) => ({
    assessment_id: stage1Id,
    pillar_id: p.id,
    raw_score: p.raw,
    weighted_score: Number((p.raw * 0.25).toFixed(2)),
    pillar_weight: 25.0, // 4 pillars at 25% each = 100%
    maturity_level: p.level,
    maturity_label_en: p.en,
    maturity_label_ar: p.ar,
    self_assessment_score: Math.min(5.0, Number((p.raw + 0.2).toFixed(2))),
    consultant_validated_score: p.raw,
    perception_gap: 0.2,
    benchmark_gap: Number((4.0 - p.raw).toFixed(2)),
  })));
  // Stage 1 overall - 4-pillar average, equal 25% weights
  const stage1Overall = Number((
    STAGE1_PILLARS.reduce((a, p) => a + p.raw, 0) / STAGE1_PILLARS.length
  ).toFixed(2));
  await sb.from("ara_assessment_scores").insert({
    assessment_id: stage1Id,
    overall_score: stage1Overall,
    overall_label_en: stage1Overall >= 4.0 ? "Advanced" : "In Progress",
    overall_label_ar: stage1Overall >= 4.0 ? "متقدم" : "في التقدم",
    score_frozen_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
  });

  // 2 light consultant notes for Stage 1 (sales-grade hook, not a full deliverable)
  await sb.from("ara_consultant_notes").insert([
    {
      assessment_id: stage1Id,
      pillar_id: null,
      note_text: `Risk Management Department scores ${stage1Overall.toFixed(2)} / 5.00 - mid-Developing band. The strongest signal is operational AI use-case discipline (4.0); the gap to address first is talent depth (3.4).`,
      include_in_report: true,
      note_language: "en" as const,
    },
    {
      assessment_id: stage1Id,
      pillar_id: "talent",
      note_text: "Department-level AI literacy is uneven. Recommend a 6-week tiered upskilling sprint targeting model-aware risk analytics. A Stage 2 division-wide assessment would surface peer benchmarks and a 12-month roadmap.",
      include_in_report: true,
      note_language: "en" as const,
    },
  ]);
  log(`  + seeded Stage 1 scores + 2 consultant notes (overall ${stage1Overall.toFixed(2)})`);

  console.log("");
  console.log("  Stage 1 Department companion demo:");
  console.log(`    /ara/consultant/assessments/${stage1Id}                     (Overview)`);
  console.log(`    /ara/consultant/assessments/${stage1Id}/report?lang=en      (8-page report)`);
  console.log(`    /ara/respond/${s1Resp?.access_token ?? ""}                    (Khalid's view)`);
  console.log("\n  Re-run this script any time to reset the demo to a clean state.\n");
}

main().catch((err) => {
  console.error("\n[seed-compass-promo] fatal:", err);
  process.exit(1);
});
