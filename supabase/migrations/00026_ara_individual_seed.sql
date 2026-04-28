-- ============================================================
-- VIFM ARA — Individual / Personal seed
--
-- 16 self-assessment items (4 per factor × 4 factors) for the
-- Personal AI Readiness Snapshot. All items live on the active
-- v1.1 question bank, distinguished from org-side questions by
-- the individual_factor_id column added in migration 00025.
--
-- Pillar assignment: all 16 are tagged pillar_id='talent' (the
-- closest semantic fit among the 8 enum values), but the
-- respondent flow filters by individual_factor_id when the
-- assessment stage is 'individual', so org-side respondents
-- never see these questions.
--
-- Question numbering: 101-116 — well above the existing talent
-- pillar's 1-18 range so there's no collision with the org bank.
--
-- Each item: 5-point Likert (Strongly Disagree → Strongly Agree),
-- score_map maps each option to 1-5 cleanly. Higher score = more
-- AI-ready on that factor.
--
-- Idempotent — NOT EXISTS guards keyed on (version_id, pillar_id,
-- question_number).
-- ============================================================

DO $$
DECLARE
  v_id uuid;
  -- Likert scale shared across all 16 items
  opts_en jsonb := '["1 - Strongly Disagree","2 - Disagree","3 - Neutral","4 - Agree","5 - Strongly Agree"]'::jsonb;
  opts_ar jsonb := '["١ - أعارض بشدة","٢ - أعارض","٣ - محايد","٤ - أوافق","٥ - أوافق بشدة"]'::jsonb;
  scoremap jsonb := '{"1 - Strongly Disagree":1,"2 - Disagree":2,"3 - Neutral":3,"4 - Agree":4,"5 - Strongly Agree":5}'::jsonb;
BEGIN
  SELECT id INTO v_id FROM ara_question_bank_versions WHERE version_number = '1.1';
  IF v_id IS NULL THEN
    RAISE NOTICE 'v1.1 question bank not found; skipping individual seed';
    RETURN;
  END IF;

  -- ─── THINKING — AI Sense-Check (factor: thinking_sense_check) ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 101, 'thinking_sense_check',
    'I check AI-generated content for factual errors before relying on it for important work.',
    'أتحقق من المحتوى الذي ينتجه الذكاء الاصطناعي للأخطاء الواقعية قبل الاعتماد عليه في عمل مهم.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 101, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 101);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 102, 'thinking_sense_check',
    'I can recognise when an AI tool is hallucinating or fabricating information that sounds plausible.',
    'أستطيع التعرف على متى ينتج أداة الذكاء الاصطناعي معلومات وهمية أو ملفقة تبدو معقولة.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 102, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 102);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 103, 'thinking_sense_check',
    'I question AI outputs against my own domain expertise rather than accepting them by default.',
    'أتساءل عن مخرجات الذكاء الاصطناعي مقارنةً بخبرتي في مجالي بدلاً من قبولها افتراضياً.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 103, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 103);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 104, 'thinking_sense_check',
    'I verify AI-generated calculations, code, or analyses against an independent source before using them.',
    'أتحقق من الحسابات أو الأكواد أو التحليلات الناتجة عن الذكاء الاصطناعي مقابل مصدر مستقل قبل استخدامها.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 104, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 104);

  -- ─── RESULTS — AI Working Practice (factor: results_working_practice) ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 105, 'results_working_practice',
    'I use AI tools regularly to accelerate or improve my day-to-day work outputs.',
    'أستخدم أدوات الذكاء الاصطناعي بانتظام لتسريع أو تحسين مخرجات عملي اليومية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 105, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 105);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 106, 'results_working_practice',
    'I write effective prompts that produce useful AI responses on the first or second try.',
    'أكتب تعليمات فعالة تنتج استجابات مفيدة من الذكاء الاصطناعي من المحاولة الأولى أو الثانية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 106, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 106);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 107, 'results_working_practice',
    'I have integrated at least one AI tool into a recurring part of my workflow.',
    'لقد دمجت أداة ذكاء اصطناعي واحدة على الأقل في جزء متكرر من سير عملي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 107, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 107);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 108, 'results_working_practice',
    'I know which tasks are worth giving to AI and which are faster to do myself.',
    'أعرف أي المهام تستحق إعطاءها للذكاء الاصطناعي وأيها أسرع لإنجازها بنفسي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 108, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 108);

  -- ─── PEOPLE — AI Collaboration (factor: people_collaboration) ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 109, 'people_collaboration',
    'I help colleagues understand what AI can and cannot do well in our line of work.',
    'أساعد الزملاء على فهم ما يستطيع الذكاء الاصطناعي القيام به وما لا يستطيع في مجال عملنا.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 109, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 109);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 110, 'people_collaboration',
    'I share AI prompt techniques, tips, or worked examples with my team.',
    'أشارك تقنيات صياغة التعليمات والنصائح والأمثلة العملية للذكاء الاصطناعي مع فريقي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 110, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 110);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 111, 'people_collaboration',
    'I encourage open conversation about AI risks, limitations, and ethical concerns in my team.',
    'أشجع الحوار المفتوح حول مخاطر الذكاء الاصطناعي وحدوده والمخاوف الأخلاقية في فريقي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 111, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 111);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 112, 'people_collaboration',
    'I model responsible AI use that others on my team can follow.',
    'أقدم نموذجاً للاستخدام المسؤول للذكاء الاصطناعي يمكن للآخرين في فريقي الاقتداء به.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 112, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 112);

  -- ─── SELF — AI Adaptive Mindset (factor: self_adaptive_mindset) ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 113, 'self_adaptive_mindset',
    'I am comfortable that my role and workflow may change significantly because of AI.',
    'أنا مرتاح لكون دوري وسير عملي قد يتغيران بشكل كبير بسبب الذكاء الاصطناعي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 113, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 113);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 114, 'self_adaptive_mindset',
    'I actively seek out new AI tools and capabilities to learn about, even when not required.',
    'أبحث بنشاط عن أدوات وقدرات جديدة للذكاء الاصطناعي لتعلمها، حتى عندما لا يكون ذلك مطلوباً.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 114, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 114);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 115, 'self_adaptive_mindset',
    'I follow my organisation''s policies on AI use, data privacy, and confidentiality.',
    'أتبع سياسات منظمتي حول استخدام الذكاء الاصطناعي وخصوصية البيانات والسرية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 115, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 115);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 116, 'self_adaptive_mindset',
    'I am willing to invest personal time in building my AI capability beyond what my employer requires.',
    'أنا مستعد لاستثمار وقتي الشخصي في بناء قدرتي على الذكاء الاصطناعي بما يتجاوز ما يتطلبه صاحب العمل.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 116, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 116);

END $$;
