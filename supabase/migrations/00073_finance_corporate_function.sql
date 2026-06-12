-- ════════════════════════════════════════════════════════════════
-- Finance competency — add the Corporate Finance function
--
-- The Finance competency held only FP&A + Management Accounting. The core
-- corporate-finance skills (Capital Budgeting, Cost of Capital/WACC, Capital
-- Structure, Working Capital, Investment Appraisal, Financial Statement
-- Analysis) lived ONLY in the retired broad-domain screener and had no home in
-- the function/skill model. This seeds them as a proper Finance function so the
-- competency anchors a real area and those skills are pickable in the runner.
--
-- Mirrors src/lib/competencies/technical-function.ts (STANDARD_FUNCTIONS).
-- Idempotent: ON CONFLICT (key) DO NOTHING.
-- ════════════════════════════════════════════════════════════════

INSERT INTO technical_functions (key, name_en, name_ar, category, skills_en, skills_ar) VALUES
  ('corporate_finance', 'Corporate Finance', 'التمويل المؤسسي', 'finance',
   ARRAY['Capital Budgeting','Cost of Capital (WACC)','Capital Structure','Working Capital Management','Investment Appraisal','Financial Statement Analysis'],
   ARRAY['الموازنة الرأسمالية','تكلفة رأس المال (WACC)','هيكل رأس المال','إدارة رأس المال العامل','تقييم جدوى الاستثمار','تحليل القوائم المالية'])
ON CONFLICT (key) DO NOTHING;
