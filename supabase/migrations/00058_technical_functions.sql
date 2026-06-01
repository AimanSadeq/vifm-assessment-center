-- ════════════════════════════════════════════════════════════════
-- Technical functions — the job-level unit of technical assessment
--
-- Technical competency is role/function-specific, not department-wide: the AR
-- team shares one body of knowledge; a Finance division (AP + AR + audit +
-- treasury) does not. So the assessable unit is the FUNCTION (Accounts Payable,
-- Treasury, Internal Audit…), defined as a blueprint of the technical skills
-- that function requires. A function assessment draws items across those skills
-- (deep + per-skill), replacing the old "pick a broad domain → 8 generic Qs".
--
-- A function comes from this curated standard library (source='standard') or is
-- derived from an imported job description (source='jd'). Programs (00057) scope
-- to one function via the new function_id.
-- ════════════════════════════════════════════════════════════════

CREATE TYPE technical_function_source AS ENUM ('standard', 'jd');

CREATE TABLE technical_functions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text UNIQUE,                 -- set for standard library; null for custom JD-derived
  name_en           text NOT NULL,
  name_ar           text,
  category          text,                        -- 'accounting' | 'reporting' | 'treasury' | 'fpa' | 'tax' | 'audit'
  skills_en         text[] NOT NULL DEFAULT '{}',-- the blueprint: skills this function is assessed on
  skills_ar         text[],
  source            technical_function_source NOT NULL DEFAULT 'standard',
  organization_name text,                        -- for JD-derived custom functions (nullable)
  status            text NOT NULL DEFAULT 'active',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_technical_functions_updated_at
  BEFORE UPDATE ON technical_functions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- A program (00057) is scoped to one function.
ALTER TABLE technical_programs ADD COLUMN function_id uuid REFERENCES technical_functions(id) ON DELETE SET NULL;

-- A sitting/result can be a function assessment (spans several domains' skills, so
-- domain_key no longer applies — it becomes nullable, and function_id/function_key
-- carry the binding instead). Existing domain runs are unaffected.
ALTER TABLE tech_assessment_results
  ALTER COLUMN domain_key DROP NOT NULL,
  ADD COLUMN function_id  uuid REFERENCES technical_functions(id) ON DELETE SET NULL,
  ADD COLUMN function_key text;
ALTER TABLE tech_assessment_sessions
  ALTER COLUMN domain_key DROP NOT NULL,
  ADD COLUMN function_id  uuid,
  ADD COLUMN function_key text;
CREATE INDEX idx_tech_results_function ON tech_assessment_results(function_id);

-- ── Seed the standard finance-function library (12 functions, bilingual) ──
INSERT INTO technical_functions (key, name_en, name_ar, category, skills_en, skills_ar) VALUES
  ('accounts_payable', 'Accounts Payable', 'الحسابات الدائنة (المدفوعات)', 'accounting',
   ARRAY['Invoice Processing & 3-Way Match','Vendor Reconciliation','Payment Runs & Controls','Expense & T&E Processing','Accruals & AP Ledger','VAT & Withholding on Payables'],
   ARRAY['معالجة الفواتير والمطابقة الثلاثية','تسوية حسابات المورّدين','دفعات السداد والضوابط','معالجة المصروفات والسفر','الاستحقاقات ودفتر الدائنين','ضريبة القيمة المضافة والاستقطاع على المدفوعات']),

  ('accounts_receivable', 'Accounts Receivable', 'الحسابات المدينة (المقبوضات)', 'accounting',
   ARRAY['Billing & Invoicing','Cash Application','Credit Assessment & Limits','Collections & Aging','Bad-Debt Provisioning','DSO Analytics'],
   ARRAY['إصدار الفواتير','تخصيص المقبوضات','تقييم الائتمان والحدود','التحصيل وأعمار الذمم','مخصصات الديون المعدومة','تحليل فترة التحصيل (DSO)']),

  ('general_ledger', 'General Ledger', 'الأستاذ العام', 'accounting',
   ARRAY['Double-Entry & Journals','Month-End Close & Reconciliations','Accruals, Prepayments & Provisions','Intercompany Accounting','Chart of Accounts Control','IFRS Fundamentals'],
   ARRAY['القيد المزدوج واليوميات','إقفال نهاية الشهر والتسويات','الاستحقاقات والمصروفات المدفوعة مقدمًا والمخصصات','محاسبة الشركات الشقيقة','ضبط دليل الحسابات','أساسيات المعايير الدولية (IFRS)']),

  ('financial_reporting', 'Financial Reporting & Consolidation', 'التقارير المالية والتوحيد', 'reporting',
   ARRAY['IFRS Application & Disclosures','Consolidation & Eliminations','FX Translation','Statutory & Regulatory Reporting','Narrative & ESG Reporting','Reporting Controls'],
   ARRAY['تطبيق المعايير الدولية والإفصاحات','التوحيد والاستبعادات','ترجمة العملات الأجنبية','التقارير النظامية والرقابية','التقارير السردية وتقارير الاستدامة (ESG)','ضوابط إعداد التقارير']),

  ('management_accounting', 'Management Accounting', 'المحاسبة الإدارية', 'accounting',
   ARRAY['Costing Methods (Standard/ABC/Marginal)','Variance Analysis','Budgeting Support','Profitability & Contribution Analysis','Cost Allocation','Management Reporting'],
   ARRAY['طرق التكاليف (المعيارية/على الأنشطة/الحدية)','تحليل الانحرافات','دعم إعداد الموازنات','تحليل الربحية والمساهمة','توزيع التكاليف','التقارير الإدارية']),

  ('treasury', 'Treasury', 'الخزينة', 'treasury',
   ARRAY['Cash & Liquidity Management','FX Risk Management','Interest-Rate Risk','Funding & Capital Markets','Bank Relationship Management','Cash Forecasting'],
   ARRAY['إدارة النقد والسيولة','إدارة مخاطر الصرف الأجنبي','مخاطر أسعار الفائدة','التمويل وأسواق المال','إدارة العلاقات المصرفية','التنبؤ بالتدفقات النقدية']),

  ('fpa', 'Financial Planning & Analysis', 'التخطيط والتحليل المالي', 'fpa',
   ARRAY['Budgeting & Rolling Forecasts','Driver & Variance Analysis','Financial Modelling','Scenario & Sensitivity Analysis','KPI & Dashboarding','Business-Partnering Analytics'],
   ARRAY['إعداد الموازنات والتنبؤات المتجددة','تحليل المحركات والانحرافات','النمذجة المالية','تحليل السيناريوهات والحساسية','مؤشرات الأداء ولوحات المعلومات','تحليلات الشراكة مع الأعمال']),

  ('tax', 'Tax', 'الضرائب', 'tax',
   ARRAY['Corporate Income Tax','VAT & Indirect Tax','Withholding Tax','Transfer Pricing','Deferred Tax & Provisioning','GCC Specifics (Zakat, E-Invoicing)'],
   ARRAY['ضريبة دخل الشركات','ضريبة القيمة المضافة والضرائب غير المباشرة','ضريبة الاستقطاع','تسعير المعاملات بين الشركات','الضريبة المؤجلة والمخصصات','خصوصيات الخليج (الزكاة، الفوترة الإلكترونية)']),

  ('internal_audit', 'Internal Audit & Controls', 'التدقيق الداخلي والضوابط', 'audit',
   ARRAY['Risk-Based Audit Planning','Internal Controls (COSO)','Walkthroughs & Testing','Fraud Risk','Audit Reporting & Follow-up','Audit Analytics'],
   ARRAY['تخطيط التدقيق القائم على المخاطر','الضوابط الداخلية (COSO)','اختبارات السير والفحص','مخاطر الاحتيال','تقارير التدقيق والمتابعة','تحليلات التدقيق']),

  ('external_audit', 'External / Statutory Audit', 'التدقيق الخارجي / القانوني', 'audit',
   ARRAY['Auditing Standards (ISA)','Materiality & Sampling','Controls vs Substantive Testing','Audit Evidence & Documentation','Going Concern & Opinion','IFRS Audit Considerations'],
   ARRAY['معايير التدقيق الدولية (ISA)','الأهمية النسبية والعينات','اختبارات الضوابط مقابل الاختبارات الأساسية','أدلة التدقيق والتوثيق','الاستمرارية وإبداء الرأي','اعتبارات تدقيق المعايير الدولية']),

  ('payroll', 'Payroll', 'الرواتب', 'accounting',
   ARRAY['Payroll Processing & Controls','Statutory Deductions (GOSI/WPS)','End-of-Service & Benefits','Payroll Reconciliation','Time & Attendance Integration'],
   ARRAY['معالجة الرواتب والضوابط','الاستقطاعات النظامية (التأمينات/حماية الأجور)','نهاية الخدمة والمزايا','تسوية الرواتب','تكامل الوقت والحضور']),

  ('fixed_assets', 'Fixed Assets', 'الأصول الثابتة', 'accounting',
   ARRAY['Capitalization & Componentization','Depreciation Methods','Impairment (IAS 36)','Asset Register & Verification','Disposals & Revaluation'],
   ARRAY['الرسملة وتجزئة المكوّنات','طرق الإهلاك','انخفاض القيمة (IAS 36)','سجل الأصول والجرد','الاستبعادات وإعادة التقييم']);

-- ── RLS: admin manages; authenticated may read (the public runner reads via the
--    service client, mirroring the taxonomy/program tables). ──
ALTER TABLE technical_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_functions_select_auth ON technical_functions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_functions_all_admin ON technical_functions
  FOR ALL USING (auth_role() = 'admin');
