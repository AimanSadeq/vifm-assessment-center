-- ============================================================
-- VIFM ARC - graded individual-factor pilot seed
--
-- 12 performance-style items (3 per factor x 4 factors) for the
-- individual / personal AI-readiness layer: 2 situational_judgment
-- (scenario -> best action) + 1 knowledge_check (objective) per factor.
--
-- All live on the active v1.1 bank, layer 1, tier 'snapshot', tagged by
-- individual_factor_id (the respondent flow already filters by it).
-- pillar_id='talent' (the same convention as the 00026 individual items).
-- Question numbers 301-312 (above the individual 101-116 + agentic 201-218
-- ranges, so no collision).
--
-- Options are {value,label} objects (the respondent renderer expects this
-- shape); score_map is keyed by the option VALUE (a/b/c/d). Scoring is
-- server-side; the key is stripped before reaching the browser.
--
-- validation_evidence.review_status = 'ai_proposed' => NOT surfaced in the
-- client report until an SME verifies it (per the 00028 review workflow).
-- These are AI-drafted; review/adjust before go-live.
--
-- Idempotent - NOT EXISTS guards keyed on (version_id, pillar_id, question_number).
-- ============================================================

DO $$
DECLARE
  v_id uuid;
  ve_thinking jsonb := '{"anchor_instruments":[{"name":"AI Literacy (Long & Magerko)","citation":"Long, D., & Magerko, B. (2020). What is AI literacy? Competencies and design considerations. CHI 2020.","confidence":"construct_aligned","rationale":"Critical evaluation and verification of AI output is a core AI-literacy competency."}],"construct_summary":"Critical evaluation of AI output (AI literacy)","review_status":"ai_proposed","reviewed_by":null,"reviewed_at":null,"ai_model":"claude-opus (seed draft)"}'::jsonb;
  ve_results jsonb := '{"anchor_instruments":[{"name":"Technology Acceptance Model","citation":"Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user acceptance of information technology. MIS Quarterly, 13(3).","confidence":"construct_aligned","rationale":"Productive, habitual AI use reflects perceived usefulness and effective task-technology fit."}],"construct_summary":"Productive AI working practice (technology acceptance)","review_status":"ai_proposed","reviewed_by":null,"reviewed_at":null,"ai_model":"claude-opus (seed draft)"}'::jsonb;
  ve_people jsonb := '{"anchor_instruments":[{"name":"UTAUT2 / Communities of Practice","citation":"Venkatesh, V., Thong, J., & Xu, X. (2012). UTAUT2. MIS Quarterly, 36(1); Wenger, E. (1998). Communities of Practice.","confidence":"construct_aligned","rationale":"Helping a team adopt AI safely reflects social influence and shared-practice norms."}],"construct_summary":"Team AI collaboration and social influence","review_status":"ai_proposed","reviewed_by":null,"reviewed_at":null,"ai_model":"claude-opus (seed draft)"}'::jsonb;
  ve_self jsonb := '{"anchor_instruments":[{"name":"Technology Readiness Index 2.0 / Growth Mindset","citation":"Parasuraman, A., & Colby, C. (2015). Technology Readiness Index 2.0. Journal of Service Research, 18(1); Dweck, C. (2006). Mindset.","confidence":"construct_aligned","rationale":"Openness to relearning and a responsible, adaptive posture reflect technology readiness and growth mindset."}],"construct_summary":"Adaptive AI mindset (technology readiness, growth mindset)","review_status":"ai_proposed","reviewed_by":null,"reviewed_at":null,"ai_model":"claude-opus (seed draft)"}'::jsonb;
BEGIN
  SELECT id INTO v_id FROM ara_question_bank_versions WHERE version_number = '1.1';
  IF v_id IS NULL THEN
    RAISE NOTICE 'v1.1 question bank not found; skipping graded individual seed';
    RETURN;
  END IF;

  -- ─── THINKING - AI Sense-Check ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 301, 'thinking_sense_check',
    'An AI assistant gives you a confident, well-written market statistic for a board paper due in an hour. You have never seen the figure before. What is the best action?',
    'يقدم لك مساعد ذكاء اصطناعي إحصائية سوقية مكتوبة بثقة لورقة مجلس إدارة مستحقة خلال ساعة. لم ترَ هذا الرقم من قبل. ما الإجراء الأفضل؟',
    'situational_judgment',
    '[{"value":"a","label":"Use it as-is - the AI is usually reliable and the paper is due."},{"value":"b","label":"Verify the figure against an authoritative source; if you cannot confirm it, leave it out or flag it."},{"value":"c","label":"Keep it but label it (AI-generated, unverified)."},{"value":"d","label":"Ask the AI to confirm whether its own figure is correct."}]'::jsonb,
    '[{"value":"a","label":"استخدمه كما هو - الذكاء الاصطناعي موثوق عادةً والورقة مستحقة."},{"value":"b","label":"تحقق من الرقم مقابل مصدر موثوق؛ وإذا لم تستطع تأكيده فاحذفه أو ضع عليه علامة."},{"value":"c","label":"أبقِه لكن ضع عليه ملصق (مولّد بالذكاء الاصطناعي، غير مُتحقق منه)."},{"value":"d","label":"اطلب من الذكاء الاصطناعي تأكيد ما إذا كان رقمه صحيحاً."}]'::jsonb,
    '{"a":1,"b":5,"c":3,"d":2}'::jsonb, 'both', 'all', 1, 301, 'snapshot', ve_thinking, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 301);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 302, 'thinking_sense_check',
    'A colleague shares an AI-written legal summary and says the AI checked it so it is accurate. You notice a citation you do not recognise. Best response?',
    'يشارك زميل ملخصاً قانونياً كتبه الذكاء الاصطناعي ويقول إن الذكاء الاصطناعي راجعه فهو دقيق. تلاحظ استشهاداً لا تعرفه. ما الرد الأفضل؟',
    'situational_judgment',
    '[{"value":"a","label":"Trust it - the AI verified it."},{"value":"b","label":"Independently verify the unfamiliar citation against the primary source before it is relied on."},{"value":"c","label":"Flag your uncertainty to the colleague and suggest they double-check it."},{"value":"d","label":"Remove the summary entirely to be safe."}]'::jsonb,
    '[{"value":"a","label":"ثق به - الذكاء الاصطناعي تحقق منه."},{"value":"b","label":"تحقق بشكل مستقل من الاستشهاد غير المألوف مقابل المصدر الأصلي قبل الاعتماد عليه."},{"value":"c","label":"أبلغ الزميل بعدم تأكدك واقترح عليه التحقق مرة أخرى."},{"value":"d","label":"احذف الملخص بالكامل للأمان."}]'::jsonb,
    '{"a":1,"b":5,"c":3,"d":2}'::jsonb, 'both', 'all', 1, 302, 'snapshot', ve_thinking, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 302);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 303, 'thinking_sense_check',
    'Which of these is the clearest sign that an AI chatbot may be hallucinating?',
    'أي مما يلي هو أوضح علامة على أن روبوت الدردشة قد يختلق المعلومات (هلوسة)؟',
    'knowledge_check',
    '[{"value":"a","label":"It responds very quickly."},{"value":"b","label":"It gives a confident, specific citation or fact that cannot be found in any real source."},{"value":"c","label":"It says it is not sure, or asks a clarifying question."},{"value":"d","label":"It uses formal language."}]'::jsonb,
    '[{"value":"a","label":"يستجيب بسرعة كبيرة."},{"value":"b","label":"يقدم استشهاداً أو حقيقة محددة بثقة لا يمكن العثور عليها في أي مصدر حقيقي."},{"value":"c","label":"يقول إنه غير متأكد، أو يطرح سؤالاً توضيحياً."},{"value":"d","label":"يستخدم لغة رسمية."}]'::jsonb,
    '{"a":1,"b":5,"c":1,"d":1}'::jsonb, 'both', 'all', 1, 303, 'snapshot', ve_thinking, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 303);

  -- ─── RESULTS - AI Working Practice ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 304, 'results_working_practice',
    'A recurring monthly report takes you about three hours. You have access to an approved AI tool. What is the best approach?',
    'يستغرق منك تقرير شهري متكرر نحو ثلاث ساعات. لديك وصول إلى أداة ذكاء اصطناعي معتمدة. ما النهج الأفضل؟',
    'situational_judgment',
    '[{"value":"a","label":"Do it manually as always - AI output cannot be trusted."},{"value":"b","label":"Draft it with the AI from a clear prompt and your data, then review and correct before sending."},{"value":"c","label":"Paste the confidential raw data into a free public AI tool to save time."},{"value":"d","label":"Ask the AI to write it and send it without review."}]'::jsonb,
    '[{"value":"a","label":"أنجزه يدوياً كالعادة - لا يمكن الوثوق بمخرجات الذكاء الاصطناعي."},{"value":"b","label":"أنشئ مسودته بالذكاء الاصطناعي من تعليمات واضحة وبياناتك، ثم راجعه وصححه قبل الإرسال."},{"value":"c","label":"الصق البيانات السرية الخام في أداة ذكاء اصطناعي عامة مجانية لتوفير الوقت."},{"value":"d","label":"اطلب من الذكاء الاصطناعي كتابته وأرسله دون مراجعة."}]'::jsonb,
    '{"a":2,"b":5,"c":1,"d":1}'::jsonb, 'both', 'all', 1, 304, 'snapshot', ve_results, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 304);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 305, 'results_working_practice',
    'Your first AI prompt returns a generic, not-very-useful answer. What is the most effective next step?',
    'تعيد أول تعليمات للذكاء الاصطناعي إجابة عامة وغير مفيدة كثيراً. ما الخطوة التالية الأكثر فعالية؟',
    'situational_judgment',
    '[{"value":"a","label":"Give up and do the task manually."},{"value":"b","label":"Refine the prompt - add context, role, examples and the format you want - and iterate."},{"value":"c","label":"Copy the generic answer anyway."},{"value":"d","label":"Send the exact same prompt again unchanged."}]'::jsonb,
    '[{"value":"a","label":"استسلم وأنجز المهمة يدوياً."},{"value":"b","label":"حسّن التعليمات - أضف السياق والدور والأمثلة والصيغة المطلوبة - وكرّر المحاولة."},{"value":"c","label":"انسخ الإجابة العامة على أي حال."},{"value":"d","label":"أرسل نفس التعليمات مرة أخرى دون تغيير."}]'::jsonb,
    '{"a":2,"b":5,"c":1,"d":1}'::jsonb, 'both', 'all', 1, 305, 'snapshot', ve_results, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 305);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 306, 'results_working_practice',
    'Which prompt is most likely to produce a useful, on-target result?',
    'أي تعليمات هي الأرجح لإنتاج نتيجة مفيدة ودقيقة؟',
    'knowledge_check',
    '[{"value":"a","label":"Write about our sales."},{"value":"b","label":"You are a finance analyst. Summarise the attached Q3 sales data into three trend bullets for a CFO, with the percentage change for each."},{"value":"c","label":"Tell me everything you know about sales."},{"value":"d","label":"Sales report please."}]'::jsonb,
    '[{"value":"a","label":"اكتب عن مبيعاتنا."},{"value":"b","label":"أنت محلل مالي. لخّص بيانات مبيعات الربع الثالث المرفقة في ثلاث نقاط اتجاه لمدير مالي، مع نسبة التغير لكل منها."},{"value":"c","label":"أخبرني بكل ما تعرفه عن المبيعات."},{"value":"d","label":"تقرير مبيعات من فضلك."}]'::jsonb,
    '{"a":1,"b":5,"c":1,"d":1}'::jsonb, 'both', 'all', 1, 306, 'snapshot', ve_results, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 306);

  -- ─── PEOPLE - AI Collaboration ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 307, 'people_collaboration',
    'A teammate is pasting client personal data into a free public AI chatbot to work faster. What is the best response?',
    'يقوم أحد أعضاء الفريق بلصق بيانات شخصية للعملاء في روبوت دردشة عام مجاني للعمل بشكل أسرع. ما الرد الأفضل؟',
    'situational_judgment',
    '[{"value":"a","label":"Say nothing - it is their choice."},{"value":"b","label":"Privately explain the data-privacy risk and point them to the approved tool and policy."},{"value":"c","label":"Report them to HR immediately without speaking to them first."},{"value":"d","label":"Start doing the same so you keep up."}]'::jsonb,
    '[{"value":"a","label":"لا تقل شيئاً - إنه خياره."},{"value":"b","label":"اشرح له على انفراد خطر خصوصية البيانات ووجّهه إلى الأداة والسياسة المعتمدة."},{"value":"c","label":"أبلغ عنه الموارد البشرية فوراً دون التحدث إليه أولاً."},{"value":"d","label":"ابدأ بفعل الشيء نفسه حتى تواكبه."}]'::jsonb,
    '{"a":1,"b":5,"c":2,"d":1}'::jsonb, 'both', 'all', 1, 307, 'snapshot', ve_people, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 307);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 308, 'people_collaboration',
    'Your team is split: some are excited about AI, others fear it will replace them. As a colleague, what helps most?',
    'فريقك منقسم: بعضهم متحمس للذكاء الاصطناعي وآخرون يخشون أن يحل محلهم. كزميل، ما الأكثر فائدة؟',
    'situational_judgment',
    '[{"value":"a","label":"Tell the anxious ones they will be fine and move on."},{"value":"b","label":"Open a conversation about where AI helps versus where human judgment stays essential, with practical examples."},{"value":"c","label":"Avoid the topic to keep the peace."},{"value":"d","label":"Push everyone to adopt AI fast before they fall behind."}]'::jsonb,
    '[{"value":"a","label":"أخبر القلقين بأنهم سيكونون بخير وانتقل."},{"value":"b","label":"افتح حواراً حول أين يساعد الذكاء الاصطناعي وأين يبقى الحكم البشري أساسياً، مع أمثلة عملية."},{"value":"c","label":"تجنّب الموضوع للحفاظ على الهدوء."},{"value":"d","label":"ادفع الجميع لتبني الذكاء الاصطناعي بسرعة قبل أن يتخلفوا."}]'::jsonb,
    '{"a":2,"b":5,"c":1,"d":2}'::jsonb, 'both', 'all', 1, 308, 'snapshot', ve_people, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 308);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 309, 'people_collaboration',
    'What is the most responsible way to share an AI productivity tip with your team?',
    'ما الطريقة الأكثر مسؤولية لمشاركة نصيحة إنتاجية بالذكاء الاصطناعي مع فريقك؟',
    'knowledge_check',
    '[{"value":"a","label":"Share the prompt plus a note on its limits and when to double-check the output."},{"value":"b","label":"Share only the prompt and say it always works."},{"value":"c","label":"Keep it to yourself for an edge."},{"value":"d","label":"Share a screenshot of the answer with no context."}]'::jsonb,
    '[{"value":"a","label":"شارك التعليمات مع ملاحظة عن حدودها ومتى يجب التحقق من المخرجات."},{"value":"b","label":"شارك التعليمات فقط وقل إنها تعمل دائماً."},{"value":"c","label":"احتفظ بها لنفسك لتحقيق ميزة."},{"value":"d","label":"شارك لقطة شاشة للإجابة دون أي سياق."}]'::jsonb,
    '{"a":5,"b":1,"c":1,"d":1}'::jsonb, 'both', 'all', 1, 309, 'snapshot', ve_people, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 309);

  -- ─── SELF - AI Adaptive Mindset ───

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 310, 'self_adaptive_mindset',
    'Your organisation releases a new AI policy that changes how you may use tools you rely on. What is the best response?',
    'تصدر مؤسستك سياسة ذكاء اصطناعي جديدة تغيّر كيفية استخدامك للأدوات التي تعتمد عليها. ما الرد الأفضل؟',
    'situational_judgment',
    '[{"value":"a","label":"Ignore it and keep working as before."},{"value":"b","label":"Read it, adjust your workflow to comply, and ask questions where it is unclear."},{"value":"c","label":"Stop using AI entirely to avoid any risk."},{"value":"d","label":"Wait until someone enforces it."}]'::jsonb,
    '[{"value":"a","label":"تجاهلها واستمر في العمل كما كان."},{"value":"b","label":"اقرأها، وعدّل سير عملك للامتثال، واطرح أسئلة حيثما كان الأمر غير واضح."},{"value":"c","label":"توقف عن استخدام الذكاء الاصطناعي تماماً لتجنب أي مخاطرة."},{"value":"d","label":"انتظر حتى يفرضها أحدهم."}]'::jsonb,
    '{"a":1,"b":5,"c":2,"d":1}'::jsonb, 'both', 'all', 1, 310, 'snapshot', ve_self, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 310);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 311, 'self_adaptive_mindset',
    'A new AI capability appears that could reshape part of your job. You are busy. What is the most adaptive response?',
    'تظهر قدرة ذكاء اصطناعي جديدة قد تعيد تشكيل جزء من عملك. أنت مشغول. ما الاستجابة الأكثر تكيفاً؟',
    'situational_judgment',
    '[{"value":"a","label":"Block thirty minutes to try it on a real task and judge where it fits."},{"value":"b","label":"Assume it is hype and ignore it."},{"value":"c","label":"Wait for formal training before touching it."},{"value":"d","label":"Worry about it but do nothing."}]'::jsonb,
    '[{"value":"a","label":"خصّص ثلاثين دقيقة لتجربتها على مهمة حقيقية وتقييم أين تناسب."},{"value":"b","label":"افترض أنها مجرد ضجيج وتجاهلها."},{"value":"c","label":"انتظر تدريباً رسمياً قبل لمسها."},{"value":"d","label":"اقلق بشأنها لكن لا تفعل شيئاً."}]'::jsonb,
    '{"a":5,"b":1,"c":2,"d":1}'::jsonb, 'both', 'all', 1, 311, 'snapshot', ve_self, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 311);

  INSERT INTO ara_questions (version_id, pillar_id, question_number, individual_factor_id, question_text_en, question_text_ar, question_type, options_en, options_ar, score_map, region, sector, layer, display_order, tier, validation_evidence, is_active)
  SELECT v_id, 'talent', 312, 'self_adaptive_mindset',
    'Which mindset best describes strong personal AI readiness?',
    'أي عقلية تصف بشكل أفضل الجاهزية الشخصية القوية للذكاء الاصطناعي؟',
    'knowledge_check',
    '[{"value":"a","label":"AI will replace me, so there is no point learning it."},{"value":"b","label":"I will keep learning where AI helps and where my judgment matters, and adapt as it changes."},{"value":"c","label":"AI is just hype; I will wait it out."},{"value":"d","label":"I will use AI for everything without checking it."}]'::jsonb,
    '[{"value":"a","label":"الذكاء الاصطناعي سيحل محلي، فلا فائدة من تعلمه."},{"value":"b","label":"سأواصل التعلم أين يساعد الذكاء الاصطناعي وأين يهم حكمي، وأتكيف مع تغيره."},{"value":"c","label":"الذكاء الاصطناعي مجرد ضجيج؛ سأنتظر زواله."},{"value":"d","label":"سأستخدم الذكاء الاصطناعي لكل شيء دون التحقق منه."}]'::jsonb,
    '{"a":1,"b":5,"c":1,"d":1}'::jsonb, 'both', 'all', 1, 312, 'snapshot', ve_self, true
  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = 'talent' AND question_number = 312);

END $$;
