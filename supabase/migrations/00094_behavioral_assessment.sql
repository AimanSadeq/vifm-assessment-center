-- ============================================================
-- 00094 - Behavioral self-assessment storage (Slice 4)
--
-- Candidate self-assessment sessions + item responses + per-competency rollup
-- (the self scores the readiness engine reads in combined mode).
-- (Delivered as handover "00084"; renumbered to 00094 - Slice 1-2 landed at
-- 00087-00093.) Writes go through service-role server actions (mirrors the
-- quiz / academy / prehire candidate flows); RLS is admin-only here.
--
-- Idempotent / re-runnable: guarded CREATE TYPE + CREATE TABLE IF NOT EXISTS +
-- DROP-then-CREATE policies, so a partial or repeated apply never errors.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE behavioral_assessment_status AS ENUM ('not_started','in_progress','submitted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS behavioral_assessment_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status        behavioral_assessment_status NOT NULL DEFAULT 'not_started',
  started_at    timestamptz,
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS behavioral_assessment_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES behavioral_assessment_sessions(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  item_key      text NOT NULL,                 -- stable id of the item within the bank
  raw_score     smallint NOT NULL CHECK (raw_score BETWEEN 1 AND 5),
  is_reverse    boolean NOT NULL DEFAULT false,
  answered_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_bx_responses_session ON behavioral_assessment_responses(session_id);

-- Per-competency self rollup the readiness engine reads in combined mode.
CREATE TABLE IF NOT EXISTS behavioral_competency_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  self_score    numeric(3,2) NOT NULL,         -- mean of items, reverse already applied
  item_count    smallint NOT NULL,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, candidate_id, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_bx_scores_candidate ON behavioral_competency_scores(engagement_id, candidate_id);

ALTER TABLE behavioral_assessment_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_assessment_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_competency_scores     ENABLE ROW LEVEL SECURITY;

-- Admin full access; candidate writes go through service-role server actions
-- (same model as candidate_quiz_attempts / academy / prehire).
DROP POLICY IF EXISTS bx_sessions_admin  ON behavioral_assessment_sessions;
CREATE POLICY bx_sessions_admin  ON behavioral_assessment_sessions  FOR ALL USING (auth_role() = 'admin');
DROP POLICY IF EXISTS bx_responses_admin ON behavioral_assessment_responses;
CREATE POLICY bx_responses_admin ON behavioral_assessment_responses FOR ALL USING (auth_role() = 'admin');
DROP POLICY IF EXISTS bx_scores_admin    ON behavioral_competency_scores;
CREATE POLICY bx_scores_admin    ON behavioral_competency_scores    FOR ALL USING (auth_role() = 'admin');
