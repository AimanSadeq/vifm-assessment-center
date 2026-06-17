-- ════════════════════════════════════════════════════════════════
-- 00118 - Category (pillar) definitions for the technical report
--
-- The manager-facing technical report must briefly EXPLAIN what each
-- category (pillar) and subcategory (skill block) tested means.
-- Skill blocks already carry description_en/_ar (00077:137-138; seeded
-- for L&D in 00117 and for the finance function in 00077) - the report
-- just wasn't rendering them. Pillars (the CATEGORY tier) had no
-- description column. This adds it and authors the three L&D pillar
-- definitions so the SDAIA L&D report explains every category +
-- subcategory out of the box.
--
-- Nullable + additive (non-breaking). Pillars on other functions stay
-- NULL for now; a later slice fills them via an authored-or-AI resolver
-- and extends the same columns to the MCQ taxonomy tables.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_pillars
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_ar text;

-- Author the three Learning & Development pillar (category) definitions
-- in plain, manager-friendly language. Matched by name to the pillars
-- seeded in 00117.
DO $$
DECLARE fn uuid;
BEGIN
  SELECT id INTO fn FROM technical_functions WHERE key='learning_development';
  IF fn IS NULL THEN RAISE NOTICE 'learning_development not found; skipping pillar definitions'; RETURN; END IF;

  UPDATE technical_pillars SET
    description_en = 'Measures how the candidate designs effective learning: applying structured design models (ADDIE/SAM), writing clear measurable objectives, and grounding courses in adult-learning principles.',
    description_ar = 'يقيس كيفية تصميم المرشح لتعلم فعّال: تطبيق نماذج التصميم المنهجية (ADDIE/SAM)، وصياغة أهداف واضحة قابلة للقياس، وبناء الدورات على مبادئ تعلم الكبار.'
  WHERE function_id = fn AND name_en = 'Instructional Design & Learning Architecture';

  UPDATE technical_pillars SET
    description_en = 'Measures how the candidate diagnoses workforce skill gaps and designs the right programme to close them: training needs analysis, competency-gap quantification, and choosing the appropriate delivery modality.',
    description_ar = 'يقيس كيفية تشخيص المرشح لفجوات مهارات القوى العاملة وتصميم البرنامج المناسب لإغلاقها: تحليل الاحتياجات التدريبية، وتحديد فجوة الجدارات كمياً، واختيار نمط التقديم المناسب.'
  WHERE function_id = fn AND name_en = 'Training Needs Analysis & Program Design';

  UPDATE technical_pillars SET
    description_en = 'Measures how the candidate runs learning at scale and proves its value: learning operations and LMS analytics, completion and compliance tracking, and training evaluation and ROI (Kirkpatrick, Phillips).',
    description_ar = 'يقيس كيفية إدارة المرشح للتعلم على نطاق واسع وإثبات قيمته: عمليات التعلم وتحليلات نظام إدارة التعلم، وتتبع الإكمال والامتثال، وتقييم التدريب وعائده (كيركباتريك، فيليبس).'
  WHERE function_id = fn AND name_en = 'Learning Operations & Evaluation';
END $$;
