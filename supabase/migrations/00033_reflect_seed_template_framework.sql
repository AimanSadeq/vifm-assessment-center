-- ============================================================
-- VIFM Reflect 360 - Seed: "VIFM Leadership Essentials" template
-- Migration 00033
--
-- Library template framework that consultants can clone when a
-- client does not bring its own competency model. Five core
-- leadership competencies, four behaviours each = 20 items.
-- All bilingual EN + AR (Arabic translations to be reviewed
-- by VIFM's linguistic lead before any live engagement uses
-- this template as-is).
-- ============================================================

DO $$
DECLARE
  v_framework_id uuid;
  v_competency_id uuid;
BEGIN
  -- ────────────────────────────────────────────────────────────
  -- Framework
  -- ────────────────────────────────────────────────────────────
  INSERT INTO reflect_frameworks (
    engagement_id, name_en, name_ar, description_en, description_ar,
    source, is_template, is_active, approved_at
  ) VALUES (
    NULL,
    'VIFM Leadership Essentials',
    'أساسيات القيادة من VIFM',
    'A five-competency starter framework for general 360° leadership feedback engagements. Consultants typically clone this and tailor it to the client''s own values and competency model.',
    'إطار أساسي مكوّن من خمس كفايات للاستخدام كنقطة انطلاق في برامج التغذية الراجعة 360° القيادية. يقوم المستشارون عادةً باستنساخ هذا الإطار ومواءمته مع قيم العميل ونموذج كفاياته الخاصة.',
    'template',
    true,
    true,
    now()
  )
  RETURNING id INTO v_framework_id;

  -- ────────────────────────────────────────────────────────────
  -- Competency 1: Strategic Thinking
  -- ────────────────────────────────────────────────────────────
  INSERT INTO reflect_competencies (framework_id, name_en, name_ar, description_en, description_ar, display_order)
  VALUES (
    v_framework_id,
    'Strategic Thinking',
    'التفكير الاستراتيجي',
    'Sees the bigger picture, anticipates change, and connects today''s actions to long-term outcomes.',
    'يرى الصورة الأشمل، ويستبق التغيير، ويربط بين القرارات الحالية والنتائج بعيدة المدى.',
    1
  )
  RETURNING id INTO v_competency_id;

  INSERT INTO reflect_behaviors (competency_id, level_tier, text_en, text_ar, source, display_order) VALUES
    (v_competency_id, 'all', 'Translates organisational priorities into clear team objectives.', 'يترجم الأولويات المؤسسية إلى أهداف واضحة للفريق.', 'manual', 1),
    (v_competency_id, 'all', 'Anticipates external trends and adjusts plans before they become urgent.', 'يتوقع التوجهات الخارجية ويعدّل الخطط قبل أن تصبح ملحّة.', 'manual', 2),
    (v_competency_id, 'all', 'Makes trade-offs between short-term wins and long-term value.', 'يوازن بين المكاسب قصيرة المدى والقيمة بعيدة المدى.', 'manual', 3),
    (v_competency_id, 'all', 'Connects own team''s work to the wider organisational strategy.', 'يربط بين عمل الفريق والاستراتيجية المؤسسية الأشمل.', 'manual', 4);

  -- ────────────────────────────────────────────────────────────
  -- Competency 2: Drive for Results
  -- ────────────────────────────────────────────────────────────
  INSERT INTO reflect_competencies (framework_id, name_en, name_ar, description_en, description_ar, display_order)
  VALUES (
    v_framework_id,
    'Drive for Results',
    'الدافع لتحقيق النتائج',
    'Sets ambitious goals, holds self and others accountable, and turns plans into measurable outcomes.',
    'يضع أهدافاً طموحة، ويُسائل نفسه والآخرين، ويحوّل الخطط إلى نتائج قابلة للقياس.',
    2
  )
  RETURNING id INTO v_competency_id;

  INSERT INTO reflect_behaviors (competency_id, level_tier, text_en, text_ar, source, display_order) VALUES
    (v_competency_id, 'all', 'Sets clear, measurable goals with defined milestones.', 'يضع أهدافاً واضحة وقابلة للقياس مع محطات مرحلية محددة.', 'manual', 1),
    (v_competency_id, 'all', 'Holds others accountable for commitments and follows through on their own.', 'يُسائل الآخرين عن التزاماتهم ويلتزم هو شخصياً بما يتعهد به.', 'manual', 2),
    (v_competency_id, 'all', 'Removes blockers quickly so the team can keep moving.', 'يزيل المعوقات بسرعة كي يستطيع الفريق مواصلة التقدم.', 'manual', 3),
    (v_competency_id, 'all', 'Prioritises ruthlessly when capacity is tight.', 'يُحدد الأولويات بحزم عند ضيق الموارد.', 'manual', 4);

  -- ────────────────────────────────────────────────────────────
  -- Competency 3: People Leadership
  -- ────────────────────────────────────────────────────────────
  INSERT INTO reflect_competencies (framework_id, name_en, name_ar, description_en, description_ar, display_order)
  VALUES (
    v_framework_id,
    'People Leadership',
    'قيادة الأفراد',
    'Develops, motivates, and trusts the team to deliver — and creates an environment where people grow.',
    'يطوّر الفريق ويُحفّزه ويمنحه الثقة لتحقيق الأهداف، ويُهيئ بيئة عمل تنمو فيها الكفاءات.',
    3
  )
  RETURNING id INTO v_competency_id;

  INSERT INTO reflect_behaviors (competency_id, level_tier, text_en, text_ar, source, display_order) VALUES
    (v_competency_id, 'all', 'Gives timely, specific, and balanced feedback.', 'يقدم تغذية راجعة في الوقت المناسب ومحددة ومتوازنة.', 'manual', 1),
    (v_competency_id, 'all', 'Coaches team members to grow in their role.', 'يدرّب أعضاء الفريق على التطور في أدوارهم.', 'manual', 2),
    (v_competency_id, 'all', 'Delegates meaningful work, not just tasks.', 'يُفوّض أعمالاً ذات معنى، لا مجرد مهام تنفيذية.', 'manual', 3),
    (v_competency_id, 'all', 'Recognises contribution publicly and addresses underperformance privately.', 'يُكافئ الإسهام علناً ويعالج ضعف الأداء على انفراد.', 'manual', 4);

  -- ────────────────────────────────────────────────────────────
  -- Competency 4: Communication & Influence
  -- ────────────────────────────────────────────────────────────
  INSERT INTO reflect_competencies (framework_id, name_en, name_ar, description_en, description_ar, display_order)
  VALUES (
    v_framework_id,
    'Communication & Influence',
    'التواصل والتأثير',
    'Communicates clearly to any audience and influences decisions through credibility, not authority.',
    'يتواصل بوضوح مع أي جمهور ويؤثر في القرارات من خلال المصداقية لا من خلال السلطة.',
    4
  )
  RETURNING id INTO v_competency_id;

  INSERT INTO reflect_behaviors (competency_id, level_tier, text_en, text_ar, source, display_order) VALUES
    (v_competency_id, 'all', 'Tailors message and level of detail to the audience.', 'يُكيّف الرسالة ومستوى التفصيل حسب الجمهور.', 'manual', 1),
    (v_competency_id, 'all', 'Listens to understand before responding.', 'ينصت ليفهم قبل أن يردّ.', 'manual', 2),
    (v_competency_id, 'all', 'Builds support for ideas across teams, including with people who disagree.', 'يبني الدعم لأفكاره عبر الفرق، حتى مع من يخالفونه الرأي.', 'manual', 3),
    (v_competency_id, 'all', 'Disagrees respectfully and commits once a decision is made.', 'يعترض باحترام، ثم يلتزم بالقرار حين يُتخذ.', 'manual', 4);

  -- ────────────────────────────────────────────────────────────
  -- Competency 5: Adaptability & Learning
  -- ────────────────────────────────────────────────────────────
  INSERT INTO reflect_competencies (framework_id, name_en, name_ar, description_en, description_ar, display_order)
  VALUES (
    v_framework_id,
    'Adaptability & Learning',
    'المرونة والتعلّم',
    'Stays effective through change, learns from setbacks, and remains open to new ways of working.',
    'يحافظ على فعاليّته في ظل التغيير، ويتعلّم من النكسات، ويبقى منفتحاً على أساليب عمل جديدة.',
    5
  )
  RETURNING id INTO v_competency_id;

  INSERT INTO reflect_behaviors (competency_id, level_tier, text_en, text_ar, source, display_order) VALUES
    (v_competency_id, 'all', 'Adjusts approach when circumstances change, without losing focus on the goal.', 'يُعدّل أسلوبه عند تغيّر الظروف دون أن يفقد التركيز على الهدف.', 'manual', 1),
    (v_competency_id, 'all', 'Seeks feedback proactively and acts on it.', 'يطلب التغذية الراجعة بمبادرة منه ويعمل بمقتضاها.', 'manual', 2),
    (v_competency_id, 'all', 'Treats mistakes as learning opportunities for the team.', 'يتعامل مع الأخطاء كفرص تعلّم للفريق.', 'manual', 3),
    (v_competency_id, 'all', 'Stays composed and constructive under pressure.', 'يحافظ على هدوئه وروحه البنّاءة تحت الضغط.', 'manual', 4);
END
$$;
