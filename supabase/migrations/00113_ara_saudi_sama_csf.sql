-- ════════════════════════════════════════════════════════════════
-- 00113 - ARA regulatory: add the 9th Saudi framework (SAMA CSF)
--
-- The handover (Section 11) specifies 7 UAE + 9 Saudi frameworks, but the
-- 00008 seed shipped only 8 Saudi (PDPL, SDAIA NDGF, NCA ECC, NCA CCC, SDAIA
-- Ethics, SDAIA AAF, Vision 2030, SDAIA GenAI). The missing 9th is the Saudi
-- Central Bank (SAMA) Cyber Security Framework - the mandatory cyber framework
-- for SAMA-regulated financial institutions, directly relevant to the GCC
-- banking market this product targets. This backfills it with the same shape
-- as 00008 (framework row + AI-contextualised requirements mapped to pillars).
--
-- Idempotent: ON CONFLICT (framework_code) / (requirement_code) DO NOTHING.
-- ════════════════════════════════════════════════════════════════

INSERT INTO ara_regulatory_frameworks (
  region, framework_code, framework_name_en, framework_name_ar,
  authority_name_en, authority_name_ar, framework_category, tier,
  is_mandatory, applies_to_sectors, official_url, display_order
) VALUES (
  'saudi', 'SAU_SAMA_CSF',
  'SAMA Cyber Security Framework',
  'إطار الأمن السيبراني للبنك المركزي السعودي',
  'Saudi Central Bank (SAMA)', 'البنك المركزي السعودي (ساما)',
  'cybersecurity', 1, true, '["banking"]'::jsonb,
  'https://www.sama.gov.sa/en-US/RulesInstructions/CyberSecurity/Cyber%20Security%20Framework.pdf', 250
) ON CONFLICT (framework_code) DO NOTHING;

-- applies_to_sectors is set to ["banking"] on every requirement row to mirror
-- the 00008 convention (each sector-restricted framework propagates its sector
-- onto its requirements for defense-in-depth). The framework-level ["banking"]
-- gate is the effective control, but matching the rows keeps requirementApplies
-- consistent for any future path that loads requirements directly.
INSERT INTO ara_regulatory_requirements (framework_id, requirement_code, requirement_text_en, requirement_text_ar, requirement_category, pillar_id, severity, applies_to_sectors, display_order)
SELECT id, v.code, v.en, v.ar, v.cat, v.pillar, v.sev::ara_severity, '["banking"]'::jsonb, v.ord
FROM ara_regulatory_frameworks, (VALUES
  ('SAU_SAMA_01', 'Cyber security governance, with board and senior-management oversight, explicitly covers AI systems and AI-driven financial services.', 'تشمل حوكمة الأمن السيبراني، بإشراف مجلس الإدارة والإدارة العليا، أنظمة الذكاء الاصطناعي والخدمات المالية المعتمدة عليه.', 'cybersecurity', 'governance', 'mandatory', 1),
  ('SAU_SAMA_02', 'Third-party and cloud AI providers are subject to due diligence and outsourcing risk management aligned to SAMA cloud/outsourcing rules.', 'يخضع مزودو الذكاء الاصطناعي من الأطراف الثالثة والسحابة للعناية الواجبة وإدارة مخاطر الإسناد وفق قواعد ساما للسحابة والإسناد.', 'cybersecurity', 'technology', 'mandatory', 2),
  ('SAU_SAMA_03', 'Customer and financial data used to train or operate AI systems is classified and protected per SAMA data-protection and confidentiality requirements.', 'تُصنَّف وتُحمى بيانات العملاء والبيانات المالية المستخدمة في تدريب أو تشغيل أنظمة الذكاء الاصطناعي وفق متطلبات ساما لحماية البيانات والسرية.', 'cybersecurity', 'data', 'mandatory', 3),
  ('SAU_SAMA_04', 'Continuous security monitoring and threat detection cover AI/model systems, including anomaly detection on model inputs and outputs.', 'تغطي المراقبة الأمنية المستمرة وكشف التهديدات أنظمة النماذج والذكاء الاصطناعي، بما في ذلك كشف الشذوذ في مدخلات النماذج ومخرجاتها.', 'cybersecurity', 'operations', 'mandatory', 4),
  ('SAU_SAMA_05', 'Business continuity and resilience plans address AI-dependent processes so a model or AI-service failure does not disrupt critical banking operations.', 'تعالج خطط استمرارية الأعمال والمرونة العمليات المعتمدة على الذكاء الاصطناعي بحيث لا يؤدي تعطّل نموذج أو خدمة إلى تعطيل العمليات المصرفية الحرجة.', 'cybersecurity', 'operations', 'mandatory', 5),
  ('SAU_SAMA_06', 'Staff in cyber, risk and business functions receive role-based training on the secure and compliant use of AI in financial services.', 'يتلقى الموظفون في وظائف الأمن السيبراني والمخاطر والأعمال تدريباً قائماً على الدور حول الاستخدام الآمن والمتوافق للذكاء الاصطناعي في الخدمات المالية.', 'cybersecurity', 'talent', 'mandatory', 6)
) AS v(code, en, ar, cat, pillar, sev, ord)
WHERE framework_code = 'SAU_SAMA_CSF'
ON CONFLICT (requirement_code) DO NOTHING;
