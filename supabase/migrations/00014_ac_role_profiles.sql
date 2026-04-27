-- ============================================================
-- VIFM Assessment Center - Role Profile Library
-- Reusable competency-pack templates for common GCC roles.
-- Admins pick a profile in the engagement wizard and it pre-fills
-- step 2 (competency selection) with weights + priorities.
-- ============================================================

CREATE TABLE role_profiles (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name_en                     text NOT NULL,
  name_ar                     text,
  description                 text,
  target_role                 text,
  industry                    text,
  region                      text CHECK (region IN ('uae', 'saudi', 'gcc', 'global')),
  default_target_proficiency  numeric(2,1) DEFAULT 3 CHECK (default_target_proficiency BETWEEN 1 AND 5),
  source_jd                   text,
  created_by                  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz DEFAULT NOW(),
  updated_at                  timestamptz DEFAULT NOW()
);

CREATE INDEX role_profiles_org_idx ON role_profiles (organization_id);
CREATE INDEX role_profiles_region_idx ON role_profiles (region);

CREATE TABLE role_profile_competencies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_profile_id  uuid NOT NULL REFERENCES role_profiles(id) ON DELETE CASCADE,
  competency_id    uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  weight           numeric(3,1) CHECK (weight BETWEEN 0.5 AND 10),
  priority         text CHECK (priority IN ('high', 'medium', 'low')),
  reasoning        text,
  UNIQUE (role_profile_id, competency_id)
);

CREATE INDEX role_profile_competencies_profile_idx ON role_profile_competencies (role_profile_id);

-- Touch updated_at on role_profiles updates
CREATE OR REPLACE FUNCTION role_profiles_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_profiles_set_updated_at
BEFORE UPDATE ON role_profiles
FOR EACH ROW EXECUTE FUNCTION role_profiles_touch_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE role_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_profile_competencies ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY role_profiles_all_admin ON role_profiles
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY role_profile_competencies_all_admin ON role_profile_competencies
  FOR ALL USING (auth_role() = 'admin');

-- Authenticated users can read profiles (assessors/clients see global
-- library and their own org's profiles; org isolation is enforced by the
-- organization_id IS NULL OR matches their org membership).
CREATE POLICY role_profiles_select_auth ON role_profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY role_profile_competencies_select_auth ON role_profile_competencies
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND role_profile_id IN (
      SELECT id FROM role_profiles
      WHERE organization_id IS NULL
         OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );
