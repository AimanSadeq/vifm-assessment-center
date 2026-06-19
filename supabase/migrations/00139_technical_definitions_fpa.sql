-- ════════════════════════════════════════════════════════════════
-- 00139 - Category (pillar) definitions for FP&A 1.7 (SD-7 ask a)
--
-- The manager-facing technical report explains each category (pillar)
-- and subcategory (skill block). Skill blocks on FP&A already carry
-- description_en/_ar (00077), but the three FP&A pillars were inserted
-- WITHOUT the description columns (those were added later in 00118), so
-- the FP&A report showed category headers with no definition.
--
-- This authors the three FP&A pillar definitions in plain, manager-
-- friendly language, matched by name to the pillars seeded in 00077.
-- Mirrors the 00118 L&D pattern. Idempotent (UPDATE by name); additive.
--
-- The seven INACTIVE finance functions in 00086 (nodes 1.1/1.2/1.3/1.4/
-- 1.6/1.8/1.11) keep NULL pillar definitions for now - they are not
-- node_status='active', so they never surface in the runner picker or a
-- report. A later slice fills them via an authored-or-AI resolver.
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE fn uuid;
BEGIN
  SELECT id INTO fn FROM technical_functions WHERE key = 'fpa';
  IF fn IS NULL THEN
    RAISE NOTICE 'fpa function not found; skipping pillar definitions';
    RETURN;
  END IF;

  UPDATE technical_pillars SET
    description_en = 'Measures how the candidate builds and structures financial models: constructing linked three-statement models, laying out clean, auditable calculation logic, and engineering the model so inputs flow correctly to outputs.',
    description_ar = 'يقيس كيفية بناء المرشح للنماذج المالية وهيكلتها: إنشاء نماذج القوائم الثلاث المترابطة، وترتيب منطق حسابي نظيف وقابل للتدقيق، وهندسة النموذج بحيث تتدفق المدخلات إلى المخرجات بشكل صحيح.'
  WHERE function_id = fn AND name_en = 'Financial Modeling & Structural Engineering';

  UPDATE technical_pillars SET
    description_en = 'Measures how the candidate diagnoses what changed and why: quantifying variances against budget or prior period, decomposing movements (e.g. price-volume-mix), and running sensitivity and scenario analysis.',
    description_ar = 'يقيس كيفية تشخيص المرشح لما تغيّر ولماذا: تحديد الانحرافات كمياً مقابل الموازنة أو الفترة السابقة، وتفكيك الحركات (مثل السعر-الحجم-المزيج)، وإجراء تحليل الحساسية والسيناريوهات.'
  WHERE function_id = fn AND name_en = 'Quantitative Variance Diagnostics';

  UPDATE technical_pillars SET
    description_en = 'Measures how the candidate works with the underlying data: interrogating data through read-only queries, validating data quality and lineage, and structuring information so it supports reliable business-intelligence reporting.',
    description_ar = 'يقيس كيفية تعامل المرشح مع البيانات الأساسية: استجواب البيانات عبر استعلامات للقراءة فقط، والتحقق من جودة البيانات ومصدرها، وهيكلة المعلومات بحيث تدعم تقارير ذكاء الأعمال الموثوقة.'
  WHERE function_id = fn AND name_en = 'Data Lifecycle Interrogation & BI Architecture';
END $$;
