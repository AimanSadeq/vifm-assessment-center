-- ════════════════════════════════════════════════════════════════
-- Behavioural framework v2: 21 competencies, 8 clusters, 4 domains.
-- GENERATED from src/lib/competencies/framework-v2.ts by .tmp/gen-00226.ts.
--
-- Loads v2 as the ACTIVE framework without deleting any competency:
--   * 13 new competencies (12 merges + Mobilising Around Purpose, moved to
--     PEOPLE); 8 v1 competencies carry over unchanged.
--   * 31 v1 competencies retire with superseded_by -> the v2 competency that
--     absorbed them; Financial Literacy & Acumen and Digital & Data Fluency
--     retire with no successor (they move to Technical). The empty
--     "Adaptability & Change" cluster retires.
--   * Content pools onto the new competencies from their sources:
--     indicators + dev tips, tags, Q&A, Persona items, quiz items, course tags,
--     technical / psychometric bridge links, and a v2 Reflect 360 template.
--   * Configuration for new work translates: role profiles (the higher
--     target, weight and priority win) and bundle designs.
--   * Records stay as they are: completed sittings, issued vouchers,
--     requisitions and stage results keep their v1 competencies; the app
--     translates them forward when a new sitting or quiz starts.
--   * Before role profiles change, every Persona sitting that names a target
--     role gets a frozen role snapshot, so no past report re-scores.
--
-- "Active" is now retired_at IS NULL (a retirement with no successor cannot
-- be expressed by superseded_by alone). Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE competencies ADD COLUMN IF NOT EXISTS retired_at timestamptz;
ALTER TABLE competency_clusters ADD COLUMN IF NOT EXISTS retired_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_competencies_live ON competencies (id) WHERE retired_at IS NULL;

INSERT INTO competency_framework_versions (version, label, is_active, notes)
VALUES (2, 'VIFM behavioural framework v2 (21 competencies, 8 clusters, 4 domains)', false,
        'Consolidated from v1: 8 carried over, 12 merges, 1 moved, 2 moved to Technical.')
ON CONFLICT (version) DO NOTHING;

CREATE TEMP TABLE v1_to_v2 (old_id uuid PRIMARY KEY, new_id uuid NOT NULL, src_order int NOT NULL) ON COMMIT DROP;
INSERT INTO v1_to_v2 (old_id, new_id, src_order) VALUES
  ('a0000001-0000-0000-0000-000000000004', 'a0000002-0000-0000-0000-000000000001', 1),
  ('a0000001-0000-0000-0000-000000000005', 'a0000002-0000-0000-0000-000000000001', 2),
  ('a0000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002', 1),
  ('a0000001-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', 2),
  ('a0000001-0000-0000-0000-000000000041', 'a0000002-0000-0000-0000-000000000002', 3),
  ('a0000001-0000-0000-0000-000000000007', 'a0000002-0000-0000-0000-000000000003', 1),
  ('a0000001-0000-0000-0000-000000000008', 'a0000002-0000-0000-0000-000000000003', 2),
  ('a0000001-0000-0000-0000-000000000015', 'a0000002-0000-0000-0000-000000000003', 3),
  ('a0000001-0000-0000-0000-000000000011', 'a0000002-0000-0000-0000-000000000004', 1),
  ('a0000001-0000-0000-0000-000000000012', 'a0000002-0000-0000-0000-000000000004', 2),
  ('a0000001-0000-0000-0000-000000000013', 'a0000002-0000-0000-0000-000000000005', 1),
  ('a0000001-0000-0000-0000-000000000038', 'a0000002-0000-0000-0000-000000000005', 2),
  ('a0000001-0000-0000-0000-000000000039', 'a0000002-0000-0000-0000-000000000006', 1),
  ('a0000001-0000-0000-0000-000000000040', 'a0000002-0000-0000-0000-000000000006', 2),
  ('a0000001-0000-0000-0000-000000000019', 'a0000002-0000-0000-0000-000000000007', 1),
  ('a0000001-0000-0000-0000-000000000028', 'a0000002-0000-0000-0000-000000000007', 2),
  ('a0000001-0000-0000-0000-000000000020', 'a0000002-0000-0000-0000-000000000008', 1),
  ('a0000001-0000-0000-0000-000000000021', 'a0000002-0000-0000-0000-000000000008', 2),
  ('a0000001-0000-0000-0000-000000000022', 'a0000002-0000-0000-0000-000000000008', 3),
  ('a0000001-0000-0000-0000-000000000023', 'a0000002-0000-0000-0000-000000000009', 1),
  ('a0000001-0000-0000-0000-000000000026', 'a0000002-0000-0000-0000-000000000009', 2),
  ('a0000001-0000-0000-0000-000000000032', 'a0000002-0000-0000-0000-000000000010', 1),
  ('a0000001-0000-0000-0000-000000000031', 'a0000002-0000-0000-0000-000000000010', 2),
  ('a0000001-0000-0000-0000-000000000027', 'a0000002-0000-0000-0000-000000000010', 3),
  ('a0000001-0000-0000-0000-000000000017', 'a0000002-0000-0000-0000-000000000011', 1),
  ('a0000001-0000-0000-0000-000000000036', 'a0000002-0000-0000-0000-000000000011', 2),
  ('a0000001-0000-0000-0000-000000000037', 'a0000002-0000-0000-0000-000000000011', 3),
  ('a0000001-0000-0000-0000-000000000034', 'a0000002-0000-0000-0000-000000000012', 1),
  ('a0000001-0000-0000-0000-000000000035', 'a0000002-0000-0000-0000-000000000012', 2),
  ('a0000001-0000-0000-0000-000000000016', 'a0000002-0000-0000-0000-000000000012', 3),
  ('a0000001-0000-0000-0000-000000000018', 'a0000002-0000-0000-0000-000000000013', 1);

-- ── 1. The 13 new competencies ─────────────────────────────────
INSERT INTO competencies (id, cluster_id, name, name_ar, description, description_ar, sort_order, framework_version)
VALUES
  ('a0000002-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'Critical Analysis & Judgement', 'التحليل النقدي وحُسن التقدير', 'Breaks ambiguous, data-heavy problems into their parts, tests assumptions, and weighs competing explanations before reaching a view. Turns that reasoning into timely, balanced decisions, even when information is incomplete, weighing risk, stakeholders and second-order consequences. Stands behind decisions with reasoning that holds up to scrutiny.', 'يفكّك المشكلات الغامضة والكثيفة بالبيانات إلى أجزائها، ويختبر الافتراضات، ويوازن بين التفسيرات المتنافسة قبل أن يكوّن رأياً. ويحوّل هذا التحليل إلى قرارات متوازنة وفي وقتها حتى عندما تكون المعلومات ناقصة، مع مراعاة المخاطر وأصحاب المصلحة والنتائج غير المباشرة. ويدافع عن قراراته بمنطق يصمد أمام التدقيق.', 1, 2),
  ('a0000002-0000-0000-0000-000000000002', 'c1000001-0000-0000-0000-000000000001', 'Strategic & Commercial Insight', 'البصيرة الاستراتيجية والتجارية', 'Reads the competitive, economic and regulatory landscape and anticipates how markets and client needs will shift. Converts that insight into a clear, prioritised direction framed around long-term value, and links day-to-day work to the commercial outcomes it should produce. Sets direction others can understand, align to and act on.', 'يقرأ المشهد التنافسي والاقتصادي والتنظيمي ويستشرف كيف ستتغير الأسواق واحتياجات العملاء. ويحوّل هذه البصيرة إلى توجّه واضح ذي أولويات مبني على القيمة طويلة الأمد، ويربط العمل اليومي بالنتائج التجارية المرجوّة منه. ويضع توجّهاً يستطيع الآخرون فهمه والالتفاف حوله والعمل به.', 2, 2),
  ('a0000002-0000-0000-0000-000000000003', 'c1000001-0000-0000-0000-000000000002', 'Navigating Complexity & Ambiguity', 'التعامل مع التعقيد والغموض', 'Makes sense of high-volume, interdependent and sometimes conflicting information, and sees how decisions ripple across functions, markets and time. Stays effective and decisive when direction, data or conditions are unclear, making progress on what is known and adjusting as new information arrives. Brings clarity that lets the organisation act.', 'يستوعب المعلومات الكثيرة والمترابطة والمتعارضة أحياناً، ويرى كيف تنعكس القرارات عبر الوظائف والأسواق وعلى مدى الزمن. ويبقى فعّالاً وحاسماً عندما يكون الاتجاه أو البيانات أو الظروف غير واضحة، فيتقدّم بناءً على المعلوم ويعدّل مساره مع ورود معلومات جديدة. ويضفي وضوحاً يمكّن المؤسسة من التصرّف.', 2, 2),
  ('a0000002-0000-0000-0000-000000000004', 'c1000001-0000-0000-0000-000000000003', 'Delivery & Accountability', 'الإنجاز والمساءلة', 'Takes personal responsibility for measurable results and follows through from commitment to completion, sustaining standards when conditions are difficult. Holds self and others to what was promised, owns mistakes openly and fixes them rather than shifting blame. Builds a track record of reliability the organisation can plan around.', 'يتحمّل المسؤولية الشخصية عن نتائج قابلة للقياس ويتابع من الالتزام حتى الإنجاز، محافظاً على المعايير عندما تصعب الظروف. ويُلزم نفسه والآخرين بما وُعد به، ويعترف بأخطائه علناً ويصلحها بدلاً من إلقاء اللوم. ويبني سجلاً من الموثوقية يمكن للمؤسسة أن تخطط على أساسه.', 2, 2),
  ('a0000002-0000-0000-0000-000000000005', 'c1000001-0000-0000-0000-000000000003', 'Planning & Resourcing', 'التخطيط وتوفير الموارد', 'Sequences work so the most important commitments are met, distinguishing the urgent from the important. Secures and deploys the people, budget and tools the work needs, making the case for resources where they will have most impact. Keeps delivery on track by anticipating dependencies and adjusting plans as conditions change.', 'يرتّب العمل بحيث تُنجَز الالتزامات الأهم، مميّزاً بين العاجل والمهم. ويؤمّن الأفراد والميزانية والأدوات التي يحتاجها العمل ويوظّفها، ويدافع عن الموارد حيث يكون أثرها أكبر. ويحافظ على مسار التنفيذ باستباق الاعتماديات وتعديل الخطط مع تغيّر الظروف.', 4, 2),
  ('a0000002-0000-0000-0000-000000000006', 'c1000001-0000-0000-0000-000000000009', 'Customer & Stakeholder Focus', 'التركيز على العملاء وأصحاب المصلحة', 'Understands and anticipates the needs of customers and stakeholders, internal and external, and delivers reliably against them. Maps who is affected by and who can affect the work, and engages each appropriately and early. Keeps diverse interests aligned around shared goals and treats their experience as a measure of success.', 'يفهم احتياجات العملاء وأصحاب المصلحة الداخليين والخارجيين ويستبقها ويلبّيها بموثوقية. ويحدّد من يتأثر بالعمل ومن يمكنه التأثير فيه، ويتواصل مع كلٍّ منهم بالشكل المناسب ومبكراً. ويحافظ على اتساق المصالح المتنوعة حول أهداف مشتركة، ويعدّ تجربتهم مقياساً للنجاح.', 1, 2),
  ('a0000002-0000-0000-0000-000000000007', 'c1000001-0000-0000-0000-000000000005', 'Clear & Adaptive Communication', 'التواصل الواضح والمرن', 'Conveys complex content clearly, tailoring message, tone and medium to the audience, and listens to check understanding rather than assuming it. Adjusts style in the moment to fit the person and the situation, flexing between directness and diplomacy without losing authenticity. Makes sure the right people grasp and act on what matters.', 'ينقل المحتوى المعقّد بوضوح، مكيّفاً الرسالة والنبرة والوسيلة بحسب الجمهور، ويصغي للتأكد من الفهم بدلاً من افتراضه. ويعدّل أسلوبه في اللحظة بما يناسب الشخص والموقف، متنقلاً بين المباشرة والدبلوماسية دون أن يفقد أصالته. ويحرص على أن يستوعب الأشخاص المعنيون ما يهم ويتصرفوا بناءً عليه.', 1, 2),
  ('a0000002-0000-0000-0000-000000000008', 'c1000001-0000-0000-0000-000000000005', 'Influence & Agreement', 'التأثير والوصول إلى الاتفاق', 'Builds well-reasoned, audience-aware cases that win genuine commitment, and addresses concerns rather than overriding them. Surfaces and resolves disagreement directly and calmly, keeping the focus on the issue. Reaches durable agreements through preparation and fair trade-offs, holding firm on what matters while staying flexible on how.', 'يبني حججاً منطقية تراعي الجمهور وتكسب التزاماً حقيقياً، ويعالج المخاوف بدلاً من تجاوزها. ويطرح الخلافات ويحلّها مباشرة وبهدوء مع إبقاء التركيز على القضية. ويصل إلى اتفاقات مستدامة عبر الإعداد والمقايضات العادلة، متمسكاً بما هو مهم ومرناً في طريقة تحقيقه.', 2, 2),
  ('a0000002-0000-0000-0000-000000000009', 'c1000001-0000-0000-0000-000000000005', 'Networks & Collaboration', 'بناء الشبكات والتعاون', 'Builds and sustains useful relationships inside and outside the organisation, investing in them before they are needed. Reaches beyond their own team to coordinate, share information and solve problems jointly. Puts the wider result ahead of silo loyalty so the organisation wins as a whole.', 'يبني علاقات مفيدة داخل المؤسسة وخارجها ويحافظ عليها، ويستثمر فيها قبل الحاجة إليها. ويتجاوز حدود فريقه للتنسيق وتبادل المعلومات وحل المشكلات بشكل مشترك. ويقدّم النتيجة الأشمل على الولاء للوحدات المنعزلة لتنجح المؤسسة ككل.', 3, 2),
  ('a0000002-0000-0000-0000-000000000010', 'c1000001-0000-0000-0000-000000000007', 'Integrity & Principled Courage', 'النزاهة والشجاعة المبدئية', 'Acts honestly and fairly, within the spirit as well as the letter of professional standards, even when no one is watching. Raises difficult issues and challenges poor decisions, even at personal or political cost. Aligns words with actions so commitments are believed, earning a reputation others can rely on.', 'يتصرف بأمانة وإنصاف وفق روح المعايير المهنية ونصّها، حتى عندما لا يراقبه أحد. ويطرح القضايا الصعبة ويعترض على القرارات الضعيفة ولو كان ذلك على حساب مصلحته الشخصية أو السياسية. ويطابق أقواله أفعاله فتكون التزاماته موضع ثقة، ويكسب سمعة يعتمد عليها الآخرون.', 1, 2),
  ('a0000002-0000-0000-0000-000000000011', 'c1000001-0000-0000-0000-000000000008', 'Resilience & Composure', 'المرونة النفسية ورباطة الجأش', 'Stays calm, clear and constructive under pressure, scrutiny and setbacks, keeping emotion in check so thinking stays sharp. Recovers quickly from disappointment and learns from it. Manages energy and the competing demands of work and life so performance holds up over time, not just in the moment.', 'يبقى هادئاً وواضحاً وبنّاءً تحت الضغط والتدقيق وعند الانتكاسات، ويضبط انفعالاته ليظل تفكيره حاداً. ويتعافى سريعاً من الإحباط ويتعلّم منه. ويدير طاقته والمتطلبات المتنافسة للعمل والحياة بحيث يستمر أداؤه على المدى الطويل لا في اللحظة فقط.', 1, 2),
  ('a0000002-0000-0000-0000-000000000012', 'c1000001-0000-0000-0000-000000000008', 'Learning Agility', 'سرعة التعلّم', 'Learns rapidly from new and first-time situations and applies the lessons in unfamiliar conditions. Experiments when facing unfamiliar problems and adjusts quickly, treating both wins and failures as information. Takes ownership of their own development so their skills keep pace with changing demands.', 'يتعلّم بسرعة من المواقف الجديدة وغير المسبوقة ويطبّق الدروس في ظروف غير مألوفة. ويجرّب عند مواجهة مشكلات غير مألوفة ويتكيّف سريعاً، معتبراً النجاح والإخفاق مصدرين للمعرفة. ويتولّى مسؤولية تطوير نفسه بحيث تواكب مهاراته المتطلبات المتغيّرة.', 2, 2),
  ('a0000002-0000-0000-0000-000000000013', 'c1000001-0000-0000-0000-000000000006', 'Mobilising Around Purpose', 'الحشد حول الهدف', 'Articulates a compelling sense of direction that connects people''s work to a larger goal and motivates action. Helps individuals see how their contribution matters and why it is worth their effort. Turns purpose into shared energy and commitment rather than leaving it as a slogan.', 'يعبّر عن توجّه ملهم يربط عمل الأفراد بهدف أكبر ويحفّزهم على العمل. ويساعد الأفراد على رؤية أهمية مساهمتهم ولماذا تستحق جهدهم. ويحوّل الهدف إلى طاقة والتزام مشتركين بدلاً من أن يبقى شعاراً.', 3, 2)
ON CONFLICT (id) DO NOTHING;

-- Tags (distinct union, up to 8) and Q&A (first question of each source, then
-- the second, up to 3) pooled from the absorbed competencies.
UPDATE competencies n SET
  tags = (SELECT (array_agg(s.t ORDER BY s.first_src, s.first_ord))[1:8] FROM (
            SELECT x.t, min(m.src_order) AS first_src, min(x.ord) AS first_ord
            FROM v1_to_v2 m JOIN competencies o ON o.id = m.old_id
            CROSS JOIN LATERAL unnest(o.tags) WITH ORDINALITY AS x(t, ord)
            WHERE m.new_id = n.id GROUP BY x.t) s),
  qa_questions = (SELECT (array_agg(x.qq ORDER BY x.ord, m.src_order))[1:3]
            FROM v1_to_v2 m JOIN competencies o ON o.id = m.old_id
            CROSS JOIN LATERAL unnest(o.qa_questions) WITH ORDINALITY AS x(qq, ord)
            WHERE m.new_id = n.id)
WHERE n.id IN (SELECT DISTINCT new_id FROM v1_to_v2) AND n.tags IS NULL;

-- ── 2. Indicators + development tips, pooled (exact duplicates dropped) ──
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order)
SELECT d.new_id, d.indicator_type, d.description, d.sort_order FROM (
  SELECT DISTINCT ON (m.new_id, lower(btrim(bi.description)))
         m.new_id, bi.indicator_type, bi.description, m.src_order * 100 + bi.sort_order AS sort_order
  FROM behavioral_indicators bi
  JOIN v1_to_v2 m ON m.old_id = bi.competency_id
  ORDER BY m.new_id, lower(btrim(bi.description)), m.src_order, bi.sort_order
) d
WHERE NOT EXISTS (SELECT 1 FROM behavioral_indicators x WHERE x.competency_id = d.new_id);

-- ── 3. Persona items for the new competencies (pooled from their sources) ──
INSERT INTO persona_items (ac_competency_id, item_key, ord, reverse, text_en, text_ar, status, source)
VALUES
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-1', 1, false, 'I test the assumptions behind a conclusion before accepting it.', 'أختبر الافتراضات الكامنة خلف استنتاج قبل قبوله.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-2', 2, false, 'I make balanced decisions even when information is incomplete.', 'أتّخذ قرارات متوازنة حتى حين تكون المعلومات ناقصة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-3', 3, false, 'I break complex problems into parts to understand them.', 'أُفكّك المشكلات المعقّدة إلى أجزاء لفهمها.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-4', 4, false, 'I consider the knock-on consequences of my decisions.', 'أراعي التبعات غير المباشرة لقراراتي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-5', 5, true, 'I tend to accept reports at face value.', 'أميل إلى قبول التقارير كما هي دون تمحيص.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-6', 6, true, 'I delay decisions until I have complete certainty.', 'أؤجّل القرارات حتى يكتمل اليقين تمامًا.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-7', 7, false, 'I weigh evidence carefully before forming a view.', 'أوازن الأدلة بعناية قبل تكوين رأي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000001', 'v2-01-8', 8, false, 'People trust my judgement on difficult calls.', 'يثق الناس بحُكمي في القرارات الصعبة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-1', 1, false, 'I think several years ahead about how my market could change.', 'أفكّر قبل سنوات في كيفية تغيّر سوقي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-2', 2, false, 'I keep close track of competitor and market moves in my industry.', 'أتابع عن كثب تحرّكات المنافسين والسوق في صناعتي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-3', 3, false, 'I connect my work to commercial outcomes and the wider value chain.', 'أربط عملي بالنتائج التجارية وسلسلة القيمة الأوسع.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-4', 4, false, 'I connect day-to-day decisions to a longer-term direction.', 'أربط القرارات اليومية بتوجّه أطول أمدًا.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-5', 5, false, 'I factor the wider economic climate into business decisions.', 'أُدخل المناخ الاقتصادي الأوسع في قرارات الأعمال.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-6', 6, false, 'I look for opportunities to create additional value for customers and the business.', 'أبحث عن فرص لخلق قيمة إضافية للعملاء وللمؤسسة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-7', 7, true, 'I focus on immediate targets rather than future shifts.', 'أركّز على المستهدفات الآنية أكثر من التحوّلات المستقبلية.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-8', 8, true, 'I find it hard to see how external trends affect my work.', 'يصعب عليّ رؤية كيف تؤثّر الاتجاهات الخارجية في عملي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-9', 9, true, 'I prioritise short-term wins over sustainable long-term value.', 'أُفضّل المكاسب قصيرة المدى على القيمة المستدامة بعيدة المدى.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-10', 10, false, 'I anticipate how regulation or competition might reshape my area.', 'أستشرف كيف قد تعيد التشريعات أو المنافسة تشكيل مجالي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-11', 11, false, 'I spot commercial opportunities that others miss.', 'ألتقط فرصًا تجارية يغفل عنها غيري.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000002', 'v2-02-12', 12, false, 'I measure and communicate the impact of my work on key outcomes.', 'أقيس وأوصّل أثر عملي على النتائج الرئيسية.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-1', 1, false, 'I can make sense of messy, conflicting information.', 'أستطيع فهم المعلومات المتشابكة والمتضاربة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-2', 2, false, 'I consider the bigger picture beyond my own area.', 'أراعي الصورة الأكبر بما يتجاوز مجالي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-3', 3, false, 'I stay effective when things are unclear.', 'أبقى فاعلًا حين تكون الأمور غير واضحة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-4', 4, false, 'I find the key issue inside a complicated situation.', 'أجد القضية الجوهرية داخل موقف معقّد.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-5', 5, false, 'I think about how parts of a system connect.', 'أفكّر في كيفية ترابط أجزاء النظام.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-6', 6, false, 'I make progress without complete information.', 'أُحرز تقدّمًا دون معلومات كاملة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-7', 7, true, 'I get overwhelmed when problems have many moving parts.', 'أُرهَق حين تكون للمشكلات أجزاء متحرّكة كثيرة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-8', 8, true, 'I focus only on my immediate remit.', 'أركّز فقط على نطاق مسؤوليتي المباشر.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-9', 9, true, 'I struggle when the way forward isn''t clear.', 'أتعثّر حين لا يكون الطريق للأمام واضحًا.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-10', 10, false, 'I structure complex problems into manageable parts.', 'أُهيكل المشكلات المعقّدة إلى أجزاء قابلة للإدارة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-11', 11, false, 'I take a broad, cross-boundary view of issues.', 'أتبنّى نظرة واسعة عابرة للحدود للقضايا.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000003', 'v2-03-12', 12, false, 'I''m comfortable acting amid uncertainty.', 'أرتاح في التصرّف وسط عدم اليقين.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-1', 1, false, 'I see things through to a result.', 'أمضي بالأمور حتى تحقيق نتيجة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-2', 2, false, 'I do what I say I will do.', 'أفعل ما أقول إنني سأفعله.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-3', 3, false, 'I keep pushing even when it''s hard.', 'أواصل الدفع حتى حين يصعب الأمر.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-4', 4, false, 'I own up quickly when I can''t meet a commitment.', 'أعترف بسرعة حين يتعذّر عليّ الوفاء بالتزام.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-5', 5, true, 'I ease off when obstacles appear.', 'أتراخى عند ظهور العقبات.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-6', 6, true, 'I make excuses when things slip.', 'أختلق الأعذار حين تتعثّر الأمور.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-7', 7, false, 'I take personal responsibility for outcomes.', 'أتحمّل المسؤولية الشخصية عن النتائج.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000004', 'v2-04-8', 8, false, 'I hold myself to my promises.', 'أُلزِم نفسي بوعودي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-1', 1, false, 'I plan my work around what matters most.', 'أخطّط عملي حول الأهمّ.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-2', 2, false, 'I get the resources needed to deliver.', 'أحصل على الموارد اللازمة للإنجاز.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-3', 3, false, 'I prioritise by impact and deadline.', 'أرتّب الأولويات بحسب الأثر والموعد.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-4', 4, false, 'I make the most of what I have.', 'أستثمر ما لديّ على أفضل وجه.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-5', 5, true, 'I tackle tasks in whatever order they arrive.', 'أتناول المهام بأي ترتيب تصل به.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-6', 6, true, 'I get stuck when resources are tight.', 'أتعثّر حين تشحّ الموارد.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-7', 7, false, 'I organise my work to meet key commitments.', 'أنظّم عملي للوفاء بالالتزامات الرئيسة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000005', 'v2-05-8', 8, false, 'I deploy people and tools effectively.', 'أوظّف الأفراد والأدوات بفاعلية.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-1', 1, false, 'I anticipate customer needs before they are expressed.', 'أستبق احتياجات العملاء قبل أن يُعبَّر عنها.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-2', 2, false, 'I map and manage the expectations of key stakeholders.', 'أحدّد وأدير توقعات أصحاب المصلحة الرئيسيين.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-3', 3, false, 'I go beyond expectations to deliver an excellent customer experience.', 'أتجاوز التوقعات لتقديم تجربة عملاء متميزة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-4', 4, false, 'I keep stakeholders informed on progress, risks and changes.', 'أُبقي أصحاب المصلحة على اطلاع بالتقدّم والمخاطر والتغييرات.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-5', 5, true, 'I lose sight of the customer when under internal pressure.', 'أفقد التركيز على العميل عند وجود ضغوط داخلية.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-6', 6, false, 'I build trusted relationships with partners inside and outside the organisation.', 'أبني علاقات موثوقة مع الشركاء داخل المؤسسة وخارجها.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-7', 7, false, 'I use customer feedback to improve how I work.', 'أستفيد من ملاحظات العملاء لتحسين طريقة عملي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000006', 'v2-06-8', 8, true, 'I avoid difficult stakeholder conversations until they escalate.', 'أتجنّب المحادثات الصعبة مع أصحاب المصلحة حتى تتفاقم.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-1', 1, false, 'I explain complex things clearly.', 'أشرح الأمور المعقّدة بوضوح.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-2', 2, false, 'I adapt my style to different people.', 'أكيّف أسلوبي مع مختلف الناس.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-3', 3, false, 'I tailor my message to the audience.', 'أكيّف رسالتي وفق الجمهور.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-4', 4, false, 'I read situations and adjust my approach.', 'أقرأ المواقف وأعدّل نهجي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-5', 5, true, 'I struggle to get my point across simply.', 'يصعب عليّ إيصال فكرتي ببساطة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-6', 6, true, 'I use the same approach with everyone.', 'أستخدم النهج نفسه مع الجميع.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-7', 7, false, 'I communicate in a way people understand.', 'أتواصل بطريقة يفهمها الناس.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000007', 'v2-07-8', 8, false, 'I flex how I work to fit the person.', 'أُرَوِّن طريقة عملي لتناسب الشخص.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-1', 1, false, 'I win people''s genuine support for ideas.', 'أكسب تأييد الناس الحقيقي للأفكار.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-2', 2, false, 'I address disagreements directly and calmly.', 'أتناول الخلافات بصراحة وهدوء.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-3', 3, false, 'I find agreements that work for both sides.', 'أجد اتفاقات تناسب الطرفين.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-4', 4, false, 'I build a convincing case.', 'أبني حجّة مقنعة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-5', 5, false, 'I keep conflict focused on the issue, not the person.', 'أُبقي الخلاف على القضية لا الشخص.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-6', 6, false, 'I look for the other party''s underlying needs.', 'أبحث عن احتياجات الطرف الآخر الكامنة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-7', 7, true, 'I find it hard to bring others around.', 'يصعب عليّ استمالة الآخرين.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-8', 8, true, 'I avoid dealing with conflict.', 'أتجنّب التعامل مع الخلاف.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-9', 9, true, 'I either give in or dig in when negotiating.', 'إمّا أستسلم وإمّا أتعنّت عند التفاوض.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-10', 10, false, 'I gain commitment, not just compliance.', 'أكسب التزامًا لا مجرّد امتثال.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-11', 11, false, 'I resolve tensions without drama.', 'أحلّ التوتّرات دون ضجّة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000008', 'v2-08-12', 12, false, 'I reach durable, fair agreements.', 'أتوصّل إلى اتفاقات مستدامة وعادلة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-1', 1, false, 'I build relationships across the organisation.', 'أبني علاقات عبر المنظمة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-2', 2, false, 'I work well across departments.', 'أعمل بكفاءة عبر الإدارات.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-3', 3, false, 'I invest in connections before I need them.', 'أستثمر في الصلات قبل أن أحتاجها.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-4', 4, false, 'I put shared goals ahead of my own unit''s interests.', 'أُقدّم الأهداف المشتركة على مصالح وحدتي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-5', 5, true, 'I keep to my own team and contacts.', 'ألتزم بفريقي وصلاتي وحدها.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-6', 6, true, 'I focus on my own area''s results over joint ones.', 'أركّز على نتائج مجالي قبل المشتركة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-7', 7, false, 'I maintain a strong network of relationships.', 'أصون شبكة علاقات قوية.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000009', 'v2-09-8', 8, false, 'I partner effectively with other teams.', 'أتشارك بفاعلية مع الفرق الأخرى.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-1', 1, false, 'I act honestly and fairly.', 'أتصرّف بأمانة وعدل.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-2', 2, false, 'I speak up about difficult issues.', 'أتكلّم عن القضايا الصعبة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-3', 3, false, 'People rely on me to follow through.', 'يعتمد الناس عليّ في الوفاء.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-4', 4, false, 'I uphold standards even under pressure.', 'أُرسي المعايير حتى تحت الضغط.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-5', 5, false, 'I say what needs to be said, even if unpopular.', 'أقول ما يجب قوله ولو كان غير محبّب.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-6', 6, false, 'I am honest and consistent in what I do.', 'أنا صادق ومتّسق فيما أفعل.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-7', 7, true, 'I bend the rules when it''s convenient.', 'أُليّن القواعد متى ناسبني ذلك.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-8', 8, true, 'I stay quiet to avoid standing out.', 'ألزم الصمت لئلّا أبرز.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-9', 9, true, 'People are sometimes unsure they can count on me.', 'لا يتيقّن الناس أحيانًا أن بإمكانهم الاعتماد عليّ.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-10', 10, false, 'I do the right thing even when it''s hard.', 'أفعل الصواب حتى حين يصعب.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-11', 11, false, 'I raise concerns others avoid.', 'أطرح المخاوف التي يتجنّبها غيري.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000010', 'v2-10-12', 12, false, 'I earn others'' trust.', 'أكسب ثقة الآخرين.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-1', 1, false, 'I bounce back from setbacks.', 'أنهض من الانتكاسات.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-2', 2, false, 'I stay calm under pressure.', 'أبقى هادئًا تحت الضغط.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-3', 3, false, 'I manage my energy to perform over time.', 'أُدير طاقتي لأؤدّي عبر الزمن.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-4', 4, false, 'I keep performing through adversity.', 'أواصل الأداء خلال الشدائد.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-5', 5, false, 'I think clearly in stressful moments.', 'أفكّر بوضوح في اللحظات العصيبة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-6', 6, false, 'I balance work demands with recovery.', 'أوازن متطلّبات العمل مع التعافي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-7', 7, true, 'Setbacks knock me off course for a long time.', 'تُخرجني الانتكاسات عن مساري وقتًا طويلًا.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-8', 8, true, 'I get rattled when the pressure is on.', 'أرتبك حين يشتدّ الضغط.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-9', 9, true, 'I run myself into the ground when busy.', 'أُنهك نفسي حتى الإرهاق حين أنشغل.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-10', 10, false, 'I recover quickly when things go wrong.', 'أتعافى بسرعة حين تسوء الأمور.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-11', 11, false, 'I keep my composure in tough situations.', 'أحافظ على رباطة جأشي في المواقف الصعبة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000011', 'v2-11-12', 12, false, 'I sustain my performance without burning out.', 'أُديم أدائي دون احتراق وظيفي.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-1', 1, false, 'I learn fast in unfamiliar situations.', 'أتعلّم بسرعة في المواقف غير المألوفة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-2', 2, false, 'I actively seek to grow and improve.', 'أسعى بنشاط إلى النمو والتحسّن.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-3', 3, false, 'I learn quickly by trying things.', 'أتعلّم بسرعة بتجربة الأشياء.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-4', 4, false, 'I apply lessons to new conditions.', 'أطبّق الدروس على ظروف جديدة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-5', 5, false, 'I look for development opportunities.', 'أبحث عن فرص التطوير.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-6', 6, false, 'I treat mistakes as a way to learn.', 'أتعامل مع الأخطاء كوسيلة للتعلّم.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-7', 7, true, 'I rely on what worked before, even when things change.', 'أعتمد على ما نجح سابقًا حتى مع تغيّر الأمور.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-8', 8, true, 'I wait for others to develop me.', 'أنتظر أن يطوّرني غيري.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-9', 9, true, 'I avoid tasks until I''ve been fully trained.', 'أتجنّب المهام حتى أتدرّب تدريبًا كاملًا.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-10', 10, false, 'I adapt quickly to new demands.', 'أتكيّف بسرعة مع المتطلّبات الجديدة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-11', 11, false, 'I work on getting better at what I do.', 'أعمل على التحسّن فيما أفعله.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000012', 'v2-12-12', 12, false, 'I adjust my approach as I learn.', 'أعدّل نهجي وأنا أتعلّم.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000013', 'v2-13-1', 1, false, 'I give people a clear sense of direction.', 'أمنح الناس إحساسًا واضحًا بالوجهة.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000013', 'v2-13-2', 2, false, 'I connect people''s work to a bigger purpose.', 'أربط عمل الناس بغاية أكبر.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000013', 'v2-13-3', 3, true, 'I struggle to get others energised behind a goal.', 'يصعب عليّ حشد الآخرين خلف هدف.', 'pending', 'v2_pooled'),
  ('a0000002-0000-0000-0000-000000000013', 'v2-13-4', 4, false, 'I motivate people toward a shared goal.', 'أحفّز الناس نحو هدف مشترك.', 'pending', 'v2_pooled')
ON CONFLICT (item_key) DO NOTHING;

-- ── 4. Quiz bank items, pooled ─────────────────────────────────
INSERT INTO competency_quiz_items (competency_id, type, prompt_en, prompt_ar, options_en, options_ar, correct_index, points, difficulty,
                                   explanation_en, explanation_ar, sequence, status, source, ar_reviewed)
SELECT m.new_id, qi.type, qi.prompt_en, qi.prompt_ar, qi.options_en, qi.options_ar, qi.correct_index, qi.points, qi.difficulty,
       qi.explanation_en, qi.explanation_ar,
       qi.sequence,
       qi.status, qi.source, qi.ar_reviewed
FROM competency_quiz_items qi
JOIN v1_to_v2 m ON m.old_id = qi.competency_id
WHERE NOT EXISTS (SELECT 1 FROM competency_quiz_items x WHERE x.competency_id = m.new_id);

-- ── 5. Freeze the target role on every Persona sitting that names one ──
UPDATE behavioral_assessment_sessions s
SET target_role_snapshot = jsonb_build_object(
  'id', rp.id,
  'name', coalesce(rp.name_en, 'Role profile'),
  'snapshotAt', now(),
  'comps', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'competencyId', rpc.competency_id,
      'name', c.name,
      'target', coalesce(rpc.target_proficiency, rp.default_target_proficiency, 3),
      'weight', coalesce(rpc.weight, 1)))
    FROM role_profile_competencies rpc JOIN competencies c ON c.id = rpc.competency_id
    WHERE rpc.role_profile_id = rp.id), '[]'::jsonb))
FROM role_profiles rp
WHERE rp.id = s.target_role_profile_id AND s.target_role_snapshot IS NULL;

-- ── 6. Role profiles onto v2 (the higher target / weight / priority wins) ──
INSERT INTO role_profile_competencies (role_profile_id, competency_id, weight, priority, reasoning, target_proficiency)
SELECT rpc.role_profile_id, m.new_id,
       max(rpc.weight),
       (array_agg(rpc.priority ORDER BY CASE rpc.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END))[1],
       left(string_agg(DISTINCT rpc.reasoning, ' '), 500),
       max(rpc.target_proficiency)
FROM role_profile_competencies rpc
JOIN v1_to_v2 m ON m.old_id = rpc.competency_id
GROUP BY rpc.role_profile_id, m.new_id
ON CONFLICT (role_profile_id, competency_id) DO UPDATE SET
  weight = greatest(role_profile_competencies.weight, EXCLUDED.weight),
  target_proficiency = greatest(role_profile_competencies.target_proficiency, EXCLUDED.target_proficiency);

DELETE FROM role_profile_competencies WHERE competency_id = ANY(ARRAY['a0000001-0000-0000-0000-000000000004'::uuid, 'a0000001-0000-0000-0000-000000000005'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'a0000001-0000-0000-0000-000000000002'::uuid, 'a0000001-0000-0000-0000-000000000041'::uuid, 'a0000001-0000-0000-0000-000000000007'::uuid, 'a0000001-0000-0000-0000-000000000008'::uuid, 'a0000001-0000-0000-0000-000000000015'::uuid, 'a0000001-0000-0000-0000-000000000011'::uuid, 'a0000001-0000-0000-0000-000000000012'::uuid, 'a0000001-0000-0000-0000-000000000013'::uuid, 'a0000001-0000-0000-0000-000000000038'::uuid, 'a0000001-0000-0000-0000-000000000039'::uuid, 'a0000001-0000-0000-0000-000000000040'::uuid, 'a0000001-0000-0000-0000-000000000019'::uuid, 'a0000001-0000-0000-0000-000000000028'::uuid, 'a0000001-0000-0000-0000-000000000020'::uuid, 'a0000001-0000-0000-0000-000000000021'::uuid, 'a0000001-0000-0000-0000-000000000022'::uuid, 'a0000001-0000-0000-0000-000000000023'::uuid, 'a0000001-0000-0000-0000-000000000026'::uuid, 'a0000001-0000-0000-0000-000000000032'::uuid, 'a0000001-0000-0000-0000-000000000031'::uuid, 'a0000001-0000-0000-0000-000000000027'::uuid, 'a0000001-0000-0000-0000-000000000017'::uuid, 'a0000001-0000-0000-0000-000000000036'::uuid, 'a0000001-0000-0000-0000-000000000037'::uuid, 'a0000001-0000-0000-0000-000000000034'::uuid, 'a0000001-0000-0000-0000-000000000035'::uuid, 'a0000001-0000-0000-0000-000000000016'::uuid, 'a0000001-0000-0000-0000-000000000018'::uuid, 'a0000001-0000-0000-0000-000000000003'::uuid, 'a0000001-0000-0000-0000-000000000009'::uuid]);

-- ── 7. Course tags + bridge links carried to the successors (old rows kept) ──
INSERT INTO vifm_course_competency_tags (course_id, competency_id, relevance_weight, rationale, source)
SELECT t.course_id, m.new_id, max(t.relevance_weight),
       (array_agg(t.rationale ORDER BY t.relevance_weight DESC, m.src_order))[1],
       (array_agg(t.source ORDER BY t.relevance_weight DESC, m.src_order))[1]
FROM vifm_course_competency_tags t
JOIN v1_to_v2 m ON m.old_id = t.competency_id
GROUP BY t.course_id, m.new_id
ON CONFLICT (course_id, competency_id) DO NOTHING;

INSERT INTO technical_domain_competencies (domain_key, competency_id, relation, weight)
SELECT l.domain_key, m.new_id, min(l.relation), max(l.weight)
FROM technical_domain_competencies l JOIN v1_to_v2 m ON m.old_id = l.competency_id
GROUP BY l.domain_key, m.new_id
ON CONFLICT (domain_key, competency_id) DO NOTHING;

INSERT INTO construct_competency_links (source_kind, source_key, competency_id, relation, layer, weight, validated, rationale)
SELECT l.source_kind, l.source_key, m.new_id, min(l.relation), min(l.layer), max(l.weight), bool_and(l.validated),
       'Carried to framework v2 from ' || string_agg(l.competency_id::text, ', ')
FROM construct_competency_links l JOIN v1_to_v2 m ON m.old_id = l.competency_id
GROUP BY l.source_kind, l.source_key, m.new_id
ON CONFLICT (source_kind, source_key, competency_id) DO NOTHING;

-- ── 8. Bundle designs onto v2 (a design, not a record) ─────────
UPDATE bespoke_services b
SET service_config = jsonb_set(b.service_config, '{persona,competencyIds}', coalesce((
  SELECT jsonb_agg(DISTINCT coalesce(m.new_id::text, x))
  FROM jsonb_array_elements_text(b.service_config->'persona'->'competencyIds') AS x
  LEFT JOIN v1_to_v2 m ON m.old_id::text = x
  WHERE x <> ALL(ARRAY['a0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000009']::text[])), '[]'::jsonb))
WHERE jsonb_typeof(b.service_config->'persona'->'competencyIds') = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(b.service_config->'persona'->'competencyIds') AS x
              WHERE x = ANY(ARRAY['a0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000041', 'a0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000038', 'a0000001-0000-0000-0000-000000000039', 'a0000001-0000-0000-0000-000000000040', 'a0000001-0000-0000-0000-000000000019', 'a0000001-0000-0000-0000-000000000028', 'a0000001-0000-0000-0000-000000000020', 'a0000001-0000-0000-0000-000000000021', 'a0000001-0000-0000-0000-000000000022', 'a0000001-0000-0000-0000-000000000023', 'a0000001-0000-0000-0000-000000000026', 'a0000001-0000-0000-0000-000000000032', 'a0000001-0000-0000-0000-000000000031', 'a0000001-0000-0000-0000-000000000027', 'a0000001-0000-0000-0000-000000000017', 'a0000001-0000-0000-0000-000000000036', 'a0000001-0000-0000-0000-000000000037', 'a0000001-0000-0000-0000-000000000034', 'a0000001-0000-0000-0000-000000000035', 'a0000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000018', 'a0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000009']::text[]));

-- ── 9. Reflect 360: a v2 full-framework template; the v1 template retires ──
INSERT INTO reflect_frameworks (id, engagement_id, name_en, name_ar, description_en, description_ar, source, is_template, is_active, approved_at)
VALUES ('f2000001-0000-0000-0000-000000000001', NULL, 'VIFM Competency Framework v2 (Full)', 'إطار كفاءات VIFM - الإصدار الثاني (كامل)',
        'The VIFM behavioural framework v2 - 21 competencies across 8 clusters and 4 domains, each with the observable behaviours pooled from the competencies it consolidates.',
        'إطار VIFM السلوكي - الإصدار الثاني: 21 كفاءة موزعة على 8 مجموعات و4 مجالات، لكل منها السلوكيات الملاحَظة المجمّعة من الكفاءات التي دُمجت فيها.',
        'template', true, true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO reflect_competencies (framework_id, name_en, name_ar, description_en, description_ar, display_order, ac_competency_id)
SELECT 'f2000001-0000-0000-0000-000000000001', v.name, v.name_ar, v.description, v.description_ar, v.ord, v.id
FROM (
  SELECT c.id, c.name, c.name_ar, c.description, c.description_ar,
         row_number() OVER (ORDER BY d.sort_order, cl.sort_order, c.sort_order, c.name) AS ord
  FROM competencies c
  JOIN competency_clusters cl ON cl.id = c.cluster_id
  JOIN competency_domains d ON d.id = cl.domain_id
  WHERE c.id = ANY(ARRAY['a0000001-0000-0000-0000-000000000006'::uuid, 'a0000001-0000-0000-0000-000000000010'::uuid, 'a0000001-0000-0000-0000-000000000014'::uuid, 'a0000001-0000-0000-0000-000000000024'::uuid, 'a0000001-0000-0000-0000-000000000025'::uuid, 'a0000001-0000-0000-0000-000000000029'::uuid, 'a0000001-0000-0000-0000-000000000030'::uuid, 'a0000001-0000-0000-0000-000000000033'::uuid, 'a0000002-0000-0000-0000-000000000001'::uuid, 'a0000002-0000-0000-0000-000000000002'::uuid, 'a0000002-0000-0000-0000-000000000003'::uuid, 'a0000002-0000-0000-0000-000000000004'::uuid, 'a0000002-0000-0000-0000-000000000005'::uuid, 'a0000002-0000-0000-0000-000000000006'::uuid, 'a0000002-0000-0000-0000-000000000007'::uuid, 'a0000002-0000-0000-0000-000000000008'::uuid, 'a0000002-0000-0000-0000-000000000009'::uuid, 'a0000002-0000-0000-0000-000000000010'::uuid, 'a0000002-0000-0000-0000-000000000011'::uuid, 'a0000002-0000-0000-0000-000000000012'::uuid, 'a0000002-0000-0000-0000-000000000013'::uuid])
) v
WHERE NOT EXISTS (SELECT 1 FROM reflect_competencies x WHERE x.framework_id = 'f2000001-0000-0000-0000-000000000001');

INSERT INTO reflect_behaviors (competency_id, level_tier, text_en, text_ar, source, display_order)
SELECT rc2.id, b.level_tier, b.text_en, b.text_ar, b.source,
       row_number() OVER (PARTITION BY rc2.id ORDER BY coalesce(m.src_order, 0), b.display_order)
FROM reflect_frameworks f1
JOIN reflect_competencies rc1 ON rc1.framework_id = f1.id
JOIN reflect_behaviors b ON b.competency_id = rc1.id
LEFT JOIN v1_to_v2 m ON m.old_id = rc1.ac_competency_id
JOIN reflect_competencies rc2 ON rc2.framework_id = 'f2000001-0000-0000-0000-000000000001'
  AND rc2.ac_competency_id = coalesce(m.new_id, rc1.ac_competency_id)
WHERE f1.is_template AND f1.engagement_id IS NULL AND f1.name_en = 'VIFM Competency Framework (Full)'
  AND NOT EXISTS (SELECT 1 FROM reflect_behaviors x JOIN reflect_competencies y ON y.id = x.competency_id
                  WHERE y.framework_id = 'f2000001-0000-0000-0000-000000000001');

UPDATE reflect_frameworks SET is_active = false
WHERE is_template AND engagement_id IS NULL AND name_en = 'VIFM Competency Framework (Full)';

-- ── 10. Retire v1 and activate v2 ──────────────────────────────
UPDATE competencies c SET superseded_by = m.new_id, retired_at = coalesce(c.retired_at, now())
FROM v1_to_v2 m WHERE c.id = m.old_id;
UPDATE competencies SET retired_at = coalesce(retired_at, now())
WHERE id = ANY(ARRAY['a0000001-0000-0000-0000-000000000003'::uuid, 'a0000001-0000-0000-0000-000000000009'::uuid]);
UPDATE competency_clusters SET retired_at = coalesce(retired_at, now())
WHERE id = ANY(ARRAY['c1000001-0000-0000-0000-000000000004'::uuid]);

UPDATE competency_framework_versions SET is_active = false WHERE version <> 2 AND is_active;
UPDATE competency_framework_versions SET is_active = true, activated_at = coalesce(activated_at, now()) WHERE version = 2;

COMMIT;

NOTIFY pgrst, 'reload schema';
