-- ════════════════════════════════════════════════════════════════
-- 00127 - Persona competency norms (percentile context)
--
-- Lets a raw 1-5 self-rating be reported as a percentile against a named
-- comparison group. Start with one internal cohort norm; sector/role norms
-- can be added as rows later. Additive.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS persona_norm_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,            -- e.g. 'gcc_all_2026'
  label_en    text NOT NULL,
  label_ar    text,
  is_provisional boolean NOT NULL DEFAULT true, -- true until n is large enough
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS persona_competency_norms (
  norm_group_id uuid NOT NULL REFERENCES persona_norm_groups(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL,
  mean          numeric(3,2) NOT NULL,
  sd            numeric(3,2) NOT NULL CHECK (sd >= 0),
  n             integer      NOT NULL CHECK (n > 0),
  PRIMARY KEY (norm_group_id, competency_id)
);

-- Which norm a sitting is read against. NULL = no norm -> the report omits
-- percentiles silently (tolerant).
ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS norm_group_id uuid
    REFERENCES persona_norm_groups(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- RLS - reference data: authenticated read, admin/service-role write.
-- Mirrors the role_profiles policy style (00014). Service role bypasses RLS.
-- ────────────────────────────────────────────────────────────
ALTER TABLE persona_norm_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_competency_norms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persona_norm_groups_all_admin ON persona_norm_groups;
CREATE POLICY persona_norm_groups_all_admin ON persona_norm_groups
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS persona_norm_groups_select_auth ON persona_norm_groups;
CREATE POLICY persona_norm_groups_select_auth ON persona_norm_groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS persona_competency_norms_all_admin ON persona_competency_norms;
CREATE POLICY persona_competency_norms_all_admin ON persona_competency_norms
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS persona_competency_norms_select_auth ON persona_competency_norms;
CREATE POLICY persona_competency_norms_select_auth ON persona_competency_norms
  FOR SELECT USING (auth.uid() IS NOT NULL);
