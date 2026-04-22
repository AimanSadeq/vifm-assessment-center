-- ============================================================
-- VIFM ARA — AI Use Case Portfolio
-- Migration 00009: ara_use_cases table for the use-case inventory
-- per best-practice enhancement. Respondents list their live AI
-- initiatives with risk, value, and maturity context. Surfaces as
-- its own table on consultant detail and a dedicated report page.
-- ============================================================

CREATE TYPE ara_use_case_stage AS ENUM (
  'ideation',
  'piloting',
  'production',
  'retired'
);

CREATE TYPE ara_risk_level AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE ara_value_level AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TABLE ara_use_cases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id      uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  respondent_id      uuid REFERENCES ara_respondents(id) ON DELETE SET NULL,
  name               text NOT NULL,
  description        text,
  stage              ara_use_case_stage NOT NULL DEFAULT 'ideation',
  pillar_id          text,
  risk_level         ara_risk_level NOT NULL DEFAULT 'medium',
  value_level        ara_value_level NOT NULL DEFAULT 'medium',
  business_owner     text,
  technical_owner    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ara_usecases_assessment ON ara_use_cases(assessment_id);
CREATE INDEX idx_ara_usecases_respondent ON ara_use_cases(respondent_id);
CREATE INDEX idx_ara_usecases_stage ON ara_use_cases(stage);

CREATE TRIGGER ara_use_cases_updated_at
  BEFORE UPDATE ON ara_use_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- RLS — same pattern as other consultant-scoped tables:
-- admin full access; consultant access to their own assessments;
-- respondent access via server-side token validation in actions.
-- ────────────────────────────────────────────────────────────

ALTER TABLE ara_use_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY ara_usecases_admin_all ON ara_use_cases
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_usecases_consultant_own ON ara_use_cases
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );
