-- ════════════════════════════════════════════════════════════════
-- 00117 - Stand up the "2.6 Learning & Development" technical function
--
-- The HR domain's L&D function (technical_functions key='learning_development',
-- node_id='2.6', domain_key='hr') already exists from 00060/00077 but is
-- node_status='inactive' with zero pillars and zero skill blocks. This seed
-- makes it LIVE, mirroring the FP&A 1.7 worked example (00077:237-260):
--   (a) refresh the function blueprint - skills_en/_ar (these DRIVE the
--       session-level MCQ knowledge generator, migration 00085 + combined.ts,
--       which carries the instructional-design JUDGMENT content), descriptor,
--       and JD-matcher keywords;
--   (b) insert 3 report-only pillars + 4 banded logic_input skill blocks for
--       the genuinely QUANTITATIVE L&D-operations tasks (course-build
--       estimation, training-needs-gap math, training ROI, LMS completion);
--   (c) flip node_status='active' so it is selectable in /admin/tech-sandbox.
--
-- Delivery shape (set at voucher time, not here): generate the L&D voucher
-- batch with a HIGH mcq_pct (recommend ~65) so the knowledge section carries
-- most of the score and the four logic_input blocks anchor the quantitative
-- competence. The MCQ items are AI-generated from skills_en at sitting time
-- (indicative bands; a verifiable credential needs SME-approved bank items).
--
-- ⚠️ SME VALIDATION REQUIRED before the delegate run: every master_solution
-- value + checkpoint `expected` below was hand-computed and is self-consistent
-- (shown in comments), but Ahmad/SME must confirm the scenarios + arithmetic
-- match the competence VIFM wants to certify. A wrong expected number silently
-- mis-scores every delegate.
--
-- Idempotent: re-runnable (DELETE pillars cascades to blocks before re-insert).
-- Arabic is best-effort MSA pending human review (project convention).
-- ════════════════════════════════════════════════════════════════

-- (a) Refresh the function blueprint. skills_en feeds the MCQ knowledge generator.
UPDATE technical_functions SET
  node_status = 'active',
  skills_en = ARRAY[
    'Instructional Design (ADDIE/SAM)',
    'Learning Objectives (Bloom Taxonomy)',
    'Adult Learning Principles (Andragogy)',
    'Training Needs Analysis',
    'Competency-Gap Analysis',
    'Curriculum and Program Design',
    'Learning Modality Selection (ILT/VILT/e-learning)',
    'Learning Operations and LMS Administration',
    'Training Evaluation (Kirkpatrick)',
    'Training ROI (Phillips)'
  ],
  skills_ar = ARRAY[
    'التصميم التعليمي (ADDIE/SAM)',
    'أهداف التعلم (تصنيف بلوم)',
    'مبادئ تعلم الكبار (الأندراغوجيا)',
    'تحليل الاحتياجات التدريبية',
    'تحليل فجوة الجدارات',
    'تصميم المناهج والبرامج',
    'اختيار نمط التعلم (حضوري/افتراضي/إلكتروني)',
    'عمليات التعلم وإدارة نظام إدارة التعلم',
    'تقييم التدريب (كيركباتريك)',
    'العائد على الاستثمار التدريبي (فيليبس)'
  ],
  descriptor_en = 'Learning & Development Operations & Instructional Design: needs analysis, ADDIE/SAM instructional design, program design and delivery, learning operations, and training evaluation/ROI.',
  descriptor_ar = 'عمليات التعلم والتطوير والتصميم التعليمي: تحليل الاحتياجات، والتصميم التعليمي وفق ADDIE/SAM، وتصميم البرامج وتقديمها، وعمليات التعلم، وتقييم التدريب وعائده.',
  keywords = ARRAY['learning and development','l&d','instructional design','addie','sam','training needs analysis','tna','bloom','andragogy','curriculum design','kirkpatrick','training roi','phillips roi','lms','learning operations','competency framework','e-learning','vilt']
WHERE key = 'learning_development';

-- (b) + (c) Pillars + banded logic_input skill blocks + activation.
DO $$
DECLARE fn uuid; p1 uuid; p2 uuid; p3 uuid;
BEGIN
  SELECT id INTO fn FROM technical_functions WHERE key='learning_development';
  IF fn IS NULL THEN RAISE NOTICE 'learning_development function not found; skipping L&D seed'; RETURN; END IF;

  -- Re-runnable: clear prior pillars (cascades to skill blocks).
  DELETE FROM technical_pillars WHERE function_id = fn;

  INSERT INTO technical_pillars (function_id,name_en,name_ar,sort_order)
    VALUES (fn,'Instructional Design & Learning Architecture','التصميم التعليمي وبنية التعلم',1) RETURNING id INTO p1;
  INSERT INTO technical_pillars (function_id,name_en,name_ar,sort_order)
    VALUES (fn,'Training Needs Analysis & Program Design','تحليل الاحتياجات التدريبية وتصميم البرامج',2) RETURNING id INTO p2;
  INSERT INTO technical_pillars (function_id,name_en,name_ar,sort_order)
    VALUES (fn,'Learning Operations & Evaluation','عمليات التعلم والتقييم',3) RETURNING id INTO p3;

  -- ── Pillar 1: Course design & development estimation ──
  -- 5 finished e-learning hours x 200 dev-hrs/hr = 1000 dev hrs; /40 hrs/wk = 25 weeks;
  -- 8 objectives x 3 items = 24 assessment items.
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p1,'Course Design & Development Estimation','تقدير تصميم وتطوير الدورة',
      'Plan a new e-learning build: apply the stated development ratio and design rules to size effort, duration and assessment coverage.',
      'تخطيط بناء دورة إلكترونية جديدة: تطبيق نسبة التطوير وقواعد التصميم لتقدير الجهد والمدة وتغطية التقييم.',
      'ATD / ADDIE Instructional Design','logic_input',480,
      'Using the stated ratios, compute the total development hours, the development duration in weeks, and the total number of assessment items.',
      'باستخدام النسب المذكورة، احسب إجمالي ساعات التطوير، ومدة التطوير بالأسابيع، وإجمالي عدد عناصر التقييم.',
      '{"scenario": {"note_en": "You are scoping a new standard self-paced e-learning course. Development ratio: 200 development hours per 1 finished hour of e-learning. Designer capacity: 40 productive hours per week. Assessment rule: 3 assessment items per learning objective. The course has 5 finished hours of content and 8 learning objectives.", "note_ar": "تتولى تحديد نطاق دورة إلكترونية ذاتية جديدة. نسبة التطوير: 200 ساعة تطوير لكل ساعة محتوى نهائية. طاقة المصمم: 40 ساعة منتجة أسبوعيا. قاعدة التقييم: 3 عناصر لكل هدف تعلم. الدورة 5 ساعات محتوى نهائية و8 أهداف تعلم.", "finished_content_hours": 5, "dev_hours_per_finished_hour": 200, "designer_hours_per_week": 40, "learning_objectives": 8, "items_per_objective": 3}, "fields": [{"id": "total_dev_hours", "label_en": "Total development hours", "label_ar": "إجمالي ساعات التطوير", "type": "number"}, {"id": "dev_weeks", "label_en": "Development duration (weeks)", "label_ar": "مدة التطوير (أسابيع)", "type": "number"}, {"id": "total_items", "label_en": "Total assessment items", "label_ar": "إجمالي عناصر التقييم", "type": "number"}]}'::jsonb,
      '{"fields": {"total_dev_hours": 1000, "dev_weeks": 25, "total_items": 24}}'::jsonb,
      '[{"id": "dev_hours", "kind": "logic_value", "field": "total_dev_hours", "expected": 1000, "tolerance": 1, "weight": 2, "label_en": "Total development hours", "label_ar": "إجمالي ساعات التطوير"}, {"id": "dev_weeks", "kind": "logic_value", "field": "dev_weeks", "expected": 25, "tolerance": 0.1, "weight": 2, "label_en": "Development duration in weeks", "label_ar": "مدة التطوير بالأسابيع"}, {"id": "items", "kind": "logic_value", "field": "total_items", "expected": 24, "tolerance": 0.1, "weight": 1, "label_en": "Total assessment items", "label_ar": "إجمالي عناصر التقييم"}]'::jsonb,1);

  -- ── Pillar 2: Training needs analysis gap quantification ──
  -- Target 4. Below target: 3@2 + 5@3 = 8 staff. Gap-levels: 3x2 + 5x1 = 11. Hours: 11 x 10 = 110.
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p2,'Training Needs Analysis Gap Quantification','تحديد فجوة الاحتياجات التدريبية',
      'Quantify a cohort competency gap and the training volume required to close it to target.',
      'تحديد فجوة جدارة لمجموعة وحجم التدريب اللازم لإغلاقها حتى المستوى المستهدف.',
      'CIPD L&D Standards / Training Needs Analysis','logic_input',600,
      'For the 12-person cohort, compute the number of staff below target, the total gap-levels to close, and the total training hours required.',
      'لمجموعة من 12 موظفا، احسب عدد الموظفين دون المستوى المستهدف، وإجمالي مستويات الفجوة، وإجمالي ساعات التدريب اللازمة.',
      '{"scenario": {"note_en": "A team of 12 staff is assessed against a key competency on a 1-5 scale; the target level is 4. Current levels: 3 staff at level 2, 5 staff at level 3, and 4 staff at level 4. Plan 10 training hours per staff member for each level of gap below the target. Staff at or above target need no training.", "note_ar": "تم تقييم فريق من 12 موظفا على جدارة رئيسية بمقياس 1-5؛ المستوى المستهدف 4. المستويات الحالية: 3 موظفين عند المستوى 2، و5 عند المستوى 3، و4 عند المستوى 4. خطط 10 ساعات تدريب لكل موظف عن كل مستوى فجوة دون المستهدف. من بلغ المستهدف أو تجاوزه لا يحتاج تدريبا.", "cohort_size": 12, "target_level": 4, "staff_at_level_2": 3, "staff_at_level_3": 5, "staff_at_level_4": 4, "training_hours_per_gap_level": 10}, "fields": [{"id": "staff_below_target", "label_en": "Staff below target", "label_ar": "عدد الموظفين دون المستهدف", "type": "number"}, {"id": "total_gap_levels", "label_en": "Total gap-levels to close", "label_ar": "إجمالي مستويات الفجوة", "type": "number"}, {"id": "total_training_hours", "label_en": "Total training hours required", "label_ar": "إجمالي ساعات التدريب", "type": "number"}]}'::jsonb,
      '{"fields": {"staff_below_target": 8, "total_gap_levels": 11, "total_training_hours": 110}}'::jsonb,
      '[{"id": "below", "kind": "logic_value", "field": "staff_below_target", "expected": 8, "tolerance": 0.1, "weight": 1, "label_en": "Staff below target", "label_ar": "عدد الموظفين دون المستهدف"}, {"id": "gap_levels", "kind": "logic_value", "field": "total_gap_levels", "expected": 11, "tolerance": 0.1, "weight": 2, "label_en": "Total gap-levels", "label_ar": "إجمالي مستويات الفجوة"}, {"id": "hours", "kind": "logic_value", "field": "total_training_hours", "expected": 110, "tolerance": 0.5, "weight": 2, "label_en": "Total training hours", "label_ar": "إجمالي ساعات التدريب"}]'::jsonb,1);

  -- ── Pillar 3, block 1: Training ROI (Phillips) ──
  -- cost/learner = 80000/40 = 2000; net = 200000-80000 = 120000; ROI% = 120000/80000*100 = 150.
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p3,'Training ROI & Benefit Analysis','العائد على الاستثمار التدريبي وتحليل المنفعة',
      'Apply the Phillips ROI method to a programme: cost-per-learner, net monetary benefit, and ROI percentage.',
      'تطبيق منهجية فيليبس للعائد على برنامج: التكلفة لكل متعلم، وصافي المنفعة المالية، ونسبة العائد.',
      'Phillips ROI Methodology / Kirkpatrick Model','logic_input',480,
      'Compute the cost per learner, the net monetary benefit, and the training ROI percentage.',
      'احسب التكلفة لكل متعلم، وصافي المنفعة المالية، ونسبة العائد على الاستثمار التدريبي.',
      '{"scenario": {"note_en": "A leadership programme has a fully-loaded cost of USD 80,000 and is delivered to 40 learners. The monetary benefit attributed to the programme (productivity gains) is USD 200,000. ROI % = (net benefit / programme cost) x 100.", "note_ar": "برنامج قيادي بتكلفة محملة بالكامل قدرها 80,000 دولار ويقدم لـ40 متعلما. المنفعة المالية المنسوبة للبرنامج (مكاسب الإنتاجية) 200,000 دولار. نسبة العائد = (صافي المنفعة / تكلفة البرنامج) × 100.", "programme_cost": 80000, "learners": 40, "monetary_benefit": 200000}, "fields": [{"id": "cost_per_learner", "label_en": "Cost per learner (USD)", "label_ar": "التكلفة لكل متعلم (دولار)", "type": "number"}, {"id": "net_benefit", "label_en": "Net monetary benefit (USD)", "label_ar": "صافي المنفعة المالية (دولار)", "type": "number"}, {"id": "roi_pct", "label_en": "Training ROI (%)", "label_ar": "العائد على الاستثمار التدريبي (%)", "type": "number"}]}'::jsonb,
      '{"fields": {"cost_per_learner": 2000, "net_benefit": 120000, "roi_pct": 150}}'::jsonb,
      '[{"id": "cpl", "kind": "logic_value", "field": "cost_per_learner", "expected": 2000, "tolerance": 0.5, "weight": 1, "label_en": "Cost per learner", "label_ar": "التكلفة لكل متعلم"}, {"id": "net", "kind": "logic_value", "field": "net_benefit", "expected": 120000, "tolerance": 1, "weight": 2, "label_en": "Net monetary benefit", "label_ar": "صافي المنفعة المالية"}, {"id": "roi", "kind": "logic_value", "field": "roi_pct", "expected": 150, "tolerance": 0.5, "weight": 3, "label_en": "Training ROI %", "label_ar": "نسبة العائد التدريبي"}]'::jsonb,1);

  -- ── Pillar 3, block 2: LMS completion analytics ──
  -- completion% = 170/200*100 = 85; target completions = 0.95*200 = 190; shortfall = 190-170 = 20.
  INSERT INTO technical_skill_blocks
    (pillar_id,name_en,name_ar,description_en,description_ar,framework_ref,engine_type,time_limit_seconds,prompt_en,prompt_ar,engine_config,master_solution,checkpoints,sort_order)
    VALUES (p3,'LMS Completion & Compliance Analytics','تحليلات الإكمال والامتثال في نظام إدارة التعلم',
      'Read LMS completion data and compute the completion rate, the target completions, and the shortfall to a compliance target.',
      'قراءة بيانات الإكمال في نظام إدارة التعلم وحساب معدل الإكمال، والإكمالات المستهدفة، والعجز مقابل هدف الامتثال.',
      'ATD Learning Operations / LMS Analytics','logic_input',480,
      'Compute the completion rate (%), the number of completions required to hit the target rate, and the shortfall in employees vs that target.',
      'احسب معدل الإكمال (%)، وعدد الإكمالات المطلوبة لبلوغ المعدل المستهدف، والعجز بعدد الموظفين مقابل ذلك المستهدف.',
      '{"scenario": {"note_en": "A mandatory compliance course is assigned to 200 employees; 170 have completed it. The target completion rate is 95%.", "note_ar": "دورة امتثال إلزامية مسندة إلى 200 موظف؛ أكملها 170. معدل الإكمال المستهدف 95%.", "assigned": 200, "completed": 170, "target_completion_rate_pct": 95}, "fields": [{"id": "completion_pct", "label_en": "Completion rate (%)", "label_ar": "معدل الإكمال (%)", "type": "number"}, {"id": "target_completions", "label_en": "Completions required for target", "label_ar": "الإكمالات المطلوبة للمستهدف", "type": "number"}, {"id": "shortfall_vs_target", "label_en": "Shortfall vs target (employees)", "label_ar": "العجز مقابل المستهدف (موظفون)", "type": "number"}]}'::jsonb,
      '{"fields": {"completion_pct": 85, "target_completions": 190, "shortfall_vs_target": 20}}'::jsonb,
      '[{"id": "rate", "kind": "logic_value", "field": "completion_pct", "expected": 85, "tolerance": 0.5, "weight": 2, "label_en": "Completion rate %", "label_ar": "معدل الإكمال"}, {"id": "target", "kind": "logic_value", "field": "target_completions", "expected": 190, "tolerance": 0.5, "weight": 1, "label_en": "Completions required", "label_ar": "الإكمالات المطلوبة"}, {"id": "short", "kind": "logic_value", "field": "shortfall_vs_target", "expected": 20, "tolerance": 0.5, "weight": 2, "label_en": "Shortfall vs target", "label_ar": "العجز مقابل المستهدف"}]'::jsonb,2);
END $$;
