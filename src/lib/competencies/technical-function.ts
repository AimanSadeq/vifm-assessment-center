import { createServiceClient } from "@/lib/supabase/server";

// ── Functions - the job-level unit of technical assessment ───────────────────
//
// Technical competency is role/function-specific, not department-wide: the AR
// team shares one body of knowledge; a Finance division (AP + AR + audit +
// treasury) does not. So the assessable unit is the FUNCTION (Accounts Payable,
// Treasury, Internal Audit…), defined as a blueprint of the technical skills the
// function requires. A function assessment draws items across those skills (deep
// + per-skill), replacing the old "pick a broad domain → 8 generic Qs".
//
// Functions come from a curated standard library (source='standard') or are
// derived from an imported job description (source='jd'). This loader reads the
// bilingual technical_functions table (migration 00058) via the service client
// (the runner is public; the table is RLS auth-only), and falls back to the
// code-side STANDARD_FUNCTIONS so the runner still works before 00058 lands.

export type TechFunctionSource = "standard" | "jd";

export type StandardFunction = {
  key: string;
  name_en: string;
  name_ar: string;
  category: string;
  skills_en: string[];
  skills_ar: string[];
};

/** Canonical fallback - mirrors the 00058 + 00060 + 00073 seed (48 standard
 *  functions across 9 competencies: Finance, Accounting, Banking, Investment,
 *  Treasury, Data Analytics, Business Intelligence, Artificial Intelligence, HR). */
export const STANDARD_FUNCTIONS: StandardFunction[] = [
  {
    key: "accounts_payable",
    name_en: "Accounts Payable",
    name_ar: "الحسابات الدائنة (المدفوعات)",
    category: "accounting",
    skills_en: ["Invoice Processing & 3-Way Match", "Vendor Reconciliation", "Payment Runs & Controls", "Expense & T&E Processing", "Accruals & AP Ledger", "VAT & Withholding on Payables"],
    skills_ar: ["معالجة الفواتير والمطابقة الثلاثية", "تسوية حسابات المورّدين", "دفعات السداد والضوابط", "معالجة المصروفات والسفر", "الاستحقاقات ودفتر الدائنين", "ضريبة القيمة المضافة والاستقطاع على المدفوعات"],
  },
  {
    key: "accounts_receivable",
    name_en: "Accounts Receivable",
    name_ar: "الحسابات المدينة (المقبوضات)",
    category: "accounting",
    skills_en: ["Billing & Invoicing", "Cash Application", "Credit Assessment & Limits", "Collections & Aging", "Bad-Debt Provisioning", "DSO Analytics"],
    skills_ar: ["إصدار الفواتير", "تخصيص المقبوضات", "تقييم الائتمان والحدود", "التحصيل وأعمار الذمم", "مخصصات الديون المعدومة", "تحليل فترة التحصيل (DSO)"],
  },
  {
    key: "general_ledger",
    name_en: "General Ledger",
    name_ar: "الأستاذ العام",
    category: "accounting",
    skills_en: ["Double-Entry & Journals", "Month-End Close & Reconciliations", "Accruals, Prepayments & Provisions", "Intercompany Accounting", "Chart of Accounts Control", "IFRS Fundamentals"],
    skills_ar: ["القيد المزدوج واليوميات", "إقفال نهاية الشهر والتسويات", "الاستحقاقات والمصروفات المدفوعة مقدمًا والمخصصات", "محاسبة الشركات الشقيقة", "ضبط دليل الحسابات", "أساسيات المعايير الدولية (IFRS)"],
  },
  {
    key: "financial_reporting",
    name_en: "Financial Reporting & Consolidation",
    name_ar: "التقارير المالية والتوحيد",
    category: "accounting",
    skills_en: ["IFRS Application & Disclosures", "Consolidation & Eliminations", "FX Translation", "Statutory & Regulatory Reporting", "Narrative & ESG Reporting", "Reporting Controls"],
    skills_ar: ["تطبيق المعايير الدولية والإفصاحات", "التوحيد والاستبعادات", "ترجمة العملات الأجنبية", "التقارير النظامية والرقابية", "التقارير السردية وتقارير الاستدامة (ESG)", "ضوابط إعداد التقارير"],
  },
  {
    key: "management_accounting",
    name_en: "Management Accounting",
    name_ar: "المحاسبة الإدارية",
    category: "finance",
    skills_en: ["Costing Methods (Standard/ABC/Marginal)", "Variance Analysis", "Budgeting Support", "Profitability & Contribution Analysis", "Cost Allocation", "Management Reporting"],
    skills_ar: ["طرق التكاليف (المعيارية/على الأنشطة/الحدية)", "تحليل الانحرافات", "دعم إعداد الموازنات", "تحليل الربحية والمساهمة", "توزيع التكاليف", "التقارير الإدارية"],
  },
  {
    key: "treasury",
    name_en: "Treasury",
    name_ar: "الخزينة",
    category: "treasury",
    skills_en: ["Cash & Liquidity Management", "FX Risk Management", "Interest-Rate Risk", "Funding & Capital Markets", "Bank Relationship Management", "Cash Forecasting"],
    skills_ar: ["إدارة النقد والسيولة", "إدارة مخاطر الصرف الأجنبي", "مخاطر أسعار الفائدة", "التمويل وأسواق المال", "إدارة العلاقات المصرفية", "التنبؤ بالتدفقات النقدية"],
  },
  {
    key: "fpa",
    name_en: "Financial Planning & Analysis",
    name_ar: "التخطيط والتحليل المالي",
    category: "finance",
    skills_en: ["Budgeting & Rolling Forecasts", "Driver & Variance Analysis", "Financial Modelling", "Scenario & Sensitivity Analysis", "KPI & Dashboarding", "Business-Partnering Analytics"],
    skills_ar: ["إعداد الموازنات والتنبؤات المتجددة", "تحليل المحركات والانحرافات", "النمذجة المالية", "تحليل السيناريوهات والحساسية", "مؤشرات الأداء ولوحات المعلومات", "تحليلات الشراكة مع الأعمال"],
  },
  {
    key: "corporate_finance",
    name_en: "Corporate Finance",
    name_ar: "التمويل المؤسسي",
    category: "finance",
    skills_en: ["Capital Budgeting", "Cost of Capital (WACC)", "Capital Structure", "Working Capital Management", "Investment Appraisal", "Financial Statement Analysis"],
    skills_ar: ["الموازنة الرأسمالية", "تكلفة رأس المال (WACC)", "هيكل رأس المال", "إدارة رأس المال العامل", "تقييم جدوى الاستثمار", "تحليل القوائم المالية"],
  },
  {
    key: "tax",
    name_en: "Tax",
    name_ar: "الضرائب",
    category: "accounting",
    skills_en: ["Corporate Income Tax", "VAT & Indirect Tax", "Withholding Tax", "Transfer Pricing", "Deferred Tax & Provisioning", "GCC Specifics (Zakat, E-Invoicing)"],
    skills_ar: ["ضريبة دخل الشركات", "ضريبة القيمة المضافة والضرائب غير المباشرة", "ضريبة الاستقطاع", "تسعير المعاملات بين الشركات", "الضريبة المؤجلة والمخصصات", "خصوصيات الخليج (الزكاة، الفوترة الإلكترونية)"],
  },
  {
    key: "internal_audit",
    name_en: "Internal Audit & Controls",
    name_ar: "التدقيق الداخلي والضوابط",
    category: "accounting",
    skills_en: ["Risk-Based Audit Planning", "Internal Controls (COSO)", "Walkthroughs & Testing", "Fraud Risk", "Audit Reporting & Follow-up", "Audit Analytics"],
    skills_ar: ["تخطيط التدقيق القائم على المخاطر", "الضوابط الداخلية (COSO)", "اختبارات السير والفحص", "مخاطر الاحتيال", "تقارير التدقيق والمتابعة", "تحليلات التدقيق"],
  },
  {
    key: "external_audit",
    name_en: "External / Statutory Audit",
    name_ar: "التدقيق الخارجي / القانوني",
    category: "accounting",
    skills_en: ["Auditing Standards (ISA)", "Materiality & Sampling", "Controls vs Substantive Testing", "Audit Evidence & Documentation", "Going Concern & Opinion", "IFRS Audit Considerations"],
    skills_ar: ["معايير التدقيق الدولية (ISA)", "الأهمية النسبية والعينات", "اختبارات الضوابط مقابل الاختبارات الأساسية", "أدلة التدقيق والتوثيق", "الاستمرارية وإبداء الرأي", "اعتبارات تدقيق المعايير الدولية"],
  },
  {
    key: "payroll",
    name_en: "Payroll",
    name_ar: "الرواتب",
    category: "accounting",
    skills_en: ["Payroll Processing & Controls", "Statutory Deductions (GOSI/WPS)", "End-of-Service & Benefits", "Payroll Reconciliation", "Time & Attendance Integration"],
    skills_ar: ["معالجة الرواتب والضوابط", "الاستقطاعات النظامية (التأمينات/حماية الأجور)", "نهاية الخدمة والمزايا", "تسوية الرواتب", "تكامل الوقت والحضور"],
  },
  {
    key: "fixed_assets",
    name_en: "Fixed Assets",
    name_ar: "الأصول الثابتة",
    category: "accounting",
    skills_en: ["Capitalization & Componentization", "Depreciation Methods", "Impairment (IAS 36)", "Asset Register & Verification", "Disposals & Revaluation"],
    skills_ar: ["الرسملة وتجزئة المكوّنات", "طرق الإهلاك", "انخفاض القيمة (IAS 36)", "سجل الأصول والجرد", "الاستبعادات وإعادة التقييم"],
  },

  // ── Banking ──────────────────────────────────────────────────────────────
  {
    key: "credit_underwriting",
    name_en: "Credit & Underwriting",
    name_ar: "الائتمان والاكتتاب",
    category: "banking",
    skills_en: ["Financial Spreading", "Credit Risk Assessment", "Collateral & Security", "Credit Scoring Models", "Covenant Monitoring", "Credit Approval Process"],
    skills_ar: ["تحليل القوائم المالية (Spreading)", "تقييم مخاطر الائتمان", "الضمانات والرهونات", "نماذج التقييم الائتماني", "مراقبة التعهدات", "عملية اعتماد الائتمان"],
  },
  {
    key: "loan_operations",
    name_en: "Loan Operations & Administration",
    name_ar: "عمليات وإدارة القروض",
    category: "banking",
    skills_en: ["Loan Documentation", "Disbursement & Drawdown", "Loan Servicing", "Collateral Management", "Delinquency Handling", "Loan System Operations"],
    skills_ar: ["توثيق القروض", "الصرف والسحب", "خدمة القروض", "إدارة الضمانات", "معالجة التعثّر", "تشغيل أنظمة القروض"],
  },
  {
    key: "banking_risk",
    name_en: "Banking Risk Management",
    name_ar: "إدارة المخاطر المصرفية",
    category: "banking",
    skills_en: ["Credit Risk", "Market Risk", "Operational Risk", "Basel III/IV & Capital Adequacy", "Stress Testing", "Risk Reporting"],
    skills_ar: ["مخاطر الائتمان", "مخاطر السوق", "المخاطر التشغيلية", "بازل 3/4 وكفاية رأس المال", "اختبارات الضغط", "تقارير المخاطر"],
  },
  {
    key: "compliance_aml_kyc",
    name_en: "Compliance, AML & KYC",
    name_ar: "الامتثال ومكافحة غسل الأموال واعرف عميلك",
    category: "banking",
    skills_en: ["KYC & Customer Due Diligence", "AML Transaction Monitoring", "Sanctions Screening", "Regulatory Reporting", "Fraud Detection", "FATCA & CRS"],
    skills_ar: ["اعرف عميلك والعناية الواجبة", "مراقبة معاملات غسل الأموال", "فحص العقوبات", "التقارير الرقابية", "كشف الاحتيال", "فاتكا والمعيار الموحد (CRS)"],
  },
  {
    key: "trade_finance",
    name_en: "Trade Finance",
    name_ar: "تمويل التجارة",
    category: "banking",
    skills_en: ["Letters of Credit", "Documentary Collections", "Guarantees & Bonds", "Supply-Chain Finance", "UCP 600 Rules", "Trade Risk"],
    skills_ar: ["الاعتمادات المستندية", "التحصيل المستندي", "الضمانات والكفالات", "تمويل سلاسل الإمداد", "قواعد UCP 600", "مخاطر التجارة"],
  },
  {
    key: "islamic_banking",
    name_en: "Islamic Banking",
    name_ar: "الصيرفة الإسلامية",
    category: "banking",
    skills_en: ["Murabaha", "Ijara", "Musharaka & Mudaraba", "Sukuk", "Sharia Compliance", "Islamic Treasury"],
    skills_ar: ["المرابحة", "الإجارة", "المشاركة والمضاربة", "الصكوك", "الالتزام بالشريعة", "الخزينة الإسلامية"],
  },

  // ── Investment ───────────────────────────────────────────────────────────
  {
    key: "equity_research",
    name_en: "Equity Research",
    name_ar: "أبحاث الأسهم",
    category: "investment",
    skills_en: ["Industry & Company Analysis", "Financial Modelling", "Valuation (DCF & Multiples)", "Earnings Forecasting", "Investment Thesis & Reports", "Sector Coverage"],
    skills_ar: ["تحليل القطاع والشركة", "النمذجة المالية", "التقييم (التدفقات النقدية والمضاعفات)", "التنبؤ بالأرباح", "أطروحة الاستثمار والتقارير", "تغطية القطاعات"],
  },
  {
    key: "portfolio_management",
    name_en: "Portfolio Management",
    name_ar: "إدارة المحافظ",
    category: "investment",
    skills_en: ["Asset Allocation", "Security Selection", "Rebalancing", "Risk Budgeting", "Mandate & IPS Compliance", "Performance Review"],
    skills_ar: ["توزيع الأصول", "اختيار الأوراق المالية", "إعادة التوازن", "موازنة المخاطر", "الالتزام بالتفويض وسياسة الاستثمار", "مراجعة الأداء"],
  },
  {
    key: "fixed_income",
    name_en: "Fixed Income",
    name_ar: "الدخل الثابت",
    category: "investment",
    skills_en: ["Bond Valuation", "Yield Curve Analysis", "Duration & Convexity", "Credit Analysis", "Spread Analysis", "Interest-Rate Strategy"],
    skills_ar: ["تقييم السندات", "تحليل منحنى العائد", "المدة والتحدّب", "تحليل الائتمان", "تحليل الهوامش", "استراتيجية أسعار الفائدة"],
  },
  {
    key: "wealth_management",
    name_en: "Wealth Management & Advisory",
    name_ar: "إدارة الثروات والاستشارات",
    category: "investment",
    skills_en: ["Client Profiling & Suitability", "Financial Planning", "Product Selection", "Portfolio Construction", "Relationship Management", "Regulatory Suitability"],
    skills_ar: ["تصنيف العملاء والملاءمة", "التخطيط المالي", "اختيار المنتجات", "بناء المحافظ", "إدارة العلاقات", "الملاءمة التنظيمية"],
  },
  {
    key: "investment_performance",
    name_en: "Performance & Risk",
    name_ar: "الأداء والمخاطر",
    category: "investment",
    skills_en: ["Performance Measurement", "Attribution Analysis", "GIPS Compliance", "Risk Metrics (VaR, Beta)", "Benchmark Analysis", "Reporting"],
    skills_ar: ["قياس الأداء", "تحليل المساهمة في العائد", "الالتزام بمعايير GIPS", "مقاييس المخاطر (القيمة المعرضة للخطر، بيتا)", "تحليل المؤشرات المرجعية", "إعداد التقارير"],
  },
  {
    key: "alternative_investments",
    name_en: "Alternative Investments",
    name_ar: "الاستثمارات البديلة",
    category: "investment",
    skills_en: ["Private Equity", "Real Estate Funds", "Hedge Fund Strategies", "Fund Due Diligence", "Illiquidity & Valuation", "ESG Integration"],
    skills_ar: ["الأسهم الخاصة", "صناديق العقار", "استراتيجيات صناديق التحوّط", "العناية الواجبة للصناديق", "عدم السيولة والتقييم", "دمج معايير الاستدامة (ESG)"],
  },

  // ── Data Analytics ─────────────────────────────────────────────────────────
  {
    key: "data_preparation",
    name_en: "Data Preparation & Engineering",
    name_ar: "إعداد البيانات وهندستها",
    category: "analytics",
    skills_en: ["Data Cleaning", "Data Wrangling", "SQL Querying", "Data Integration", "Data Quality", "Pipeline Basics"],
    skills_ar: ["تنظيف البيانات", "معالجة البيانات", "الاستعلام بلغة SQL", "تكامل البيانات", "جودة البيانات", "أساسيات خطوط البيانات"],
  },
  {
    key: "statistical_analysis",
    name_en: "Statistical Analysis",
    name_ar: "التحليل الإحصائي",
    category: "analytics",
    skills_en: ["Descriptive Statistics", "Hypothesis Testing", "Regression Analysis", "Correlation & Causation", "Sampling", "Time-Series Basics"],
    skills_ar: ["الإحصاء الوصفي", "اختبار الفرضيات", "تحليل الانحدار", "الارتباط والسببية", "المعاينة", "أساسيات السلاسل الزمنية"],
  },
  {
    key: "forecasting_modelling",
    name_en: "Forecasting & Modelling",
    name_ar: "التنبؤ والنمذجة",
    category: "analytics",
    skills_en: ["Forecasting Methods", "Predictive Modelling", "Scenario & Sensitivity Analysis", "Model Validation", "Spreadsheet Engineering", "Driver-Based Models"],
    skills_ar: ["أساليب التنبؤ", "النمذجة التنبؤية", "تحليل السيناريوهات والحساسية", "التحقق من النماذج", "هندسة الجداول الإلكترونية", "النماذج المبنية على المحركات"],
  },
  {
    key: "analytics_programming",
    name_en: "Programming for Analytics",
    name_ar: "البرمجة للتحليلات",
    category: "analytics",
    skills_en: ["Python for Data", "R for Statistics", "Pandas & NumPy", "Automation Scripting", "APIs & Data Extraction", "Version Control Basics"],
    skills_ar: ["بايثون للبيانات", "R للإحصاء", "Pandas وNumPy", "برمجة الأتمتة", "واجهات برمجة التطبيقات واستخراج البيانات", "أساسيات إدارة الإصدارات"],
  },
  {
    key: "data_visualization",
    name_en: "Visualization & Storytelling",
    name_ar: "التصور السردي للبيانات",
    category: "analytics",
    skills_en: ["Chart Selection", "Dashboard Design", "Narrative & Insight", "Stakeholder Communication", "Visualization Tools", "Reporting"],
    skills_ar: ["اختيار الرسوم البيانية", "تصميم لوحات المعلومات", "السرد والاستبصار", "التواصل مع أصحاب المصلحة", "أدوات التصور", "إعداد التقارير"],
  },

  // ── Business Intelligence ──────────────────────────────────────────────────
  {
    key: "dashboard_development",
    name_en: "Dashboard Development",
    name_ar: "تطوير لوحات المعلومات",
    category: "business_intelligence",
    skills_en: ["Dashboard Design", "Visual Best Practices", "Interactivity & Filters", "Power BI / Tableau Build", "Mobile & Responsive BI", "BI UX"],
    skills_ar: ["تصميم لوحات المعلومات", "أفضل ممارسات العرض المرئي", "التفاعلية والمرشحات", "البناء على Power BI / Tableau", "ذكاء الأعمال للجوال والمتجاوب", "تجربة المستخدم لذكاء الأعمال"],
  },
  {
    key: "bi_data_modelling",
    name_en: "Data Modelling (BI)",
    name_ar: "نمذجة البيانات (ذكاء الأعمال)",
    category: "business_intelligence",
    skills_en: ["Star Schema", "Relationships & Cardinality", "DAX & Calculated Measures", "Data Granularity", "Semantic Layer", "Performance Optimization"],
    skills_ar: ["مخطط النجمة", "العلاقات والتعدّدية", "DAX والمقاييس المحسوبة", "دقة تفصيل البيانات", "الطبقة الدلالية", "تحسين الأداء"],
  },
  {
    key: "etl_integration",
    name_en: "ETL & Data Integration",
    name_ar: "الاستخلاص والتحويل وتكامل البيانات",
    category: "business_intelligence",
    skills_en: ["Data Source Connection", "Power Query / ETL", "Data Transformation", "Incremental Refresh", "Pipeline Scheduling", "Data Lineage"],
    skills_ar: ["الاتصال بمصادر البيانات", "Power Query / ETL", "تحويل البيانات", "التحديث التزايدي", "جدولة خطوط البيانات", "تتبّع مسار البيانات"],
  },
  {
    key: "kpi_metric_design",
    name_en: "KPI & Metric Design",
    name_ar: "تصميم مؤشرات الأداء والمقاييس",
    category: "business_intelligence",
    skills_en: ["KPI Definition", "Metric Frameworks", "Targets & Thresholds", "Drill-Down Hierarchies", "Balanced Scorecard", "Metric Governance"],
    skills_ar: ["تعريف مؤشرات الأداء", "أطر المقاييس", "المستهدفات والحدود", "التسلسلات الهرمية للتفصيل", "بطاقة الأداء المتوازن", "حوكمة المقاييس"],
  },
  {
    key: "bi_governance",
    name_en: "BI Governance & Administration",
    name_ar: "حوكمة وإدارة ذكاء الأعمال",
    category: "business_intelligence",
    skills_en: ["Workspace & Tenant Admin", "Row-Level Security", "Refresh & Gateway Management", "Version Control", "Self-Service Enablement", "Data Governance"],
    skills_ar: ["إدارة مساحات العمل والمستأجر", "أمن مستوى الصفوف", "إدارة التحديث والبوابات", "إدارة الإصدارات", "تمكين الخدمة الذاتية", "حوكمة البيانات"],
  },

  // ── Artificial Intelligence ────────────────────────────────────────────────
  {
    key: "ml_foundations",
    name_en: "AI & ML Foundations",
    name_ar: "أساسيات الذكاء الاصطناعي والتعلم الآلي",
    category: "artificial_intelligence",
    skills_en: ["Supervised vs Unsupervised", "Model Training Basics", "Feature Engineering", "Overfitting & Validation", "Evaluation Metrics", "Algorithm Selection"],
    skills_ar: ["التعلّم الموجّه مقابل غير الموجّه", "أساسيات تدريب النماذج", "هندسة الخصائص", "فرط التخصيص والتحقق", "مقاييس التقييم", "اختيار الخوارزميات"],
  },
  {
    key: "applied_ai_finance",
    name_en: "Applied AI in Finance",
    name_ar: "الذكاء الاصطناعي التطبيقي في المالية",
    category: "artificial_intelligence",
    skills_en: ["Credit Scoring Models", "Fraud Detection", "Forecasting & Demand", "Customer Analytics", "Document Automation", "Use-Case Scoping"],
    skills_ar: ["نماذج التقييم الائتماني", "كشف الاحتيال", "التنبؤ والطلب", "تحليلات العملاء", "أتمتة المستندات", "تحديد نطاق حالات الاستخدام"],
  },
  {
    key: "generative_ai",
    name_en: "Generative AI & Prompting",
    name_ar: "الذكاء الاصطناعي التوليدي والتلقين",
    category: "artificial_intelligence",
    skills_en: ["Prompt Engineering", "LLM Capabilities & Limits", "RAG Basics", "GenAI Tooling", "Output Evaluation", "Productivity Workflows"],
    skills_ar: ["هندسة التلقين", "قدرات النماذج اللغوية وحدودها", "أساسيات RAG", "أدوات الذكاء التوليدي", "تقييم المخرجات", "تدفّقات الإنتاجية"],
  },
  {
    key: "ai_data_readiness",
    name_en: "Data Readiness for AI",
    name_ar: "جاهزية البيانات للذكاء الاصطناعي",
    category: "artificial_intelligence",
    skills_en: ["Data Quality for AI", "Feature Stores", "Data Labeling", "Data Pipelines", "Bias in Data", "Data Governance for AI"],
    skills_ar: ["جودة البيانات للذكاء الاصطناعي", "مخازن الخصائص", "توسيم البيانات", "خطوط البيانات", "التحيّز في البيانات", "حوكمة البيانات للذكاء الاصطناعي"],
  },
  {
    key: "ai_governance",
    name_en: "AI Risk, Ethics & Governance",
    name_ar: "مخاطر الذكاء الاصطناعي وأخلاقياته وحوكمته",
    category: "artificial_intelligence",
    skills_en: ["Model Risk Management", "Explainability", "Bias & Fairness", "Regulatory & Ethics", "Model Monitoring", "AI Policy"],
    skills_ar: ["إدارة مخاطر النماذج", "القابلية للتفسير", "التحيّز والإنصاف", "التنظيم والأخلاقيات", "مراقبة النماذج", "سياسة الذكاء الاصطناعي"],
  },
  {
    key: "intelligent_automation",
    name_en: "Intelligent Automation",
    name_ar: "الأتمتة الذكية",
    category: "artificial_intelligence",
    skills_en: ["RPA Fundamentals", "AI + RPA Integration", "Process Identification", "Workflow Orchestration", "NLP & Document Intelligence", "ROI Measurement"],
    skills_ar: ["أساسيات الأتمتة الروبوتية (RPA)", "دمج الذكاء الاصطناعي مع RPA", "تحديد العمليات", "تنسيق سير العمل", "معالجة اللغة وذكاء المستندات", "قياس العائد على الاستثمار"],
  },

  // ── Human Resources ────────────────────────────────────────────────────────
  {
    key: "talent_acquisition",
    name_en: "Talent Acquisition & Recruitment",
    name_ar: "استقطاب المواهب والتوظيف",
    category: "human_resources",
    skills_en: ["Workforce Planning", "Sourcing & Screening", "Interviewing & Selection", "Employer Branding", "Onboarding", "Recruitment Metrics"],
    skills_ar: ["تخطيط القوى العاملة", "البحث والفرز", "المقابلات والاختيار", "العلامة التجارية لصاحب العمل", "الإلحاق الوظيفي", "مؤشرات التوظيف"],
  },
  {
    key: "compensation_benefits",
    name_en: "Compensation & Benefits",
    name_ar: "التعويضات والمزايا",
    category: "human_resources",
    skills_en: ["Salary Structures & Grading", "Job Evaluation", "Benefits Administration", "Incentive & Bonus Design", "Market Benchmarking", "Payroll Coordination"],
    skills_ar: ["هياكل الرواتب والدرجات", "تقييم الوظائف", "إدارة المزايا", "تصميم الحوافز والمكافآت", "المقارنة بالسوق", "تنسيق الرواتب"],
  },
  {
    key: "learning_development",
    name_en: "Learning & Development",
    name_ar: "التعلّم والتطوير",
    category: "human_resources",
    skills_en: ["Training Needs Analysis", "Program Design", "Delivery & Facilitation", "Competency Frameworks", "L&D Evaluation (ROI)", "Succession & Career Pathing"],
    skills_ar: ["تحليل الاحتياجات التدريبية", "تصميم البرامج", "التقديم والتيسير", "أطر الجدارات", "تقييم التعلّم والتطوير (العائد)", "التعاقب والمسارات الوظيفية"],
  },
  {
    key: "performance_management",
    name_en: "Performance Management",
    name_ar: "إدارة الأداء",
    category: "human_resources",
    skills_en: ["Goal Setting & KPIs", "Appraisal Cycles", "Calibration", "Feedback & Coaching", "Performance Improvement Plans", "Reward Linkage"],
    skills_ar: ["تحديد الأهداف ومؤشرات الأداء", "دورات التقييم", "المعايرة", "التغذية الراجعة والإرشاد", "خطط تحسين الأداء", "الربط بالمكافآت"],
  },
  {
    key: "employee_relations",
    name_en: "Employee Relations & Engagement",
    name_ar: "علاقات الموظفين وإشراكهم",
    category: "human_resources",
    skills_en: ["Labor Law & Disputes", "Grievance Handling", "Engagement Surveys", "Disciplinary Process", "Wellbeing", "Culture & Communication"],
    skills_ar: ["قانون العمل والنزاعات", "معالجة الشكاوى", "استبيانات الإشراك", "الإجراءات التأديبية", "العافية", "الثقافة والتواصل"],
  },
  {
    key: "hr_operations",
    name_en: "HR Operations & HRIS",
    name_ar: "عمليات الموارد البشرية وأنظمتها",
    category: "human_resources",
    skills_en: ["Employee Lifecycle Admin", "HRIS & Systems", "HR Policies & Compliance", "Records & Documentation", "GCC Labor Compliance (Saudization, GOSI/WPS)", "HR Analytics"],
    skills_ar: ["إدارة دورة حياة الموظف", "أنظمة معلومات الموارد البشرية", "سياسات الموارد البشرية والامتثال", "السجلات والتوثيق", "الامتثال العمالي الخليجي (السعودة، التأمينات/حماية الأجور)", "تحليلات الموارد البشرية"],
  },
  {
    key: "people_analytics",
    name_en: "People Analytics",
    name_ar: "تحليلات الموارد البشرية",
    category: "human_resources",
    skills_en: ["HR Metrics & Dashboards", "Turnover & Attrition Analysis", "Workforce Planning Analytics", "Predictive HR", "Engagement Analytics", "Reporting"],
    skills_ar: ["مقاييس ولوحات الموارد البشرية", "تحليل الدوران والتسرّب", "تحليلات تخطيط القوى العاملة", "الموارد البشرية التنبؤية", "تحليلات الإشراك", "إعداد التقارير"],
  },
];

// The competency taxonomy (categories, order, labels) lives in a server-free
// module so client components can import the helpers without pulling server-only
// code. Re-exported here for existing server-side call sites.
export {
  TECH_FUNCTION_CATEGORIES,
  type TechFunctionCategory,
  CATEGORY_ORDER,
  categoryRank,
  categoryLabel,
} from "./technical-categories";
import { categoryLabel } from "./technical-categories";

/** A competency within a function (migration 00074), localized. */
export type LocalizedTechCompetency = {
  id: string;
  name: string; // localized
  nameEn: string;
  /** Canonical English skill names in this competency (the tag/grading axis). */
  skillsEn: string[];
  /** Localized skill labels, index-aligned with skillsEn. */
  skills: string[];
};

/** A function localized for the runner: display name + localized + canonical skills. */
export type LocalizedTechFunction = {
  /** Stable handle for the runner: the function `key` (standard) or `id` (custom JD). */
  ref: string;
  id: string | null;
  key: string | null;
  name: string; // localized
  nameEn: string;
  category: string | null;
  categoryLabel: string; // localized
  /** Canonical English skill names - the tag/grading axis (never localized). */
  skillsEn: string[];
  /** Localized skill labels, index-aligned with skillsEn. */
  skills: string[];
  /** The Competency tier (00074). Empty when none are seeded for this function -
   *  consumers fall back to the flat skillsEn list. */
  competencies: LocalizedTechCompetency[];
  source: TechFunctionSource;
};

type FunctionRow = {
  id: string;
  key: string | null;
  name_en: string;
  name_ar: string | null;
  category: string | null;
  skills_en: string[] | null;
  skills_ar: string[] | null;
  source: string | null;
};

function localizeStandard(f: StandardFunction, locale: "en" | "ar"): LocalizedTechFunction {
  return {
    ref: f.key,
    id: null,
    key: f.key,
    name: locale === "ar" ? f.name_ar || f.name_en : f.name_en,
    nameEn: f.name_en,
    category: f.category,
    categoryLabel: categoryLabel(f.category, locale),
    skillsEn: [...f.skills_en],
    skills: locale === "ar" ? f.skills_ar.map((s, i) => s || f.skills_en[i]) : [...f.skills_en],
    competencies: [], // code-side fallback has no ids → no competency rows
    source: "standard",
  };
}

function localizeRow(r: FunctionRow, locale: "en" | "ar"): LocalizedTechFunction {
  const skillsEn = r.skills_en ?? [];
  const skillsAr = r.skills_ar ?? [];
  return {
    ref: r.key ?? r.id,
    id: r.id,
    key: r.key,
    name: locale === "ar" ? r.name_ar || r.name_en : r.name_en,
    nameEn: r.name_en,
    category: r.category,
    categoryLabel: categoryLabel(r.category, locale),
    skillsEn,
    skills: locale === "ar" ? skillsEn.map((s, i) => skillsAr[i] || s) : skillsEn,
    competencies: [], // attached separately by the loaders (batch query)
    source: r.source === "jd" ? "jd" : "standard",
  };
}

// ── Competency tier (migration 00074) ───────────────────────────────────────
type CompetencyRow = { id: string; function_id: string; name_en: string; name_ar: string | null };
type CompetencySkillRow = { competency_id: string; name_en: string; name_ar: string | null };

/**
 * Batch-load the competency groups for the given function ids and attach them to
 * the matching localized functions (in place). Tolerant: on any error or empty
 * result the functions keep `competencies: []` and callers fall back to skillsEn.
 */
async function attachCompetencies(
  sb: ReturnType<typeof createServiceClient>,
  fns: LocalizedTechFunction[],
  locale: "en" | "ar"
): Promise<void> {
  const ids = fns.map((f) => f.id).filter((id): id is string => !!id);
  if (ids.length === 0) return;
  try {
    const { data: comps } = await sb
      .from("technical_competencies")
      .select("id, function_id, name_en, name_ar")
      .in("function_id", ids)
      .order("sort_order");
    const compRows = (comps ?? []) as CompetencyRow[];
    if (compRows.length === 0) return;

    const { data: skills } = await sb
      .from("technical_competency_skills")
      .select("competency_id, name_en, name_ar")
      .in("competency_id", compRows.map((c) => c.id))
      .order("sort_order");
    const skillRows = (skills ?? []) as CompetencySkillRow[];

    const skillsByComp = new Map<string, CompetencySkillRow[]>();
    for (const s of skillRows) {
      const arr = skillsByComp.get(s.competency_id) ?? [];
      arr.push(s);
      skillsByComp.set(s.competency_id, arr);
    }

    const compsByFn = new Map<string, LocalizedTechCompetency[]>();
    for (const c of compRows) {
      const cs = skillsByComp.get(c.id) ?? [];
      const localized: LocalizedTechCompetency = {
        id: c.id,
        nameEn: c.name_en,
        name: locale === "ar" ? c.name_ar || c.name_en : c.name_en,
        skillsEn: cs.map((s) => s.name_en),
        skills: cs.map((s) => (locale === "ar" ? s.name_ar || s.name_en : s.name_en)),
      };
      const arr = compsByFn.get(c.function_id) ?? [];
      arr.push(localized);
      compsByFn.set(c.function_id, arr);
    }

    for (const f of fns) {
      if (f.id && compsByFn.has(f.id)) f.competencies = compsByFn.get(f.id)!;
    }
  } catch {
    /* tolerant - leave competencies empty, callers fall back to flat skills */
  }
}

/**
 * All active functions, localized. Reads technical_functions via the service
 * client; falls back to STANDARD_FUNCTIONS if the table is absent or empty (so
 * the runner works before 00058 is applied).
 */
export async function listTechnicalFunctions(locale: "en" | "ar"): Promise<LocalizedTechFunction[]> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("technical_functions")
      .select("id, key, name_en, name_ar, category, skills_en, skills_ar, source")
      .eq("status", "active")
      .order("category")
      .order("name_en");
    if (error || !data || data.length === 0) {
      return STANDARD_FUNCTIONS.map((f) => localizeStandard(f, locale));
    }
    const fns = (data as FunctionRow[]).map((r) => localizeRow(r, locale));
    await attachCompetencies(sb, fns, locale);
    return fns;
  } catch {
    return STANDARD_FUNCTIONS.map((f) => localizeStandard(f, locale));
  }
}

/**
 * One function by its runner ref (a standard `key` or a custom `id`), localized.
 * Falls back to the code-side standard library on table/lookup miss.
 */
export async function getTechnicalFunctionByRef(
  ref: string,
  locale: "en" | "ar"
): Promise<LocalizedTechFunction | null> {
  const fallback = () => {
    const f = STANDARD_FUNCTIONS.find((x) => x.key === ref);
    return f ? localizeStandard(f, locale) : null;
  };
  try {
    const sb = createServiceClient();
    // ref may be a standard key or a uuid id - try key first, then id.
    let row: FunctionRow | null = null;
    const byKey = await sb
      .from("technical_functions")
      .select("id, key, name_en, name_ar, category, skills_en, skills_ar, source")
      .eq("key", ref)
      .maybeSingle();
    if (byKey.data) {
      row = byKey.data as FunctionRow;
    } else if (/^[0-9a-fA-F-]{36}$/.test(ref)) {
      const byId = await sb
        .from("technical_functions")
        .select("id, key, name_en, name_ar, category, skills_en, skills_ar, source")
        .eq("id", ref)
        .maybeSingle();
      if (byId.data) row = byId.data as FunctionRow;
    }
    if (!row) return fallback();
    const fn = localizeRow(row, locale);
    await attachCompetencies(sb, [fn], locale);
    return fn;
  } catch {
    return fallback();
  }
}

/** English skill name → localized label, for per-skill result/item rendering. */
export function functionSkillLabels(fn: LocalizedTechFunction): Record<string, string> {
  const map: Record<string, string> = {};
  fn.skillsEn.forEach((en, i) => {
    map[en] = fn.skills[i] ?? en;
  });
  return map;
}

/** Distinct English skill names across the given functions - the reuse menu the
 *  JD extractor matches against (so a custom function reuses existing skills). */
export function skillLibraryFrom(functions: LocalizedTechFunction[]): string[] {
  const set = new Set<string>();
  for (const f of functions) for (const s of f.skillsEn) set.add(s);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
