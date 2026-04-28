-- ────────────────────────────────────────────────────────────
-- Migration 00008: Stakeholder Feedback (Ahmed's Review)
-- Adds demographic fields, project metadata, templates, consent extras
-- ────────────────────────────────────────────────────────────

-- ── Candidate demographics ──────────────────────────────────
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS department       text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS gender           text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS age_range        text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS seniority_level  text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS national_id_hash text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS function_role    text;

-- ── Engagement / project metadata ───────────────────────────
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS assessment_type    text;          -- Professional | Graduate | Other
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS norm_group         text;          -- e.g. GCC Banking, MENA Government
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS project_type       text;          -- project type tag
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS cutoff_scores      jsonb;         -- { competency_id: min_score }
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS device_options     text[];        -- ['desktop','tablet','mobile']
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS proctoring_enabled boolean NOT NULL DEFAULT false;

-- ── Consent extras ──────────────────────────────────────────
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS contact_consent       boolean;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS client_forms_accepted boolean;

-- ── Project templates ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  config          jsonb NOT NULL DEFAULT '{}',
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

-- DROP-then-CREATE pattern keeps these idempotent. Postgres lacks
-- `CREATE POLICY ... IF NOT EXISTS` so we drop-if-exists first.

-- Clients can manage their own org templates
DROP POLICY IF EXISTS templates_select_own_org ON project_templates;
CREATE POLICY templates_select_own_org ON project_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS templates_insert_own_org ON project_templates;
CREATE POLICY templates_insert_own_org ON project_templates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS templates_update_own_org ON project_templates;
CREATE POLICY templates_update_own_org ON project_templates
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS templates_delete_own_org ON project_templates;
CREATE POLICY templates_delete_own_org ON project_templates
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Admin full access to templates
DROP POLICY IF EXISTS templates_admin_all ON project_templates;
CREATE POLICY templates_admin_all ON project_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_templates_org ON project_templates(organization_id);
