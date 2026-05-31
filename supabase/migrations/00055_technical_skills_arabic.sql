-- ════════════════════════════════════════════════════════════════
-- Bilingual technical skills
--
-- technical_domains already carries name_ar (00054); technical_skills did not.
-- This adds name_ar so the self-served technical assessment runner (and its
-- per-skill result breakdown) can render skill names in Arabic, consistent with
-- the rest of the bilingual portal. English stays in `name` (the stable key the
-- assessment items reference); name_ar is display-only and admin-editable.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_skills ADD COLUMN IF NOT EXISTS name_ar text;

-- Seed Arabic display names, matched to the English `name` per domain.
UPDATE technical_skills s SET name_ar = v.name_ar
FROM (VALUES
  ('finance','Financial Modelling','النمذجة المالية'),
  ('finance','Capital Budgeting','الموازنة الرأسمالية'),
  ('finance','Cost of Capital (WACC)','تكلفة رأس المال (WACC)'),
  ('finance','Working Capital Management','إدارة رأس المال العامل'),
  ('finance','Financial Statement Analysis','تحليل القوائم المالية'),

  ('investment','Valuation (DCF & Multiples)','التقييم (التدفقات النقدية المخصومة والمضاعفات)'),
  ('investment','Portfolio Management','إدارة المحافظ الاستثمارية'),
  ('investment','Equity Analysis','تحليل الأسهم'),
  ('investment','Fixed Income','الدخل الثابت'),
  ('investment','Risk, Return & CAPM','المخاطر والعائد ونموذج تسعير الأصول الرأسمالية'),

  ('treasury','Cash & Liquidity Management','إدارة النقد والسيولة'),
  ('treasury','FX Risk Management','إدارة مخاطر الصرف الأجنبي'),
  ('treasury','Interest-Rate Risk','مخاطر أسعار الفائدة'),
  ('treasury','Funding & Capital Markets','التمويل وأسواق المال'),
  ('treasury','Bank Relationship Management','إدارة العلاقات المصرفية'),

  ('accounting','Financial Accounting','المحاسبة المالية'),
  ('accounting','IFRS','المعايير الدولية لإعداد التقارير المالية'),
  ('accounting','Management Accounting','المحاسبة الإدارية'),
  ('accounting','Consolidation','توحيد القوائم المالية'),
  ('accounting','Revenue Recognition','الاعتراف بالإيرادات'),

  ('banking','Credit Analysis','التحليل الائتماني'),
  ('banking','Loan Structuring','هيكلة القروض'),
  ('banking','Basel & Capital Adequacy','بازل وكفاية رأس المال'),
  ('banking','Islamic Banking','الصيرفة الإسلامية'),
  ('banking','Retail & Commercial Products','منتجات الأفراد والشركات'),

  ('analytics','Financial Data Analysis','تحليل البيانات المالية'),
  ('analytics','Forecasting & Modelling','التنبؤ والنمذجة'),
  ('analytics','Statistics for Finance','الإحصاء للتمويل'),
  ('analytics','Scenario & Sensitivity Analysis','تحليل السيناريوهات والحساسية'),
  ('analytics','Spreadsheet Engineering','هندسة الجداول الحسابية'),

  ('business_intelligence','Dashboarding & Visualization','لوحات المعلومات والتمثيل المرئي'),
  ('business_intelligence','KPI Design','تصميم مؤشرات الأداء الرئيسية'),
  ('business_intelligence','Data Modelling','نمذجة البيانات'),
  ('business_intelligence','Reporting Automation','أتمتة التقارير'),
  ('business_intelligence','BI Tools (Power BI / Tableau)','أدوات ذكاء الأعمال (Power BI / Tableau)'),

  ('artificial_intelligence','AI & ML Foundations','أساسيات الذكاء الاصطناعي والتعلّم الآلي'),
  ('artificial_intelligence','Applied AI in Finance','الذكاء الاصطناعي التطبيقي في التمويل'),
  ('artificial_intelligence','GenAI Tools & Prompting','أدوات الذكاء التوليدي وصياغة الأوامر'),
  ('artificial_intelligence','Data Readiness for AI','جاهزية البيانات للذكاء الاصطناعي'),
  ('artificial_intelligence','AI Risk & Governance','مخاطر وحوكمة الذكاء الاصطناعي'),

  ('business_reporting','Financial Reporting & Disclosures','التقارير المالية والإفصاحات'),
  ('business_reporting','Management Reporting','التقارير الإدارية'),
  ('business_reporting','Regulatory Reporting','التقارير الرقابية'),
  ('business_reporting','Narrative & ESG Reporting','التقارير السردية وتقارير الاستدامة (ESG)'),
  ('business_reporting','Board Reporting','تقارير مجلس الإدارة'),

  ('real_estate','Real Estate Finance','التمويل العقاري'),
  ('real_estate','Property Valuation','تقييم العقارات'),
  ('real_estate','REITs & Funds','صناديق الاستثمار العقاري والصناديق'),
  ('real_estate','Development Feasibility','جدوى التطوير العقاري'),
  ('real_estate','Investment Analysis','تحليل الاستثمار')
) AS v(domain_key, name, name_ar)
WHERE s.domain_key = v.domain_key AND s.name = v.name;
