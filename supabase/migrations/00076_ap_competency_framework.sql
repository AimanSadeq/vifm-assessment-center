-- ════════════════════════════════════════════════════════════════
-- Accounts Payable technical competency framework v2 (P2.3, approved 2026-06-13)
-- See docs/technical-ap-competency-framework.md.
--
-- 3-tier model: Category (grouping, NOT banded) -> Competency (the assessed
-- unit, banded Basic/Intermediate/Advanced) -> Skill / sub-component (what
-- questions measure; rolls up to the competency). Each competency carries an
-- authoritative reference (IOFM/COSO/ACFE/APQC/AICPA-CIMA/IFRS-GAAP) for
-- defensibility.
--
-- 6 categories · 19 competencies · 36 sub-component skills.
-- The function's skills_en blueprint is refreshed to exactly these 36 skill
-- names so exam items tag to them and aggregateByCompetency() rolls them up.
-- Idempotent: ADD COLUMN IF NOT EXISTS + clears AP competencies first.
-- ════════════════════════════════════════════════════════════════

-- 0. Competency-tier columns: category + authoritative reference.
ALTER TABLE technical_competencies ADD COLUMN IF NOT EXISTS category_en text;
ALTER TABLE technical_competencies ADD COLUMN IF NOT EXISTS category_ar text;
ALTER TABLE technical_competencies ADD COLUMN IF NOT EXISTS reference   text;

-- 1. Refresh AP's 36-skill blueprint (EN/AR index-aligned; order = competency order).
UPDATE technical_functions SET
  skills_en = ARRAY[
    'Opex vs Capex Classification','Cost-Centre / Project Coding',
    'Month-End Unvouched Liabilities','Open-PO Commitment Tracking',
    'Credit Notes & Short Payments','Correcting Journal Entries',
    'Multi-Period Service Identification','Deferred Expense Scheduling',
    'Invoice-PO-GRN Cross-Check','Price, Quantity & Terms Verification',
    'Variance Root-Cause Analysis','Dispute & Escalation Workflows',
    'Delegation-of-Authority (DoA) Checks','Signing-Limit Verification',
    'Advanced Functions (XLOOKUP, PivotTables)','Data Cleaning & Filtering',
    'Vendor Statement vs Sub-Ledger','Isolating Missing / Unapplied Items',
    'Aging Bucket Interpretation','Payment Urgency & Debit Balances',
    'AP Module Fluency (SAP/Oracle/NetSuite)','Batch, Post & Clear Transactions',
    'Invoice Ingestion Queues','OCR Field-Mapping Correction',
    'Document Management Platforms','Unblocking Approval Loops',
    'Localized Transaction Taxes (VAT/Sales/Use)','Tax on Complex Multi-Line Invoices',
    'Cross-Border WHT Deductions',
    'Segregation of Duties (SoD)','Vendor Bank-Change Verification',
    'Duplicate / Altered-Bank / Split-Invoice Flags',
    'Payment Files (ACH/Wire/EFT/V-Card)','Bank-Spec File Formatting',
    'Payment-Term Evaluation (2/10 Net 30)','Optimal Payment Timing'
  ],
  skills_ar = ARRAY[
    'تصنيف المصروفات التشغيلية مقابل الرأسمالية','ترميز مراكز التكلفة والمشاريع',
    'التزامات غير مُستندة في نهاية الشهر','تتبّع التزامات أوامر الشراء المفتوحة',
    'إشعارات الدائن والمدفوعات الناقصة','قيود تصحيح المخصصات الخاطئة',
    'تحديد الخدمات متعددة الفترات','جدولة المصروفات المؤجلة',
    'المطابقة بين الفاتورة وأمر الشراء وإشعار الاستلام','التحقق من السعر والكمية والشروط',
    'تحليل الأسباب الجذرية للانحرافات','مسارات النزاع والتصعيد',
    'التحقق من مصفوفة تفويض الصلاحيات','التحقق من حدود التوقيع',
    'الدوال المتقدمة (XLOOKUP، الجداول المحورية)','تنظيف البيانات وتصفيتها',
    'كشف المورّد مقابل الأستاذ المساعد','عزل البنود المفقودة وغير المخصصة',
    'تفسير فئات الأعمار (٠-٣٠/٣١-٦٠/٩٠+)','أولوية السداد والأرصدة المدينة',
    'إتقان وحدة الدائنين (SAP/Oracle/NetSuite)','تجميع وترحيل وتسوية المعاملات',
    'إدارة قوائم استقبال الفواتير','تصحيح ربط حقول التعرّف الضوئي',
    'منصات إدارة المستندات','فك حلقات الاعتماد المتعطّلة',
    'الضرائب المحلية على المعاملات (القيمة المضافة/المبيعات/الاستخدام)','الضريبة على الفواتير متعددة البنود',
    'استقطاعات الضريبة على الموردين الأجانب',
    'الفصل بين المهام','التحقق من تغيير بيانات بنك المورّد',
    'مؤشرات التكرار وتغيير البنك وتجزئة الفواتير',
    'ملفات الدفع (ACH/تحويل/EFT/بطاقة افتراضية)','تنسيق الملفات وفق مواصفات البنك',
    'تقييم شروط السداد (٢/١٠ صافي ٣٠)','التوقيت الأمثل للسداد'
  ]
WHERE key = 'accounts_payable';

-- 2. Reset AP competencies, then seed 6 categories / 19 competencies / 36 skills.
DELETE FROM technical_competencies
WHERE function_id = (SELECT id FROM technical_functions WHERE key = 'accounts_payable');

DO $$
DECLARE fid uuid; cid uuid; so int := 0;
BEGIN
  SELECT id INTO fid FROM technical_functions WHERE key = 'accounts_payable';
  IF fid IS NULL THEN RAISE EXCEPTION 'accounts_payable function not found - apply 00058 first'; END IF;

  -- helper inline via repeated blocks. category text reused per group.

  -- ════ Category 1: Sub-Ledger Accounting Mechanics ════
  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Chart of Accounts (CoA) Mapping','ربط دليل الحسابات','Sub-Ledger Accounting Mechanics','آليات محاسبة الأستاذ المساعد','AICPA / CIMA (CGMA)',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Opex vs Capex Classification','تصنيف المصروفات التشغيلية مقابل الرأسمالية',0),
    (cid,'Cost-Centre / Project Coding','ترميز مراكز التكلفة والمشاريع',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Accrual & Cut-off Precision','دقة الاستحقاق وقطع الفترة','Sub-Ledger Accounting Mechanics','آليات محاسبة الأستاذ المساعد','IFRS / US GAAP',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Month-End Unvouched Liabilities','التزامات غير مُستندة في نهاية الشهر',0),
    (cid,'Open-PO Commitment Tracking','تتبّع التزامات أوامر الشراء المفتوحة',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Double-Entry Adjustment Logic','منطق قيود التسوية المزدوجة','Sub-Ledger Accounting Mechanics','آليات محاسبة الأستاذ المساعد','AICPA / CIMA',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Credit Notes & Short Payments','إشعارات الدائن والمدفوعات الناقصة',0),
    (cid,'Correcting Journal Entries','قيود تصحيح المخصصات الخاطئة',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Amortization & Prepaid Recognition','إطفاء وإثبات المصروفات المدفوعة مقدماً','Sub-Ledger Accounting Mechanics','آليات محاسبة الأستاذ المساعد','IFRS / US GAAP',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Multi-Period Service Identification','تحديد الخدمات متعددة الفترات',0),
    (cid,'Deferred Expense Scheduling','جدولة المصروفات المؤجلة',1);

  -- ════ Category 2: Document Verification & Matching Logic ════
  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Three-Way Matching Execution','تنفيذ المطابقة الثلاثية','Document Verification & Matching Logic','التحقق من المستندات ومنطق المطابقة','IOFM (CAPP) / APQC',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Invoice-PO-GRN Cross-Check','المطابقة بين الفاتورة وأمر الشراء وإشعار الاستلام',0),
    (cid,'Price, Quantity & Terms Verification','التحقق من السعر والكمية والشروط',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Exception & Discrepancy Resolution','معالجة الاستثناءات والفروقات','Document Verification & Matching Logic','التحقق من المستندات ومنطق المطابقة','IOFM (CAPP)',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Variance Root-Cause Analysis','تحليل الأسباب الجذرية للانحرافات',0),
    (cid,'Dispute & Escalation Workflows','مسارات النزاع والتصعيد',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Non-PO Authorization Handling','معالجة الاعتماد دون أمر شراء','Document Verification & Matching Logic','التحقق من المستندات ومنطق المطابقة','COSO',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Delegation-of-Authority (DoA) Checks','التحقق من مصفوفة تفويض الصلاحيات',0),
    (cid,'Signing-Limit Verification','التحقق من حدود التوقيع',1);

  -- ════ Category 3: Financial Data Manipulation & Reconciliation ════
  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Spreadsheet Data Manipulation','معالجة بيانات الجداول الإلكترونية','Financial Data Manipulation & Reconciliation','معالجة البيانات المالية والتسويات','IOFM / APQC',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Advanced Functions (XLOOKUP, PivotTables)','الدوال المتقدمة (XLOOKUP، الجداول المحورية)',0),
    (cid,'Data Cleaning & Filtering','تنظيف البيانات وتصفيتها',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Statement of Account Reconciliation','تسوية كشف الحساب','Financial Data Manipulation & Reconciliation','معالجة البيانات المالية والتسويات','IOFM (CAPP)',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Vendor Statement vs Sub-Ledger','كشف المورّد مقابل الأستاذ المساعد',0),
    (cid,'Isolating Missing / Unapplied Items','عزل البنود المفقودة وغير المخصصة',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Aging Analysis','تحليل الأعمار','Financial Data Manipulation & Reconciliation','معالجة البيانات المالية والتسويات','IOFM / AICPA',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Aging Bucket Interpretation','تفسير فئات الأعمار (٠-٣٠/٣١-٦٠/٩٠+)',0),
    (cid,'Payment Urgency & Debit Balances','أولوية السداد والأرصدة المدينة',1);

  -- ════ Category 4: ERP & AP Workflow Systems Navigation ════
  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'ERP Transactional Competence','الكفاءة التشغيلية في نظام تخطيط الموارد','ERP & AP Workflow Systems Navigation','التنقل في أنظمة وسير عمل الدائنين','APQC',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'AP Module Fluency (SAP/Oracle/NetSuite)','إتقان وحدة الدائنين (SAP/Oracle/NetSuite)',0),
    (cid,'Batch, Post & Clear Transactions','تجميع وترحيل وتسوية المعاملات',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'OCR Engine Gatekeeping','الرقابة على محرك التعرّف الضوئي','ERP & AP Workflow Systems Navigation','التنقل في أنظمة وسير عمل الدائنين','IOFM',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Invoice Ingestion Queues','إدارة قوائم استقبال الفواتير',0),
    (cid,'OCR Field-Mapping Correction','تصحيح ربط حقول التعرّف الضوئي',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Electronic Workflow Management','إدارة سير العمل الإلكتروني','ERP & AP Workflow Systems Navigation','التنقل في أنظمة وسير عمل الدائنين','APQC',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Document Management Platforms','منصات إدارة المستندات',0),
    (cid,'Unblocking Approval Loops','فك حلقات الاعتماد المتعطّلة',1);

  -- ════ Category 5: Regulatory, Tax & Internal Control Compliance ════
  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Multi-Jurisdictional Tax Application','تطبيق الضرائب متعدد الولايات','Regulatory, Tax & Internal Control Compliance','الامتثال التنظيمي والضريبي والرقابة الداخلية','IFRS / US GAAP / Local Tax',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Localized Transaction Taxes (VAT/Sales/Use)','الضرائب المحلية على المعاملات (القيمة المضافة/المبيعات/الاستخدام)',0),
    (cid,'Tax on Complex Multi-Line Invoices','الضريبة على الفواتير متعددة البنود',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Withholding Tax (WHT) Compliance','الامتثال لضريبة الاستقطاع','Regulatory, Tax & Internal Control Compliance','الامتثال التنظيمي والضريبي والرقابة الداخلية','Local Statutory Laws',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Cross-Border WHT Deductions','استقطاعات الضريبة على الموردين الأجانب',0);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Master Data Guardrails','ضوابط البيانات الرئيسية','Regulatory, Tax & Internal Control Compliance','الامتثال التنظيمي والضريبي والرقابة الداخلية','COSO',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Segregation of Duties (SoD)','الفصل بين المهام',0),
    (cid,'Vendor Bank-Change Verification','التحقق من تغيير بيانات بنك المورّد',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Fraud Pattern Recognition','كشف أنماط الاحتيال','Regulatory, Tax & Internal Control Compliance','الامتثال التنظيمي والضريبي والرقابة الداخلية','ACFE',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Duplicate / Altered-Bank / Split-Invoice Flags','مؤشرات التكرار وتغيير البنك وتجزئة الفواتير',0);

  -- ════ Category 6: Treasury & Payment Execution Support ════
  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Payment Rail Mechanics','آليات قنوات الدفع','Treasury & Payment Execution Support','دعم الخزينة وتنفيذ المدفوعات','IOFM / APQC',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Payment Files (ACH/Wire/EFT/V-Card)','ملفات الدفع (ACH/تحويل/EFT/بطاقة افتراضية)',0),
    (cid,'Bank-Spec File Formatting','تنسيق الملفات وفق مواصفات البنك',1);

  INSERT INTO technical_competencies (function_id,name_en,name_ar,category_en,category_ar,reference,sort_order)
    VALUES (fid,'Discount Optimization Calculation','حساب تحسين الخصومات','Treasury & Payment Execution Support','دعم الخزينة وتنفيذ المدفوعات','AICPA / IOFM',so) RETURNING id INTO cid; so:=so+1;
  INSERT INTO technical_competency_skills (competency_id,name_en,name_ar,sort_order) VALUES
    (cid,'Payment-Term Evaluation (2/10 Net 30)','تقييم شروط السداد (٢/١٠ صافي ٣٠)',0),
    (cid,'Optimal Payment Timing','التوقيت الأمثل للسداد',1);
END $$;
