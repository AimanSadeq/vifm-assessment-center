-- ============================================================
-- VIFM Assessment Center — Arabic for the competency framework
-- Migration 00071
--
-- Adds Arabic columns to the competency tables and populates them for
-- all 4 domains, 8 clusters, and 38 competencies (names + descriptions).
-- English columns (name / description) are UNCHANGED and remain the
-- fallback. Display code picks name_ar when the locale is Arabic
-- (rtl ? name_ar ?? name : name), mirroring the Reflect pattern.
--
-- Safe & additive: new nullable columns; UPDATE-by-UUID (clusters,
-- competencies) and by-name (domains, whose name is UNIQUE and stays
-- the English key used by talent-map). Idempotent.
-- ============================================================

ALTER TABLE competency_domains  ADD COLUMN IF NOT EXISTS name_ar        text;
ALTER TABLE competency_clusters ADD COLUMN IF NOT EXISTS name_ar        text;
ALTER TABLE competencies        ADD COLUMN IF NOT EXISTS name_ar        text;
ALTER TABLE competencies        ADD COLUMN IF NOT EXISTS description_ar text;

-- ── Domains (by name; the English name stays the code key) ──
UPDATE competency_domains SET name_ar = 'التفكير' WHERE name = 'THINKING';
UPDATE competency_domains SET name_ar = 'النتائج' WHERE name = 'RESULTS';
UPDATE competency_domains SET name_ar = 'الأشخاص' WHERE name = 'PEOPLE';
UPDATE competency_domains SET name_ar = 'الذات'   WHERE name = 'SELF';

-- ── Clusters (by UUID) ──
UPDATE competency_clusters SET name_ar = 'التفكير الاستراتيجي والتجاري'   WHERE id = 'c1000001-0000-0000-0000-000000000001';
UPDATE competency_clusters SET name_ar = 'الابتكار والتعامل مع التعقيد'    WHERE id = 'c1000001-0000-0000-0000-000000000002';
UPDATE competency_clusters SET name_ar = 'الإنجاز والتنفيذ'               WHERE id = 'c1000001-0000-0000-0000-000000000003';
UPDATE competency_clusters SET name_ar = 'التكيّف والتغيير'              WHERE id = 'c1000001-0000-0000-0000-000000000004';
UPDATE competency_clusters SET name_ar = 'التأثير والتواصل'              WHERE id = 'c1000001-0000-0000-0000-000000000005';
UPDATE competency_clusters SET name_ar = 'قيادة الآخرين وتطويرهم'         WHERE id = 'c1000001-0000-0000-0000-000000000006';
UPDATE competency_clusters SET name_ar = 'النزاهة والشخصية'              WHERE id = 'c1000001-0000-0000-0000-000000000007';
UPDATE competency_clusters SET name_ar = 'النمو والفاعلية الشخصية'        WHERE id = 'c1000001-0000-0000-0000-000000000008';

-- ── Competencies (by UUID): name_ar + description_ar ──
-- Cluster 1
UPDATE competencies SET name_ar = 'رسم الاستراتيجية المستقبلية', description_ar = 'يستشرف كيف ستتغيّر الأسواق والتشريعات واحتياجات العملاء، ويحوّل تلك البصيرة إلى توجّه استراتيجي واضح.' WHERE id = 'a0000001-0000-0000-0000-000000000001';
UPDATE competencies SET name_ar = 'الوعي التجاري ووعي السوق', description_ar = 'يقرأ المشهد التنافسي والاقتصادي لاكتشاف الفرص والمخاطر التي تخدم أهداف المنظمة.' WHERE id = 'a0000001-0000-0000-0000-000000000002';
UPDATE competencies SET name_ar = 'الإلمام والفطنة المالية', description_ar = 'يفسّر القوائم والنسب ومؤشرات رأس المال والسيولة، ويستخدمها لموازنة المفاضلات وتبرير القرارات.' WHERE id = 'a0000001-0000-0000-0000-000000000003';
UPDATE competencies SET name_ar = 'التحليل النقدي', description_ar = 'يُفكّك المشكلات الغامضة والكثيفة بالبيانات، ويختبر الافتراضات، ويوازن الأدلة للوصول إلى استنتاجات مدروسة.' WHERE id = 'a0000001-0000-0000-0000-000000000004';
UPDATE competencies SET name_ar = 'سلامة الحُكم', description_ar = 'يتّخذ قرارات متوازنة وفي الوقت المناسب رغم نقص المعلومات، مع مراعاة المخاطر وأصحاب المصلحة والتبعات غير المباشرة.' WHERE id = 'a0000001-0000-0000-0000-000000000005';
-- Cluster 2
UPDATE competencies SET name_ar = 'حل المشكلات الإبداعي', description_ar = 'يبتكر ويختبر أساليب أصيلة تُحسّن المنتجات أو العمليات أو النتائج بدلاً من الاكتفاء بالمألوف.' WHERE id = 'a0000001-0000-0000-0000-000000000006';
UPDATE competencies SET name_ar = 'التعامل مع التعقيد', description_ar = 'يستوعب المعلومات الكثيرة والمترابطة والمتضاربة أحياناً لتحديد المشكلات والتعامل معها.' WHERE id = 'a0000001-0000-0000-0000-000000000007';
UPDATE competencies SET name_ar = 'المنظور النظمي والعالمي', description_ar = 'يراعي النظام الأوسع — عبر الحدود والوظائف والاقتصاد الكلي — عند تأطير القضايا وتقدير الأثر.' WHERE id = 'a0000001-0000-0000-0000-000000000008';
UPDATE competencies SET name_ar = 'الطلاقة الرقمية والبياناتية', description_ar = 'يوظّف الأدوات الرقمية والأتمتة وتحليل البيانات لتحسين أداء العمل واتخاذ القرار.' WHERE id = 'a0000001-0000-0000-0000-000000000009';
-- Cluster 3
UPDATE competencies SET name_ar = 'المبادرة الاستباقية', description_ar = 'يتحرّك تجاه الفرص والتحديات الصعبة مبكّراً وبحماس، بدلاً من انتظار التوجيه.' WHERE id = 'a0000001-0000-0000-0000-000000000010';
UPDATE competencies SET name_ar = 'تملّك النتائج', description_ar = 'يقود العمل حتى تحقيق نتائج قابلة للقياس، محافظاً على الجهد والمعايير حتى في الظروف الصعبة.' WHERE id = 'a0000001-0000-0000-0000-000000000011';
UPDATE competencies SET name_ar = 'المساءلة عن الالتزامات', description_ar = 'يُحاسب نفسه والآخرين على ما تم التعهّد به، ويفي بالمواعيد والجودة بشفافية.' WHERE id = 'a0000001-0000-0000-0000-000000000012';
UPDATE competencies SET name_ar = 'التخطيط وترتيب الأولويات', description_ar = 'ينظّم العمل وموارده بحيث تُنجَز أهم الالتزامات بما يتوافق مع أهداف المنظمة.' WHERE id = 'a0000001-0000-0000-0000-000000000013';
UPDATE competencies SET name_ar = 'تحسين العمليات', description_ar = 'يصمّم ويحسّن سير العمل لتحقيق الكفاءة والضبط، بتحسين مستمر ودون التفريط في الالتزام.' WHERE id = 'a0000001-0000-0000-0000-000000000014';
-- Cluster 4
UPDATE competencies SET name_ar = 'العمل وسط عدم اليقين', description_ar = 'يبقى فاعلاً وحاسماً عندما يكون التوجّه أو البيانات أو الظروف غير واضحة أو متغيّرة.' WHERE id = 'a0000001-0000-0000-0000-000000000015';
UPDATE competencies SET name_ar = 'التعلّم بالممارسة', description_ar = 'يجرّب عند مواجهة مشكلات غير مألوفة ويعدّل بسرعة، متعاملاً مع النجاحات والإخفاقات كمصدر للمعرفة.' WHERE id = 'a0000001-0000-0000-0000-000000000016';
UPDATE competencies SET name_ar = 'الصمود تحت الضغط', description_ar = 'يتعافى من الانتكاسات وأعباء العمل المستمرة والشدائد مع الحفاظ على الأداء ورباطة الجأش.' WHERE id = 'a0000001-0000-0000-0000-000000000017';
UPDATE competencies SET name_ar = 'الحشد حول الغاية', description_ar = 'يرسم وجهةً مُلهمة تربط عمل الأفراد بغاية أكبر وتحفّز على الفعل.' WHERE id = 'a0000001-0000-0000-0000-000000000018';
-- Cluster 5
UPDATE competencies SET name_ar = 'التواصل الواضح والمرن', description_ar = 'ينقل المحتوى المعقّد والاستراتيجي بوضوح، مكيّفاً الرسالة وأسلوبها وفق الجمهور المختلف.' WHERE id = 'a0000001-0000-0000-0000-000000000019';
UPDATE competencies SET name_ar = 'الإقناع وكسب التأييد', description_ar = 'يبني حججاً منطقية تراعي الجمهور وتكسب دعماً والتزاماً حقيقياً لا مجرّد امتثال.' WHERE id = 'a0000001-0000-0000-0000-000000000020';
UPDATE competencies SET name_ar = 'إدارة الخلاف البنّاءة', description_ar = 'يُظهر الخلاف ويحلّه بصراحة وهدوء، محافظاً على العلاقات والزخم.' WHERE id = 'a0000001-0000-0000-0000-000000000021';
UPDATE competencies SET name_ar = 'التفاوض المبدئي', description_ar = 'يتوصّل إلى اتفاقات مستدامة ومجدية للطرفين عبر الإعداد والحوار والمفاضلات العادلة.' WHERE id = 'a0000001-0000-0000-0000-000000000022';
UPDATE competencies SET name_ar = 'شبكات العلاقات', description_ar = 'يبني ويصون علاقات داخلية وخارجية مفيدة تتيح الوصول والبصيرة والتأثير.' WHERE id = 'a0000001-0000-0000-0000-000000000023';
-- Cluster 6
UPDATE competencies SET name_ar = 'التوجيه وتنمية المواهب', description_ar = 'يطوّر الآخرين نحو إمكاناتهم واحتياجات المنظمة عبر التغذية الراجعة والمهام الممتدّة والدعم.' WHERE id = 'a0000001-0000-0000-0000-000000000024';
UPDATE competencies SET name_ar = 'بناء فرق متماسكة', description_ar = 'يُكوّن فرقاً ذات هوية وغاية مشتركة تجمع نقاط قوة متنوّعة لتُنجز معاً.' WHERE id = 'a0000001-0000-0000-0000-000000000025';
UPDATE competencies SET name_ar = 'التعاون عبر الوظائف', description_ar = 'يتشارك عبر الوحدات والتخصصات لتحقيق الأهداف المشتركة فوق المصالح الضيّقة.' WHERE id = 'a0000001-0000-0000-0000-000000000026';
UPDATE competencies SET name_ar = 'الثقة والمصداقية', description_ar = 'يكسب الثقة بالصدق والاتّساق والوفاء، فيغدو شخصاً يعتمد عليه الآخرون.' WHERE id = 'a0000001-0000-0000-0000-000000000027';
UPDATE competencies SET name_ar = 'المرونة في التعامل', description_ar = 'يكيّف أسلوبه ونهجه آنياً بما يناسب الشخص والموقف دون فقدان أصالته.' WHERE id = 'a0000001-0000-0000-0000-000000000028';
-- Cluster 7
UPDATE competencies SET name_ar = 'الاستبصار الذاتي', description_ar = 'يستخدم التغذية الراجعة والتأمّل لفهم نقاط قوته وحدوده وأثره، ويتصرّف بناءً على ذلك.' WHERE id = 'a0000001-0000-0000-0000-000000000029';
UPDATE competencies SET name_ar = 'تنظيم الانفعالات والتعاطف', description_ar = 'يدرك ويضبط انفعالاته ويقرأ انفعالات الآخرين، فيستجيب بما يلائم الموقف.' WHERE id = 'a0000001-0000-0000-0000-000000000030';
UPDATE competencies SET name_ar = 'الشجاعة المبدئية', description_ar = 'يطرح القضايا الصعبة ويقول ما يجب قوله، ولو على حساب مكانته الشخصية أو التنظيمية.' WHERE id = 'a0000001-0000-0000-0000-000000000031';
UPDATE competencies SET name_ar = 'السلوك الأخلاقي', description_ar = 'يتصرّف بأمانة وعدل، ملتزماً بروح المعايير المهنية والتنظيمية ونصّها.' WHERE id = 'a0000001-0000-0000-0000-000000000032';
UPDATE competencies SET name_ar = 'الحساسية الثقافية والشمول', description_ar = 'يتفهّم ويحترم الأعراف ووجهات النظر المتنوّعة، ويعمل بروح الشمول عبرها.' WHERE id = 'a0000001-0000-0000-0000-000000000033';
-- Cluster 8
UPDATE competencies SET name_ar = 'القدرة على التعلّم التكيّفي', description_ar = 'يتعلّم بسرعة من المواقف الجديدة وغير المسبوقة ويطبّق الدروس للأداء في ظروف غير مألوفة.' WHERE id = 'a0000001-0000-0000-0000-000000000034';
UPDATE competencies SET name_ar = 'التطوير الذاتي المستمر', description_ar = 'يسعى بنشاط إلى النمو عبر القنوات الرسمية وغير الرسمية ويوظّفه لرفع أدائه.' WHERE id = 'a0000001-0000-0000-0000-000000000035';
UPDATE competencies SET name_ar = 'رباطة الجأش تحت الضغط', description_ar = 'يبقى هادئاً وواضحاً وبنّاءً تحت الضغط أو التدقيق.' WHERE id = 'a0000001-0000-0000-0000-000000000036';
UPDATE competencies SET name_ar = 'العافية المستدامة', description_ar = 'يدير طاقته ومتطلبات العمل والحياة لاستدامة الأداء عبر الزمن.' WHERE id = 'a0000001-0000-0000-0000-000000000037';
UPDATE competencies SET name_ar = 'حشد الموارد', description_ar = 'يؤمّن ويوظّف الأفراد والميزانية والأدوات بفاعلية لإنجاز العمل.' WHERE id = 'a0000001-0000-0000-0000-000000000038';
