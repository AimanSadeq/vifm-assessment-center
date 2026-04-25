/**
 * ============================================================
 *  seed-production-bank.ts
 *  -----------------------------------------------------------
 *  Seeds the VETTED PRODUCTION question bank for the
 *  AI Readiness Compass.
 *
 *  Creates question bank version "1.1" labelled
 *  "Vetted Production Bank - May 2026" containing 121 questions
 *  (91 Layer 1 + 30 Layer 2) across the 8 pillars, weighted
 *  toward Data, Technology, Governance and Model Management
 *  per the depth recommendation in CLAUDE.md.
 *
 *  Each question is anchored to a published framework or
 *  standard. The reference is stored in `help_text_en` so it
 *  surfaces during audit/QA and never gets lost.
 *
 *  Run once to populate:
 *    npx tsx scripts/seed-production-bank.ts
 *
 *  Then activate via the admin UI at /ara/admin/questions
 *  (or pass --activate to flip is_active automatically).
 *
 *  Frameworks referenced:
 *    UAE PDPL                  Federal Decree-Law 45 of 2021
 *    UAE National AI Strategy  AI Strategy 2031
 *    UAE AI Charter            June 2024 - 12 Principles
 *    UAE AI Ethics Guide       2022
 *    TDRA                      Digital Government Regulations
 *    DCAI                      Dubai AI Centre Guidelines
 *    ADDA                      Abu Dhabi Digital Authority
 *    Saudi PDPL                Royal Decree M/19, M/148
 *    SDAIA NDGF                National Data Governance Framework
 *    SDAIA AI Ethics           2023 - 12 Principles
 *    SDAIA AI Adoption         September 2024
 *    SDAIA GenAI Guidelines    January 2024
 *    NCA ECC-2:2024            Essential Cybersecurity Controls
 *    NCA CCC-2:2024            Cloud Cybersecurity Controls
 *    Vision 2030               Saudi national plan
 *    ISO/IEC 42001             AI Management Systems
 *    ISO/IEC 23894             AI Risk Management
 *    NIST AI RMF               AI Risk Management Framework
 *    OECD AI Principles        2019 (revised 2024)
 * ============================================================
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("\n[seed-production-bank] Missing env vars in .env.local\n");
  process.exit(1);
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ACTIVATE = process.argv.includes("--activate");

const VERSION_NUMBER = "1.1";
const VERSION_LABEL = "Vetted Production Bank - May 2026";

// ─── Standard Likert (most rating + multi-choice) ───────────────
const LIKERT_EN = ["1 - Not at all", "2 - Early exploration", "3 - In progress", "4 - Mostly in place", "5 - Comprehensive"];
const LIKERT_AR = ["١ - ليس بعد", "٢ - استكشاف مبكر", "٣ - قيد التقدم", "٤ - قائم غالباً", "٥ - شامل"];
const LIKERT_MAP: Record<string, number> = {
  "1 - Not at all": 1.0, "2 - Early exploration": 2.0, "3 - In progress": 3.0,
  "4 - Mostly in place": 4.0, "5 - Comprehensive": 5.0,
};
const YESNO_EN = ["Yes", "No", "Not sure"];
const YESNO_AR = ["نعم", "لا", "غير متأكد"];
const YESNO_MAP: Record<string, number> = { "Yes": 5.0, "No": 1.0, "Not sure": 2.5 };

// ─── Question type ──────────────────────────────────────────────

type QType = "rating" | "yes_no" | "multiple_choice" | "open_text";

interface VettedQuestion {
  layer: 1 | 2;
  type: QType;
  en: string;
  ar: string;
  /** Standard or framework anchor stored in help_text_en for audit. */
  ref: string;
  /** Optional override of the default Likert/yes-no options. */
  options?: { en: string[]; ar: string[]; map: Record<string, number> };
}

// ─── 121 questions across 8 pillars ─────────────────────────────
//
// Order within each pillar: existing Layer 1 (1-5) -> additional
// Layer 1 -> Layer 2 (consultant-only). question_number is assigned
// sequentially when inserted.

const PILLAR_QUESTIONS: Record<string, VettedQuestion[]> = {

  // ──────────────────────────────────────────────────────────────
  // STRATEGY & VISION (8 L1 + 3 L2 = 11)
  // ──────────────────────────────────────────────────────────────
  strategy: [
    { layer: 1, type: "rating",
      en: "Our organization has a documented AI strategy with a named executive sponsor and approved budget.",
      ar: "لدى منظمتنا استراتيجية موثقة للذكاء الاصطناعي مع راعٍ تنفيذي مسمى وميزانية معتمدة.",
      ref: "UAE National AI Strategy 2031 §1; ISO 42001 §5.2" },
    { layer: 1, type: "rating",
      en: "AI use cases are prioritized against business value and risk on a regular cadence.",
      ar: "يتم ترتيب أولويات حالات استخدام الذكاء الاصطناعي وفق القيمة التجارية والمخاطر بشكل منتظم.",
      ref: "ISO 42001 §6.1; SDAIA AI Adoption §4" },
    { layer: 1, type: "rating",
      en: "The AI strategy is aligned with the organization's broader digital transformation and national AI goals.",
      ar: "استراتيجية الذكاء الاصطناعي متوافقة مع أهداف التحول الرقمي وأهداف الدولة للذكاء الاصطناعي.",
      ref: "UAE AI Strategy 2031; Saudi Vision 2030" },
    { layer: 1, type: "rating",
      en: "Board-level reviews of AI progress happen at least quarterly.",
      ar: "تُعقد مراجعات مجلس الإدارة لتقدم الذكاء الاصطناعي على الأقل كل ربع سنوي.",
      ref: "UAE AI Charter Principle 4; ISO 42001 §9.3" },
    { layer: 1, type: "rating",
      en: "The organization benchmarks its AI maturity against regional peers.",
      ar: "تقارن المنظمة نضج الذكاء الاصطناعي لديها مع النظراء الإقليميين.",
      ref: "SDAIA AI Adoption §3; OECD AI Principles" },
    { layer: 1, type: "rating",
      en: "A documented investment plan specifies which AI capabilities the organization will own internally vs procure from vendors over the next 24 months.",
      ar: "خطة استثمار موثقة تحدد القدرات التي ستمتلكها المنظمة داخلياً مقابل تلك التي ستشتريها من الموردين خلال ٢٤ شهراً القادمة.",
      ref: "ISO 42001 §6.1; UAE AI Strategy 2031 §3" },
    { layer: 1, type: "rating",
      en: "The organization has identified its three-to-five highest-priority AI use cases for the current fiscal year and assigned named owners.",
      ar: "حددت المنظمة من ثلاث إلى خمس حالات استخدام عالية الأولوية للذكاء الاصطناعي للسنة المالية الحالية وعينت لها مالكين محددين.",
      ref: "SDAIA AI Adoption §4" },
    { layer: 1, type: "yes_no",
      en: "Is the AI strategy a formal, board-approved document (not only a leadership memo)?",
      ar: "هل استراتيجية الذكاء الاصطناعي وثيقة رسمية معتمدة من مجلس الإدارة (وليس فقط مذكرة قيادية)؟",
      ref: "ISO 42001 §5.2" },
    { layer: 2, type: "open_text",
      en: "Describe the mechanism by which the organization de-prioritises or shuts down AI initiatives that fail to meet KPIs.",
      ar: "صف الآلية التي تستخدمها المنظمة لتقليل أولوية أو إيقاف مبادرات الذكاء الاصطناعي التي لا تحقق المؤشرات.",
      ref: "ISO 42001 §6.2; NIST AI RMF MANAGE-1.4" },
    { layer: 2, type: "multiple_choice",
      en: "How frequently does the AI strategy receive a documented refresh?",
      ar: "ما مدى تكرار تحديث استراتيجية الذكاء الاصطناعي بشكل موثق؟",
      ref: "ISO 42001 §9.3",
      options: {
        en: ["Never refreshed", "Ad-hoc, no schedule", "Annual", "Semi-annual", "Quarterly"],
        ar: ["لم يتم", "حسب الحاجة، بلا جدول", "سنوي", "نصف سنوي", "ربع سنوي"],
        map: { "Never refreshed": 1.0, "Ad-hoc, no schedule": 2.0, "Annual": 3.0, "Semi-annual": 4.0, "Quarterly": 5.0 },
      } },
    { layer: 2, type: "rating",
      en: "Rate the alignment between the AI strategy and the organisation's stated risk appetite.",
      ar: "قيّم مدى توافق استراتيجية الذكاء الاصطناعي مع مستوى تقبل المخاطر المعلن.",
      ref: "ISO 23894 §6.4; NIST AI RMF GOVERN-1" },
  ],

  // ──────────────────────────────────────────────────────────────
  // DATA FOUNDATIONS (14 L1 + 5 L2 = 19)
  // ──────────────────────────────────────────────────────────────
  data: [
    { layer: 1, type: "rating",
      en: "Data quality is measured with defined KPIs across critical sources.",
      ar: "تُقاس جودة البيانات بمؤشرات أداء محددة عبر المصادر الحرجة.",
      ref: "SDAIA NDGF Article 6; ISO 42001 §8.4" },
    { layer: 1, type: "rating",
      en: "Data ownership is clearly assigned through a data steward model.",
      ar: "تُسند ملكية البيانات بوضوح من خلال نموذج المشرف على البيانات.",
      ref: "SDAIA NDGF Article 4" },
    { layer: 1, type: "rating",
      en: "Sensitive data is classified and protected according to policy and regulation.",
      ar: "تُصنف البيانات الحساسة وتُحمى وفق السياسات واللوائح.",
      ref: "UAE PDPL Article 6; SDAIA NDGF Article 5" },
    { layer: 1, type: "rating",
      en: "Data lineage from source systems to AI model inputs is documented and traceable.",
      ar: "نسب البيانات من الأنظمة المصدر إلى مدخلات نماذج الذكاء الاصطناعي موثق وقابل للتتبع.",
      ref: "ISO 42001 §8.4; NIST AI RMF MAP-2.2" },
    { layer: 1, type: "rating",
      en: "The organization has defined controls against 'shadow AI' (staff using unapproved AI tools on work data).",
      ar: "لدى المنظمة ضوابط محددة ضد الذكاء الاصطناعي الخفي (استخدام الموظفين لأدوات غير معتمدة).",
      ref: "SDAIA GenAI Guidelines §2; NCA ECC-2:2024" },
    { layer: 1, type: "rating",
      en: "A published data classification scheme includes specific categories for data feeding AI systems (training data, inference inputs, model outputs).",
      ar: "مخطط تصنيف بيانات منشور يتضمن فئات محددة للبيانات التي تغذي أنظمة الذكاء الاصطناعي.",
      ref: "SDAIA NDGF Article 5; UAE PDPL Article 6" },
    { layer: 1, type: "yes_no",
      en: "Is a Data Protection Impact Assessment (DPIA) conducted before any AI system processes personal data?",
      ar: "هل يتم إجراء تقييم رسمي لأثر حماية البيانات قبل أن يعالج أي نظام ذكاء اصطناعي بيانات شخصية؟",
      ref: "UAE PDPL Article 21; Saudi PDPL Article 25; GDPR Article 35" },
    { layer: 1, type: "rating",
      en: "Cross-border data transfers used by AI systems are documented and comply with applicable data localisation requirements.",
      ar: "عمليات نقل البيانات عبر الحدود التي تستخدمها أنظمة الذكاء الاصطناعي موثقة ومتوافقة مع متطلبات توطين البيانات.",
      ref: "SDAIA NDGF Article 13; UAE PDPL Article 22" },
    { layer: 1, type: "rating",
      en: "The organization maintains a register of all data sources (internal + external) feeding production AI models.",
      ar: "تحتفظ المنظمة بسجل لجميع مصادر البيانات (الداخلية والخارجية) التي تغذي نماذج الذكاء الاصطناعي الإنتاجية.",
      ref: "ISO 42001 §8.4; NIST AI RMF MAP-2.1" },
    { layer: 1, type: "rating",
      en: "Synthetic data and data-augmentation techniques used for AI training are documented and approved by data governance.",
      ar: "تقنيات البيانات الاصطناعية وتعزيز البيانات المستخدمة في تدريب الذكاء الاصطناعي موثقة ومعتمدة من حوكمة البيانات.",
      ref: "ISO 42001 §8.4; NIST AI RMF MEASURE-2.5" },
    { layer: 1, type: "rating",
      en: "A formal process exists to anonymise or pseudonymise personal data before it is used to train AI models.",
      ar: "توجد عملية رسمية لإخفاء الهوية للبيانات الشخصية قبل استخدامها لتدريب نماذج الذكاء الاصطناعي.",
      ref: "UAE PDPL Article 13; Saudi PDPL Article 9" },
    { layer: 1, type: "rating",
      en: "Data retention policies explicitly cover AI training data and inference logs (length of retention, deletion process).",
      ar: "سياسات الاحتفاظ بالبيانات تغطي بوضوح بيانات تدريب الذكاء الاصطناعي وسجلات الاستدلال.",
      ref: "UAE PDPL Article 17; SDAIA NDGF Article 9" },
    { layer: 1, type: "rating",
      en: "Data drift monitoring is in place for production AI systems (input distribution divergence from training data is flagged).",
      ar: "مراقبة انحراف البيانات معتمدة لجميع أنظمة الذكاء الاصطناعي الإنتاجية.",
      ref: "NIST AI RMF MEASURE-2.4; ISO 42001 §8.5" },
    { layer: 1, type: "rating",
      en: "Third-party AI tools have documented data-handling agreements specifying how vendors process organisational data.",
      ar: "أدوات الذكاء الاصطناعي من أطراف ثالثة لها اتفاقيات معالجة بيانات موثقة.",
      ref: "UAE PDPL Article 27; Saudi PDPL Article 30; ISO 42001 §8.6" },
    { layer: 2, type: "open_text",
      en: "How does the organization detect when an employee uploads sensitive data into an unapproved generative AI tool?",
      ar: "كيف تكتشف المنظمة قيام موظف برفع بيانات حساسة إلى أداة ذكاء اصطناعي توليدي غير معتمدة؟",
      ref: "SDAIA GenAI Guidelines §3; NCA ECC-2:2024" },
    { layer: 2, type: "rating",
      en: "Rate the maturity of the data quality KPI dashboard for AI-relevant data sources.",
      ar: "قيّم مدى نضج لوحة مؤشرات جودة البيانات لمصادر البيانات المتعلقة بالذكاء الاصطناعي.",
      ref: "SDAIA NDGF Article 6" },
    { layer: 2, type: "open_text",
      en: "Describe the most recent DPIA conducted for an AI system - findings, mitigations, and current status.",
      ar: "صف أحدث تقييم لأثر حماية البيانات أُجري لنظام ذكاء اصطناعي - النتائج والإجراءات والوضع الحالي.",
      ref: "UAE PDPL Article 21; Saudi PDPL Article 25" },
    { layer: 2, type: "multiple_choice",
      en: "Are model retraining triggers based on data drift, scheduled cadence, or both?",
      ar: "هل محفزات إعادة تدريب النموذج مبنية على انحراف البيانات، أو جدول زمني، أو كليهما؟",
      ref: "NIST AI RMF MANAGE-2.4",
      options: {
        en: ["Neither - retrained ad-hoc", "Scheduled cadence only", "Drift-triggered only", "Both - drift + scheduled", "Both, with documented thresholds"],
        ar: ["لا يوجد - حسب الحاجة", "جدول زمني فقط", "حسب الانحراف فقط", "كلاهما", "كلاهما مع حدود موثقة"],
        map: { "Neither - retrained ad-hoc": 1.0, "Scheduled cadence only": 2.5, "Drift-triggered only": 3.5, "Both - drift + scheduled": 4.0, "Both, with documented thresholds": 5.0 },
      } },
    { layer: 2, type: "rating",
      en: "Rate the discipline of the data-source register: completeness, freshness, and ownership accuracy.",
      ar: "قيّم انضباط سجل مصادر البيانات: الاكتمال، الحداثة، ودقة الملكية.",
      ref: "ISO 42001 §8.4" },
  ],

  // ──────────────────────────────────────────────────────────────
  // TECHNOLOGY & INFRASTRUCTURE (14 L1 + 5 L2 = 19)
  // ──────────────────────────────────────────────────────────────
  technology: [
    { layer: 1, type: "rating",
      en: "AI workloads run on approved cloud infrastructure with data sovereignty controls.",
      ar: "تعمل أحمال الذكاء الاصطناعي على بنية سحابية معتمدة مع ضوابط سيادة البيانات.",
      ref: "TDRA Cloud Framework; NCA CCC-2:2024" },
    { layer: 1, type: "rating",
      en: "A formal AI tool approval process governs which tools staff may use.",
      ar: "تحكم عملية اعتماد رسمية لأدوات الذكاء الاصطناعي في ما يُسمح للموظفين باستخدامه.",
      ref: "ISO 42001 §8.6; SDAIA GenAI Guidelines §2" },
    { layer: 1, type: "rating",
      en: "MLOps practices (CI/CD, versioning, monitoring) are in place for production AI.",
      ar: "ممارسات MLOps (التكامل المستمر والتحكم بالإصدارات والمراقبة) مطبقة في الإنتاج.",
      ref: "ISO 42001 §8.5; NIST AI RMF MANAGE-2" },
    { layer: 1, type: "rating",
      en: "A sandbox environment exists for safe AI experimentation.",
      ar: "توجد بيئة تجريبية آمنة للتجارب على الذكاء الاصطناعي.",
      ref: "DCAI Guidelines §3; SDAIA AI Adoption §5" },
    { layer: 1, type: "rating",
      en: "Infrastructure can scale to support AI workloads without procurement delays.",
      ar: "البنية التحتية قابلة للتوسع لدعم أحمال الذكاء الاصطناعي دون تأخير في الشراء.",
      ref: "ISO 42001 §7.1" },
    { layer: 1, type: "rating",
      en: "A documented architecture pattern exists for integrating AI services into production systems (APIs, latency SLAs, fallback paths).",
      ar: "نمط معماري موثق لدمج خدمات الذكاء الاصطناعي في الأنظمة الإنتاجية (APIs، اتفاقيات مستوى الخدمة، مسارات بديلة).",
      ref: "ISO 42001 §8.3; NIST AI RMF MAP-3" },
    { layer: 1, type: "yes_no",
      en: "Are GPU / accelerator resources allocated through a formal capacity-management process?",
      ar: "هل يتم تخصيص موارد المعالجات الرسومية / المعجلات من خلال عملية إدارة سعة رسمية؟",
      ref: "ISO 42001 §7.1" },
    { layer: 1, type: "rating",
      en: "Production AI services have documented uptime, latency, and accuracy SLAs.",
      ar: "خدمات الذكاء الاصطناعي الإنتاجية لها اتفاقيات مستوى خدمة موثقة (وقت التشغيل، الزمن، الدقة).",
      ref: "ISO 42001 §8.5" },
    { layer: 1, type: "rating",
      en: "Cybersecurity controls for AI assets (model files, embeddings, prompt logs) match the controls applied to other production systems.",
      ar: "ضوابط الأمن السيبراني لأصول الذكاء الاصطناعي (ملفات النماذج، التضمينات، سجلات المطالبات) تماثل ضوابط الأنظمة الإنتاجية الأخرى.",
      ref: "NCA ECC-2:2024; NIST AI RMF MAP-4" },
    { layer: 1, type: "rating",
      en: "Approved generative AI assistants (e.g. Copilot, internal LLMs) are integrated with corporate identity and DLP controls.",
      ar: "مساعدو الذكاء الاصطناعي التوليدي المعتمدون مدمجون مع نظام الهوية المؤسسية وضوابط منع تسرب البيانات.",
      ref: "SDAIA GenAI Guidelines §3; NCA ECC-2:2024" },
    { layer: 1, type: "rating",
      en: "The technology team maintains a documented inventory of every external AI API the organization calls in production.",
      ar: "يحتفظ فريق التكنولوجيا بمخزون موثق لكل واجهة برمجية خارجية للذكاء الاصطناعي تستدعيها المنظمة في الإنتاج.",
      ref: "ISO 42001 §8.6; NIST AI RMF MAP-2.1" },
    { layer: 1, type: "rating",
      en: "AI workloads have documented disaster-recovery and business-continuity plans.",
      ar: "أحمال الذكاء الاصطناعي لها خطط موثقة للتعافي من الكوارث واستمرارية الأعمال.",
      ref: "NCA ECC-2:2024 §5; ISO 42001 §8.5" },
    { layer: 1, type: "rating",
      en: "Cost monitoring is in place for AI compute, including alerts on unusual model-inference spend.",
      ar: "مراقبة التكاليف معتمدة لحوسبة الذكاء الاصطناعي، مع تنبيهات على الإنفاق غير المعتاد.",
      ref: "ISO 42001 §7.1" },
    { layer: 1, type: "rating",
      en: "A formal end-of-life process retires deprecated AI models, removes them from production, and archives their artefacts for audit.",
      ar: "عملية رسمية لإنهاء حياة النماذج المهجورة وإزالتها من الإنتاج وأرشفة مكوناتها للتدقيق.",
      ref: "ISO 42001 §8.7; NIST AI RMF MANAGE-3" },
    { layer: 2, type: "open_text",
      en: "Walk through the path of a single inference request: where it lands, where its inputs and outputs are logged, who can read those logs.",
      ar: "اشرح مسار طلب استدلال واحد: أين يصل، أين تُسجل مدخلاته ومخرجاته، ومن يستطيع قراءة هذه السجلات.",
      ref: "ISO 42001 §8.5; NIST AI RMF MEASURE-2" },
    { layer: 2, type: "rating",
      en: "Rate the maturity of the AI model registry (versioning, lineage, approvals tracked in a single artefact).",
      ar: "قيّم نضج سجل نماذج الذكاء الاصطناعي (الإصدارات، النسب، الاعتمادات في مكان واحد).",
      ref: "ISO 42001 §8.5" },
    { layer: 2, type: "open_text",
      en: "Describe the procurement process when a business unit wants to onboard a new third-party AI tool.",
      ar: "صف عملية الشراء عندما ترغب وحدة أعمال في إضافة أداة ذكاء اصطناعي خارجية جديدة.",
      ref: "ISO 42001 §8.6; SDAIA AI Adoption §6" },
    { layer: 2, type: "multiple_choice",
      en: "How is GPU capacity prioritised across competing AI projects?",
      ar: "كيف يتم تحديد أولويات سعة المعالجات الرسومية بين مشاريع الذكاء الاصطناعي المتنافسة؟",
      ref: "ISO 42001 §7.1",
      options: {
        en: ["First-come first-served", "Manual triage by IT", "Documented priority matrix", "Documented priority matrix + capacity SLAs", "Automated allocation with usage-based billing"],
        ar: ["الأولى بالأولى", "فرز يدوي من تقنية المعلومات", "مصفوفة أولويات موثقة", "مصفوفة + اتفاقيات مستوى خدمة", "تخصيص آلي مع فواتير حسب الاستخدام"],
        map: { "First-come first-served": 1.0, "Manual triage by IT": 2.0, "Documented priority matrix": 3.5, "Documented priority matrix + capacity SLAs": 4.0, "Automated allocation with usage-based billing": 5.0 },
      } },
    { layer: 2, type: "rating",
      en: "Rate the readiness of disaster-recovery procedures specifically for production AI services (last test, recovery time achieved).",
      ar: "قيّم جاهزية إجراءات التعافي من الكوارث المخصصة لخدمات الذكاء الاصطناعي الإنتاجية.",
      ref: "NCA ECC-2:2024 §5; ISO 42001 §8.5" },
  ],

  // ──────────────────────────────────────────────────────────────
  // TALENT & SKILLS (9 L1 + 4 L2 = 13)
  // ──────────────────────────────────────────────────────────────
  talent: [
    { layer: 1, type: "rating",
      en: "Staff at all levels have completed AI awareness training.",
      ar: "أكمل الموظفون على جميع المستويات تدريب الوعي بالذكاء الاصطناعي.",
      ref: "SDAIA AI Adoption §7; UAE AI Charter Principle 9" },
    { layer: 1, type: "rating",
      en: "Role-based AI learning paths exist for technical and business roles.",
      ar: "توجد مسارات تعلم قائمة على الأدوار للأدوار التقنية وأدوار الأعمال.",
      ref: "SDAIA AI Adoption §7" },
    { layer: 1, type: "rating",
      en: "The organization has a named AI centre of excellence or equivalent.",
      ar: "لدى المنظمة مركز تميز للذكاء الاصطناعي مسمى أو ما يعادله.",
      ref: "SDAIA AI Adoption §2" },
    { layer: 1, type: "rating",
      en: "Hiring pipelines explicitly include AI/ML skills for relevant roles.",
      ar: "تشمل قنوات التوظيف بوضوح مهارات الذكاء الاصطناعي والتعلم الآلي للأدوار المعنية.",
      ref: "SDAIA AI Adoption §7" },
    { layer: 1, type: "rating",
      en: "Employee sentiment on AI adoption is regularly surveyed.",
      ar: "يُستطلع رأي الموظفين حول تبني الذكاء الاصطناعي بشكل منتظم.",
      ref: "ISO 42001 §7.4" },
    { layer: 1, type: "rating",
      en: "AI ethics training is mandatory for staff who design, build, or operate AI systems.",
      ar: "تدريب أخلاقيات الذكاء الاصطناعي إلزامي للموظفين الذين يصممون أو يبنون أو يشغلون أنظمة الذكاء الاصطناعي.",
      ref: "UAE AI Charter Principles 1-3; SDAIA AI Ethics §2" },
    { layer: 1, type: "rating",
      en: "Career paths for AI specialists (data scientists, ML engineers, AI ethicists) are formally defined and progressed.",
      ar: "المسارات الوظيفية لمتخصصي الذكاء الاصطناعي محددة رسمياً ويتم التقدم فيها.",
      ref: "ISO 42001 §7.2" },
    { layer: 1, type: "rating",
      en: "Middle management has received tailored AI literacy training (not just executive briefings or staff awareness).",
      ar: "تلقت الإدارة الوسطى تدريباً مخصصاً على معرفة الذكاء الاصطناعي.",
      ref: "OECD AI Principles §1.4; UAE AI Charter Principle 9" },
    { layer: 1, type: "rating",
      en: "Partnerships exist with regional universities or technical institutes to source AI talent.",
      ar: "توجد شراكات مع الجامعات أو المعاهد التقنية الإقليمية لاستقطاب مواهب الذكاء الاصطناعي.",
      ref: "Saudi Vision 2030; UAE National AI Strategy 2031 §4" },
    { layer: 2, type: "open_text",
      en: "What does the organization do when a key AI specialist resigns? How is knowledge captured?",
      ar: "ماذا تفعل المنظمة عندما يستقيل متخصص رئيسي في الذكاء الاصطناعي؟ كيف يتم نقل المعرفة؟",
      ref: "ISO 42001 §7.3" },
    { layer: 2, type: "multiple_choice",
      en: "What proportion of staff have completed AI awareness training in the last 12 months?",
      ar: "ما نسبة الموظفين الذين أكملوا تدريب الوعي بالذكاء الاصطناعي خلال الـ١٢ شهراً الماضية؟",
      ref: "SDAIA AI Adoption §7",
      options: {
        en: ["< 25%", "25-50%", "50-75%", "75-95%", "> 95%"],
        ar: ["أقل من ٢٥٪", "٢٥-٥٠٪", "٥٠-٧٥٪", "٧٥-٩٥٪", "أكثر من ٩٥٪"],
        map: { "< 25%": 1.0, "25-50%": 2.0, "50-75%": 3.0, "75-95%": 4.0, "> 95%": 5.0 },
      } },
    { layer: 2, type: "rating",
      en: "Rate the depth of AI fluency at the executive committee level (ability to interpret model outputs, ask the right risk questions).",
      ar: "قيّم عمق الإلمام بالذكاء الاصطناعي على مستوى اللجنة التنفيذية.",
      ref: "OECD AI Principles §1.4; UAE AI Charter Principle 4" },
    { layer: 2, type: "open_text",
      en: "How does the organization measure ROI on AI training investments?",
      ar: "كيف تقيس المنظمة العائد على الاستثمار في تدريب الذكاء الاصطناعي؟",
      ref: "ISO 42001 §9.1" },
  ],

  // ──────────────────────────────────────────────────────────────
  // CULTURE & CHANGE READINESS (8 L1 + 3 L2 = 11)
  // ──────────────────────────────────────────────────────────────
  culture: [
    { layer: 1, type: "rating",
      en: "Leadership communicates AI vision and progress regularly to all staff.",
      ar: "تبلغ القيادة رؤية وتقدم الذكاء الاصطناعي لجميع الموظفين بانتظام.",
      ref: "ISO 42001 §5.1; UAE AI Charter Principle 4" },
    { layer: 1, type: "rating",
      en: "The organization celebrates AI wins and learns publicly from failures.",
      ar: "تحتفل المنظمة بنجاحات الذكاء الاصطناعي وتتعلم علنياً من الإخفاقات.",
      ref: "ISO 42001 §10.1" },
    { layer: 1, type: "rating",
      en: "Cross-functional teams collaborate on AI projects without silos.",
      ar: "تتعاون الفرق متعددة الوظائف على مشاريع الذكاء الاصطناعي دون حواجز.",
      ref: "SDAIA AI Adoption §4" },
    { layer: 1, type: "rating",
      en: "Change management accompanies every major AI rollout.",
      ar: "إدارة التغيير ترافق كل إطلاق رئيسي للذكاء الاصطناعي.",
      ref: "ISO 42001 §6.3" },
    { layer: 1, type: "rating",
      en: "Employees feel empowered to propose AI use cases from the ground up.",
      ar: "يشعر الموظفون بالقدرة على اقتراح حالات استخدام للذكاء الاصطناعي من القاعدة.",
      ref: "ISO 42001 §7.4" },
    { layer: 1, type: "rating",
      en: "Employee unions or representative bodies have been formally engaged on the workforce implications of AI deployments.",
      ar: "تم إشراك نقابات الموظفين أو الهيئات الممثلة رسمياً في تداعيات نشر الذكاء الاصطناعي على القوى العاملة.",
      ref: "OECD AI Principles §2.3; UAE AI Charter Principle 8" },
    { layer: 1, type: "rating",
      en: "A documented psychological-safety mechanism (e.g. anonymous reporting, ombuds) exists for staff to raise concerns about AI use without retaliation.",
      ar: "آلية موثقة للأمان النفسي تتيح للموظفين إثارة المخاوف حول استخدام الذكاء الاصطناعي دون انتقام.",
      ref: "OECD AI Principles §1.3; UAE AI Ethics Guide §5" },
    { layer: 1, type: "yes_no",
      en: "Has the organization run at least one cross-functional AI workshop or hackathon in the last 12 months?",
      ar: "هل أجرت المنظمة على الأقل ورشة عمل أو هاكاثون مشترك بين الوظائف للذكاء الاصطناعي خلال الـ١٢ شهراً الماضية؟",
      ref: "SDAIA AI Adoption §5" },
    { layer: 2, type: "open_text",
      en: "Describe one AI initiative that was scaled back or paused after employee feedback raised concerns.",
      ar: "صف مبادرة ذكاء اصطناعي تم تقليصها أو إيقافها بعد ملاحظات الموظفين.",
      ref: "OECD AI Principles §1.3; UAE AI Charter Principle 5" },
    { layer: 2, type: "rating",
      en: "Rate the consistency between executive AI communication and what middle managers actually tell their teams.",
      ar: "قيّم مدى الاتساق بين تواصل القيادة العليا حول الذكاء الاصطناعي وما يبلغه المديرون المتوسطون لفرقهم.",
      ref: "ISO 42001 §5.1" },
    { layer: 2, type: "multiple_choice",
      en: "How is staff feedback on AI tools collected after deployment?",
      ar: "كيف يتم جمع ملاحظات الموظفين حول أدوات الذكاء الاصطناعي بعد النشر؟",
      ref: "ISO 42001 §9.1",
      options: {
        en: ["Not collected systematically", "Annual employee survey only", "Quarterly survey with action tracking", "Continuous feedback loop in the tool itself", "Continuous feedback + closed-loop reporting back to staff"],
        ar: ["لا يجمع منهجياً", "استطلاع سنوي فقط", "استطلاع ربع سنوي مع متابعة إجراءات", "حلقة تعليقات مستمرة في الأداة نفسها", "تعليقات مستمرة مع تقارير عكسية للموظفين"],
        map: { "Not collected systematically": 1.0, "Annual employee survey only": 2.0, "Quarterly survey with action tracking": 3.5, "Continuous feedback loop in the tool itself": 4.0, "Continuous feedback + closed-loop reporting back to staff": 5.0 },
      } },
  ],

  // ──────────────────────────────────────────────────────────────
  // GOVERNANCE, ETHICS & COMPLIANCE (14 L1 + 5 L2 = 19)
  // ──────────────────────────────────────────────────────────────
  governance: [
    { layer: 1, type: "rating",
      en: "An AI governance committee is formally chartered with defined membership and cadence.",
      ar: "لجنة حوكمة الذكاء الاصطناعي مُشكلة رسمياً بعضوية وتواتر محددين.",
      ref: "ISO 42001 §5.3; UAE AI Charter Principle 5" },
    { layer: 1, type: "rating",
      en: "An acceptable-use policy for AI tools is published and acknowledged by staff.",
      ar: "سياسة الاستخدام المقبول لأدوات الذكاء الاصطناعي منشورة ومُقرّة من الموظفين.",
      ref: "SDAIA GenAI Guidelines §2; ISO 42001 §5.2" },
    { layer: 1, type: "rating",
      en: "AI systems are audited for compliance with applicable regulations.",
      ar: "تُدقق أنظمة الذكاء الاصطناعي للامتثال للوائح المعمول بها.",
      ref: "UAE PDPL Article 41; SDAIA NDGF Article 11" },
    { layer: 1, type: "rating",
      en: "An incident response playbook covers AI-specific scenarios.",
      ar: "كتيب الاستجابة للحوادث يغطي سيناريوهات خاصة بالذكاء الاصطناعي.",
      ref: "NCA ECC-2:2024 §6; ISO 42001 §8.7" },
    { layer: 1, type: "rating",
      en: "Third-party AI tools are vetted against security, privacy, and ethics criteria.",
      ar: "تُفحص أدوات الذكاء الاصطناعي من أطراف ثالثة وفق معايير الأمن والخصوصية والأخلاقيات.",
      ref: "ISO 42001 §8.6; UAE AI Charter Principle 6" },
    { layer: 1, type: "rating",
      en: "An AI ethics policy explicitly references fairness, transparency, accountability, privacy, and human oversight.",
      ar: "سياسة أخلاقيات الذكاء الاصطناعي تشير صراحة إلى العدالة، الشفافية، المساءلة، الخصوصية، والإشراف البشري.",
      ref: "UAE AI Charter Principles 1-12; SDAIA AI Ethics §1-12; OECD AI Principles" },
    { layer: 1, type: "yes_no",
      en: "Is there a designated Data Protection Officer (DPO) or equivalent with explicit AI oversight responsibilities?",
      ar: "هل يوجد مسؤول حماية بيانات (DPO) أو ما يعادله بمسؤوليات إشراف صريحة على الذكاء الاصطناعي؟",
      ref: "UAE PDPL Article 26; Saudi PDPL Article 32" },
    { layer: 1, type: "rating",
      en: "All AI systems have a documented owner accountable for outputs, including a clearly defined escalation path for issues.",
      ar: "لكل أنظمة الذكاء الاصطناعي مالك موثق ومسؤول عن المخرجات، مع مسار تصعيد واضح.",
      ref: "ISO 42001 §5.3; NIST AI RMF GOVERN-2" },
    { layer: 1, type: "rating",
      en: "AI decisions affecting customers or citizens are documented with the data, model version, and reasoning that produced them.",
      ar: "قرارات الذكاء الاصطناعي التي تؤثر على العملاء أو المواطنين موثقة مع البيانات وإصدار النموذج والمنطق.",
      ref: "UAE AI Charter Principle 3; SDAIA AI Ethics §3; GDPR Article 22" },
    { layer: 1, type: "rating",
      en: "Affected individuals are informed when an AI system makes or significantly influences decisions about them.",
      ar: "يُبلَّغ الأفراد المعنيون عندما يتخذ نظام ذكاء اصطناعي قرارات تؤثر عليهم.",
      ref: "UAE AI Charter Principle 3; UAE PDPL Article 22; GDPR Article 22" },
    { layer: 1, type: "rating",
      en: "A formal AI risk register tracks identified AI-related risks, owners, mitigations, and residual risk levels.",
      ar: "سجل مخاطر رسمي للذكاء الاصطناعي يتتبع المخاطر المحددة، أصحابها، إجراءات التخفيف، ومستويات المخاطر المتبقية.",
      ref: "ISO 23894 §6.4; NIST AI RMF MANAGE-1" },
    { layer: 1, type: "rating",
      en: "AI governance includes mandatory pre-deployment review for high-stakes models (those affecting credit, employment, health, justice).",
      ar: "حوكمة الذكاء الاصطناعي تشمل مراجعة إلزامية قبل النشر للنماذج عالية المخاطر.",
      ref: "ISO 42001 §8.2; UAE AI Charter Principle 5; EU AI Act Title III (reference)" },
    { layer: 1, type: "rating",
      en: "An audit trail captures every change to a production AI system: model version, data update, configuration change.",
      ar: "سجل تدقيق يلتقط كل تغيير في نظام ذكاء اصطناعي إنتاجي: إصدار النموذج، تحديث البيانات، تغيير الإعدادات.",
      ref: "ISO 42001 §8.5; NCA ECC-2:2024 §7" },
    { layer: 1, type: "rating",
      en: "The organization complies with regional AI registration requirements (e.g. Dubai DCAI registry, SDAIA approvals where applicable).",
      ar: "تمتثل المنظمة لمتطلبات تسجيل الذكاء الاصطناعي الإقليمية (سجل DCAI في دبي، اعتمادات SDAIA حيث ينطبق).",
      ref: "DCAI Guidelines §4; SDAIA AI Adoption §6" },
    { layer: 2, type: "open_text",
      en: "Describe a recent AI governance committee decision and the basis on which it was made.",
      ar: "صف قراراً حديثاً للجنة حوكمة الذكاء الاصطناعي والأساس الذي اتخذ عليه.",
      ref: "ISO 42001 §9.3" },
    { layer: 2, type: "rating",
      en: "Rate the strength of the link between the AI risk register and the enterprise risk-management framework.",
      ar: "قيّم قوة الارتباط بين سجل مخاطر الذكاء الاصطناعي وإطار إدارة المخاطر المؤسسية.",
      ref: "ISO 23894 §5.4" },
    { layer: 2, type: "open_text",
      en: "Walk through the most recent AI incident: what happened, who was notified, what was the resolution, what changed afterward.",
      ar: "اشرح أحدث حادث ذكاء اصطناعي: ماذا حدث، من تم إبلاغه، ما الحل، ما الذي تغير بعد ذلك.",
      ref: "NCA ECC-2:2024 §6; ISO 42001 §10.1" },
    { layer: 2, type: "multiple_choice",
      en: "What level of human oversight is mandated for generative AI outputs that go directly to external audiences?",
      ar: "ما مستوى الإشراف البشري المطلوب لمخرجات الذكاء الاصطناعي التوليدي التي تصل إلى الجمهور الخارجي؟",
      ref: "UAE AI Charter Principle 4; SDAIA GenAI Guidelines §3",
      options: {
        en: ["No oversight required", "Random spot-checks", "Sample-based human review", "100% human review for high-stakes outputs", "100% human review + signed approval audit trail"],
        ar: ["لا يوجد إشراف", "فحوصات عشوائية", "مراجعة بشرية لعينات", "مراجعة بشرية كاملة للمخرجات عالية المخاطر", "مراجعة كاملة مع سجل اعتماد موقع"],
        map: { "No oversight required": 1.0, "Random spot-checks": 2.0, "Sample-based human review": 3.0, "100% human review for high-stakes outputs": 4.0, "100% human review + signed approval audit trail": 5.0 },
      } },
    { layer: 2, type: "rating",
      en: "Rate the readiness of the organization to respond to a regulatory AI audit within 5 business days.",
      ar: "قيّم جاهزية المنظمة للاستجابة لتدقيق تنظيمي للذكاء الاصطناعي خلال ٥ أيام عمل.",
      ref: "UAE PDPL Article 41; SDAIA NDGF Article 11" },
  ],

  // ──────────────────────────────────────────────────────────────
  // OPERATIONS & USE CASE PORTFOLIO (10 L1 + 4 L2 = 14)
  // ──────────────────────────────────────────────────────────────
  operations: [
    { layer: 1, type: "rating",
      en: "A central inventory lists all AI use cases with status, owner, and business value.",
      ar: "مخزون مركزي يسرد جميع حالات استخدام الذكاء الاصطناعي مع الحالة والمالك والقيمة التجارية.",
      ref: "ISO 42001 §8.1; NIST AI RMF MAP-1" },
    { layer: 1, type: "rating",
      en: "ROI is measured and reported for production AI use cases.",
      ar: "يُقاس العائد على الاستثمار ويُبلَّغ عن حالات الاستخدام الإنتاجية.",
      ref: "ISO 42001 §9.1" },
    { layer: 1, type: "rating",
      en: "Failed pilots are retired on a defined timeline with lessons captured.",
      ar: "التجارب الفاشلة تُوقَف وفق جدول زمني محدد مع توثيق الدروس المستفادة.",
      ref: "ISO 42001 §10.1" },
    { layer: 1, type: "rating",
      en: "AI use cases are mapped to specific business outcomes or KPIs.",
      ar: "تُرتبط حالات استخدام الذكاء الاصطناعي بنتائج أعمال أو مؤشرات أداء محددة.",
      ref: "ISO 42001 §6.2" },
    { layer: 1, type: "rating",
      en: "Cross-department AI portfolio reviews happen at least biannually.",
      ar: "مراجعات محفظة الذكاء الاصطناعي عبر الإدارات تُعقد على الأقل نصف سنوية.",
      ref: "ISO 42001 §9.3" },
    { layer: 1, type: "rating",
      en: "Each AI use case has a documented success threshold defined before deployment, and the actual outcome is compared back to it.",
      ar: "لكل حالة استخدام للذكاء الاصطناعي عتبة نجاح موثقة قبل النشر، وتُقارن النتيجة الفعلية بها.",
      ref: "ISO 42001 §6.2; NIST AI RMF MEASURE-1" },
    { layer: 1, type: "rating",
      en: "A balanced portfolio is maintained across efficiency, customer experience, and revenue-generating AI use cases.",
      ar: "تحافظ المنظمة على محفظة متوازنة بين الكفاءة وتجربة العميل وتوليد الإيرادات في حالات استخدام الذكاء الاصطناعي.",
      ref: "SDAIA AI Adoption §4; ISO 42001 §6.1" },
    { layer: 1, type: "rating",
      en: "Operational ownership of AI use cases passes from the project team to a business unit at production hand-over, with a documented runbook.",
      ar: "تنتقل الملكية التشغيلية لحالات استخدام الذكاء الاصطناعي من فريق المشروع إلى وحدة أعمال عند التسليم للإنتاج مع كتيب تشغيل موثق.",
      ref: "ISO 42001 §8.5" },
    { layer: 1, type: "yes_no",
      en: "Is there at least one AI use case currently in production that has been operating for more than 12 months?",
      ar: "هل توجد حالة استخدام واحدة على الأقل للذكاء الاصطناعي في الإنتاج منذ أكثر من ١٢ شهراً؟",
      ref: "SDAIA AI Adoption §3" },
    { layer: 1, type: "rating",
      en: "AI use case proposals must include an impact assessment covering customer / citizen, employee, and regulatory dimensions.",
      ar: "تتطلب مقترحات حالات استخدام الذكاء الاصطناعي تقييم أثر يغطي البعد العملاء / المواطنين والموظفين والتنظيمي.",
      ref: "UAE AI Charter Principle 5; OECD AI Principles §2.3" },
    { layer: 2, type: "open_text",
      en: "Describe how an AI initiative gets approved for funding from idea to production - the gates, the people, the typical timeline.",
      ar: "صف كيف يتم اعتماد مبادرة ذكاء اصطناعي للتمويل من الفكرة إلى الإنتاج.",
      ref: "ISO 42001 §6.2" },
    { layer: 2, type: "multiple_choice",
      en: "What is the typical lifecycle of an AI use case from approval to first production deployment?",
      ar: "ما الدورة الحياتية النموذجية لحالة استخدام الذكاء الاصطناعي من الاعتماد إلى أول نشر إنتاجي؟",
      ref: "ISO 42001 §6.2",
      options: {
        en: ["> 18 months", "12-18 months", "9-12 months", "6-9 months", "< 6 months"],
        ar: ["أكثر من ١٨ شهراً", "١٢-١٨ شهراً", "٩-١٢ شهراً", "٦-٩ أشهر", "أقل من ٦ أشهر"],
        map: { "> 18 months": 1.0, "12-18 months": 2.0, "9-12 months": 3.0, "6-9 months": 4.0, "< 6 months": 5.0 },
      } },
    { layer: 2, type: "rating",
      en: "Rate the discipline of post-deployment ROI tracking for the top 3 AI use cases.",
      ar: "قيّم انضباط تتبع العائد على الاستثمار بعد النشر لأهم ٣ حالات استخدام للذكاء الاصطناعي.",
      ref: "ISO 42001 §9.1" },
    { layer: 2, type: "open_text",
      en: "Which two AI use cases delivered the most value in the last year, and how was that value measured?",
      ar: "أي حالتي استخدام للذكاء الاصطناعي حققتا أكبر قيمة في العام الماضي، وكيف تم قياس تلك القيمة؟",
      ref: "ISO 42001 §9.1" },
  ],

  // ──────────────────────────────────────────────────────────────
  // MODEL MANAGEMENT & MONITORING (14 L1 + 5 L2 = 19)
  // ──────────────────────────────────────────────────────────────
  model_management: [
    { layer: 1, type: "rating",
      en: "All production models are versioned and tracked in a model registry.",
      ar: "جميع نماذج الإنتاج لها إصدارات ومتتبعة في سجل نماذج.",
      ref: "ISO 42001 §8.5; NIST AI RMF MANAGE-2" },
    { layer: 1, type: "rating",
      en: "Model performance (accuracy, drift, bias) is continuously monitored.",
      ar: "أداء النماذج (الدقة والانحراف والتحيز) يُراقب باستمرار.",
      ref: "NIST AI RMF MEASURE-2; ISO 42001 §9.1" },
    { layer: 1, type: "rating",
      en: "Human review is mandatory for high-stakes model decisions.",
      ar: "المراجعة البشرية إلزامية لقرارات النماذج عالية المخاطر.",
      ref: "UAE AI Charter Principle 4; SDAIA AI Ethics §4" },
    { layer: 1, type: "rating",
      en: "Models undergo periodic fairness and bias testing.",
      ar: "تخضع النماذج لاختبار دوري للعدالة والتحيز.",
      ref: "UAE AI Charter Principle 2; SDAIA AI Ethics §2; NIST AI RMF MEASURE-2.11" },
    { layer: 1, type: "rating",
      en: "A retirement process removes stale or underperforming models from production.",
      ar: "عملية إيقاف محددة تزيل النماذج القديمة أو ضعيفة الأداء من الإنتاج.",
      ref: "ISO 42001 §8.7" },
    { layer: 1, type: "rating",
      en: "Each production model has a documented model card covering intended use, training data, performance metrics, and known limitations.",
      ar: "لكل نموذج إنتاجي بطاقة نموذج موثقة تغطي الاستخدام المقصود، بيانات التدريب، مقاييس الأداء، والقيود المعروفة.",
      ref: "ISO 42001 §8.5; NIST AI RMF MAP-3.4" },
    { layer: 1, type: "rating",
      en: "Adversarial testing (red-teaming, prompt-injection probes for LLMs) is conducted before high-risk model deployment.",
      ar: "اختبار خصومي (red-teaming، اختبارات حقن المطالبات للنماذج اللغوية الكبيرة) يُجرى قبل نشر النماذج عالية المخاطر.",
      ref: "NIST AI RMF MEASURE-2.7; SDAIA GenAI Guidelines §4" },
    { layer: 1, type: "rating",
      en: "Explainability methods (e.g. SHAP, LIME, attention visualisation) are produced and reviewed for high-stakes models.",
      ar: "طرق التفسير (مثل SHAP، LIME، تصور الانتباه) تُنتج وتُراجع للنماذج عالية المخاطر.",
      ref: "UAE AI Charter Principle 3; OECD AI Principles §1.3" },
    { layer: 1, type: "rating",
      en: "Model retraining decisions are documented (trigger, dataset, performance delta, sign-off).",
      ar: "قرارات إعادة تدريب النماذج موثقة (المحفز، بيانات التدريب، فارق الأداء، الاعتماد).",
      ref: "ISO 42001 §8.5; NIST AI RMF MANAGE-2.4" },
    { layer: 1, type: "rating",
      en: "Champion-challenger or A/B testing infrastructure is in place to compare model versions on live traffic before promoting a new version.",
      ar: "بنية تحتية للاختبار من نوع champion-challenger أو A/B لمقارنة إصدارات النماذج على حركة المرور الحية قبل ترقية إصدار جديد.",
      ref: "ISO 42001 §8.5" },
    { layer: 1, type: "rating",
      en: "Production model performance is reviewed against documented KPIs at least monthly.",
      ar: "أداء النماذج الإنتاجية يُراجع مقابل مؤشرات موثقة على الأقل شهرياً.",
      ref: "ISO 42001 §9.1; NIST AI RMF MEASURE-1" },
    { layer: 1, type: "rating",
      en: "Models are rolled back automatically when monitoring detects performance regression beyond defined thresholds.",
      ar: "تُستعاد النماذج تلقائياً عندما تكتشف المراقبة تراجعاً في الأداء يتجاوز حدوداً محددة.",
      ref: "NIST AI RMF MANAGE-2.4; ISO 42001 §8.5" },
    { layer: 1, type: "yes_no",
      en: "Is there a published policy that mandates a human-in-the-loop step for any AI decision affecting customer access to services or employment?",
      ar: "هل توجد سياسة منشورة تتطلب خطوة بشرية لأي قرار ذكاء اصطناعي يؤثر على وصول العميل للخدمات أو التوظيف؟",
      ref: "UAE AI Charter Principle 4; UAE PDPL Article 22; GDPR Article 22" },
    { layer: 1, type: "rating",
      en: "Generative AI outputs that go to external audiences are watermarked or labelled as AI-generated where required.",
      ar: "مخرجات الذكاء الاصطناعي التوليدي التي تصل إلى الجمهور الخارجي موسومة كمولّدة بالذكاء الاصطناعي حيثما يُطلب.",
      ref: "SDAIA GenAI Guidelines §3; UAE AI Charter Principle 3" },
    { layer: 2, type: "open_text",
      en: "Describe the most recent fairness/bias evaluation conducted on a production model. Findings? Mitigations? Re-test results?",
      ar: "صف أحدث تقييم عدالة / تحيز أُجري على نموذج إنتاجي. النتائج؟ الإجراءات؟ نتائج إعادة الاختبار؟",
      ref: "NIST AI RMF MEASURE-2.11; UAE AI Charter Principle 2" },
    { layer: 2, type: "rating",
      en: "Rate the depth and consistency of model documentation across the production portfolio.",
      ar: "قيّم عمق واتساق توثيق النماذج عبر المحفظة الإنتاجية.",
      ref: "ISO 42001 §8.5" },
    { layer: 2, type: "open_text",
      en: "Walk through the steps that would happen if a production model started producing biased outputs against a protected group: detection, escalation, remediation, reporting.",
      ar: "اشرح الخطوات التي ستحدث إذا بدأ نموذج إنتاجي في إنتاج مخرجات متحيزة ضد فئة محمية: الكشف، التصعيد، المعالجة، الإبلاغ.",
      ref: "UAE AI Charter Principle 2; NIST AI RMF MANAGE-1.4" },
    { layer: 2, type: "multiple_choice",
      en: "How are model performance regressions discovered today?",
      ar: "كيف يتم اكتشاف تراجع أداء النماذج اليوم؟",
      ref: "NIST AI RMF MEASURE-2",
      options: {
        en: ["Customer complaint or external incident", "Quarterly manual review", "Monthly dashboards reviewed by team", "Automated alerts on threshold breach", "Automated alerts + auto-rollback + post-incident review"],
        ar: ["شكوى عميل أو حادث خارجي", "مراجعة يدوية ربع سنوية", "لوحات شهرية يراجعها الفريق", "تنبيهات آلية عند تجاوز الحدود", "تنبيهات + استعادة آلية + مراجعة بعد الحادث"],
        map: { "Customer complaint or external incident": 1.0, "Quarterly manual review": 2.0, "Monthly dashboards reviewed by team": 3.0, "Automated alerts on threshold breach": 4.0, "Automated alerts + auto-rollback + post-incident review": 5.0 },
      } },
    { layer: 2, type: "rating",
      en: "Rate the rigour of pre-deployment testing for the most recently launched generative AI capability.",
      ar: "قيّم صرامة الاختبار قبل النشر لأحدث قدرة ذكاء اصطناعي توليدي تم إطلاقها.",
      ref: "SDAIA GenAI Guidelines §4; NIST AI RMF MEASURE-2.7" },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────

function log(msg: string) {
  const now = new Date().toISOString().slice(11, 19);
  console.log(`[${now}] ${msg}`);
}

async function die(prefix: string, err: { message: string } | null): Promise<never> {
  console.error(`\n[seed-production-bank] ${prefix}: ${err?.message ?? "unknown error"}\n`);
  process.exit(1);
}

function resolveOptions(q: VettedQuestion) {
  if (q.type === "open_text") return { en: null, ar: null, map: null };
  if (q.options) return { en: q.options.en, ar: q.options.ar, map: q.options.map };
  if (q.type === "yes_no") return { en: YESNO_EN, ar: YESNO_AR, map: YESNO_MAP };
  // rating + multi-choice default to Likert
  return { en: LIKERT_EN, ar: LIKERT_AR, map: LIKERT_MAP };
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  log("VIFM Compass - production question bank seed");
  log(`Version: ${VERSION_NUMBER} - "${VERSION_LABEL}"`);
  log(`Activate after seed: ${ACTIVATE ? "YES" : "no (admin must activate manually)"}`);
  log("------------------------------------------------");

  // 1. Find-or-create the version row.
  let versionId: string;
  {
    const { data: existing } = await sb
      .from("ara_question_bank_versions")
      .select("id")
      .eq("version_number", VERSION_NUMBER)
      .maybeSingle<{ id: string }>();

    if (existing) {
      versionId = existing.id;
      log(`  - reused version ${VERSION_NUMBER}`);
    } else {
      const { data: created, error } = await sb
        .from("ara_question_bank_versions")
        .insert({
          version_number: VERSION_NUMBER,
          version_label: VERSION_LABEL,
          is_active: false, // activated explicitly below if --activate
          release_notes:
            "Vetted production bank: 91 Layer 1 + 30 Layer 2 questions across 8 pillars. " +
            "Each question references a published framework (UAE PDPL, SDAIA NDGF, ISO 42001, " +
            "NIST AI RMF, OECD AI Principles, UAE AI Charter) in help_text_en for audit traceability.",
        })
        .select("id")
        .single();
      if (error || !created) await die("create version", error);
      versionId = created!.id;
      log(`  + created version ${VERSION_NUMBER} (id ${versionId})`);
    }
  }

  // 2. Wipe any existing questions on this version - we are the source
  // of truth. Cascades to responses against this version.
  log("Wiping prior questions on this version...");
  {
    const { error } = await sb.from("ara_questions").delete().eq("version_id", versionId);
    if (error) await die("wipe questions", error);
    log("  - wiped");
  }

  // 3. Insert all 121 questions in pillar order, each with a numeric
  // `question_number` 1..N within its pillar.
  log("Inserting vetted questions...");
  const rows: Array<Record<string, unknown>> = [];
  for (const pillarId of Object.keys(PILLAR_QUESTIONS)) {
    PILLAR_QUESTIONS[pillarId].forEach((q, idx) => {
      const opts = resolveOptions(q);
      rows.push({
        version_id: versionId,
        pillar_id: pillarId,
        question_number: idx + 1,
        question_text_en: q.en,
        question_text_ar: q.ar,
        question_type: q.type,
        options_en: opts.en,
        options_ar: opts.ar,
        score_map: opts.map,
        // Audit / provenance string surfaces in admin UI as help text.
        help_text_en: `Reference: ${q.ref}`,
        help_text_ar: `المرجع: ${q.ref}`,
        region: "both",
        sector: "all",
        layer: q.layer,
        display_order: idx + 1,
        is_active: true,
      });
    });
  }

  const { data: inserted, error: insErr } = await sb
    .from("ara_questions")
    .insert(rows)
    .select("id, pillar_id, layer");
  if (insErr) await die("insert questions", insErr);

  log(`  + inserted ${inserted!.length} questions total`);
  const byPillar: Record<string, { l1: number; l2: number }> = {};
  for (const r of inserted as Array<{ pillar_id: string; layer: number }>) {
    byPillar[r.pillar_id] = byPillar[r.pillar_id] ?? { l1: 0, l2: 0 };
    if (r.layer === 1) byPillar[r.pillar_id].l1++;
    else byPillar[r.pillar_id].l2++;
  }
  for (const [p, c] of Object.entries(byPillar)) {
    console.log(`     ${p.padEnd(20)}  L1: ${String(c.l1).padStart(2)}   L2: ${String(c.l2).padStart(2)}`);
  }

  // 4. Optionally activate (deactivates whatever was active before).
  if (ACTIVATE) {
    log("Activating this version (deactivating any prior active)...");
    const { error: deactErr } = await sb
      .from("ara_question_bank_versions")
      .update({ is_active: false })
      .neq("id", versionId);
    if (deactErr) await die("deactivate prior", deactErr);
    const { error: actErr } = await sb
      .from("ara_question_bank_versions")
      .update({ is_active: true, published_at: new Date().toISOString() })
      .eq("id", versionId);
    if (actErr) await die("activate version", actErr);
    log(`  + ${VERSION_NUMBER} is now ACTIVE.`);
  }

  console.log("\n=================================================");
  console.log("  PRODUCTION BANK SEEDED");
  console.log("=================================================");
  console.log(`  Version:    ${VERSION_NUMBER} - ${VERSION_LABEL}`);
  console.log(`  Questions:  ${inserted!.length} total`);
  console.log(`  Active:     ${ACTIVATE ? "yes (just set)" : "no - activate via /ara/admin/questions"}`);
  console.log("");
  console.log("  Browse + edit at:   /ara/admin/questions");
  console.log(`  Click 'v${VERSION_NUMBER}' to see all questions.`);
  console.log("  Click any question's pencil icon to edit text, options,");
  console.log("  layer, region/sector filter, or score map.");
  console.log("");
  console.log("  Re-run with --activate to flip is_active automatically:");
  console.log("    npx tsx scripts/seed-production-bank.ts --activate\n");
}

main().catch((err) => {
  console.error("\n[seed-production-bank] fatal:", err);
  process.exit(1);
});
