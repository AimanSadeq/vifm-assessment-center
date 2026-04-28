-- ============================================================
-- ARA culture + talent rebalance — adds 10 questions to v1.1
--
-- Why: pre-rebalance distribution was lopsided — data/technology/
-- governance/model_management each had 14 L1 questions, but
-- talent/culture/strategy sat at 8-9 L1. The four people-facing
-- pillars are exactly where consulting clients want depth, so the
-- bank under-served them. This adds 4 L1 + 1 L2 to each of
-- talent and culture (10 questions, +8% to the bank), bringing
-- those pillars to 12-13 L1 — close parity with the heavy pillars.
--
-- Strategy is also light (8 L1) but intentionally untouched here
-- per the user's brief; revisit if consultant feedback flags a gap.
--
-- Versioning note: in a fully-loaded production environment with
-- in-flight respondents, the convention in /ara/admin/questions
-- is "Minor bump (1.0 → 1.1) for additions". Doing that here
-- would mean creating v1.2, copying 125 questions, adding 10,
-- and publishing — heavy ceremony for a dev-stage rebalance with
-- no in-flight assessments. We add directly to v1.1 instead.
-- If/when this ships to a prod env where consultants have
-- mid-flight respondents, prefer the minor-bump path.
--
-- Idempotent: each INSERT is guarded by NOT EXISTS keyed on
-- (version_id, pillar_id, question_number) so re-running is safe.
-- ============================================================

DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM ara_question_bank_versions WHERE version_number = '1.1';
  IF v_id IS NULL THEN
    -- Migration 00021 should have created this row on a fresh clone.
    -- If it's still missing, exit cleanly rather than erroring out.
    RAISE NOTICE 'v1.1 question bank not found; skipping rebalance';
    RETURN;
  END IF;

  -- ─── Talent: +4 L1, +1 L2 (current 9 L1, 4 L2 → target 13 L1, 5 L2) ───

  -- T14 — AI specialist retention strategy
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 14,
    'A documented retention strategy exists for high-performing AI specialists (compensation, growth pathway, recognition).',
    'توجد استراتيجية احتفاظ موثقة للمختصين عاليي الأداء في الذكاء الاصطناعي (الأجور، مسار النمو، التقدير).',
    'rating',
    '["1 - Not at all","2 - Early exploration","3 - In progress","4 - Mostly in place","5 - Comprehensive"]'::jsonb,
    '["١ - ليس بعد","٢ - استكشاف مبكر","٣ - قيد التقدم","٤ - قائم غالباً","٥ - شامل"]'::jsonb,
    '{"1 - Not at all":1,"2 - Early exploration":2,"3 - In progress":3,"4 - Mostly in place":4,"5 - Comprehensive":5}'::jsonb,
    'Reference: ISO 42001 §7.2; SDAIA AI Adoption §7',
    'المرجع: ISO 42001 §7.2; SDAIA AI Adoption §7',
    'both', 'all', 1, 14, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 14);

  -- T15 — Line-manager AI fluency
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 15,
    'Line managers (not just executives) can interpret AI model outputs and explain them to their teams in plain language.',
    'يستطيع المديرون المباشرون (وليس التنفيذيين فقط) تفسير مخرجات نماذج الذكاء الاصطناعي وشرحها لفرقهم بلغة بسيطة.',
    'rating',
    '["1 - Not at all","2 - Early exploration","3 - In progress","4 - Mostly in place","5 - Comprehensive"]'::jsonb,
    '["١ - ليس بعد","٢ - استكشاف مبكر","٣ - قيد التقدم","٤ - قائم غالباً","٥ - شامل"]'::jsonb,
    '{"1 - Not at all":1,"2 - Early exploration":2,"3 - In progress":3,"4 - Mostly in place":4,"5 - Comprehensive":5}'::jsonb,
    'Reference: OECD AI Principles §1.4; UAE AI Charter Principle 9',
    'المرجع: OECD AI Principles §1.4; UAE AI Charter Principle 9',
    'both', 'all', 1, 15, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 15);

  -- T16 — Reskilling plan for staff displaced by AI
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 16,
    'A documented reskilling plan exists for staff whose roles will be reshaped or displaced by AI adoption.',
    'توجد خطة إعادة تأهيل موثقة للموظفين الذين ستعاد صياغة أدوارهم أو يحلّ محلها الذكاء الاصطناعي.',
    'rating',
    '["1 - Not at all","2 - Early exploration","3 - In progress","4 - Mostly in place","5 - Comprehensive"]'::jsonb,
    '["١ - ليس بعد","٢ - استكشاف مبكر","٣ - قيد التقدم","٤ - قائم غالباً","٥ - شامل"]'::jsonb,
    '{"1 - Not at all":1,"2 - Early exploration":2,"3 - In progress":3,"4 - Mostly in place":4,"5 - Comprehensive":5}'::jsonb,
    'Reference: ISO 42001 §7.4; OECD AI Principles §2.3',
    'المرجع: ISO 42001 §7.4; OECD AI Principles §2.3',
    'both', 'all', 1, 16, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 16);

  -- T17 — How AI capability is sourced
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 17,
    'How does the organisation primarily source AI capability today?',
    'كيف تستقطب المنظمة قدرات الذكاء الاصطناعي بشكل رئيسي اليوم؟',
    'multiple_choice',
    '["External hires only","External hires + internal training","External hires + consultants","External hires + consultants + university partnerships","Mature mix: hires, consultants, partnerships, internal mobility"]'::jsonb,
    '["التعيين الخارجي فقط","التعيين الخارجي + التدريب الداخلي","التعيين الخارجي + الاستشاريون","التعيين الخارجي + الاستشاريون + شراكات جامعية","مزيج ناضج: تعيين، استشاريون، شراكات، تنقل داخلي"]'::jsonb,
    '{"External hires only":1,"External hires + internal training":2,"External hires + consultants":3,"External hires + consultants + university partnerships":4,"Mature mix: hires, consultants, partnerships, internal mobility":5}'::jsonb,
    'Reference: SDAIA AI Adoption §7; ISO 42001 §7.1',
    'المرجع: SDAIA AI Adoption §7; ISO 42001 §7.1',
    'both', 'all', 1, 17, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 17);

  -- T18 — Phase 2 dive: which AI hires failed and why
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 18,
    'Which AI roles has the organisation tried to hire and failed to fill in the past 12 months? What was the constraint (compensation, location, skills, visa)?',
    'ما الأدوار في مجال الذكاء الاصطناعي التي حاولت المنظمة التوظيف فيها وفشلت في السنة الماضية؟ ما العائق (الأجور، الموقع، المهارات، التأشيرة)؟',
    'open_text',
    NULL, NULL, NULL,
    'Reference: ISO 42001 §7.2',
    'المرجع: ISO 42001 §7.2',
    'both', 'all', 2, 18, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 18);

  -- ─── Culture: +4 L1, +1 L2 (current 8 L1, 3 L2 → target 12 L1, 4 L2) ───

  -- C12 — AI experimentation sandbox / pilot programme
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'culture', 12,
    'Employees have access to a documented AI experimentation sandbox or pilot programme to test ideas safely without breaking production systems.',
    'للموظفين وصول إلى بيئة تجريبية موثقة للذكاء الاصطناعي أو برنامج تجريبي لاختبار الأفكار بأمان دون التأثير على الأنظمة الإنتاجية.',
    'rating',
    '["1 - Not at all","2 - Early exploration","3 - In progress","4 - Mostly in place","5 - Comprehensive"]'::jsonb,
    '["١ - ليس بعد","٢ - استكشاف مبكر","٣ - قيد التقدم","٤ - قائم غالباً","٥ - شامل"]'::jsonb,
    '{"1 - Not at all":1,"2 - Early exploration":2,"3 - In progress":3,"4 - Mostly in place":4,"5 - Comprehensive":5}'::jsonb,
    'Reference: ISO 42001 §6.3; SDAIA AI Adoption §5',
    'المرجع: ISO 42001 §6.3; SDAIA AI Adoption §5',
    'both', 'all', 1, 12, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'culture' AND question_number = 12);

  -- C13 — Recognition for AI contributors
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'culture', 13,
    'Formal recognition mechanisms reward employees who contribute to AI initiatives — innovation awards, performance reviews, or promotion criteria.',
    'توجد آليات تقدير رسمية تكافئ الموظفين الذين يساهمون في مبادرات الذكاء الاصطناعي - جوائز الابتكار، مراجعات الأداء، أو معايير الترقية.',
    'rating',
    '["1 - Not at all","2 - Early exploration","3 - In progress","4 - Mostly in place","5 - Comprehensive"]'::jsonb,
    '["١ - ليس بعد","٢ - استكشاف مبكر","٣ - قيد التقدم","٤ - قائم غالباً","٥ - شامل"]'::jsonb,
    '{"1 - Not at all":1,"2 - Early exploration":2,"3 - In progress":3,"4 - Mostly in place":4,"5 - Comprehensive":5}'::jsonb,
    'Reference: ISO 42001 §10.3',
    'المرجع: ISO 42001 §10.3',
    'both', 'all', 1, 13, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'culture' AND question_number = 13);

  -- C14 — Public commitment to responsible AI
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'culture', 14,
    'The organisation has a public, externally visible commitment to responsible AI principles — for example an AI ethics statement, charter signature, or customer-facing commitment.',
    'للمنظمة التزام علني ومرئي خارجياً بمبادئ الذكاء الاصطناعي المسؤول - مثل بيان أخلاقيات، أو توقيع ميثاق، أو التزام يخص العملاء.',
    'rating',
    '["1 - Not at all","2 - Early exploration","3 - In progress","4 - Mostly in place","5 - Comprehensive"]'::jsonb,
    '["١ - ليس بعد","٢ - استكشاف مبكر","٣ - قيد التقدم","٤ - قائم غالباً","٥ - شامل"]'::jsonb,
    '{"1 - Not at all":1,"2 - Early exploration":2,"3 - In progress":3,"4 - Mostly in place":4,"5 - Comprehensive":5}'::jsonb,
    'Reference: UAE AI Charter Principles 1-12; OECD AI Principles §1.5',
    'المرجع: UAE AI Charter Principles 1-12; OECD AI Principles §1.5',
    'both', 'all', 1, 14, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'culture' AND question_number = 14);

  -- C15 — Diversity tracking within AI teams
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'culture', 15,
    'Does the organisation track gender, nationality, and seniority diversity within its AI teams?',
    'هل تتتبع المنظمة تنوع الجنس والجنسية والأقدمية داخل فرق الذكاء الاصطناعي؟',
    'yes_no',
    '["Yes","No","Not sure"]'::jsonb,
    '["نعم","لا","غير متأكد"]'::jsonb,
    '{"Yes":5,"No":1,"Not sure":2.5}'::jsonb,
    'Reference: OECD AI Principles §1.2; UAE AI Charter Principle 6',
    'المرجع: OECD AI Principles §1.2; UAE AI Charter Principle 6',
    'both', 'all', 1, 15, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'culture' AND question_number = 15);

  -- C16 — Phase 2 dive: where cultural friction has been highest
  INSERT INTO ara_questions (version_id, pillar_id, question_number, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order, is_active)
  SELECT v_id, 'culture', 16,
    'Describe the most significant cultural resistance the organisation has encountered during AI adoption — which department, role, generation, or language group, and what drove the resistance?',
    'صف أبرز مقاومة ثقافية واجهتها المنظمة خلال تبني الذكاء الاصطناعي - أي قسم، دور، جيل، أو فئة لغوية، وما الذي دفع المقاومة؟',
    'open_text',
    NULL, NULL, NULL,
    'Reference: ISO 42001 §7.4',
    'المرجع: ISO 42001 §7.4',
    'both', 'all', 2, 16, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'culture' AND question_number = 16);

END $$;
