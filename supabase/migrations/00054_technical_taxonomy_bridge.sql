-- ════════════════════════════════════════════════════════════════
-- Technical taxonomy → DB + the technical↔behavioural bridge
--
-- Two changes the framework asked for:
--   1. PROMOTE the technical taxonomy out of code-only constants
--      (src/lib/competencies/technical-framework.ts) into real tables, so the
--      loose `domain_key` strings on the tech_assessment_* tables become FOREIGN
--      KEYS and the taxonomy is admin-editable like the behavioural 38.
--   2. BRIDGE technical → behavioural: declare which behavioural competencies
--      each technical domain ENABLES (mirrors Fluent's language→behavioural
--      `enables` map), stored as FK rows so the unified profile can surface a
--      technical result as an "enables" signal on those competencies.
--
-- The code framework stays as the typed/synchronous source for the assessment
-- engine + SME console; these tables are seeded to match it (single seed, no
-- drift at install) and own the FK integrity + the editable bridge.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Domains (the FK target; `key` matches TechDomainKey in code) ──
CREATE TABLE technical_domains (
  key        text PRIMARY KEY,                 -- 'finance', 'treasury', …
  name_en    text NOT NULL,
  name_ar    text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_technical_domains_updated_at
  BEFORE UPDATE ON technical_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. Skills (5 per domain; editable, FK to the domain) ──
CREATE TABLE technical_skills (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES technical_domains(key) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (domain_key, name)
);
CREATE INDEX idx_technical_skills_domain ON technical_skills(domain_key);

-- ── 3. The bridge: a technical domain ENABLES a behavioural competency ──
-- relation 'enables' = contributor/enabler (never a direct behavioural measure).
-- weight 1–3 = strength of the contribution (3 = primary).
CREATE TABLE technical_domain_competencies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key    text NOT NULL REFERENCES technical_domains(key) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  relation      text NOT NULL DEFAULT 'enables' CHECK (relation IN ('enables', 'measures')),
  weight        smallint NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 3),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_key, competency_id)
);
CREATE INDEX idx_tech_domain_comp_domain ON technical_domain_competencies(domain_key);
CREATE INDEX idx_tech_domain_comp_comp   ON technical_domain_competencies(competency_id);

-- ── Seed domains (mirrors TECH_DOMAINS in technical-framework.ts) ──
INSERT INTO technical_domains (key, name_en, name_ar, sort_order) VALUES
  ('finance',                 'Finance',                 'المالية',              1),
  ('investment',              'Investment',              'الاستثمار',            2),
  ('treasury',                'Treasury',                'الخزينة',              3),
  ('accounting',              'Accounting',              'المحاسبة',             4),
  ('banking',                 'Banking',                 'المصارف',              5),
  ('analytics',               'Analytics',               'التحليلات',            6),
  ('business_intelligence',   'Business Intelligence',   'ذكاء الأعمال',         7),
  ('artificial_intelligence', 'Artificial Intelligence', 'الذكاء الاصطناعي',     8),
  ('business_reporting',      'Business Reporting',      'إعداد التقارير',       9),
  ('real_estate',             'Real Estate',             'العقارات',            10);

-- ── Seed skills (5 per domain, matching the code framework verbatim) ──
INSERT INTO technical_skills (domain_key, name, sort_order) VALUES
  ('finance','Financial Modelling',1),('finance','Capital Budgeting',2),('finance','Cost of Capital (WACC)',3),('finance','Working Capital Management',4),('finance','Financial Statement Analysis',5),
  ('investment','Valuation (DCF & Multiples)',1),('investment','Portfolio Management',2),('investment','Equity Analysis',3),('investment','Fixed Income',4),('investment','Risk, Return & CAPM',5),
  ('treasury','Cash & Liquidity Management',1),('treasury','FX Risk Management',2),('treasury','Interest-Rate Risk',3),('treasury','Funding & Capital Markets',4),('treasury','Bank Relationship Management',5),
  ('accounting','Financial Accounting',1),('accounting','IFRS',2),('accounting','Management Accounting',3),('accounting','Consolidation',4),('accounting','Revenue Recognition',5),
  ('banking','Credit Analysis',1),('banking','Loan Structuring',2),('banking','Basel & Capital Adequacy',3),('banking','Islamic Banking',4),('banking','Retail & Commercial Products',5),
  ('analytics','Financial Data Analysis',1),('analytics','Forecasting & Modelling',2),('analytics','Statistics for Finance',3),('analytics','Scenario & Sensitivity Analysis',4),('analytics','Spreadsheet Engineering',5),
  ('business_intelligence','Dashboarding & Visualization',1),('business_intelligence','KPI Design',2),('business_intelligence','Data Modelling',3),('business_intelligence','Reporting Automation',4),('business_intelligence','BI Tools (Power BI / Tableau)',5),
  ('artificial_intelligence','AI & ML Foundations',1),('artificial_intelligence','Applied AI in Finance',2),('artificial_intelligence','GenAI Tools & Prompting',3),('artificial_intelligence','Data Readiness for AI',4),('artificial_intelligence','AI Risk & Governance',5),
  ('business_reporting','Financial Reporting & Disclosures',1),('business_reporting','Management Reporting',2),('business_reporting','Regulatory Reporting',3),('business_reporting','Narrative & ESG Reporting',4),('business_reporting','Board Reporting',5),
  ('real_estate','Real Estate Finance',1),('real_estate','Property Valuation',2),('real_estate','REITs & Funds',3),('real_estate','Development Feasibility',4),('real_estate','Investment Analysis',5);

-- ── Seed the bridge (domain → behavioural competency it enables) ──
-- Resolved by competency NAME (the seeded 38), so it survives any UUID change.
-- A pair whose name doesn't resolve is simply skipped (tolerant).
INSERT INTO technical_domain_competencies (domain_key, competency_id, weight)
SELECT v.domain_key, c.id, v.weight
FROM (
  VALUES
    ('finance','Financial Acumen',3),('finance','Analytical Reasoning',2),('finance','Decision Quality',1),
    ('investment','Financial Acumen',3),('investment','Analytical Reasoning',2),('investment','Business Insight',1),
    ('treasury','Financial Acumen',3),('treasury','Manages Complexity',2),('treasury','Decision Quality',1),
    ('accounting','Financial Acumen',3),('accounting','Ensures Accountability',2),('accounting','Optimizes Processes',1),
    ('banking','Financial Acumen',3),('banking','Analytical Reasoning',2),('banking','Business Insight',1),
    ('analytics','Analytical Reasoning',3),('analytics','Manages Complexity',2),('analytics','Decision Quality',1),
    ('business_intelligence','Digital Fluency',3),('business_intelligence','Analytical Reasoning',2),('business_intelligence','Optimizes Processes',1),
    ('artificial_intelligence','Digital Fluency',3),('artificial_intelligence','Cultivates Innovation',2),('artificial_intelligence','Manages Complexity',1),
    ('business_reporting','Communicates Effectively',3),('business_reporting','Financial Acumen',2),('business_reporting','Ensures Accountability',1),
    ('real_estate','Financial Acumen',3),('real_estate','Analytical Reasoning',2),('real_estate','Business Insight',1)
) AS v(domain_key, comp_name, weight)
JOIN competencies c ON c.name = v.comp_name;

-- ── Turn the loose domain_key strings into FOREIGN KEYS ──
-- Every domain_key comes from the same 10-domain code framework (all seeded
-- above), so new + existing rows resolve. Added NOT VALID so the migration
-- can't fail on any stray legacy row — new writes are still FK-checked, and an
-- admin can VALIDATE CONSTRAINT later once legacy data is confirmed clean.
ALTER TABLE tech_assessment_results
  ADD CONSTRAINT fk_tech_results_domain    FOREIGN KEY (domain_key) REFERENCES technical_domains(key) NOT VALID;
ALTER TABLE tech_assessment_sessions
  ADD CONSTRAINT fk_tech_sessions_domain   FOREIGN KEY (domain_key) REFERENCES technical_domains(key) NOT VALID;
ALTER TABLE tech_assessment_items
  ADD CONSTRAINT fk_tech_items_domain      FOREIGN KEY (domain_key) REFERENCES technical_domains(key) NOT VALID;
ALTER TABLE tech_assessment_cut_scores
  ADD CONSTRAINT fk_tech_cut_scores_domain FOREIGN KEY (domain_key) REFERENCES technical_domains(key) NOT VALID;

-- ── RLS: mirror the behavioural competency tables (auth SELECT + admin ALL) ──
ALTER TABLE technical_domains             ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_skills              ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_domain_competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_domains_select_auth ON technical_domains
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY technical_domains_all_admin ON technical_domains
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY technical_skills_select_auth ON technical_skills
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY technical_skills_all_admin ON technical_skills
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY tech_domain_comp_select_auth ON technical_domain_competencies
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_domain_comp_all_admin ON technical_domain_competencies
  FOR ALL USING (auth_role() = 'admin');
