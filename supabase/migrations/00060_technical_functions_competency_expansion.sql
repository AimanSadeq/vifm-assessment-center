-- ════════════════════════════════════════════════════════════════
-- Technical functions — competency expansion
--
-- Reframes the function library around the 9 top-level COMPETENCIES the runner
-- now groups by ("Select a competency → function within it"):
--   Finance · Accounting · Banking · Investment · Treasury ·
--   Data Analytics · Business Intelligence · Artificial Intelligence · HR
--
-- 1. Re-points the 12 seeded functions onto the new competency categories
--    (reporting/tax/audit fold into Accounting; FP&A + Management Accounting
--    become Finance — matching src/lib/competencies/technical-function.ts).
-- 2. Adds 35 new standard functions across Banking, Investment, Data Analytics,
--    Business Intelligence, Artificial Intelligence, and Human Resources.
--
-- Idempotent: category updates are keyed; inserts use ON CONFLICT (key) DO
-- NOTHING so re-running is safe and won't disturb any edited rows.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Recategorize existing standard functions onto competencies ──
UPDATE technical_functions SET category = 'accounting'
  WHERE key IN ('financial_reporting', 'tax', 'internal_audit', 'external_audit');
UPDATE technical_functions SET category = 'finance'
  WHERE key IN ('fpa', 'management_accounting');

-- ── 2. Seed the new competency functions (bilingual) ──
INSERT INTO technical_functions (key, name_en, name_ar, category, skills_en, skills_ar) VALUES
  -- Banking
  ('credit_underwriting', 'Credit & Underwriting', 'الائتمان والاكتتاب', 'banking',
   ARRAY['Financial Spreading','Credit Risk Assessment','Collateral & Security','Credit Scoring Models','Covenant Monitoring','Credit Approval Process'],
   ARRAY['تحليل القوائم المالية (Spreading)','تقييم مخاطر الائتمان','الضمانات والرهونات','نماذج التقييم الائتماني','مراقبة التعهدات','عملية اعتماد الائتمان']),
  ('loan_operations', 'Loan Operations & Administration', 'عمليات وإدارة القروض', 'banking',
   ARRAY['Loan Documentation','Disbursement & Drawdown','Loan Servicing','Collateral Management','Delinquency Handling','Loan System Operations'],
   ARRAY['توثيق القروض','الصرف والسحب','خدمة القروض','إدارة الضمانات','معالجة التعثّر','تشغيل أنظمة القروض']),
  ('banking_risk', 'Banking Risk Management', 'إدارة المخاطر المصرفية', 'banking',
   ARRAY['Credit Risk','Market Risk','Operational Risk','Basel III/IV & Capital Adequacy','Stress Testing','Risk Reporting'],
   ARRAY['مخاطر الائتمان','مخاطر السوق','المخاطر التشغيلية','بازل 3/4 وكفاية رأس المال','اختبارات الضغط','تقارير المخاطر']),
  ('compliance_aml_kyc', 'Compliance, AML & KYC', 'الامتثال ومكافحة غسل الأموال واعرف عميلك', 'banking',
   ARRAY['KYC & Customer Due Diligence','AML Transaction Monitoring','Sanctions Screening','Regulatory Reporting','Fraud Detection','FATCA & CRS'],
   ARRAY['اعرف عميلك والعناية الواجبة','مراقبة معاملات غسل الأموال','فحص العقوبات','التقارير الرقابية','كشف الاحتيال','فاتكا والمعيار الموحد (CRS)']),
  ('trade_finance', 'Trade Finance', 'تمويل التجارة', 'banking',
   ARRAY['Letters of Credit','Documentary Collections','Guarantees & Bonds','Supply-Chain Finance','UCP 600 Rules','Trade Risk'],
   ARRAY['الاعتمادات المستندية','التحصيل المستندي','الضمانات والكفالات','تمويل سلاسل الإمداد','قواعد UCP 600','مخاطر التجارة']),
  ('islamic_banking', 'Islamic Banking', 'الصيرفة الإسلامية', 'banking',
   ARRAY['Murabaha','Ijara','Musharaka & Mudaraba','Sukuk','Sharia Compliance','Islamic Treasury'],
   ARRAY['المرابحة','الإجارة','المشاركة والمضاربة','الصكوك','الالتزام بالشريعة','الخزينة الإسلامية']),

  -- Investment
  ('equity_research', 'Equity Research', 'أبحاث الأسهم', 'investment',
   ARRAY['Industry & Company Analysis','Financial Modelling','Valuation (DCF & Multiples)','Earnings Forecasting','Investment Thesis & Reports','Sector Coverage'],
   ARRAY['تحليل القطاع والشركة','النمذجة المالية','التقييم (التدفقات النقدية والمضاعفات)','التنبؤ بالأرباح','أطروحة الاستثمار والتقارير','تغطية القطاعات']),
  ('portfolio_management', 'Portfolio Management', 'إدارة المحافظ', 'investment',
   ARRAY['Asset Allocation','Security Selection','Rebalancing','Risk Budgeting','Mandate & IPS Compliance','Performance Review'],
   ARRAY['توزيع الأصول','اختيار الأوراق المالية','إعادة التوازن','موازنة المخاطر','الالتزام بالتفويض وسياسة الاستثمار','مراجعة الأداء']),
  ('fixed_income', 'Fixed Income', 'الدخل الثابت', 'investment',
   ARRAY['Bond Valuation','Yield Curve Analysis','Duration & Convexity','Credit Analysis','Spread Analysis','Interest-Rate Strategy'],
   ARRAY['تقييم السندات','تحليل منحنى العائد','المدة والتحدّب','تحليل الائتمان','تحليل الهوامش','استراتيجية أسعار الفائدة']),
  ('wealth_management', 'Wealth Management & Advisory', 'إدارة الثروات والاستشارات', 'investment',
   ARRAY['Client Profiling & Suitability','Financial Planning','Product Selection','Portfolio Construction','Relationship Management','Regulatory Suitability'],
   ARRAY['تصنيف العملاء والملاءمة','التخطيط المالي','اختيار المنتجات','بناء المحافظ','إدارة العلاقات','الملاءمة التنظيمية']),
  ('investment_performance', 'Performance & Risk', 'الأداء والمخاطر', 'investment',
   ARRAY['Performance Measurement','Attribution Analysis','GIPS Compliance','Risk Metrics (VaR, Beta)','Benchmark Analysis','Reporting'],
   ARRAY['قياس الأداء','تحليل المساهمة في العائد','الالتزام بمعايير GIPS','مقاييس المخاطر (القيمة المعرضة للخطر، بيتا)','تحليل المؤشرات المرجعية','إعداد التقارير']),
  ('alternative_investments', 'Alternative Investments', 'الاستثمارات البديلة', 'investment',
   ARRAY['Private Equity','Real Estate Funds','Hedge Fund Strategies','Fund Due Diligence','Illiquidity & Valuation','ESG Integration'],
   ARRAY['الأسهم الخاصة','صناديق العقار','استراتيجيات صناديق التحوّط','العناية الواجبة للصناديق','عدم السيولة والتقييم','دمج معايير الاستدامة (ESG)']),

  -- Data Analytics
  ('data_preparation', 'Data Preparation & Engineering', 'إعداد البيانات وهندستها', 'analytics',
   ARRAY['Data Cleaning','Data Wrangling','SQL Querying','Data Integration','Data Quality','Pipeline Basics'],
   ARRAY['تنظيف البيانات','معالجة البيانات','الاستعلام بلغة SQL','تكامل البيانات','جودة البيانات','أساسيات خطوط البيانات']),
  ('statistical_analysis', 'Statistical Analysis', 'التحليل الإحصائي', 'analytics',
   ARRAY['Descriptive Statistics','Hypothesis Testing','Regression Analysis','Correlation & Causation','Sampling','Time-Series Basics'],
   ARRAY['الإحصاء الوصفي','اختبار الفرضيات','تحليل الانحدار','الارتباط والسببية','المعاينة','أساسيات السلاسل الزمنية']),
  ('forecasting_modelling', 'Forecasting & Modelling', 'التنبؤ والنمذجة', 'analytics',
   ARRAY['Forecasting Methods','Predictive Modelling','Scenario & Sensitivity Analysis','Model Validation','Spreadsheet Engineering','Driver-Based Models'],
   ARRAY['أساليب التنبؤ','النمذجة التنبؤية','تحليل السيناريوهات والحساسية','التحقق من النماذج','هندسة الجداول الإلكترونية','النماذج المبنية على المحركات']),
  ('analytics_programming', 'Programming for Analytics', 'البرمجة للتحليلات', 'analytics',
   ARRAY['Python for Data','R for Statistics','Pandas & NumPy','Automation Scripting','APIs & Data Extraction','Version Control Basics'],
   ARRAY['بايثون للبيانات','R للإحصاء','Pandas وNumPy','برمجة الأتمتة','واجهات برمجة التطبيقات واستخراج البيانات','أساسيات إدارة الإصدارات']),
  ('data_visualization', 'Visualization & Storytelling', 'التصور السردي للبيانات', 'analytics',
   ARRAY['Chart Selection','Dashboard Design','Narrative & Insight','Stakeholder Communication','Visualization Tools','Reporting'],
   ARRAY['اختيار الرسوم البيانية','تصميم لوحات المعلومات','السرد والاستبصار','التواصل مع أصحاب المصلحة','أدوات التصور','إعداد التقارير']),

  -- Business Intelligence
  ('dashboard_development', 'Dashboard Development', 'تطوير لوحات المعلومات', 'business_intelligence',
   ARRAY['Dashboard Design','Visual Best Practices','Interactivity & Filters','Power BI / Tableau Build','Mobile & Responsive BI','BI UX'],
   ARRAY['تصميم لوحات المعلومات','أفضل ممارسات العرض المرئي','التفاعلية والمرشحات','البناء على Power BI / Tableau','ذكاء الأعمال للجوال والمتجاوب','تجربة المستخدم لذكاء الأعمال']),
  ('bi_data_modelling', 'Data Modelling (BI)', 'نمذجة البيانات (ذكاء الأعمال)', 'business_intelligence',
   ARRAY['Star Schema','Relationships & Cardinality','DAX & Calculated Measures','Data Granularity','Semantic Layer','Performance Optimization'],
   ARRAY['مخطط النجمة','العلاقات والتعدّدية','DAX والمقاييس المحسوبة','دقة تفصيل البيانات','الطبقة الدلالية','تحسين الأداء']),
  ('etl_integration', 'ETL & Data Integration', 'الاستخلاص والتحويل وتكامل البيانات', 'business_intelligence',
   ARRAY['Data Source Connection','Power Query / ETL','Data Transformation','Incremental Refresh','Pipeline Scheduling','Data Lineage'],
   ARRAY['الاتصال بمصادر البيانات','Power Query / ETL','تحويل البيانات','التحديث التزايدي','جدولة خطوط البيانات','تتبّع مسار البيانات']),
  ('kpi_metric_design', 'KPI & Metric Design', 'تصميم مؤشرات الأداء والمقاييس', 'business_intelligence',
   ARRAY['KPI Definition','Metric Frameworks','Targets & Thresholds','Drill-Down Hierarchies','Balanced Scorecard','Metric Governance'],
   ARRAY['تعريف مؤشرات الأداء','أطر المقاييس','المستهدفات والحدود','التسلسلات الهرمية للتفصيل','بطاقة الأداء المتوازن','حوكمة المقاييس']),
  ('bi_governance', 'BI Governance & Administration', 'حوكمة وإدارة ذكاء الأعمال', 'business_intelligence',
   ARRAY['Workspace & Tenant Admin','Row-Level Security','Refresh & Gateway Management','Version Control','Self-Service Enablement','Data Governance'],
   ARRAY['إدارة مساحات العمل والمستأجر','أمن مستوى الصفوف','إدارة التحديث والبوابات','إدارة الإصدارات','تمكين الخدمة الذاتية','حوكمة البيانات']),

  -- Artificial Intelligence
  ('ml_foundations', 'AI & ML Foundations', 'أساسيات الذكاء الاصطناعي والتعلم الآلي', 'artificial_intelligence',
   ARRAY['Supervised vs Unsupervised','Model Training Basics','Feature Engineering','Overfitting & Validation','Evaluation Metrics','Algorithm Selection'],
   ARRAY['التعلّم الموجّه مقابل غير الموجّه','أساسيات تدريب النماذج','هندسة الخصائص','فرط التخصيص والتحقق','مقاييس التقييم','اختيار الخوارزميات']),
  ('applied_ai_finance', 'Applied AI in Finance', 'الذكاء الاصطناعي التطبيقي في المالية', 'artificial_intelligence',
   ARRAY['Credit Scoring Models','Fraud Detection','Forecasting & Demand','Customer Analytics','Document Automation','Use-Case Scoping'],
   ARRAY['نماذج التقييم الائتماني','كشف الاحتيال','التنبؤ والطلب','تحليلات العملاء','أتمتة المستندات','تحديد نطاق حالات الاستخدام']),
  ('generative_ai', 'Generative AI & Prompting', 'الذكاء الاصطناعي التوليدي والتلقين', 'artificial_intelligence',
   ARRAY['Prompt Engineering','LLM Capabilities & Limits','RAG Basics','GenAI Tooling','Output Evaluation','Productivity Workflows'],
   ARRAY['هندسة التلقين','قدرات النماذج اللغوية وحدودها','أساسيات RAG','أدوات الذكاء التوليدي','تقييم المخرجات','تدفّقات الإنتاجية']),
  ('ai_data_readiness', 'Data Readiness for AI', 'جاهزية البيانات للذكاء الاصطناعي', 'artificial_intelligence',
   ARRAY['Data Quality for AI','Feature Stores','Data Labeling','Data Pipelines','Bias in Data','Data Governance for AI'],
   ARRAY['جودة البيانات للذكاء الاصطناعي','مخازن الخصائص','توسيم البيانات','خطوط البيانات','التحيّز في البيانات','حوكمة البيانات للذكاء الاصطناعي']),
  ('ai_governance', 'AI Risk, Ethics & Governance', 'مخاطر الذكاء الاصطناعي وأخلاقياته وحوكمته', 'artificial_intelligence',
   ARRAY['Model Risk Management','Explainability','Bias & Fairness','Regulatory & Ethics','Model Monitoring','AI Policy'],
   ARRAY['إدارة مخاطر النماذج','القابلية للتفسير','التحيّز والإنصاف','التنظيم والأخلاقيات','مراقبة النماذج','سياسة الذكاء الاصطناعي']),
  ('intelligent_automation', 'Intelligent Automation', 'الأتمتة الذكية', 'artificial_intelligence',
   ARRAY['RPA Fundamentals','AI + RPA Integration','Process Identification','Workflow Orchestration','NLP & Document Intelligence','ROI Measurement'],
   ARRAY['أساسيات الأتمتة الروبوتية (RPA)','دمج الذكاء الاصطناعي مع RPA','تحديد العمليات','تنسيق سير العمل','معالجة اللغة وذكاء المستندات','قياس العائد على الاستثمار']),

  -- Human Resources
  ('talent_acquisition', 'Talent Acquisition & Recruitment', 'استقطاب المواهب والتوظيف', 'human_resources',
   ARRAY['Workforce Planning','Sourcing & Screening','Interviewing & Selection','Employer Branding','Onboarding','Recruitment Metrics'],
   ARRAY['تخطيط القوى العاملة','البحث والفرز','المقابلات والاختيار','العلامة التجارية لصاحب العمل','الإلحاق الوظيفي','مؤشرات التوظيف']),
  ('compensation_benefits', 'Compensation & Benefits', 'التعويضات والمزايا', 'human_resources',
   ARRAY['Salary Structures & Grading','Job Evaluation','Benefits Administration','Incentive & Bonus Design','Market Benchmarking','Payroll Coordination'],
   ARRAY['هياكل الرواتب والدرجات','تقييم الوظائف','إدارة المزايا','تصميم الحوافز والمكافآت','المقارنة بالسوق','تنسيق الرواتب']),
  ('learning_development', 'Learning & Development', 'التعلّم والتطوير', 'human_resources',
   ARRAY['Training Needs Analysis','Program Design','Delivery & Facilitation','Competency Frameworks','L&D Evaluation (ROI)','Succession & Career Pathing'],
   ARRAY['تحليل الاحتياجات التدريبية','تصميم البرامج','التقديم والتيسير','أطر الجدارات','تقييم التعلّم والتطوير (العائد)','التعاقب والمسارات الوظيفية']),
  ('performance_management', 'Performance Management', 'إدارة الأداء', 'human_resources',
   ARRAY['Goal Setting & KPIs','Appraisal Cycles','Calibration','Feedback & Coaching','Performance Improvement Plans','Reward Linkage'],
   ARRAY['تحديد الأهداف ومؤشرات الأداء','دورات التقييم','المعايرة','التغذية الراجعة والإرشاد','خطط تحسين الأداء','الربط بالمكافآت']),
  ('employee_relations', 'Employee Relations & Engagement', 'علاقات الموظفين وإشراكهم', 'human_resources',
   ARRAY['Labor Law & Disputes','Grievance Handling','Engagement Surveys','Disciplinary Process','Wellbeing','Culture & Communication'],
   ARRAY['قانون العمل والنزاعات','معالجة الشكاوى','استبيانات الإشراك','الإجراءات التأديبية','العافية','الثقافة والتواصل']),
  ('hr_operations', 'HR Operations & HRIS', 'عمليات الموارد البشرية وأنظمتها', 'human_resources',
   ARRAY['Employee Lifecycle Admin','HRIS & Systems','HR Policies & Compliance','Records & Documentation','GCC Labor Compliance (Saudization, GOSI/WPS)','HR Analytics'],
   ARRAY['إدارة دورة حياة الموظف','أنظمة معلومات الموارد البشرية','سياسات الموارد البشرية والامتثال','السجلات والتوثيق','الامتثال العمالي الخليجي (السعودة، التأمينات/حماية الأجور)','تحليلات الموارد البشرية']),
  ('people_analytics', 'People Analytics', 'تحليلات الموارد البشرية', 'human_resources',
   ARRAY['HR Metrics & Dashboards','Turnover & Attrition Analysis','Workforce Planning Analytics','Predictive HR','Engagement Analytics','Reporting'],
   ARRAY['مقاييس ولوحات الموارد البشرية','تحليل الدوران والتسرّب','تحليلات تخطيط القوى العاملة','الموارد البشرية التنبؤية','تحليلات الإشراك','إعداد التقارير'])
ON CONFLICT (key) DO NOTHING;
