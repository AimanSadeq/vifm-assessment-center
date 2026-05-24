-- ============================================================
-- VIFM ARA — Agentic-AI Readiness tier
-- Migration 00041
--
-- Adds an "agentic" dimension to the ARC question bank: readiness to
-- DELEGATE work to autonomous AI agents (governance, human oversight,
-- failure/risk, access control, autonomy calibration, auditability) —
-- distinct from the existing pillars, which measure readiness to USE AI.
--
-- Discriminator mirrors the individual-factor pattern (migration 00025):
-- a nullable `agentic_dimension_id` column identifies agentic items, so
-- org-pillar and individual-factor questions are untouched. An assessment
-- opts in via `include_agentic_layer`. The 18 items below live on the
-- active v1.1 bank so existing assessments inherit them when opted in.
--
-- Non-breaking: one new column on ara_questions, one on ara_assessments,
-- plus seed rows. Idempotent throughout.
-- ============================================================

-- ─── 1. ara_questions.agentic_dimension_id ──────────────────────
ALTER TABLE ara_questions
  ADD COLUMN IF NOT EXISTS agentic_dimension_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ara_questions_agentic_dim_check'
  ) THEN
    ALTER TABLE ara_questions
      ADD CONSTRAINT ara_questions_agentic_dim_check
      CHECK (agentic_dimension_id IS NULL OR agentic_dimension_id IN (
        'agent_governance',
        'human_oversight',
        'risk_failure',
        'access_control',
        'autonomy_calibration',
        'auditability'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ara_questions_agentic
  ON ara_questions(agentic_dimension_id)
  WHERE agentic_dimension_id IS NOT NULL;

-- ─── 2. ara_assessments.include_agentic_layer ───────────────────
ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS include_agentic_layer boolean NOT NULL DEFAULT false;

-- ─── 3. Seed 18 agentic items (3 per dimension) on v1.1 ─────────
-- Org-level framing ("our organisation"). 5-point Likert, higher =
-- more mature. pillar_id is set to the closest existing pillar for
-- compatibility, but agentic items are filtered by agentic_dimension_id,
-- so they never pollute the 8-pillar scoring unless the agentic layer is on.
-- Question numbers 201-218 sit above the individual range (101-116).
DO $$
DECLARE
  v_id uuid;
  opts_en jsonb := '["1 - Strongly Disagree","2 - Disagree","3 - Neutral","4 - Agree","5 - Strongly Agree"]'::jsonb;
  opts_ar jsonb := '["١ - أعارض بشدة","٢ - أعارض","٣ - محايد","٤ - أوافق","٥ - أوافق بشدة"]'::jsonb;
  scoremap jsonb := '{"1 - Strongly Disagree":1,"2 - Disagree":2,"3 - Neutral":3,"4 - Agree":4,"5 - Strongly Agree":5}'::jsonb;
BEGIN
  SELECT id INTO v_id FROM ara_question_bank_versions WHERE version_number = '1.1';
  IF v_id IS NULL THEN
    RAISE NOTICE 'v1.1 question bank not found; skipping agentic seed';
    RETURN;
  END IF;

  -- helper insert via a temp procedure-like pattern is overkill; inline
  -- INSERT ... SELECT ... WHERE NOT EXISTS keeps each row idempotent.

  -- ── Agent governance & accountability ──
  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 201, 'agent_governance',
    'Our organisation has a clear policy defining who is accountable when an autonomous AI agent takes an action on our behalf.',
    'لدى مؤسستنا سياسة واضحة تحدد الجهة المسؤولة عندما يتخذ وكيل ذكاء اصطناعي مستقل إجراءً نيابةً عنا.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 201, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 201);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 202, 'agent_governance',
    'Ownership for each deployed AI agent — who approves it and who can pause it — is formally assigned, not implicit.',
    'تُسنَد ملكية كل وكيل ذكاء اصطناعي مُشغَّل رسمياً — من يعتمده ومن يستطيع إيقافه — وليست ضمنية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 202, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 202);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 203, 'agent_governance',
    'We have a defined approval process a new agentic AI use case must pass before it goes live.',
    'لدينا عملية اعتماد محددة يجب أن تجتازها أي حالة استخدام جديدة للذكاء الاصطناعي الوكيلي قبل تشغيلها.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 203, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 203);

  -- ── Human-in-the-loop & oversight ──
  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 204, 'human_oversight',
    'For high-impact decisions, our AI agents require explicit human approval before acting.',
    'بالنسبة للقرارات عالية الأثر، تتطلب وكلاء الذكاء الاصطناعي لدينا موافقة بشرية صريحة قبل التنفيذ.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 204, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 204);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 205, 'human_oversight',
    'Staff working alongside AI agents know exactly which actions they must review and which the agent may take alone.',
    'يعرف الموظفون الذين يعملون مع وكلاء الذكاء الاصطناعي بدقة أي الإجراءات يجب أن يراجعوها وأيها يمكن للوكيل تنفيذها وحده.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 205, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 205);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 206, 'human_oversight',
    'We can interrupt or override an AI agent''s action while it is in progress.',
    'نستطيع مقاطعة إجراء وكيل الذكاء الاصطناعي أو تجاوزه أثناء تنفيذه.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 206, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 206);

  -- ── Failure-mode & risk awareness ──
  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'model_management', 207, 'risk_failure',
    'We have assessed the realistic failure modes of our AI agents (wrong action, bad data, manipulation) before deployment.',
    'قيّمنا أنماط الفشل الواقعية لوكلاء الذكاء الاصطناعي لدينا (إجراء خاطئ، بيانات سيئة، تلاعب) قبل التشغيل.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 207, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'model_management' AND question_number = 207);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'model_management', 208, 'risk_failure',
    'There is a documented fallback plan for when an AI agent behaves unexpectedly or fails.',
    'توجد خطة بديلة موثّقة لما يحدث عندما يتصرف وكيل الذكاء الاصطناعي بشكل غير متوقع أو يفشل.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 208, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'model_management' AND question_number = 208);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'model_management', 209, 'risk_failure',
    'We test agentic AI against adversarial and edge-case scenarios, not just the expected path.',
    'نختبر الذكاء الاصطناعي الوكيلي في مواجهة سيناريوهات عدائية وحالات حدّية، وليس المسار المتوقع فحسب.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 209, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'model_management' AND question_number = 209);

  -- ── Tool & data access control ──
  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 210, 'access_control',
    'Each AI agent''s access to systems, tools and data is scoped to the minimum it needs (least privilege).',
    'يُقيَّد وصول كل وكيل ذكاء اصطناعي إلى الأنظمة والأدوات والبيانات إلى الحد الأدنى اللازم (مبدأ الامتياز الأدنى).',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 210, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 210);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 211, 'access_control',
    'We control and log which external tools and APIs an AI agent is permitted to call.',
    'نتحكم في الأدوات وواجهات البرمجة الخارجية التي يُسمح لوكيل الذكاء الاصطناعي باستدعائها ونسجّلها.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 211, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 211);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 212, 'access_control',
    'Sensitive data an AI agent can reach is governed by the same controls we apply to human staff.',
    'تخضع البيانات الحساسة التي يمكن لوكيل الذكاء الاصطناعي الوصول إليها لنفس الضوابط التي نطبقها على الموظفين.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 212, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 212);

  -- ── Autonomy calibration by task risk ──
  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'model_management', 213, 'autonomy_calibration',
    'The level of autonomy we grant an AI agent is matched to the risk of the task it performs.',
    'يتناسب مستوى الاستقلالية الذي نمنحه لوكيل الذكاء الاصطناعي مع مخاطر المهمة التي يؤديها.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 213, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'model_management' AND question_number = 213);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'model_management', 214, 'autonomy_calibration',
    'Low-risk repetitive tasks are delegated to agents while high-risk decisions stay with people — by deliberate design.',
    'تُفوَّض المهام المتكررة منخفضة المخاطر إلى الوكلاء بينما تبقى القرارات عالية المخاطر بيد البشر — بتصميم متعمَّد.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 214, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'model_management' AND question_number = 214);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'model_management', 215, 'autonomy_calibration',
    'We revisit and adjust how much autonomy each agent has based on its track record.',
    'نراجع ونعدّل مقدار الاستقلالية الممنوحة لكل وكيل بناءً على سجل أدائه.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 215, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'model_management' AND question_number = 215);

  -- ── Auditability & traceability ──
  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 216, 'auditability',
    'Every consequential action an AI agent takes is logged in a way we can reconstruct later.',
    'يُسجَّل كل إجراء مؤثّر يتخذه وكيل الذكاء الاصطناعي بطريقة تتيح لنا إعادة تتبّعه لاحقاً.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 216, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 216);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'governance', 217, 'auditability',
    'We can produce an audit trail of an AI agent''s decisions for a regulator or internal review.',
    'نستطيع إنتاج مسار تدقيق لقرارات وكيل الذكاء الاصطناعي لجهة تنظيمية أو لمراجعة داخلية.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 217, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'governance' AND question_number = 217);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, agentic_dimension_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, is_active)
  SELECT v_id, 'model_management', 218, 'auditability',
    'Our monitoring would detect if an AI agent started operating outside its intended scope.',
    'ستكتشف أنظمة المراقبة لدينا إذا بدأ وكيل الذكاء الاصطناعي بالعمل خارج نطاقه المقصود.',
    'rating', opts_en, opts_ar, scoremap, 'both', 'all', 2, 218, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'model_management' AND question_number = 218);

  RAISE NOTICE 'Agentic-AI Readiness tier seeded (18 items) on bank v1.1';
END $$;
