-- ════════════════════════════════════════════════════════════════
-- Technical competency tier — insert COMPETENCY between Function and Skill
--
-- Agreed taxonomy (standards-aligned with IMA/CGMA; Function added as the
-- real-world job layer a client's JD maps to):
--
--   Domain (technical_domains)        e.g. Finance
--     └─ Function (technical_functions)   e.g. Corporate Finance  ← the job/role
--         └─ Competency (THIS TABLE)        e.g. Capital Structure & Funding
--             └─ Skill (THIS TABLE)           e.g. WACC, Capital Budgeting …
--
-- Today a function's skills live as a flat text[] (technical_functions.skills_en).
-- This migration is ADDITIVE: it introduces the two relational tiers below.
-- The flat skills_en/skills_ar columns are LEFT IN PLACE so the existing runner,
-- JD-extractor, and reports keep working unchanged until later increments switch
-- them over. The AI-regroup script (scripts/regroup-tech-skills.ts) populates
-- these tables from the existing flat skills.
--
-- Relational (not JSONB) by design: a competency taxonomy is shared reference
-- data referenced by items / results / cut-scores and aggregated per-competency,
-- so FKs + GROUP BY are the right tools. This mirrors the precedent set by
-- migration 00054 (promote the technical taxonomy into real tables with FKs).
-- ════════════════════════════════════════════════════════════════

-- ── Competency tier: a function HAS competencies ──
CREATE TABLE technical_competencies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id  uuid NOT NULL REFERENCES technical_functions(id) ON DELETE CASCADE,
  name_en      text NOT NULL,
  name_ar      text,
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (function_id, name_en)
);
CREATE INDEX idx_tech_competencies_function ON technical_competencies(function_id);

CREATE TRIGGER trg_technical_competencies_updated_at
  BEFORE UPDATE ON technical_competencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Skill tier: a competency HAS skills (the granular, assessable unit) ──
CREATE TABLE technical_competency_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES technical_competencies(id) ON DELETE CASCADE,
  name_en       text NOT NULL,
  name_ar       text,
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competency_id, name_en)
);
CREATE INDEX idx_tech_comp_skills_competency ON technical_competency_skills(competency_id);

-- ── RLS: admin manages; authenticated may read (the public runner reads via the
--    service client, mirroring technical_functions / taxonomy / program tables). ──
ALTER TABLE technical_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_competency_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_competencies_select_auth ON technical_competencies
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_competencies_all_admin ON technical_competencies
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY tech_comp_skills_select_auth ON technical_competency_skills
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_comp_skills_all_admin ON technical_competency_skills
  FOR ALL USING (auth_role() = 'admin');
