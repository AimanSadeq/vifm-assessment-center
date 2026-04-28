-- ============================================================
-- VIFM ARA — Individual readiness: tiers + org-engagement layer
--
-- Three deployment modes for the four-factor individual readiness
-- assessment (added in migrations 00025/00026):
--
--   A) Free self-served snapshot
--      engagement_stage='individual', assessment_tier='snapshot'
--      24 items (6 per factor) — directional
--
--   B) Paid deep-dive (consultant-issued)
--      engagement_stage='individual', assessment_tier='deep_dive'
--      48 items (12 per factor) — research-grade reliability
--      (α ≈ 0.85+ per factor at 12 items)
--
--   C) Individual layer inside an org engagement
--      engagement_stage IN (department/division/enterprise),
--      include_individual_layer=true
--      Org respondents answer their pillar questions PLUS the
--      24 or 48 individual items based on assessment_tier.
--      Consultant can also invite "individual_only" respondents
--      to the same org assessment — they skip pillar questions
--      and only do the personal layer.
--
-- This migration adds:
--   1. ara_questions.tier — 'snapshot' (default) or 'deep_dive_extra'
--   2. ara_assessments.assessment_tier — 'snapshot' (default) or 'deep_dive'
--   3. ara_assessments.include_individual_layer — boolean default false
--   4. ara_respondents.individual_only — boolean default false
--   5. 8 new snapshot items (q117-q124, 2 per factor) → bank now 24 individual items
--   6. 24 new deep-dive-extra items (q125-q148, 6 per factor) → bank now 48 total
--
-- Idempotent. All ALTERs use IF NOT EXISTS / DO blocks; all INSERTs
-- guarded by NOT EXISTS keyed on (version, pillar, q_number).
-- ============================================================

-- ─── 1. ara_questions.tier ─────────────────────────────────────
ALTER TABLE ara_questions
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'snapshot';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ara_questions_tier_check'
  ) THEN
    ALTER TABLE ara_questions
      ADD CONSTRAINT ara_questions_tier_check
      CHECK (tier IN ('snapshot', 'deep_dive_extra'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ara_questions_tier
  ON ara_questions(tier)
  WHERE individual_factor_id IS NOT NULL;

-- ─── 2. ara_assessments.assessment_tier ─────────────────────────
ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS assessment_tier text NOT NULL DEFAULT 'snapshot';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ara_assessments_tier_check'
  ) THEN
    ALTER TABLE ara_assessments
      ADD CONSTRAINT ara_assessments_tier_check
      CHECK (assessment_tier IN ('snapshot', 'deep_dive'));
  END IF;
END $$;

-- ─── 3. ara_assessments.include_individual_layer ────────────────
ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS include_individual_layer boolean NOT NULL DEFAULT false;

-- ─── 4. ara_respondents.individual_only ─────────────────────────
ALTER TABLE ara_respondents
  ADD COLUMN IF NOT EXISTS individual_only boolean NOT NULL DEFAULT false;

-- ─── 5+6. Seed the additional items ─────────────────────────────
DO $$
DECLARE
  v_id uuid;
  opts_en jsonb := '["1 - Strongly Disagree","2 - Disagree","3 - Neutral","4 - Agree","5 - Strongly Agree"]'::jsonb;
  opts_ar jsonb := '["١ - أعارض بشدة","٢ - أعارض","٣ - محايد","٤ - أوافق","٥ - أوافق بشدة"]'::jsonb;
  scoremap jsonb := '{"1 - Strongly Disagree":1,"2 - Disagree":2,"3 - Neutral":3,"4 - Agree":4,"5 - Strongly Agree":5}'::jsonb;
BEGIN
  SELECT id INTO v_id FROM ara_question_bank_versions WHERE version_number = '1.1';
  IF v_id IS NULL THEN
    RAISE NOTICE 'v1.1 question bank not found; skipping individual tier seed';
    RETURN;
  END IF;

  -- ════════════════════════════════════════════════════════════
  -- 8 NEW SNAPSHOT ITEMS — 2 per factor — bring snapshot to 6 items/factor
  -- ════════════════════════════════════════════════════════════

  -- ─── THINKING — AI Sense-Check (q117-q118) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 117, 'thinking_sense_check', 'snapshot',
    'Before sharing AI-generated work with a colleague or client, I edit it to reflect my own judgment.',
    'قبل مشاركة عمل ينتجه الذكاء الاصطناعي مع زميل أو عميل، أقوم بتحريره ليعكس حكمي الخاص.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 117, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 117);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 118, 'thinking_sense_check', 'snapshot',
    'I notice when an AI''s confident-sounding answer doesn''t actually match what was asked.',
    'ألاحظ عندما لا تتطابق الإجابة الواثقة من الذكاء الاصطناعي مع ما تم سؤاله فعلياً.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 118, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 118);

  -- ─── RESULTS — AI Working Practice (q119-q120) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 119, 'results_working_practice', 'snapshot',
    'I break complex tasks into smaller steps when prompting an AI rather than asking everything at once.',
    'أقسّم المهام المعقدة إلى خطوات أصغر عند توجيه الذكاء الاصطناعي بدلاً من طلب كل شيء دفعة واحدة.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 119, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 119);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 120, 'results_working_practice', 'snapshot',
    'I save and reuse prompts that worked well, so I''m not starting from scratch each time.',
    'أحفظ وأعيد استخدام التعليمات التي نجحت سابقاً، حتى لا أبدأ من الصفر في كل مرة.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 120, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 120);

  -- ─── PEOPLE — AI Collaboration (q121-q122) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 121, 'people_collaboration', 'snapshot',
    'When a colleague is stuck on an AI tool, I take time to walk them through what works.',
    'عندما يواجه زميل صعوبة في أداة ذكاء اصطناعي، أخصص وقتاً لإرشاده إلى ما يعمل بشكل جيد.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 121, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 121);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 122, 'people_collaboration', 'snapshot',
    'I credit AI''s contribution honestly when sharing AI-assisted work with my team or clients.',
    'أعزو مساهمة الذكاء الاصطناعي بصدق عند مشاركة عمل بمساعدته مع فريقي أو عملائي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 122, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 122);

  -- ─── SELF — AI Adaptive Mindset (q123-q124) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 123, 'self_adaptive_mindset', 'snapshot',
    'I treat the speed of AI change as an opportunity, not a threat to my career.',
    'أعتبر سرعة تطور الذكاء الاصطناعي فرصة، لا تهديداً لمسيرتي المهنية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 123, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 123);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 124, 'self_adaptive_mindset', 'snapshot',
    'I am honest with myself about which parts of my role AI does better than I do.',
    'أكون صادقاً مع نفسي بشأن أجزاء عملي التي يؤديها الذكاء الاصطناعي بشكل أفضل مني.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 124, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 124);

  -- ════════════════════════════════════════════════════════════
  -- 24 DEEP-DIVE-EXTRA ITEMS — 6 per factor — bring deep-dive to 12 items/factor
  -- ════════════════════════════════════════════════════════════

  -- ─── THINKING — AI Sense-Check deep-dive (q125-q130) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 125, 'thinking_sense_check', 'deep_dive_extra',
    'I have rejected or significantly altered AI-generated content because it didn''t meet professional standards.',
    'لقد رفضت أو غيّرت بشكل كبير محتوى ينتجه الذكاء الاصطناعي لأنه لم يستوفِ المعايير المهنية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 125, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 125);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 126, 'thinking_sense_check', 'deep_dive_extra',
    'I can explain in plain language why a particular AI output might be biased or flawed.',
    'أستطيع أن أشرح بلغة بسيطة لماذا قد يكون مخرج معين للذكاء الاصطناعي متحيزاً أو معيباً.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 126, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 126);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 127, 'thinking_sense_check', 'deep_dive_extra',
    'I check AI-generated source citations against the actual sources before relying on them.',
    'أتحقق من المراجع التي يستشهد بها الذكاء الاصطناعي مقابل المصادر الفعلية قبل الاعتماد عليها.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 127, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 127);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 128, 'thinking_sense_check', 'deep_dive_extra',
    'I distinguish between tasks where AI is reliably accurate and tasks where it is not.',
    'أميز بين المهام التي يكون الذكاء الاصطناعي فيها دقيقاً بشكل موثوق والمهام التي لا يكون كذلك.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 128, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 128);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 129, 'thinking_sense_check', 'deep_dive_extra',
    'When AI gives a confident answer outside its training data, I recognise the risk.',
    'عندما يقدم الذكاء الاصطناعي إجابة واثقة خارج نطاق بياناته التدريبية، أدرك المخاطر.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 129, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 129);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 130, 'thinking_sense_check', 'deep_dive_extra',
    'I keep a mental list of common AI failure modes (hallucinations, outdated info, biased training) that I check against.',
    'أحتفظ بقائمة ذهنية بأنماط فشل الذكاء الاصطناعي الشائعة (الهلوسة، المعلومات القديمة، التدريب المتحيز) أتحقق منها.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 130, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 130);

  -- ─── RESULTS — AI Working Practice deep-dive (q131-q136) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 131, 'results_working_practice', 'deep_dive_extra',
    'I use AI to draft, then refine, rather than expecting perfect output on the first try.',
    'أستخدم الذكاء الاصطناعي للصياغة الأولية ثم التحسين، بدلاً من توقع مخرج مثالي من المحاولة الأولى.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 131, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 131);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 132, 'results_working_practice', 'deep_dive_extra',
    'I have measurable evidence (time saved, errors reduced) that my AI use improves work outcomes.',
    'لديّ دليل قابل للقياس (وقت موفّر، أخطاء أقل) على أن استخدامي للذكاء الاصطناعي يحسن نتائج العمل.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 132, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 132);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 133, 'results_working_practice', 'deep_dive_extra',
    'I combine multiple AI tools when one tool isn''t sufficient for the task.',
    'أدمج عدة أدوات للذكاء الاصطناعي عندما لا تكفي أداة واحدة للمهمة.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 133, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 133);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 134, 'results_working_practice', 'deep_dive_extra',
    'I provide AI with the context, role, and format it needs rather than vague prompts.',
    'أوفر للذكاء الاصطناعي السياق والدور والصيغة التي يحتاجها بدلاً من تعليمات مبهمة.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 134, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 134);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 135, 'results_working_practice', 'deep_dive_extra',
    'I have built or customised an AI workflow that fits my specific job.',
    'لقد بنيت أو خصصت سير عمل بالذكاء الاصطناعي يناسب وظيفتي تحديداً.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 135, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 135);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 136, 'results_working_practice', 'deep_dive_extra',
    'I know when to abandon an AI approach and revert to traditional methods.',
    'أعرف متى أتخلى عن نهج الذكاء الاصطناعي وأعود إلى الأساليب التقليدية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 136, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 136);

  -- ─── PEOPLE — AI Collaboration deep-dive (q137-q142) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 137, 'people_collaboration', 'deep_dive_extra',
    'I have led at least one team conversation about how AI changes our work.',
    'لقد قدت محادثة واحدة على الأقل في الفريق حول كيف يغيّر الذكاء الاصطناعي عملنا.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 137, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 137);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 138, 'people_collaboration', 'deep_dive_extra',
    'I help colleagues set realistic expectations for what AI can deliver in their tasks.',
    'أساعد الزملاء على وضع توقعات واقعية لما يمكن أن يقدمه الذكاء الاصطناعي في مهامهم.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 138, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 138);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 139, 'people_collaboration', 'deep_dive_extra',
    'I challenge colleagues respectfully when their AI use risks accuracy, ethics, or compliance.',
    'أعترض باحترام على استخدام الزملاء للذكاء الاصطناعي عندما يهدد الدقة أو الأخلاق أو الامتثال.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 139, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 139);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 140, 'people_collaboration', 'deep_dive_extra',
    'I share my AI failures and lessons-learned, not just my AI successes.',
    'أشارك إخفاقاتي والدروس المستفادة من الذكاء الاصطناعي، وليس نجاحاتي فقط.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 140, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 140);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 141, 'people_collaboration', 'deep_dive_extra',
    'I help newer team members build their AI skills through coaching or pairing.',
    'أساعد أعضاء الفريق الجدد على بناء مهاراتهم في الذكاء الاصطناعي من خلال التوجيه أو العمل المشترك.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 141, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 141);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 142, 'people_collaboration', 'deep_dive_extra',
    'I bridge between technical and non-technical colleagues when discussing AI.',
    'أكون جسراً بين الزملاء التقنيين وغير التقنيين عند مناقشة الذكاء الاصطناعي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 142, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 142);

  -- ─── SELF — AI Adaptive Mindset deep-dive (q143-q148) ───
  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 143, 'self_adaptive_mindset', 'deep_dive_extra',
    'I have changed my workflow significantly in the last 12 months because of AI.',
    'لقد غيرت سير عملي بشكل كبير في الأشهر الـ 12 الماضية بسبب الذكاء الاصطناعي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 143, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 143);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 144, 'self_adaptive_mindset', 'deep_dive_extra',
    'I read or follow at least one credible source on AI developments regularly.',
    'أقرأ أو أتابع بانتظام مصدراً موثوقاً واحداً على الأقل لتطورات الذكاء الاصطناعي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 144, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 144);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 145, 'self_adaptive_mindset', 'deep_dive_extra',
    'I stay aware of which of my skills are becoming less differentiating because of AI.',
    'أبقى على دراية بأي من مهاراتي تصبح أقل تميزاً بسبب الذكاء الاصطناعي.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 145, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 145);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 146, 'self_adaptive_mindset', 'deep_dive_extra',
    'I invest in deepening uniquely-human skills (judgment, empathy, ethics) that AI doesn''t replace.',
    'أستثمر في تعميق المهارات البشرية الفريدة (الحكم، التعاطف، الأخلاق) التي لا يحلّ الذكاء الاصطناعي محلها.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 146, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 146);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 147, 'self_adaptive_mindset', 'deep_dive_extra',
    'I refuse to use AI in situations where my organisation''s policy or industry rules forbid it.',
    'أرفض استخدام الذكاء الاصطناعي في الحالات التي تحظرها سياسة منظمتي أو قواعد القطاع.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 147, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 147);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, tier, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'talent', 148, 'self_adaptive_mindset', 'deep_dive_extra',
    'I share AI use disclosures with stakeholders when professional norms require it.',
    'أشارك إفصاحات استخدام الذكاء الاصطناعي مع أصحاب المصلحة عندما تتطلب ذلك الأعراف المهنية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 1, 148, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 148);

END $$;
