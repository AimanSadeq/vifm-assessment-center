-- ════════════════════════════════════════════════════════════════
-- Technical Assessment Portal — performance-based sandbox model
--
-- Replaces the MCQ technical module per the "Technical Assessment Portal Master
-- Blueprint" SRS. Model: Domain -> Function -> Pillar -> Skill Block. The Skill
-- Block is the assessed unit (banded Basic/Intermediate/Advanced); a Pillar is a
-- report-only grouping. Each Skill Block is delivered through a sandbox ENGINE
-- (spreadsheet / advanced_spreadsheet / logic_input / sql / python) and scored by
-- weighted validation CHECKPOINTS against a master solution.
--
-- This migration is ADDITIVE and non-destructive: the MCQ tables (00052) and the
-- AP framework (00074/00076) are left in git/history but drop out of the live
-- flow. The blueprint's lazy-load node index is expressed relationally:
-- technical_functions.node_status = 'active' only for seeded functions (FP&A 1.7
-- now); all others are 'inactive' valid-empty nodes ready for expansion.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Blueprint's 9 domains (upsert; finance + banking already exist) ──
INSERT INTO technical_domains (key, name_en, name_ar, sort_order) VALUES
  ('finance',      'Finance, Accounting & Investments',        'المالية والمحاسبة والاستثمارات', 1),
  ('hr',           'Human Resources',                          'الموارد البشرية',               2),
  ('cre',          'Corporate Real Estate & Facilities',       'العقارات المؤسسية والمرافق',     3),
  ('data_ai',      'Data Analytics & Artificial Intelligence', 'تحليلات البيانات والذكاء الاصطناعي', 4),
  ('banking',      'Banking Operations & Risk Management',     'العمليات المصرفية وإدارة المخاطر', 5),
  ('pmo',          'Project Management & Business Governance',  'إدارة المشاريع وحوكمة الأعمال',  6),
  ('supply_chain', 'Supply Chain & Strategic Procurement',     'سلسلة التوريد والمشتريات',       7),
  ('strategy',     'Corporate Strategy, Leadership & OD',       'استراتيجية الشركة والقيادة',     8),
  ('grc',          'Legal, Governance, Risk & Compliance',     'القانون والحوكمة والمخاطر والامتثال', 9)
ON CONFLICT (key) DO UPDATE
  SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, sort_order = EXCLUDED.sort_order;

-- ── 2. Extend technical_functions for the blueprint node index ──
ALTER TABLE technical_functions
  ADD COLUMN IF NOT EXISTS node_id       text,
  ADD COLUMN IF NOT EXISTS domain_key    text REFERENCES technical_domains(key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS node_status   text NOT NULL DEFAULT 'inactive' CHECK (node_status IN ('active','inactive')),
  ADD COLUMN IF NOT EXISTS keywords      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS descriptor_en text,
  ADD COLUMN IF NOT EXISTS descriptor_ar text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_technical_functions_node_id
  ON technical_functions(node_id) WHERE node_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_technical_functions_domain ON technical_functions(domain_key);

-- ── 3. Seed / reconcile the 62 blueprint functions (upsert by key) ──
INSERT INTO technical_functions (key, node_id, domain_key, name_en, name_ar) VALUES
  ('accounts_payable','1.1','finance','Accounts Payable (AP)','الحسابات الدائنة'),
  ('accounts_receivable','1.2','finance','Accounts Receivable (AR) & Credit Management','الحسابات المدينة وإدارة الائتمان'),
  ('general_ledger','1.3','finance','Core General Ledger (GL) Accounting','محاسبة الأستاذ العام'),
  ('fixed_assets','1.4','finance','Fixed Assets (FA) & Capital Accounting','الأصول الثابتة والمحاسبة الرأسمالية'),
  ('inventory_cost_accounting','1.5','finance','Inventory & Cost Accounting','المخزون ومحاسبة التكاليف'),
  ('payroll','1.6','finance','Payroll Operations & Tax Compliance','عمليات الرواتب والامتثال الضريبي'),
  ('fpa','1.7','finance','Financial Planning & Analysis (FP&A)','التخطيط والتحليل المالي'),
  ('treasury','1.8','finance','Treasury & Cash Management','الخزينة وإدارة النقد'),
  ('investment_management','1.9','finance','Investment Management & Capital Allocation','إدارة الاستثمار وتخصيص رأس المال'),
  ('corporate_development_ma','1.10','finance','Corporate Development, Valuations, & M&A','تطوير الشركات والتقييم والاندماج والاستحواذ'),
  ('tax','1.11','finance','Corporate Tax (Direct & Indirect Compliance)','الضرائب على الشركات (المباشرة وغير المباشرة)'),
  ('internal_audit','1.12','finance','Internal Audit, Financial Risks, & SOX Governance','التدقيق الداخلي والمخاطر المالية وحوكمة ساربينز أوكسلي'),
  ('strategic_procurement_finance','1.13','finance','Strategic Procurement & Tactical Sourcing','المشتريات الاستراتيجية والتوريد التكتيكي'),
  ('total_rewards','2.1','hr','Total Rewards (Compensation & Benefits Architecture)','المكافآت الشاملة (هيكل التعويضات والمزايا)'),
  ('hris','2.2','hr','HR Information Systems (HRIS) & Core Data Governance','أنظمة معلومات الموارد البشرية وحوكمة البيانات'),
  ('hr_payroll_admin','2.3','hr','Payroll Administration & Employee Allocations','إدارة الرواتب وتخصيصات الموظفين'),
  ('talent_acquisition','2.4','hr','Talent Acquisition (Sourcing, Recruitment, & Sourcing Yields)','استقطاب المواهب (البحث والتوظيف)'),
  ('talent_management_od','2.5','hr','Talent Management & Organizational Development (OD)','إدارة المواهب والتطوير التنظيمي'),
  ('learning_development','2.6','hr','Learning & Development (L&D) Operations & Instructional Design','التعلم والتطوير والتصميم التعليمي'),
  ('hr_shared_services','2.7','hr','Centralized HR Shared Services & Operational Operations','الخدمات المشتركة المركزية للموارد البشرية'),
  ('employee_relations','2.8','hr','Employee Relations & Statutory Labor Compliance','علاقات الموظفين والامتثال لقوانين العمل'),
  ('cre_asset_management','3.1','cre','Corporate Real Estate Asset Management & Portfolio Strategy','إدارة أصول العقارات المؤسسية واستراتيجية المحفظة'),
  ('property_construction_pm','3.2','cre','Property Design, Construction, & Capital Project Management','تصميم العقارات والإنشاء وإدارة المشاريع الرأسمالية'),
  ('lease_administration','3.3','cre','Commercial Lease Administration & Financial Abstract Compliance','إدارة عقود الإيجار التجارية والامتثال المالي'),
  ('facilities_operations','3.4','cre','Facilities Operations, Engineering, & Preventive Maintenance','عمليات المرافق والهندسة والصيانة الوقائية'),
  ('property_acquisition_brokerage','3.5','cre','Property Acquisition, Divestment, & Commercial Brokerage Mechanics','اقتناء العقارات والتصرف والوساطة التجارية'),
  ('hse_compliance','3.6','cre','Health, Safety, & Environment (HSE) Statutory Compliance','الامتثال للصحة والسلامة والبيئة'),
  ('workplace_experience','3.7','cre','Workplace Experience, Space Planning, & Utilization Analytics','تجربة مكان العمل وتخطيط المساحات وتحليل الاستخدام'),
  ('data_engineering','4.1','data_ai','Data Engineering & Pipeline Infrastructure Management (ETL/ELT)','هندسة البيانات وإدارة خطوط المعالجة'),
  ('data_warehousing','4.2','data_ai','Enterprise Data Warehousing & Schema Architecture Design','مستودعات البيانات المؤسسية وتصميم البنية'),
  ('business_intelligence','4.3','data_ai','Business Intelligence (BI) & Semantic Dashboard Layer Design','ذكاء الأعمال وتصميم لوحات المعلومات'),
  ('product_analytics','4.4','data_ai','Product Analytics, Conversion Funnels, & Growth Engineering Metrics','تحليلات المنتج ومسارات التحويل ومقاييس النمو'),
  ('data_science','4.5','data_ai','Data Science, Advanced Statistical Research, & Predictive Modeling','علم البيانات والبحث الإحصائي والنمذجة التنبؤية'),
  ('ml_engineering','4.6','data_ai','Machine Learning (ML) Engineering & MLOps Pipelines','هندسة تعلم الآلة وخطوط MLOps'),
  ('deep_learning_nlp','4.7','data_ai','Deep Learning, Computer Vision, & Natural Language Processing (NLP)','التعلم العميق والرؤية الحاسوبية ومعالجة اللغة'),
  ('generative_ai','4.8','data_ai','Generative AI (GenAI), Large Language Models, & RAG Architecture','الذكاء الاصطناعي التوليدي والنماذج اللغوية الكبيرة'),
  ('ai_governance','4.9','data_ai','AI Governance, Ethics, Bias Mitigation, & Model Risk Management','حوكمة الذكاء الاصطناعي والأخلاقيات وإدارة مخاطر النماذج'),
  ('data_governance_mdm','4.10','data_ai','Data Governance, Privacy Compliance, & Master Data Management (MDM)','حوكمة البيانات والخصوصية وإدارة البيانات الرئيسية'),
  ('commercial_credit_underwriting','5.1','banking','Corporate & Commercial Credit Underwriting','الاكتتاب الائتماني للشركات والتجاري'),
  ('retail_lending','5.2','banking','Retail Lending, Mortgages, & Consumer Credit Risk','الإقراض الأفراد والرهون ومخاطر الائتمان الاستهلاكي'),
  ('wealth_management','5.3','banking','Wealth Management, Private Banking, & Advisory Services','إدارة الثروات والخدمات المصرفية الخاصة'),
  ('global_markets_alm','5.4','banking','Global Markets, Asset Liability Management (ALM), & Liquidity Risk','الأسواق العالمية وإدارة الأصول والخصوم ومخاطر السيولة'),
  ('transaction_banking_trade','5.5','banking','Corporate Banking Transaction Services & Trade Finance','الخدمات المصرفية للمعاملات وتمويل التجارة'),
  ('core_banking_ops','5.6','banking','Core Banking Systems Operations & Clearinghouse Mechanics','عمليات الأنظمة المصرفية الأساسية والمقاصة'),
  ('financial_crime_aml','5.7','banking','Financial Crime, AML, Know-Your-Customer (KYC), & Sanctions Compliance','الجرائم المالية ومكافحة غسل الأموال واعرف عميلك'),
  ('banking_regulatory_basel','5.8','banking','Banking Regulatory Affairs, Basel IV Compliance, & Capital Adequacy','الشؤون التنظيمية المصرفية وامتثال بازل وكفاية رأس المال'),
  ('pmo_strategy','6.1','pmo','Project Management Office (PMO) Strategy & Governance','استراتيجية مكتب إدارة المشاريع والحوكمة'),
  ('agile_delivery','6.2','pmo','Agile, Scrum, & Hybrid Delivery Frameworks','أطر التسليم الرشيقة وسكرم والهجينة'),
  ('project_cost_control','6.3','pmo','Project Capital Budgeting, Estimation, & Cost Control','الموازنة الرأسمالية للمشاريع والتقدير وضبط التكاليف'),
  ('erm_change','6.4','pmo','Enterprise Risk Management (ERM) & Change Management Execution','إدارة مخاطر المؤسسة وتنفيذ إدارة التغيير'),
  ('strategic_sourcing','7.1','supply_chain','Strategic Sourcing, Category Management, & Vendor Negotiations','التوريد الاستراتيجي وإدارة الفئات والتفاوض مع الموردين'),
  ('tactical_procurement','7.2','supply_chain','Tactical Procurement, Purchase Requisition, & PO Lifecycle Control','المشتريات التكتيكية وطلبات الشراء ودورة أوامر الشراء'),
  ('logistics_warehousing','7.3','supply_chain','Logistics, Warehousing, & Inventory Distribution Networks','الخدمات اللوجستية والتخزين وشبكات التوزيع'),
  ('supply_chain_risk','7.4','supply_chain','Supply Chain Risk Management & Contract Compliance Audits','إدارة مخاطر سلسلة التوريد وتدقيق الامتثال للعقود'),
  ('corporate_strategy','8.1','strategy','Corporate Strategy Formulation & Scenario Planning','صياغة استراتيجية الشركة وتخطيط السيناريوهات'),
  ('org_development','8.2','strategy','Organizational Development (OD), Transformation, & Culture Change','التطوير التنظيمي والتحول وتغيير الثقافة'),
  ('corporate_governance_esg','8.3','strategy','Corporate Governance, Sustainability, & ESG Strategy Integration','حوكمة الشركات والاستدامة ودمج استراتيجية ESG'),
  ('executive_communications','8.4','strategy','Executive Communications, Public Relations, & Stakeholder Engagement','الاتصالات التنفيذية والعلاقات العامة وإشراك أصحاب المصلحة'),
  ('corporate_secretarial','9.1','grc','Corporate Secretarial Practice & Board Governance Administration','أعمال أمانة السر للشركات وإدارة حوكمة المجلس'),
  ('contract_legal','9.2','grc','Contract Drafting, Vetting, & Legal Risk Mitigation','صياغة العقود ومراجعتها وتخفيف المخاطر القانونية'),
  ('ethics_anticorruption','9.3','grc','Ethics, Anti-Corruption, & Code of Conduct Enforcement Workflows','الأخلاقيات ومكافحة الفساد وإنفاذ مدونة السلوك'),
  ('statutory_audit_compliance','9.4','grc','Statutory Auditing, Regulatory Liaison, & Policy Compliance Management','التدقيق النظامي والتواصل التنظيمي وإدارة الامتثال')
ON CONFLICT (key) DO UPDATE
  SET node_id = EXCLUDED.node_id, domain_key = EXCLUDED.domain_key,
      name_en = EXCLUDED.name_en, name_ar = COALESCE(technical_functions.name_ar, EXCLUDED.name_ar);

-- ── 4. Pillar tier (grouping of skill blocks; report roll-up, NOT banded) ──
CREATE TABLE technical_pillars (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id uuid NOT NULL REFERENCES technical_functions(id) ON DELETE CASCADE,
  name_en     text NOT NULL,
  name_ar     text,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (function_id, name_en)
);
CREATE INDEX idx_tech_pillars_function ON technical_pillars(function_id);
CREATE TRIGGER trg_technical_pillars_updated_at
  BEFORE UPDATE ON technical_pillars FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. Skill Block tier (THE assessed unit; sandbox-delivered, banded) ──
CREATE TYPE technical_engine_type AS ENUM
  ('spreadsheet','advanced_spreadsheet','logic_input','sql','python');

CREATE TABLE technical_skill_blocks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id        uuid NOT NULL REFERENCES technical_pillars(id) ON DELETE CASCADE,
  name_en          text NOT NULL,
  name_ar          text,
  description_en   text,
  description_ar   text,
  framework_ref    text,                       -- authoritative framework (CFA/IMA/AFP/CIMA/DAMA…)
  engine_type      technical_engine_type NOT NULL,
  time_limit_seconds int NOT NULL DEFAULT 1200,-- blueprint default 20 min
  prompt_en        text,
  prompt_ar        text,
  instructions_en  text,
  instructions_ar  text,
  engine_config    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- grid seed / fields / sql schema
  master_solution  jsonb NOT NULL DEFAULT '{}'::jsonb,  -- expected cells / values / master query
  checkpoints      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- weighted validation checks
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order       int  NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pillar_id, name_en)
);
CREATE INDEX idx_tech_skill_blocks_pillar ON technical_skill_blocks(pillar_id);
CREATE TRIGGER trg_technical_skill_blocks_updated_at
  BEFORE UPDATE ON technical_skill_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 6. Sandbox sittings (one sitting = one function; token-accessed, timed) ──
CREATE TABLE technical_sandbox_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id     uuid NOT NULL REFERENCES technical_functions(id) ON DELETE CASCADE,
  candidate_name  text,
  candidate_email text,
  access_token    uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by      uuid,
  organization_name text,
  status          text NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited','in_progress','submitted','expired','cancelled')),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  expires_at      timestamptz,
  submitted_at    timestamptz,
  overall_score_pct numeric,
  overall_band      text,
  pdf_url         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tech_sandbox_sessions_function ON technical_sandbox_sessions(function_id);
CREATE INDEX idx_tech_sandbox_sessions_token    ON technical_sandbox_sessions(access_token);
CREATE TRIGGER trg_technical_sandbox_sessions_updated_at
  BEFORE UPDATE ON technical_sandbox_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 7. Per-block responses (autosaved work + scored result) ──
CREATE TABLE technical_sandbox_responses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL REFERENCES technical_sandbox_sessions(id) ON DELETE CASCADE,
  skill_block_id     uuid NOT NULL REFERENCES technical_skill_blocks(id) ON DELETE CASCADE,
  work               jsonb NOT NULL DEFAULT '{}'::jsonb,
  status             text NOT NULL DEFAULT 'in_progress'
                       CHECK (status IN ('in_progress','submitted','validated')),
  score_pct          numeric,
  band               text,
  checkpoint_results jsonb,
  started_at         timestamptz,
  submitted_at       timestamptz,
  validated_at       timestamptz,
  time_spent_seconds int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, skill_block_id)
);
CREATE INDEX idx_tech_sandbox_responses_session ON technical_sandbox_responses(session_id);
CREATE TRIGGER trg_technical_sandbox_responses_updated_at
  BEFORE UPDATE ON technical_sandbox_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 8. RLS (admin manages; authenticated reads; candidate writes via service/token) ──
ALTER TABLE technical_pillars            ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_skill_blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_sandbox_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_sandbox_responses  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_pillars_select_auth ON technical_pillars FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_pillars_all_admin   ON technical_pillars FOR ALL    USING (auth_role() = 'admin');
CREATE POLICY tech_blocks_select_auth  ON technical_skill_blocks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_blocks_all_admin    ON technical_skill_blocks FOR ALL    USING (auth_role() = 'admin');
CREATE POLICY tech_sbx_sessions_all_admin   ON technical_sandbox_sessions  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY tech_sbx_responses_all_admin  ON technical_sandbox_responses FOR ALL USING (auth_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- 9. FP&A 1.7 — ACTIVE worked example (3 pillars, 4 skill blocks)
-- ════════════════════════════════════════════════════════════════
UPDATE technical_functions SET node_status='active',
  descriptor_en='Financial Planning & Analysis: integrated modeling, variance diagnostics and data interrogation for forecasting and decision support.',
  descriptor_ar='التخطيط والتحليل المالي: النمذجة المتكاملة وتشخيص الانحرافات واستجواب البيانات لدعم التنبؤ والقرار.',
  keywords=ARRAY['financial model','forecasting','3-statement','three-statement','variance','price volume mix','pvm','ebitda','cash runway','wacc','budgeting','sensitivity','scenario','fp&a','fpa']
  WHERE key='fpa';
UPDATE technical_functions SET
  keywords=ARRAY['depreciation','capitalization threshold','asset disposal','betterment','impairment','ias 16','asc 360','fixed assets','capital accounting'],
  descriptor_en='Fixed Assets & Capital Accounting: capitalization, depreciation, disposals and impairment under IAS 16 / ASC 360.'
  WHERE key='fixed_assets';
UPDATE technical_functions SET
  keywords=ARRAY['mlops','model pipelines','regression','scikit-learn','hyperparameter','training logs','inference deployment','machine learning'],
  descriptor_en='Machine Learning Engineering & MLOps: model pipelines, training, tuning and inference deployment.'
  WHERE key='ml_engineering';
DO $$
DECLARE fn uuid; p1 uuid; p2 uuid; p3 uuid;
BEGIN
  SELECT id INTO fn FROM technical_functions WHERE key='fpa';
  INSERT INTO technical_pillars (function_id,name_en,name_ar,sort_order) VALUES (fn,'Financial Modeling & Structural Engineering','النمذجة المالية والهندسة الهيكلية',1) RETURNING id INTO p1;
  INSERT INTO technical_pillars (function_id,name_en,name_ar,sort_order) VALUES (fn,'Quantitative Variance Diagnostics','تشخيص الانحرافات الكمية',2) RETURNING id INTO p2;
  INSERT INTO technical_pillars (function_id,name_en,name_ar,sort_order) VALUES (fn,'Data Lifecycle Interrogation & BI Architecture','استجواب دورة حياة البيانات وبنية ذكاء الأعمال',3) RETURNING id INTO p3;
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p1,'Three-Statement Integrated Model Mechanics','آليات النموذج المالي المتكامل ثلاثي القوائم','Construct fully linked projections across Income Statement, Balance Sheet and Cash Flow; resolve the indirect cash-flow build and the balance check.','بناء توقعات مترابطة عبر قائمة الدخل والميزانية والتدفقات النقدية وحل معادلة التوازن.','CFA Institute / IMA CMA Standards','spreadsheet',1200,'Complete the indirect cash-flow statement and the Year-1 balance sheet so the model fully links and the balance check equals zero.','أكمل قائمة التدفقات النقدية غير المباشرة والميزانية للسنة الأولى بحيث تتوازن المعادلة عند الصفر.',
    '{"sheetName": "Model", "currency": "USD 000s", "rows": [{"r": 1, "A": "VIFM Co — Year 1 Projection (USD 000s)", "kind": "title"}, {"r": 3, "A": "Income Statement", "kind": "section"}, {"r": 4, "A": "Net Income", "B": 120, "given": true}, {"r": 6, "A": "Cash Flow from Operations (indirect)", "kind": "section"}, {"r": 7, "A": "  Net Income (link from above)", "ref": "B7", "editable": true, "hint": "=B4"}, {"r": 8, "A": "  Add: Depreciation", "B": 40, "given": true}, {"r": 9, "A": "  Less: Increase in Accounts Receivable", "B": -30, "given": true}, {"r": 10, "A": "  Less: Increase in Inventory", "B": -20, "given": true}, {"r": 11, "A": "  Add: Increase in Accounts Payable", "B": 15, "given": true}, {"r": 12, "A": "  Cash Flow from Operations (CFO)", "ref": "B12", "editable": true, "hint": "=SUM(B7:B11)"}, {"r": 14, "A": "Cash Flow from Investing", "kind": "section"}, {"r": 15, "A": "  Capital Expenditure", "B": -60, "given": true}, {"r": 16, "A": "  Cash Flow from Investing (CFI)", "ref": "B16", "editable": true, "hint": "=B15"}, {"r": 18, "A": "Cash Flow from Financing", "kind": "section"}, {"r": 19, "A": "  Debt Drawdown", "B": 10, "given": true}, {"r": 20, "A": "  Dividends Paid", "B": -25, "given": true}, {"r": 21, "A": "  Cash Flow from Financing (CFF)", "ref": "B21", "editable": true, "hint": "=SUM(B19:B20)"}, {"r": 23, "A": "Net Change in Cash", "ref": "B23", "editable": true, "hint": "=B12+B16+B21"}, {"r": 24, "A": "Opening Cash", "B": 100, "given": true}, {"r": 25, "A": "Closing Cash", "ref": "B25", "editable": true, "hint": "=B23+B24"}, {"r": 27, "A": "Balance Sheet — Year 1", "kind": "section"}, {"r": 28, "A": "Cash (link from Closing Cash)", "ref": "B28", "editable": true, "hint": "=B25"}, {"r": 29, "A": "Accounts Receivable", "B": 110, "given": true}, {"r": 30, "A": "Inventory", "B": 80, "given": true}, {"r": 31, "A": "PP&E (net)", "B": 320, "given": true}, {"r": 32, "A": "Total Assets", "ref": "B32", "editable": true, "hint": "=SUM(B28:B31)"}, {"r": 34, "A": "Accounts Payable", "B": 65, "given": true}, {"r": 35, "A": "Debt", "B": 130, "given": true}, {"r": 36, "A": "Equity", "B": 465, "given": true}, {"r": 37, "A": "Total Liabilities & Equity", "ref": "B37", "editable": true, "hint": "=SUM(B34:B36)"}, {"r": 39, "A": "Balance Check (Assets − Liab & Equity)", "ref": "B39", "editable": true, "hint": "=B32-B37"}], "editable": ["B7", "B12", "B16", "B21", "B23", "B25", "B28", "B32", "B37", "B39"]}'::jsonb,'{"cells": {"B7": 120, "B12": 125, "B16": -60, "B21": -15, "B23": 50, "B25": 150, "B28": 150, "B32": 660, "B37": 660, "B39": 0}}'::jsonb,'[{"id": "cfo", "kind": "cell_value", "target": "B12", "expected": 125, "tolerance": 0.01, "weight": 2, "label_en": "CFO computed correctly", "label_ar": "احتساب التدفق التشغيلي بشكل صحيح"}, {"id": "net_change", "kind": "cell_value", "target": "B23", "expected": 50, "tolerance": 0.01, "weight": 1, "label_en": "Net change in cash", "label_ar": "صافي التغير في النقد"}, {"id": "closing_cash", "kind": "cell_value", "target": "B25", "expected": 150, "tolerance": 0.01, "weight": 2, "label_en": "Closing cash", "label_ar": "النقد الختامي"}, {"id": "total_assets", "kind": "cell_value", "target": "B32", "expected": 660, "tolerance": 0.01, "weight": 1, "label_en": "Total assets", "label_ar": "إجمالي الأصول"}, {"id": "total_le", "kind": "cell_value", "target": "B37", "expected": 660, "tolerance": 0.01, "weight": 1, "label_en": "Total liabilities & equity", "label_ar": "إجمالي الخصوم وحقوق الملكية"}, {"id": "delta", "kind": "cell_value", "target": "B39", "expected": 0, "tolerance": 0.01, "weight": 3, "label_en": "Balance check = 0 (Assets − L&E)", "label_ar": "معادلة التوازن = صفر"}]'::jsonb,1);
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p1,'Sensitivity & Stress-Test Matrix Arrays','مصفوفات تحليل الحساسية واختبارات الضغط','Build a two-variable data table assessing EBITDA volatility across price and volume using native array formulas.','بناء جدول بيانات بمتغيرين لتقييم تقلب الأرباح عبر السعر والحجم باستخدام صيغ المصفوفات.','AFP FP&A Body of Knowledge (FPAC)','advanced_spreadsheet',900,'Build the two-variable data table for EBITDA across the given price and volume axes. It must use a native data table, not hardcoded numbers.','ابنِ جدول البيانات بمتغيرين للأرباح عبر محوري السعر والحجم باستخدام جدول بيانات أصلي.',
    '{"sheetName": "Sensitivity", "currency": "USD", "model": {"price": "B1", "unitCost": "B2", "volume": "B3", "fixedCost": "B4", "ebitda": "B5"}, "rows": [{"r": 1, "A": "Price / unit", "B": 50, "given": true}, {"r": 2, "A": "Variable cost / unit", "B": 30, "given": true}, {"r": 3, "A": "Volume (units)", "B": 1000, "given": true}, {"r": 4, "A": "Fixed cost", "B": 8000, "given": true}, {"r": 5, "A": "EBITDA  =(Price−VarCost)×Volume−FixedCost", "ref": "B5", "editable": true, "hint": "=(B1-B2)*B3-B4"}, {"r": 7, "A": "Two-variable Data Table: rows=Volume, cols=Price", "kind": "section"}, {"r": 8, "A": "(corner formula links to EBITDA)", "B7ref": "B8", "editable": true, "hint": "=B5"}, {"r": 8, "C": 45, "D": 50, "E": 55, "given": true, "note": "price headers C8:E8"}, {"r": 9, "A": 800, "given": true, "note": "volume row header"}, {"r": 10, "A": 1000, "given": true}, {"r": 11, "A": 1200, "given": true}], "dataTable": {"range": "C9:E11", "rowInput": "B3", "colInput": "B1", "corner": "B8"}, "editable": ["B5", "B8", "C9:E11"]}'::jsonb,'{"cells": {"B5": 12000, "C9": 4000, "E11": 22000, "D10": 12000}}'::jsonb,'[{"id": "array_formula", "kind": "is_array_formula", "target": "C9:E11", "weight": 3, "label_en": "Uses a native data table {=TABLE()} (not hardcoded)", "label_ar": "استخدام جدول بيانات أصلي وليس قيمًا ثابتة"}, {"id": "corner_low", "kind": "cell_value", "target": "C9", "expected": 4000, "tolerance": 0.01, "weight": 1, "label_en": "Low corner (Price 45, Vol 800)", "label_ar": "الزاوية الدنيا"}, {"id": "corner_high", "kind": "cell_value", "target": "E11", "expected": 22000, "tolerance": 0.01, "weight": 1, "label_en": "High corner (Price 55, Vol 1200)", "label_ar": "الزاوية العليا"}, {"id": "center", "kind": "cell_value", "target": "D10", "expected": 12000, "tolerance": 0.01, "weight": 1, "label_en": "Base case (Price 50, Vol 1000)", "label_ar": "الحالة الأساسية"}]'::jsonb,2);
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p2,'Price-Volume-Mix (PVM) Revenue Deconstruction','تفكيك إيراد السعر والحجم والمزيج','Apply exact variance equations to split a revenue variance into price, volume and mix components.','تطبيق معادلات الانحراف الدقيقة لتقسيم انحراف الإيراد إلى مكونات السعر والحجم والمزيج.','CIMA Management Accounting Framework / IMA','logic_input',600,'Using the two-product scenario, compute the price, volume and mix variances. They must reconcile to the total revenue variance.','باستخدام سيناريو المنتجين، احسب انحرافات السعر والحجم والمزيج بحيث تتطابق مع الإجمالي.',
    '{"scenario": {"products": [{"name": "Product A", "budget_price": 10, "budget_vol": 600, "actual_price": 11, "actual_vol": 700}, {"name": "Product B", "budget_price": 20, "budget_vol": 400, "actual_price": 19, "actual_vol": 500}], "budget_revenue": 14000, "actual_revenue": 17200, "total_variance": 3200, "note_en": "Decompose the total revenue variance into Price, Volume (quantity) and Mix using standard PVM equations.", "note_ar": "حلّل انحراف الإيراد الإجمالي إلى السعر والكمية والمزيج باستخدام معادلات PVM المعيارية."}, "fields": [{"id": "price_variance", "label_en": "Price Variance ($)", "label_ar": "انحراف السعر", "type": "number"}, {"id": "volume_variance", "label_en": "Volume (Quantity) Variance ($)", "label_ar": "انحراف الكمية", "type": "number"}, {"id": "mix_variance", "label_en": "Mix Variance ($)", "label_ar": "انحراف المزيج", "type": "number"}, {"id": "total_variance", "label_en": "Total Revenue Variance ($)", "label_ar": "إجمالي انحراف الإيراد", "type": "number"}]}'::jsonb,'{"fields": {"price_variance": 200, "volume_variance": 2800, "mix_variance": 200, "total_variance": 3200}}'::jsonb,'[{"id": "price", "kind": "logic_value", "field": "price_variance", "expected": 200, "tolerance": 0.5, "weight": 2, "label_en": "Price variance", "label_ar": "انحراف السعر"}, {"id": "volume", "kind": "logic_value", "field": "volume_variance", "expected": 2800, "tolerance": 0.5, "weight": 2, "label_en": "Volume variance", "label_ar": "انحراف الكمية"}, {"id": "mix", "kind": "logic_value", "field": "mix_variance", "expected": 200, "tolerance": 0.5, "weight": 3, "label_en": "Mix variance", "label_ar": "انحراف المزيج"}, {"id": "total", "kind": "logic_value", "field": "total_variance", "expected": 3200, "tolerance": 0.5, "weight": 1, "label_en": "Total variance reconciles", "label_ar": "إجمالي الانحراف يتطابق"}]'::jsonb,1);
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p3,'Relational Database Querying (SQL)','الاستعلام عن قواعد البيانات العلائقية','Write relational queries to aggregate enterprise transaction rows for spending-pattern analysis.','كتابة استعلامات علائقية لتجميع صفوف المعاملات لتحليل أنماط الإنفاق.','DAMA International (DMBOK)','sql',600,'Query the transactions ledger to return total spend per category, highest first.','استعلم عن سجل المعاملات لإرجاع إجمالي الإنفاق لكل فئة من الأعلى إلى الأدنى.',
    '{"dialect": "postgres", "schema_sql": "CREATE TABLE transactions (id int PRIMARY KEY, vendor text, category text, amount numeric, txn_date date);", "seed_sql": "INSERT INTO transactions (id, vendor, category, amount, txn_date) VALUES (1,''Acme'',''IT'',1200,''2025-01-05''),(2,''Globex'',''Travel'',300,''2025-01-08''),(3,''Initech'',''Marketing'',1000,''2025-01-10''),(4,''Acme'',''IT'',800,''2025-02-01''),(5,''Umbrella'',''Office'',200,''2025-02-03''),(6,''Globex'',''Travel'',150,''2025-02-09''),(7,''Umbrella'',''Office'',100,''2025-03-01'');", "prompt_en": "Write a query returning total spend per category, highest total first. Columns: category, total.", "prompt_ar": "اكتب استعلامًا يُرجع إجمالي الإنفاق لكل فئة، من الأعلى إلى الأدنى. الأعمدة: category, total."}'::jsonb,'{"master_query": "SELECT category, SUM(amount) AS total FROM transactions GROUP BY category ORDER BY total DESC, category"}'::jsonb,'[{"id": "result_match", "kind": "sql_result_match", "weight": 1, "ordered": true, "label_en": "Query result matches the master (category totals, correct order)", "label_ar": "نتيجة الاستعلام تطابق النموذج"}]'::jsonb,1);
END $$;
