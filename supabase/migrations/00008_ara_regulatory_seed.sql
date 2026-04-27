-- ============================================================
-- VIFM ARA - Regulatory Frameworks Seed Data
-- Migration 00008: UAE + Saudi Arabia frameworks and
-- requirements per handover Section 11.5 & 11.6.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- UAE FRAMEWORKS
-- ────────────────────────────────────────────────────────────

-- UAE_PDPL - Tier 1 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'uae', 'UAE_PDPL',
  'UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)',
  'قانون حماية البيانات الشخصية الإماراتي',
  'UAE Data Office', 'مكتب الإمارات للبيانات',
  'data_privacy', 1, true, '["all"]'::jsonb,
  'https://uaelegislation.gov.ae/en/legislations/1972', 10
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('UAE_PDPL_01', 'Organization has identified and documented a legal basis for all personal data processing including AI-driven processing.', 'حددت المنظمة ووثقت الأساس القانوني لجميع أنشطة معالجة البيانات الشخصية.', 'data_privacy', 'data', 'mandatory', 1),
  ('UAE_PDPL_02', 'Organization has appointed a Data Protection Officer where required - particularly for large-scale processing of sensitive data.', 'عينت المنظمة مسؤول حماية البيانات حيثما لزم.', 'data_privacy', 'governance', 'mandatory', 2),
  ('UAE_PDPL_03', 'Organization maintains a Record of Processing Activities documenting all personal data processing including AI system inputs and outputs.', 'تحتفظ المنظمة بسجل أنشطة المعالجة.', 'data_privacy', 'data', 'mandatory', 3),
  ('UAE_PDPL_04', 'Organization conducts Data Protection Impact Assessments before deploying AI systems involving automated decision-making or large-scale sensitive data.', 'تجري المنظمة تقييمات تأثير حماية البيانات قبل نشر أنظمة الذكاء الاصطناعي.', 'data_privacy', 'governance', 'mandatory', 4),
  ('UAE_PDPL_05', 'Organization has mechanisms enabling data subjects to exercise their rights - access, rectification, erasure, restriction, objection - including when AI processes their data.', 'لدى المنظمة آليات تمكن أصحاب البيانات من ممارسة حقوقهم.', 'data_privacy', 'governance', 'mandatory', 5),
  ('UAE_PDPL_06', 'Cross-border transfers of personal data processed by AI systems are permitted only to countries with adequate data protection or under appropriate safeguards.', 'تتم عمليات نقل البيانات عبر الحدود فقط إلى دول توفر حماية كافية.', 'data_privacy', 'technology', 'mandatory', 6),
  ('UAE_PDPL_07', 'Organization has a documented data breach incident response plan covering AI system breaches.', 'لدى المنظمة خطة موثقة للاستجابة لاختراقات البيانات.', 'data_privacy', 'governance', 'mandatory', 7),
  ('UAE_PDPL_08', 'Employees using AI tools receive regular training on PDPL obligations and data protection best practices.', 'يتلقى الموظفون تدريباً منتظماً على التزامات القانون.', 'data_privacy', 'talent', 'mandatory', 8)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'UAE_PDPL';


-- UAE_AI_STRATEGY - Tier 2 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'uae', 'UAE_AI_STRATEGY',
  'UAE National AI Strategy 2031',
  'استراتيجية الإمارات الوطنية للذكاء الاصطناعي 2031',
  'UAE AI Office', 'مكتب الإمارات للذكاء الاصطناعي',
  'strategy', 2, false, '["all"]'::jsonb,
  'https://ai.gov.ae/strategy/', 20
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('UAE_AIS_01', 'Organization''s AI strategy explicitly references and aligns to UAE National AI Strategy 2031 goals.', 'تشير استراتيجية الذكاء الاصطناعي للمنظمة إلى أهداف استراتيجية الإمارات 2031.', 'strategy', 'strategy', 'mandatory', 1),
  ('UAE_AIS_02', 'Organization has a named executive sponsor accountable for AI strategy alignment to national AI goals.', 'لدى المنظمة راعٍ تنفيذي مسمى مسؤول عن توافق استراتيجية الذكاء الاصطناعي.', 'strategy', 'strategy', 'mandatory', 2),
  ('UAE_AIS_03', 'Organization has identified and prioritized AI use cases aligned to its mission and UAE Vision sectors.', 'حددت المنظمة حالات استخدام الذكاء الاصطناعي المتوافقة مع مهمتها وقطاعات رؤية الإمارات.', 'strategy', 'operations', 'recommended', 3),
  ('UAE_AIS_04', 'Organization is aware of UAE AI Office programs and UAE AI Seal criteria for responsible AI certification.', 'المنظمة على دراية ببرامج مكتب الإمارات للذكاء الاصطناعي ومعايير ختم الذكاء الاصطناعي.', 'strategy', 'governance', 'advisory', 4)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'UAE_AI_STRATEGY';


-- UAE_AI_CHARTER - Tier 2 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'uae', 'UAE_AI_CHARTER',
  'UAE Charter for the Development and Use of AI (June 2024 - 12 Principles)',
  'ميثاق الإمارات لتطوير واستخدام الذكاء الاصطناعي',
  'UAE Ministry of AI', 'وزارة الذكاء الاصطناعي',
  'ethics', 2, false, '["all"]'::jsonb,
  'https://uaelegislation.gov.ae/en/policy/details/the-uae-charter-for-the-development-and-use-of-artificial-intelligence',
  30
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('UAE_CHARTER_01', 'AI systems prioritize human well-being and do not compromise human safety or fundamental rights.', 'تعطي أنظمة الذكاء الاصطناعي الأولوية لرفاهية الإنسان.', 'ethics', 'governance', 'recommended', 1),
  ('UAE_CHARTER_02', 'Organization has assessed AI systems for algorithmic bias and fairness.', 'قيّمت المنظمة أنظمة الذكاء الاصطناعي للتحيز الخوارزمي والعدالة.', 'ethics', 'model_management', 'recommended', 2),
  ('UAE_CHARTER_03', 'AI systems are transparent - users are informed when interacting with or affected by AI.', 'أنظمة الذكاء الاصطناعي شفافة ويُخطر المستخدمون عند تفاعلهم معها.', 'transparency', 'governance', 'recommended', 3),
  ('UAE_CHARTER_04', 'Organization maintains human oversight and control over AI systems for high-stakes decisions.', 'تحافظ المنظمة على الرقابة البشرية على أنظمة الذكاء الاصطناعي.', 'ai_governance', 'model_management', 'recommended', 4),
  ('UAE_CHARTER_05', 'Organization has a governance and accountability structure for AI with clear ownership and defined responsibility.', 'لدى المنظمة هيكل حوكمة ومساءلة للذكاء الاصطناعي مع ملكية واضحة.', 'ai_governance', 'governance', 'recommended', 5)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'UAE_AI_CHARTER';


-- UAE_AI_ETHICS - Tier 3 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, display_order
) VALUES (
  'uae', 'UAE_AI_ETHICS',
  'UAE AI Ethics Guide (2022)',
  'دليل أخلاقيات الذكاء الاصطناعي الإماراتي',
  'UAE AI Office', 'مكتب الإمارات للذكاء الاصطناعي',
  'ethics', 3, false, '["all"]'::jsonb, 40
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('UAE_ETHICS_01', 'Organization has a documented AI ethics policy covering fairness, transparency, accountability, privacy, and safety.', 'لدى المنظمة سياسة أخلاقيات موثقة للذكاء الاصطناعي.', 'ethics', 'governance', 'advisory', 1),
  ('UAE_ETHICS_02', 'AI ethics considerations are embedded in the organization''s AI project lifecycle.', 'اعتبارات أخلاقيات الذكاء الاصطناعي مدمجة في دورة حياة المشاريع.', 'ethics', 'model_management', 'advisory', 2)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'UAE_AI_ETHICS';


-- UAE_TDRA - Tier 1 - Government sector only
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'uae', 'UAE_TDRA',
  'TDRA Digital Government Regulations',
  'لوائح هيئة تنظيم الاتصالات والحكومة الرقمية',
  'TDRA', 'هيئة تنظيم الاتصالات والحكومة الرقمية',
  'cybersecurity', 1, true, '["government"]'::jsonb,
  'https://tdra.gov.ae/', 50
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, applies_to_sectors, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, '["government"]'::jsonb, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('UAE_TDRA_01', 'Government entity complies with TDRA data residency requirements - government data must not be stored outside UAE without authorization.', 'تمتثل الجهة الحكومية لمتطلبات إقامة بيانات TDRA.', 'cybersecurity', 'technology', 'mandatory', 1),
  ('UAE_TDRA_02', 'AI tools used in citizen-facing government services meet TDRA accessibility, security, and transparency standards.', 'تستوفي أدوات الذكاء الاصطناعي في الخدمات الحكومية معايير TDRA.', 'ai_governance', 'technology', 'mandatory', 2),
  ('UAE_TDRA_03', 'Cloud services used comply with TDRA data residency requirements for government data classification levels.', 'الخدمات السحابية المستخدمة تمتثل لمتطلبات إقامة بيانات TDRA.', 'cybersecurity', 'technology', 'mandatory', 3)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'UAE_TDRA';


-- UAE_DCAI - Tier 2 - Government sector (Dubai only)
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'uae', 'UAE_DCAI',
  'Dubai Centre for Artificial Intelligence (DCAI) Guidelines',
  'إرشادات مركز دبي للذكاء الاصطناعي',
  'DCAI', 'مركز دبي للذكاء الاصطناعي',
  'ai_governance', 2, false, '["government"]'::jsonb,
  'https://ai.dubai.gov.ae/', 60
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, applies_to_sectors, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, '["government"]'::jsonb, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('UAE_DCAI_01', 'Dubai government entity has registered AI use cases per DCAI guidelines.', 'سجّلت الجهة الحكومية في دبي حالات استخدام الذكاء الاصطناعي وفق إرشادات DCAI.', 'ai_governance', 'operations', 'mandatory', 1),
  ('UAE_DCAI_02', 'Organization follows DCAI AI deployment and governance guidelines for all AI systems.', 'تتبع المنظمة إرشادات DCAI لجميع أنظمة الذكاء الاصطناعي.', 'ai_governance', 'governance', 'mandatory', 2)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'UAE_DCAI';


-- UAE_ADDA - Tier 2 - Government sector (Abu Dhabi only)
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'uae', 'UAE_ADDA',
  'Abu Dhabi Digital Authority (ADDA) Data and AI Standards',
  'معايير البيانات والذكاء الاصطناعي لسلطة أبوظبي الرقمية',
  'ADDA', 'سلطة أبوظبي الرقمية',
  'ai_governance', 2, false, '["government"]'::jsonb,
  'https://adda.gov.ae/', 70
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, applies_to_sectors, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, '["government"]'::jsonb, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('UAE_ADDA_01', 'Abu Dhabi entity complies with ADDA data governance and AI standards for all AI systems.', 'تمتثل الجهة في أبوظبي لمعايير ADDA لجميع أنظمة الذكاء الاصطناعي.', 'ai_governance', 'governance', 'mandatory', 1),
  ('UAE_ADDA_02', 'Data used in AI systems is managed per ADDA data policies including classification, quality, and access control.', 'البيانات المستخدمة في أنظمة الذكاء الاصطناعي مُدارة وفق سياسات ADDA.', 'ai_governance', 'data', 'mandatory', 2)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'UAE_ADDA';


-- ────────────────────────────────────────────────────────────
-- SAUDI ARABIA FRAMEWORKS
-- ────────────────────────────────────────────────────────────

-- SAU_PDPL - Tier 1 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_PDPL',
  'Saudi Personal Data Protection Law (Royal Decree M/19, amended M/148) - Enforceable since September 14, 2024',
  'نظام حماية البيانات الشخصية السعودي',
  'SDAIA', 'هيئة البيانات والذكاء الاصطناعي السعودية',
  'data_privacy', 1, true, '["all"]'::jsonb,
  'https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx', 10
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_PDPL_01', 'Organization has identified and documented a legal basis for all personal data processing including AI-driven processing of Saudi residents'' data.', 'حددت المنظمة ووثقت الأساس القانوني لجميع معالجة البيانات.', 'data_privacy', 'data', 'mandatory', 1),
  ('SAU_PDPL_02', 'Personal data of Saudi residents processed by AI remains within Saudi Arabia unless cross-border transfer conditions under the updated Data Transfer Regulation (September 2024) are satisfied.', 'تبقى البيانات الشخصية للمقيمين السعوديين داخل المملكة إلا إذا استوفت شروط النقل.', 'data_privacy', 'technology', 'mandatory', 2),
  ('SAU_PDPL_03', 'Organization has appointed a Data Protection Officer or equivalent role responsible for PDPL compliance.', 'عينت المنظمة مسؤول حماية البيانات.', 'data_privacy', 'governance', 'mandatory', 3),
  ('SAU_PDPL_04', 'Organization maintains a Record of Processing Activities for all personal data including AI inputs and outputs - retained for 5 years.', 'تحتفظ المنظمة بسجل أنشطة المعالجة لمدة 5 سنوات.', 'data_privacy', 'data', 'mandatory', 4),
  ('SAU_PDPL_05', 'Organization has mechanisms enabling Saudi residents to exercise PDPL rights including when data is processed by AI.', 'لدى المنظمة آليات تمكن المقيمين من ممارسة حقوقهم.', 'data_privacy', 'governance', 'mandatory', 5),
  ('SAU_PDPL_06', 'Sensitive personal data processed by AI - ethnic origin, health, biometric, location, credit - is classified and handled with additional safeguards.', 'البيانات الحساسة التي يعالجها الذكاء الاصطناعي مصنفة ومعالجة بضمانات إضافية.', 'data_privacy', 'data', 'mandatory', 6),
  ('SAU_PDPL_07', 'Organization has a documented data breach incident response plan covering AI-related breaches with SDAIA notification protocols.', 'لدى المنظمة خطة استجابة لخروقات البيانات مع بروتوكولات إشعار SDAIA.', 'data_privacy', 'governance', 'mandatory', 7),
  ('SAU_PDPL_08', 'Employees using AI tools receive regular training on Saudi PDPL obligations and secure data handling.', 'يتلقى الموظفون تدريباً على التزامات نظام حماية البيانات.', 'data_privacy', 'talent', 'mandatory', 8)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_PDPL';


-- SAU_SDAIA_NDGF - Tier 1 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_SDAIA_NDGF',
  'SDAIA National Data Governance Framework',
  'إطار حوكمة البيانات الوطني',
  'SDAIA / NDMO', 'هيئة البيانات والذكاء الاصطناعي / المكتب الوطني لإدارة البيانات',
  'ai_governance', 1, true, '["all"]'::jsonb,
  'https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx', 20
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_NDGF_01', 'Organization has adopted SDAIA/NDMO data classification standards - all AI system data is classified by sensitivity level.', 'اعتمدت المنظمة معايير تصنيف البيانات وجميع بيانات أنظمة الذكاء الاصطناعي مصنفة.', 'ai_governance', 'data', 'mandatory', 1),
  ('SAU_NDGF_02', 'Data governance roles are formally assigned - data owners, stewards, and custodians identified for all AI-related data assets.', 'أدوار حوكمة البيانات محددة رسمياً بما في ذلك لأصول بيانات الذكاء الاصطناعي.', 'ai_governance', 'data', 'mandatory', 2),
  ('SAU_NDGF_03', 'National or sensitive government data used in AI is not processed by non-approved external AI tools or cloud platforms.', 'البيانات الحكومية الحساسة لا تُعالج بأدوات خارجية غير معتمدة.', 'ai_governance', 'technology', 'mandatory', 3),
  ('SAU_NDGF_04', 'Organization has a data catalog documenting all data assets used in AI systems per NDMO standards.', 'لدى المنظمة كتالوج بيانات يوثق أصول بيانات الذكاء الاصطناعي.', 'ai_governance', 'data', 'recommended', 4),
  ('SAU_NDGF_05', 'Organization''s AI governance policy is formally aligned with SDAIA National Data Governance Framework and reviewed annually.', 'سياسة حوكمة الذكاء الاصطناعي متوافقة مع إطار SDAIA ومراجعة سنوياً.', 'ai_governance', 'governance', 'mandatory', 5)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_SDAIA_NDGF';


-- SAU_NCA_ECC - Tier 1 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_NCA_ECC',
  'NCA Essential Cybersecurity Controls (ECC-2:2024 - updated October 2024)',
  'الضوابط الأساسية للأمن السيبراني',
  'NCA', 'الهيئة الوطنية للأمن السيبراني',
  'cybersecurity', 1, true, '["all"]'::jsonb,
  'https://nca.gov.sa/en/regulatory-documents/controls-list/ecc/', 30
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_ECC_01', 'Organization has a documented cybersecurity governance framework covering AI systems, model security, and AI-related threat management.', 'لدى المنظمة إطار حوكمة أمن سيبراني موثق يشمل أنظمة الذكاء الاصطناعي.', 'cybersecurity', 'governance', 'mandatory', 1),
  ('SAU_ECC_02', 'Organization implements access controls and identity management for AI systems including multi-factor authentication for sensitive data systems.', 'تطبق المنظمة ضوابط الوصول وإدارة الهوية لأنظمة الذكاء الاصطناعي.', 'cybersecurity', 'technology', 'mandatory', 2),
  ('SAU_ECC_03', 'Organization conducts regular cybersecurity risk assessments covering AI system vulnerabilities, model tampering, and training data integrity.', 'تجري المنظمة تقييمات منتظمة لمخاطر الأمن السيبراني تغطي ثغرات أنظمة الذكاء الاصطناعي.', 'cybersecurity', 'governance', 'mandatory', 3),
  ('SAU_ECC_04', 'Organization has an incident response plan covering AI-related cybersecurity incidents aligned to NCA ECC-2:2024.', 'لدى المنظمة خطة استجابة للحوادث تغطي الحوادث السيبرانية المتعلقة بالذكاء الاصطناعي.', 'cybersecurity', 'governance', 'mandatory', 4),
  ('SAU_ECC_05', 'Employee use of public AI tools is governed by a formal AI Acceptable Use Policy aligned to NCA cybersecurity controls.', 'استخدام الموظفين لأدوات الذكاء الاصطناعي العامة محكوم بسياسة استخدام مقبول رسمية.', 'cybersecurity', 'governance', 'mandatory', 5),
  ('SAU_ECC_06', 'Organization runs regular cybersecurity awareness programs covering AI-specific threats - phishing via AI, data leakage, deepfakes.', 'تنفذ المنظمة برامج توعية بالأمن السيبراني تغطي التهديدات الخاصة بالذكاء الاصطناعي.', 'cybersecurity', 'talent', 'mandatory', 6)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_NCA_ECC';


-- SAU_NCA_CCC - Tier 1 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_NCA_CCC',
  'NCA Cloud Cybersecurity Controls (CCC-2:2024 - updated 2024)',
  'ضوابط الأمن السيبراني للحوسبة السحابية',
  'NCA', 'الهيئة الوطنية للأمن السيبراني',
  'cybersecurity', 1, true, '["all"]'::jsonb,
  'https://nca.gov.sa/en/regulatory-documents/controls-list/ccc/', 40
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_CCC_01', 'All cloud services used for AI processing are hosted in data centers physically within Saudi Arabia unless NDMO assessment permits otherwise.', 'جميع الخدمات السحابية لمعالجة الذكاء الاصطناعي مستضافة داخل المملكة.', 'cybersecurity', 'technology', 'mandatory', 1),
  ('SAU_CCC_02', 'Organization has assessed all cloud AI services against NCA Cloud Cybersecurity Controls CCC-2:2024 requirements.', 'قيّمت المنظمة جميع خدمات الذكاء الاصطناعي السحابية وفق متطلبات NCA CCC-2:2024.', 'cybersecurity', 'technology', 'mandatory', 2),
  ('SAU_CCC_03', 'Contracts with cloud AI service providers obligate the provider to comply with NCA CCC requirements and Saudi data protection obligations.', 'عقود مزودي الخدمات السحابية تلزمهم بالامتثال لمتطلبات NCA CCC.', 'cybersecurity', 'technology', 'mandatory', 3)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_NCA_CCC';


-- SAU_SDAIA_ETHICS - Tier 3 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_SDAIA_ETHICS',
  'SDAIA AI Ethics Principles (2023 v2 - 12 principles)',
  'مبادئ أخلاقيات الذكاء الاصطناعي لهيئة SDAIA',
  'SDAIA', 'هيئة البيانات والذكاء الاصطناعي',
  'ethics', 3, false, '["all"]'::jsonb,
  'https://sdaia.gov.sa/en/SDAIA/about/Pages/AIEthics.aspx', 50
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_ETHICS_01', 'Organization has adopted SDAIA AI Ethics Principles as foundation for its AI governance policy.', 'اعتمدت المنظمة مبادئ أخلاقيات SDAIA أساساً لسياسة حوكمة الذكاء الاصطناعي.', 'ethics', 'governance', 'advisory', 1),
  ('SAU_ETHICS_02', 'AI systems are assessed against SDAIA ethics principles before launch with documented fairness testing and bias review.', 'تُقيَّم أنظمة الذكاء الاصطناعي وفق مبادئ أخلاقيات SDAIA قبل الإطلاق.', 'ethics', 'model_management', 'advisory', 2)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_SDAIA_ETHICS';


-- SAU_SDAIA_AAF - Tier 2 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_SDAIA_AAF',
  'SDAIA AI Adoption Framework (September 2024)',
  'إطار اعتماد الذكاء الاصطناعي لهيئة SDAIA',
  'SDAIA', 'هيئة البيانات والذكاء الاصطناعي',
  'ai_governance', 2, false, '["all"]'::jsonb,
  'https://sdaia.gov.sa/en/SDAIA/about/Pages/AIAdoptionFramework.aspx', 60
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_AAF_01', 'Organization has established a formal AI governance structure with defined executive sponsorship and clear roles for AI compliance, security, and procurement.', 'أنشأت المنظمة هيكل حوكمة رسمي للذكاء الاصطناعي مع رعاية تنفيذية محددة.', 'ai_governance', 'governance', 'recommended', 1),
  ('SAU_AAF_02', 'Organization maintains an inventory of all AI systems in use with documented risk assessments per SDAIA AI Adoption Framework.', 'تحتفظ المنظمة بجرد لجميع أنظمة الذكاء الاصطناعي مع تقييمات موثقة للمخاطر.', 'ai_governance', 'model_management', 'recommended', 2),
  ('SAU_AAF_03', 'AI systems are assessed for data governance and PDPL compliance before deployment.', 'تُقيَّم أنظمة الذكاء الاصطناعي لحوكمة البيانات والامتثال قبل النشر.', 'ai_governance', 'data', 'recommended', 3),
  ('SAU_AAF_04', 'Organization has a workforce AI capability building plan covering AI literacy for all staff, technical skills for specialists, and AI-literate leadership.', 'لدى المنظمة خطة لبناء قدرات القوى العاملة في الذكاء الاصطناعي.', 'ai_governance', 'talent', 'recommended', 4),
  ('SAU_AAF_05', 'AI systems in production are monitored for performance degradation, safety issues, and unintended outputs with documented logs and review cycles.', 'أنظمة الذكاء الاصطناعي في الإنتاج مراقبة مع سجلات موثقة.', 'ai_governance', 'model_management', 'recommended', 5)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_SDAIA_AAF';


-- SAU_VISION2030 - Tier 2 - All sectors
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_VISION2030',
  'Saudi Vision 2030 - AI and Digital Transformation Targets',
  'رؤية المملكة العربية السعودية 2030',
  'Vision 2030 PMO', 'مكتب إدارة برنامج رؤية 2030',
  'strategy', 2, false, '["all"]'::jsonb,
  'https://www.vision2030.gov.sa/', 70
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_V30_01', 'Organization''s AI strategy explicitly references Vision 2030 goals and demonstrates how AI contributes to national transformation objectives.', 'تشير استراتيجية الذكاء الاصطناعي إلى أهداف رؤية 2030.', 'strategy', 'strategy', 'mandatory', 1),
  ('SAU_V30_02', 'Organization tracks and reports contribution of AI initiatives to Vision 2030 KPIs including efficiency gains and service improvements.', 'تتتبع المنظمة وتبلغ عن مساهمة مبادرات الذكاء الاصطناعي في مؤشرات رؤية 2030.', 'strategy', 'operations', 'recommended', 2)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_VISION2030';


-- SAU_SDAIA_GENAI - Tier 3 - Government sector only
INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_SDAIA_GENAI',
  'SDAIA Generative AI Guidelines for Government (January 2024)',
  'إرشادات الذكاء الاصطناعي التوليدي لهيئة SDAIA للحكومة',
  'SDAIA', 'هيئة البيانات والذكاء الاصطناعي',
  'ai_governance', 3, false, '["government"]'::jsonb,
  'https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx', 80
);

INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, applies_to_sectors, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, '["government"]'::jsonb, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_GENAI_01', 'Government employees have received training on SDAIA Generative AI Guidelines covering responsible use and data sharing restrictions.', 'تلقى موظفو الحكومة تدريباً على إرشادات الذكاء الاصطناعي التوليدي لـ SDAIA.', 'ai_governance', 'talent', 'recommended', 1),
  ('SAU_GENAI_02', 'Organization has a formal policy governing employee use of generative AI tools prohibiting sharing sensitive government data with public AI systems.', 'لدى المنظمة سياسة رسمية تحكم استخدام أدوات الذكاء الاصطناعي التوليدي.', 'ai_governance', 'governance', 'recommended', 2),
  ('SAU_GENAI_03', 'AI-generated content in official government communications is reviewed by a human before publication and disclosed as AI-assisted.', 'المحتوى الذي يولده الذكاء الاصطناعي في الاتصالات الرسمية يخضع لمراجعة بشرية.', 'transparency', 'model_management', 'recommended', 3)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_SDAIA_GENAI';
