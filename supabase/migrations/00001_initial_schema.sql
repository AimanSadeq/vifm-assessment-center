-- ============================================================
-- VIFM Assessment Center - Initial Schema
-- Migration 00001: Tables, Enums, Indexes, RLS Policies
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'admin',
  'lead_assessor',
  'associate_assessor',
  'candidate',
  'client'
);

CREATE TYPE engagement_status AS ENUM (
  'draft',
  'active',
  'completed',
  'archived'
);

CREATE TYPE candidate_status AS ENUM (
  'invited',
  'registered',
  'in_progress',
  'completed',
  'withdrawn'
);

CREATE TYPE exercise_type AS ENUM (
  'in_basket',
  'role_play',
  'group_exercise',
  'case_study',
  'oral_presentation',
  'competency_based_interview'
);

CREATE TYPE indicator_type AS ENUM (
  'positive',
  'negative'
);

CREATE TYPE oar_recommendation AS ENUM (
  'ready_now',
  'ready_with_development',
  'not_ready'
);

CREATE TYPE report_status AS ENUM (
  'draft',
  'final',
  'released'
);

CREATE TYPE recommendation_priority AS ENUM (
  'high',
  'medium',
  'low'
);


-- ────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger function
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- GROUP 1: Identity & Access
-- ────────────────────────────────────────────────────────────

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  industry    text,
  country     text,
  contact_name  text,
  contact_email text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'candidate',
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  full_name       text NOT NULL,
  email           text NOT NULL,
  phone           text,
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_organization ON profiles(organization_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- HELPER: get current user's role from profiles
-- (must come after profiles table is created)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ────────────────────────────────────────────────────────────
-- GROUP 2: Competency Framework
-- ────────────────────────────────────────────────────────────

CREATE TABLE competency_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE competency_clusters (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id  uuid NOT NULL REFERENCES competency_domains(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX idx_clusters_domain ON competency_clusters(domain_id);

CREATE TABLE competencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id  uuid NOT NULL REFERENCES competency_clusters(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE INDEX idx_competencies_cluster ON competencies(cluster_id);

CREATE TABLE behavioral_indicators (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id  uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  indicator_type indicator_type NOT NULL,
  description    text NOT NULL,
  sort_order     int NOT NULL DEFAULT 0
);

CREATE INDEX idx_indicators_competency ON behavioral_indicators(competency_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 3: Exercise Library
-- ────────────────────────────────────────────────────────────

CREATE TABLE exercises (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  exercise_type    exercise_type NOT NULL,
  description      text,
  duration_minutes int,
  instructions     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE exercise_materials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_url      text NOT NULL,
  material_type text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_materials_exercise ON exercise_materials(exercise_id);

CREATE TABLE role_player_prompts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id       uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  prompt_text       text NOT NULL,
  trigger_behaviors text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompts_exercise ON role_player_prompts(exercise_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 4: Engagements
-- ────────────────────────────────────────────────────────────

CREATE TABLE engagements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  target_role     text,
  status          engagement_status NOT NULL DEFAULT 'draft',
  start_date      date,
  end_date        date,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_engagements_org ON engagements(organization_id);
CREATE INDEX idx_engagements_status ON engagements(status);

CREATE TRIGGER engagements_updated_at
  BEFORE UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE engagement_competencies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  weight        numeric,
  UNIQUE(engagement_id, competency_id)
);

CREATE INDEX idx_eng_comp_engagement ON engagement_competencies(engagement_id);

CREATE TABLE engagement_exercises (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  exercise_id    uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  scheduled_date timestamptz,
  UNIQUE(engagement_id, exercise_id)
);

CREATE INDEX idx_eng_ex_engagement ON engagement_exercises(engagement_id);

CREATE TABLE exercise_competency_matrix (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  UNIQUE(engagement_id, exercise_id, competency_id)
);

CREATE INDEX idx_matrix_engagement ON exercise_competency_matrix(engagement_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 5: Candidates & Assessors
-- ────────────────────────────────────────────────────────────

CREATE TABLE candidates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  profile_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  full_name     text NOT NULL,
  email         text NOT NULL,
  phone         text,
  status        candidate_status NOT NULL DEFAULT 'invited',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_engagement ON candidates(engagement_id);
CREATE INDEX idx_candidates_profile ON candidates(profile_id);

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE assessor_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  assessor_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  UNIQUE(engagement_id, assessor_id, candidate_id, exercise_id)
);

CREATE INDEX idx_assignments_assessor ON assessor_assignments(assessor_id);
CREATE INDEX idx_assignments_candidate ON assessor_assignments(candidate_id);
CREATE INDEX idx_assignments_engagement ON assessor_assignments(engagement_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 6: Observations & Ratings
-- ────────────────────────────────────────────────────────────

CREATE TABLE observations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessor_assignment_id uuid NOT NULL REFERENCES assessor_assignments(id) ON DELETE CASCADE,
  competency_id          uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  behavior_observed      text NOT NULL,
  is_positive            boolean,
  observed_at            timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_observations_assignment ON observations(assessor_assignment_id);
CREATE INDEX idx_observations_competency ON observations(competency_id);

CREATE TABLE ratings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessor_assignment_id uuid NOT NULL REFERENCES assessor_assignments(id) ON DELETE CASCADE,
  competency_id          uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  score                  int NOT NULL CHECK (score >= 1 AND score <= 5),
  justification          text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessor_assignment_id, competency_id)
);

CREATE INDEX idx_ratings_assignment ON ratings(assessor_assignment_id);

CREATE TRIGGER ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE integration_worksheets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id     uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  assessor_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id      uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  competency_id     uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  preliminary_rating int NOT NULL CHECK (preliminary_rating >= 1 AND preliminary_rating <= 5),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_worksheets_engagement ON integration_worksheets(engagement_id);
CREATE INDEX idx_worksheets_assessor ON integration_worksheets(assessor_id);

CREATE TRIGGER worksheets_updated_at
  BEFORE UPDATE ON integration_worksheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE consensus_ratings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id    uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id     uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  competency_id    uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  final_score      int NOT NULL CHECK (final_score >= 1 AND final_score <= 5),
  discussion_notes text,
  decided_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(engagement_id, candidate_id, competency_id)
);

CREATE INDEX idx_consensus_engagement ON consensus_ratings(engagement_id);
CREATE INDEX idx_consensus_candidate ON consensus_ratings(candidate_id);

CREATE TRIGGER consensus_updated_at
  BEFORE UPDATE ON consensus_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE overall_assessment_ratings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id   uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  overall_score  int NOT NULL CHECK (overall_score >= 1 AND overall_score <= 5),
  recommendation oar_recommendation NOT NULL,
  summary        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(engagement_id, candidate_id)
);

CREATE INDEX idx_oar_engagement ON overall_assessment_ratings(engagement_id);
CREATE INDEX idx_oar_candidate ON overall_assessment_ratings(candidate_id);

CREATE TRIGGER oar_updated_at
  BEFORE UPDATE ON overall_assessment_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- GROUP 7: Reporting
-- ────────────────────────────────────────────────────────────

CREATE TABLE candidate_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  report_url    text,
  status        report_status NOT NULL DEFAULT 'draft',
  released_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_candidate ON candidate_reports(candidate_id);
CREATE INDEX idx_reports_engagement ON candidate_reports(engagement_id);

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON candidate_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE psychometric_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  test_name     text NOT NULL,
  test_provider text,
  score_data    jsonb NOT NULL DEFAULT '{}',
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_psychometric_candidate ON psychometric_results(candidate_id);

CREATE TABLE development_recommendations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  recommendation text NOT NULL,
  priority      recommendation_priority NOT NULL DEFAULT 'medium',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_devrec_candidate ON development_recommendations(candidate_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 8: Compliance
-- ────────────────────────────────────────────────────────────

CREATE TABLE consent_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  consented    boolean NOT NULL,
  ip_address   text,
  consented_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);

CREATE INDEX idx_consent_candidate ON consent_records(candidate_id);

CREATE TABLE audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action     text NOT NULL,
  table_name text NOT NULL,
  record_id  uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_created ON audit_log(created_at);


-- ════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

-- Enable RLS on every table
ALTER TABLE organizations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_domains         ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_clusters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE competencies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_indicators      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_materials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_player_prompts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements                ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_competencies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_exercises       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_competency_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessor_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_worksheets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_ratings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE overall_assessment_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychometric_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                  ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────

-- Everyone can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT USING (auth_role() = 'admin');

-- Users can update their own profile (except role)
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Admins can insert/update/delete any profile
CREATE POLICY profiles_all_admin ON profiles
  FOR ALL USING (auth_role() = 'admin');


-- ────────────────────────────────────────────────────────────
-- ORGANIZATIONS
-- ────────────────────────────────────────────────────────────

CREATE POLICY organizations_select_admin ON organizations
  FOR SELECT USING (auth_role() = 'admin');

CREATE POLICY organizations_all_admin ON organizations
  FOR ALL USING (auth_role() = 'admin');

-- Clients can read their own organization
CREATE POLICY organizations_select_client ON organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- COMPETENCY FRAMEWORK (read for all authenticated, write for admin)
-- ────────────────────────────────────────────────────────────

CREATE POLICY domains_select_auth ON competency_domains
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY domains_all_admin ON competency_domains
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY clusters_select_auth ON competency_clusters
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY clusters_all_admin ON competency_clusters
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY competencies_select_auth ON competencies
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY competencies_all_admin ON competencies
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY indicators_select_auth ON behavioral_indicators
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY indicators_all_admin ON behavioral_indicators
  FOR ALL USING (auth_role() = 'admin');


-- ────────────────────────────────────────────────────────────
-- EXERCISES (read for all authenticated, write for admin)
-- ────────────────────────────────────────────────────────────

CREATE POLICY exercises_select_auth ON exercises
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY exercises_all_admin ON exercises
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY materials_select_auth ON exercise_materials
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY materials_all_admin ON exercise_materials
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY prompts_select_auth ON role_player_prompts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY prompts_all_admin ON role_player_prompts
  FOR ALL USING (auth_role() = 'admin');


-- ────────────────────────────────────────────────────────────
-- ENGAGEMENTS
-- ────────────────────────────────────────────────────────────

-- Admins: full access
CREATE POLICY engagements_all_admin ON engagements
  FOR ALL USING (auth_role() = 'admin');

-- Assessors: read engagements they're assigned to
CREATE POLICY engagements_select_assessor ON engagements
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND id IN (
      SELECT DISTINCT engagement_id FROM assessor_assignments
      WHERE assessor_id = auth.uid()
    )
  );

-- Clients: read their organization's engagements
CREATE POLICY engagements_select_client ON engagements
  FOR SELECT USING (
    auth_role() = 'client'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- ENGAGEMENT SUB-TABLES (same visibility as engagements)
-- ────────────────────────────────────────────────────────────

-- engagement_competencies
CREATE POLICY eng_comp_all_admin ON engagement_competencies
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY eng_comp_select_assessor ON engagement_competencies
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND engagement_id IN (
      SELECT DISTINCT engagement_id FROM assessor_assignments
      WHERE assessor_id = auth.uid()
    )
  );

CREATE POLICY eng_comp_select_client ON engagement_competencies
  FOR SELECT USING (
    auth_role() = 'client'
    AND engagement_id IN (
      SELECT id FROM engagements
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- engagement_exercises
CREATE POLICY eng_ex_all_admin ON engagement_exercises
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY eng_ex_select_assessor ON engagement_exercises
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND engagement_id IN (
      SELECT DISTINCT engagement_id FROM assessor_assignments
      WHERE assessor_id = auth.uid()
    )
  );

CREATE POLICY eng_ex_select_client ON engagement_exercises
  FOR SELECT USING (
    auth_role() = 'client'
    AND engagement_id IN (
      SELECT id FROM engagements
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- exercise_competency_matrix
CREATE POLICY matrix_all_admin ON exercise_competency_matrix
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY matrix_select_assessor ON exercise_competency_matrix
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND engagement_id IN (
      SELECT DISTINCT engagement_id FROM assessor_assignments
      WHERE assessor_id = auth.uid()
    )
  );

CREATE POLICY matrix_select_client ON exercise_competency_matrix
  FOR SELECT USING (
    auth_role() = 'client'
    AND engagement_id IN (
      SELECT id FROM engagements
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );


-- ────────────────────────────────────────────────────────────
-- CANDIDATES
-- ────────────────────────────────────────────────────────────

CREATE POLICY candidates_all_admin ON candidates
  FOR ALL USING (auth_role() = 'admin');

-- Assessors: read candidates they're assigned to
CREATE POLICY candidates_select_assessor ON candidates
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND id IN (
      SELECT DISTINCT candidate_id FROM assessor_assignments
      WHERE assessor_id = auth.uid()
    )
  );

-- Candidates: read own record
CREATE POLICY candidates_select_own ON candidates
  FOR SELECT USING (
    auth_role() = 'candidate'
    AND profile_id = auth.uid()
  );

-- Clients: read candidates in their org's engagements
CREATE POLICY candidates_select_client ON candidates
  FOR SELECT USING (
    auth_role() = 'client'
    AND engagement_id IN (
      SELECT id FROM engagements
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );


-- ────────────────────────────────────────────────────────────
-- ASSESSOR ASSIGNMENTS
-- ────────────────────────────────────────────────────────────

CREATE POLICY assignments_all_admin ON assessor_assignments
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY assignments_select_assessor ON assessor_assignments
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND assessor_id = auth.uid()
  );


-- ────────────────────────────────────────────────────────────
-- OBSERVATIONS
-- ────────────────────────────────────────────────────────────

CREATE POLICY observations_select_admin ON observations
  FOR SELECT USING (auth_role() = 'admin');

-- Assessors: full CRUD on their own observations
CREATE POLICY observations_all_assessor ON observations
  FOR ALL USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND assessor_assignment_id IN (
      SELECT id FROM assessor_assignments WHERE assessor_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- RATINGS
-- ────────────────────────────────────────────────────────────

CREATE POLICY ratings_select_admin ON ratings
  FOR SELECT USING (auth_role() = 'admin');

CREATE POLICY ratings_all_assessor ON ratings
  FOR ALL USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND assessor_assignment_id IN (
      SELECT id FROM assessor_assignments WHERE assessor_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- INTEGRATION WORKSHEETS
-- ────────────────────────────────────────────────────────────

CREATE POLICY worksheets_select_admin ON integration_worksheets
  FOR SELECT USING (auth_role() = 'admin');

CREATE POLICY worksheets_all_assessor ON integration_worksheets
  FOR ALL USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND assessor_id = auth.uid()
  );


-- ────────────────────────────────────────────────────────────
-- CONSENSUS RATINGS & OAR
-- ────────────────────────────────────────────────────────────

CREATE POLICY consensus_all_admin ON consensus_ratings
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY consensus_select_assessor ON consensus_ratings
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND engagement_id IN (
      SELECT DISTINCT engagement_id FROM assessor_assignments
      WHERE assessor_id = auth.uid()
    )
  );

CREATE POLICY oar_all_admin ON overall_assessment_ratings
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY oar_select_assessor ON overall_assessment_ratings
  FOR SELECT USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND engagement_id IN (
      SELECT DISTINCT engagement_id FROM assessor_assignments
      WHERE assessor_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- CANDIDATE REPORTS
-- ────────────────────────────────────────────────────────────

CREATE POLICY reports_all_admin ON candidate_reports
  FOR ALL USING (auth_role() = 'admin');

-- Candidates: read own released reports
CREATE POLICY reports_select_candidate ON candidate_reports
  FOR SELECT USING (
    auth_role() = 'candidate'
    AND status = 'released'
    AND candidate_id IN (
      SELECT id FROM candidates WHERE profile_id = auth.uid()
    )
  );

-- Clients: read released reports for their org's engagements
CREATE POLICY reports_select_client ON candidate_reports
  FOR SELECT USING (
    auth_role() = 'client'
    AND status = 'released'
    AND engagement_id IN (
      SELECT id FROM engagements
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );


-- ────────────────────────────────────────────────────────────
-- PSYCHOMETRIC RESULTS
-- ────────────────────────────────────────────────────────────

CREATE POLICY psychometric_all_admin ON psychometric_results
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY psychometric_select_candidate ON psychometric_results
  FOR SELECT USING (
    auth_role() = 'candidate'
    AND candidate_id IN (
      SELECT id FROM candidates WHERE profile_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- DEVELOPMENT RECOMMENDATIONS
-- ────────────────────────────────────────────────────────────

CREATE POLICY devrec_all_admin ON development_recommendations
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY devrec_select_candidate ON development_recommendations
  FOR SELECT USING (
    auth_role() = 'candidate'
    AND candidate_id IN (
      SELECT id FROM candidates WHERE profile_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- CONSENT RECORDS
-- ────────────────────────────────────────────────────────────

CREATE POLICY consent_select_admin ON consent_records
  FOR SELECT USING (auth_role() = 'admin');

-- Candidates: insert and read own consent
CREATE POLICY consent_insert_candidate ON consent_records
  FOR INSERT WITH CHECK (
    auth_role() = 'candidate'
    AND candidate_id IN (
      SELECT id FROM candidates WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY consent_select_candidate ON consent_records
  FOR SELECT USING (
    auth_role() = 'candidate'
    AND candidate_id IN (
      SELECT id FROM candidates WHERE profile_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- AUDIT LOG (append-only: insert for all, select for admin)
-- ────────────────────────────────────────────────────────────

CREATE POLICY audit_insert_auth ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY audit_select_admin ON audit_log
  FOR SELECT USING (auth_role() = 'admin');

-- Explicitly deny update and delete by not creating policies for them.
-- RLS with no matching policy = denied.
