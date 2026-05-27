-- ============================================================
-- VIFM Academy + Credentials (VIFM Verify)
--
-- Closes the loop: diagnose -> recommend (already built) -> DELIVER
-- (Academy) -> CERTIFY (Credentials).
--
--   vifm_enrollments        : one row per (candidate, course) enrollment -
--                             the source of truth for "My Learning".
--   academy_lesson_attempts : per-lesson AI knowledge-check, mirroring
--                             candidate_quiz_attempts so the quiz engine
--                             (quiz-generator + QuizInterface) is reused
--                             verbatim. A "lesson" maps to one outline
--                             section of the course.
--   vifm_credentials        : a verifiable credential for any certified
--                             outcome - Academy course completion, an AC
--                             "Ready Now" OAR, or a Fluent CEFR placement.
--                             Looked up publicly by verification_code via a
--                             service-role API route (no public SELECT policy).
--
-- Built as additive substrate: all code paths are best-effort and tolerant,
-- so the app deploys before this migration is applied.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- vifm_enrollments
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vifm_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES vifm_courses(id) ON DELETE CASCADE,
  source        text NOT NULL DEFAULT 'self'
                  CHECK (source IN ('self', 'admin_assigned', 'recommender')),
  status        text NOT NULL DEFAULT 'enrolled'
                  CHECK (status IN ('enrolled', 'in_progress', 'completed', 'withdrawn')),
  enrolled_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null = self-enrolled
  visible_at    timestamptz NOT NULL DEFAULT now(),               -- hide admin-assigned until ready
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  UNIQUE (candidate_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_vifm_enrollments_candidate ON vifm_enrollments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_vifm_enrollments_course ON vifm_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_vifm_enrollments_status ON vifm_enrollments(status);

-- ────────────────────────────────────────────────────────────
-- academy_lesson_attempts  (reuses candidate_quiz_status enum + update_updated_at())
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_lesson_attempts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       uuid NOT NULL REFERENCES vifm_enrollments(id) ON DELETE CASCADE,
  candidate_id        uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES vifm_courses(id) ON DELETE CASCADE,
  lesson_key          text NOT NULL,            -- slug of the outline section title
  status              candidate_quiz_status NOT NULL DEFAULT 'in_progress',
  questions           jsonb NOT NULL,
  answers             jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_pct           numeric(5,2),
  correct_count       int,
  total_count         int NOT NULL,
  passing_score_pct   numeric(5,2) NOT NULL DEFAULT 70.00,
  time_taken_seconds  int,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_key)
);

CREATE INDEX IF NOT EXISTS idx_academy_lesson_attempts_enrollment ON academy_lesson_attempts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_academy_lesson_attempts_candidate ON academy_lesson_attempts(candidate_id);

CREATE TRIGGER academy_lesson_attempts_updated_at
  BEFORE UPDATE ON academy_lesson_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- vifm_credentials
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vifm_credentials (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code  uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),  -- public lookup key
  candidate_id       uuid REFERENCES candidates(id) ON DELETE SET NULL,  -- null for anonymous Fluent
  issued_to_name     text NOT NULL,                                   -- denormalized at issue time
  issued_to_email    text,
  credential_type    text NOT NULL
                       CHECK (credential_type IN ('academy_completion', 'ac_ready_now', 'fluent_cefr')),
  title_en           text NOT NULL,
  title_ar           text,
  subtitle_en        text,
  subtitle_ar        text,
  issuer             text NOT NULL DEFAULT 'Virginia Institute of Finance and Management',
  score_pct          numeric(5,2),
  source_id          uuid,        -- enrollment / engagement / fluent-result id (untyped, app-checked)
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz,
  revoked_at         timestamptz,
  revocation_reason  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vifm_credentials_verification ON vifm_credentials(verification_code);
CREATE INDEX IF NOT EXISTS idx_vifm_credentials_candidate ON vifm_credentials(candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vifm_credentials_type ON vifm_credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_vifm_credentials_source ON vifm_credentials(source_id) WHERE source_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- RLS  (admin full access; candidates own their rows; clients read their
--       org's; public credential verification goes through a service-role
--       API route, never a table-level public SELECT policy)
-- ────────────────────────────────────────────────────────────
ALTER TABLE vifm_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lesson_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vifm_credentials ENABLE ROW LEVEL SECURITY;

-- vifm_enrollments
DROP POLICY IF EXISTS vifm_enrollments_admin ON vifm_enrollments;
CREATE POLICY vifm_enrollments_admin ON vifm_enrollments
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS vifm_enrollments_own ON vifm_enrollments;
CREATE POLICY vifm_enrollments_own ON vifm_enrollments
  FOR ALL USING (
    candidate_id IN (SELECT id FROM candidates WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS vifm_enrollments_select_client ON vifm_enrollments;
CREATE POLICY vifm_enrollments_select_client ON vifm_enrollments
  FOR SELECT USING (
    auth_role() = 'client'
    AND candidate_id IN (
      SELECT c.id FROM candidates c
      JOIN engagements e ON e.id = c.engagement_id
      WHERE e.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- academy_lesson_attempts (mirrors candidate_quiz_attempts)
DROP POLICY IF EXISTS academy_lesson_attempts_admin ON academy_lesson_attempts;
CREATE POLICY academy_lesson_attempts_admin ON academy_lesson_attempts
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS academy_lesson_attempts_own ON academy_lesson_attempts;
CREATE POLICY academy_lesson_attempts_own ON academy_lesson_attempts
  FOR ALL USING (
    candidate_id IN (SELECT id FROM candidates WHERE profile_id = auth.uid())
  );

-- vifm_credentials
DROP POLICY IF EXISTS vifm_credentials_admin ON vifm_credentials;
CREATE POLICY vifm_credentials_admin ON vifm_credentials
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS vifm_credentials_own ON vifm_credentials;
CREATE POLICY vifm_credentials_own ON vifm_credentials
  FOR SELECT USING (
    candidate_id IN (SELECT id FROM candidates WHERE profile_id = auth.uid())
  );
