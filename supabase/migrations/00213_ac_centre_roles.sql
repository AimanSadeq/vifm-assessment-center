-- Assessment Center: who works a centre, and whether they are competent to.
--
-- BPS standard:
--   3.12  the service provider is responsible for the competence of EVERYONE
--         who contributes to a centre in any capacity, and where they are the
--         client's people, must at least specify the competence required
--   3.13  all those who work for it shall be suitably qualified and competent
--   4.42  there shall be a role profile for each role adopted at the centre
--   4.43  feedback generators and a feedback meeting chair are required where
--         the outcome includes qualitative feedback
--   4.44  role profiles shall address the competences listed per role
--   5.14  the service provider shall advise the client on the quantity and
--         quality of resource each role needs
--   5.16  a centre shall have at least one Centre Manager and one Centre
--         Administrator
--   5.17  a Psychometric Test User is required whenever tests are used
--   5.22  the service provider shall CONFIRM, in advance of the centre, that
--         all centre staff have demonstrated competence against their profiles
--   5.33  briefing documentation shall be prepared for every role
--   5.34  initial or refresher training shall be provided so everyone meets
--         the required level
--   6.1   the Centre Manager is responsible for implementing the centre in
--         line with its design and this standard
--   6.2   only staff deemed competent by the service provider shall be used
--   8.17  whoever gives feedback shall be trained in it and familiar with the
--         centre
--   8.18  and shall be trained to give it sensitively and constructively
--
-- The platform knew about assessors and nobody else. A centre had no manager,
-- no administrator, no record that anyone was competent at anything, and no
-- way to answer the question a client is entitled to ask: who ran this, and
-- what makes them qualified to have run it.
--
-- The role catalogue itself is in code (src/lib/ac/centre-roles.ts) because the
-- standard fixes it. These tables hold what varies: who is competent, and who
-- held which role at which centre.

-- ───────────────────── Competence, per person per role ────────────────────────
CREATE TABLE IF NOT EXISTS ac_role_competence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Matches a key in CENTRE_ROLES. Deliberately not an enum: the catalogue is
  -- versioned in code and a new role should not need a migration.
  role_key      text NOT NULL,
  status        text NOT NULL DEFAULT 'in_training'
                  CHECK (status IN ('in_training', 'competent', 'withdrawn')),
  -- What was actually seen. 5.22 asks us to confirm competence was
  -- DEMONSTRATED, so "attended a course" is not by itself an answer.
  evidence      text,
  trained_on    date,
  -- Competence goes stale. Null means it does not expire, which is a choice
  -- someone has to make rather than a default that quietly never lapses.
  expires_on    date,
  confirmed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  confirmed_by_name text,
  confirmed_at  timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, role_key)
);

COMMENT ON TABLE ac_role_competence IS
  'Demonstrated competence per person per centre role (BPS 3.12, 5.22, 5.34). Confirmed before a centre runs; expires_on lets competence lapse rather than stand forever.';

CREATE INDEX IF NOT EXISTS idx_ac_role_competence_profile ON ac_role_competence(profile_id);
CREATE INDEX IF NOT EXISTS idx_ac_role_competence_role ON ac_role_competence(role_key, status);

DROP TRIGGER IF EXISTS ac_role_competence_updated_at ON ac_role_competence;
CREATE TRIGGER ac_role_competence_updated_at
  BEFORE UPDATE ON ac_role_competence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ac_role_competence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_role_competence_admin ON ac_role_competence;
CREATE POLICY ac_role_competence_admin ON ac_role_competence
  FOR ALL USING (auth_role() = 'admin');

-- People can see their own record: it is about them, and they are entitled to
-- know what VIFM says they are qualified to do. They cannot edit it.
DROP POLICY IF EXISTS ac_role_competence_own ON ac_role_competence;
CREATE POLICY ac_role_competence_own ON ac_role_competence
  FOR SELECT USING (profile_id = auth.uid());

-- ─────────────────── Who holds which role at which centre ─────────────────────
CREATE TABLE IF NOT EXISTS ac_engagement_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  role_key      text NOT NULL,
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Somebody outside VIFM - a client manager acting as a role-player, say.
  -- 3.12 still makes us responsible for specifying what they must be able to
  -- do, so they are recorded here like anyone else.
  is_external   boolean NOT NULL DEFAULT false,
  external_note text,
  assigned_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, role_key, profile_id)
);

COMMENT ON TABLE ac_engagement_roles IS
  'Who held which centre role at which engagement (BPS 4.42, 5.14, 5.16, 5.17, 6.1). Answers "who ran this centre" long after it ran.';

CREATE INDEX IF NOT EXISTS idx_ac_engagement_roles_eng ON ac_engagement_roles(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ac_engagement_roles_profile ON ac_engagement_roles(profile_id);

ALTER TABLE ac_engagement_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_engagement_roles_admin ON ac_engagement_roles;
CREATE POLICY ac_engagement_roles_admin ON ac_engagement_roles
  FOR ALL USING (auth_role() = 'admin');

-- You can see your own role, and assessors working the centre can see the whole
-- staff list - they have to find each other on the day.
--
-- Note the shape: "anyone holding a role here can see the others" would be the
-- natural rule, but a policy ON ac_engagement_roles that SELECTs
-- ac_engagement_roles recurses infinitely and Postgres refuses it. The
-- assessor_assignments test is a different table, so it is safe; a non-assessor
-- role holder sees their own row, and admins see everything.
DROP POLICY IF EXISTS ac_engagement_roles_staff ON ac_engagement_roles;
CREATE POLICY ac_engagement_roles_staff ON ac_engagement_roles
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM assessor_assignments aa
      WHERE aa.engagement_id = ac_engagement_roles.engagement_id
        AND aa.assessor_id = auth.uid()
    )
  );
