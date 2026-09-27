-- ════════════════════════════════════════════════════════════════
-- Behavioural framework versioning (plumbing only - no behaviour change).
--
-- Prepares the move from the 41-competency framework to its successor
-- without ever deleting a competency row: 20 tables cascade-delete from
-- `competencies`, so a delete would erase every assessment recorded against
-- it. Instead a competency is RETIRED by pointing `superseded_by` at the
-- competency that absorbed it. "Active" = superseded_by IS NULL, which is how
-- every picker and list filters. Until switch day nothing is superseded, so
-- every read returns exactly the 41 it returns today.
--
-- Also adds the snapshots a sitting needs so a later framework or role
-- change can never alter a completed report:
--   * behavioral_assessment_sessions.framework_version   which framework it ran on
--   * behavioral_assessment_sessions.served_item_keys     the exact statements served
--   * behavioral_assessment_sessions.target_role_snapshot the role profile it was scored against
-- (Persona standalone, voucher, bundle and Role Readiness sittings all live
-- in behavioral_assessment_sessions.)
-- ════════════════════════════════════════════════════════════════

-- ── The framework versions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS competency_framework_versions (
  version      smallint PRIMARY KEY,
  label        text NOT NULL,
  is_active    boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Exactly one active version at a time.
CREATE UNIQUE INDEX IF NOT EXISTS competency_framework_versions_one_active
  ON competency_framework_versions ((true)) WHERE is_active;

INSERT INTO competency_framework_versions (version, label, is_active, activated_at, notes)
VALUES (1, 'VIFM behavioural framework v1 (41 competencies, 9 clusters, 4 domains)', true, now(),
        'The framework in use since launch.')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE competency_framework_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competency_framework_versions_read ON competency_framework_versions;
CREATE POLICY competency_framework_versions_read ON competency_framework_versions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS competency_framework_versions_admin ON competency_framework_versions;
CREATE POLICY competency_framework_versions_admin ON competency_framework_versions
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- ── Competencies: version + successor ────────────────────────────
ALTER TABLE competencies
  ADD COLUMN IF NOT EXISTS framework_version smallint NOT NULL DEFAULT 1
    REFERENCES competency_framework_versions(version);

-- The competency that absorbed this one. NULL = active. ON DELETE SET NULL so
-- removing a successor can never cascade into its predecessors' history.
ALTER TABLE competencies
  ADD COLUMN IF NOT EXISTS superseded_by uuid
    REFERENCES competencies(id) ON DELETE SET NULL;

ALTER TABLE competencies DROP CONSTRAINT IF EXISTS competencies_not_self_superseded;
ALTER TABLE competencies
  ADD CONSTRAINT competencies_not_self_superseded CHECK (superseded_by IS NULL OR superseded_by <> id);

CREATE INDEX IF NOT EXISTS idx_competencies_active ON competencies (id) WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_competencies_superseded_by ON competencies (superseded_by);

-- ── Sitting snapshots ────────────────────────────────────────────
ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS framework_version smallint;
ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS served_item_keys text[];
ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS target_role_snapshot jsonb;

COMMENT ON COLUMN behavioral_assessment_sessions.framework_version IS
  'Behavioural framework version the sitting ran on (competency_framework_versions.version).';
COMMENT ON COLUMN behavioral_assessment_sessions.served_item_keys IS
  'The exact normative item keys served at start. Resume and save honour this set.';
COMMENT ON COLUMN behavioral_assessment_sessions.target_role_snapshot IS
  'The target role profile at start: {role_profile_id, name, default_target, competencies:[{competency_id, weight, target_proficiency}]}. Reports read this, not the live profile.';
