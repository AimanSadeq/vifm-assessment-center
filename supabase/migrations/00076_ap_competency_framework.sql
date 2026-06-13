-- ════════════════════════════════════════════════════════════════
-- Accounts Payable technical competency framework (P2.3, approved 2026-06-13)
-- See docs/technical-ap-competency-framework.md.
--
-- Model: Function (AP, a job - NOT banded) -> Competency (assessed unit, banded
-- Basic/Intermediate/Advanced) -> Skill (what questions measure; rolls up to the
-- competency). 6 competencies x 5 skills.
--
-- The function's skills_en blueprint is refreshed to exactly these 30 skill
-- names so exam items tag to them and aggregateByCompetency() rolls them up to
-- the right competency. Idempotent: clears AP's existing competencies first.
-- ════════════════════════════════════════════════════════════════

-- 1. Refresh AP's skill blueprint (the finer framework skills, EN/AR index-aligned).
UPDATE technical_functions SET
  skills_en = ARRAY[
    'Invoice Capture & Coding','2-Way vs 3-Way Match','PO / GRN Matching','Exception & Discrepancy Resolution','Duplicate-Invoice Detection',
    'Vendor Master Data Integrity','Supplier Statement Reconciliation','Query & Dispute Resolution','Vendor Onboarding & Validation','Bank-Detail Change Controls',
    'Payment-Run Execution','Payment Methods (WPS / SWIFT / Cheque)','Approval Workflow & Limits','Segregation of Duties','Payment-Fraud Controls',
    'Accruals & Cut-off','GL / Cost-Centre Coding','Sub-ledger to GL Reconciliation','Aged-Payables Analysis','Month-End Close Tasks',
    'Input VAT Treatment','Withholding Tax','E-Invoicing (ZATCA / FTA)','T&E & Expense-Policy Compliance','Documentation & Audit Trail',
    'P2P Internal Controls','Audit Readiness','Fraud Schemes & Prevention','ERP AP-Module Proficiency','AP Automation & Reporting'
  ],
  skills_ar = ARRAY[
    'التقاط الفواتير وترميزها','المطابقة الثنائية مقابل الثلاثية','مطابقة أمر الشراء وإشعار الاستلام','معالجة الاستثناءات والفروقات','كشف الفواتير المكررة',
    'سلامة بيانات المورّدين الرئيسية','تسوية كشوف المورّدين','حل الاستفسارات والنزاعات','إدراج المورّدين والتحقق منهم','ضوابط تغيير البيانات البنكية',
    'تنفيذ دفعات السداد','وسائل الدفع (حماية الأجور/سويفت/الشيكات)','مسارات الاعتماد والحدود','الفصل بين المهام','ضوابط مكافحة احتيال المدفوعات',
    'الاستحقاقات وقطع الفترة','ترميز الأستاذ العام/مراكز التكلفة','تسوية الأستاذ المساعد مع الأستاذ العام','تحليل أعمار الذمم الدائنة','مهام الإقفال الشهري',
    'معالجة ضريبة القيمة المضافة على المدخلات','ضريبة الاستقطاع','الفوترة الإلكترونية (هيئة الزكاة والضريبة/الهيئة الاتحادية)','الامتثال لسياسة المصروفات والسفر','التوثيق ومسار التدقيق',
    'الضوابط الداخلية لدورة الشراء حتى الدفع','الجاهزية للتدقيق','أنماط الاحتيال والوقاية منها','إتقان وحدة الدائنين في نظام تخطيط الموارد','أتمتة الدائنين والتقارير'
  ]
WHERE key = 'accounts_payable';

-- 2. Reset AP competencies, then seed the 6 approved competencies + their skills.
DELETE FROM technical_competencies
WHERE function_id = (SELECT id FROM technical_functions WHERE key = 'accounts_payable');

DO $$
DECLARE fid uuid; cid uuid;
BEGIN
  SELECT id INTO fid FROM technical_functions WHERE key = 'accounts_payable';
  IF fid IS NULL THEN RAISE EXCEPTION 'accounts_payable function not found - apply 00058 first'; END IF;

  -- C1
  INSERT INTO technical_competencies (function_id, name_en, name_ar, sort_order)
    VALUES (fid, 'Invoice Processing & Matching', 'معالجة الفواتير والمطابقة', 0) RETURNING id INTO cid;
  INSERT INTO technical_competency_skills (competency_id, name_en, name_ar, sort_order) VALUES
    (cid,'Invoice Capture & Coding','التقاط الفواتير وترميزها',0),
    (cid,'2-Way vs 3-Way Match','المطابقة الثنائية مقابل الثلاثية',1),
    (cid,'PO / GRN Matching','مطابقة أمر الشراء وإشعار الاستلام',2),
    (cid,'Exception & Discrepancy Resolution','معالجة الاستثناءات والفروقات',3),
    (cid,'Duplicate-Invoice Detection','كشف الفواتير المكررة',4);

  -- C2
  INSERT INTO technical_competencies (function_id, name_en, name_ar, sort_order)
    VALUES (fid, 'Supplier / Vendor Management', 'إدارة المورّدين', 1) RETURNING id INTO cid;
  INSERT INTO technical_competency_skills (competency_id, name_en, name_ar, sort_order) VALUES
    (cid,'Vendor Master Data Integrity','سلامة بيانات المورّدين الرئيسية',0),
    (cid,'Supplier Statement Reconciliation','تسوية كشوف المورّدين',1),
    (cid,'Query & Dispute Resolution','حل الاستفسارات والنزاعات',2),
    (cid,'Vendor Onboarding & Validation','إدراج المورّدين والتحقق منهم',3),
    (cid,'Bank-Detail Change Controls','ضوابط تغيير البيانات البنكية',4);

  -- C3
  INSERT INTO technical_competencies (function_id, name_en, name_ar, sort_order)
    VALUES (fid, 'Payments & Disbursement Controls', 'المدفوعات وضوابط الصرف', 2) RETURNING id INTO cid;
  INSERT INTO technical_competency_skills (competency_id, name_en, name_ar, sort_order) VALUES
    (cid,'Payment-Run Execution','تنفيذ دفعات السداد',0),
    (cid,'Payment Methods (WPS / SWIFT / Cheque)','وسائل الدفع (حماية الأجور/سويفت/الشيكات)',1),
    (cid,'Approval Workflow & Limits','مسارات الاعتماد والحدود',2),
    (cid,'Segregation of Duties','الفصل بين المهام',3),
    (cid,'Payment-Fraud Controls','ضوابط مكافحة احتيال المدفوعات',4);

  -- C4
  INSERT INTO technical_competencies (function_id, name_en, name_ar, sort_order)
    VALUES (fid, 'AP Accounting & Period Close', 'محاسبة الدائنين وإقفال الفترة', 3) RETURNING id INTO cid;
  INSERT INTO technical_competency_skills (competency_id, name_en, name_ar, sort_order) VALUES
    (cid,'Accruals & Cut-off','الاستحقاقات وقطع الفترة',0),
    (cid,'GL / Cost-Centre Coding','ترميز الأستاذ العام/مراكز التكلفة',1),
    (cid,'Sub-ledger to GL Reconciliation','تسوية الأستاذ المساعد مع الأستاذ العام',2),
    (cid,'Aged-Payables Analysis','تحليل أعمار الذمم الدائنة',3),
    (cid,'Month-End Close Tasks','مهام الإقفال الشهري',4);

  -- C5
  INSERT INTO technical_competencies (function_id, name_en, name_ar, sort_order)
    VALUES (fid, 'Tax & Regulatory Compliance', 'الامتثال الضريبي والتنظيمي', 4) RETURNING id INTO cid;
  INSERT INTO technical_competency_skills (competency_id, name_en, name_ar, sort_order) VALUES
    (cid,'Input VAT Treatment','معالجة ضريبة القيمة المضافة على المدخلات',0),
    (cid,'Withholding Tax','ضريبة الاستقطاع',1),
    (cid,'E-Invoicing (ZATCA / FTA)','الفوترة الإلكترونية (هيئة الزكاة والضريبة/الهيئة الاتحادية)',2),
    (cid,'T&E & Expense-Policy Compliance','الامتثال لسياسة المصروفات والسفر',3),
    (cid,'Documentation & Audit Trail','التوثيق ومسار التدقيق',4);

  -- C6
  INSERT INTO technical_competencies (function_id, name_en, name_ar, sort_order)
    VALUES (fid, 'Controls, Risk & AP Systems', 'الضوابط والمخاطر وأنظمة الدائنين', 5) RETURNING id INTO cid;
  INSERT INTO technical_competency_skills (competency_id, name_en, name_ar, sort_order) VALUES
    (cid,'P2P Internal Controls','الضوابط الداخلية لدورة الشراء حتى الدفع',0),
    (cid,'Audit Readiness','الجاهزية للتدقيق',1),
    (cid,'Fraud Schemes & Prevention','أنماط الاحتيال والوقاية منها',2),
    (cid,'ERP AP-Module Proficiency','إتقان وحدة الدائنين في نظام تخطيط الموارد',3),
    (cid,'AP Automation & Reporting','أتمتة الدائنين والتقارير',4);
END $$;
