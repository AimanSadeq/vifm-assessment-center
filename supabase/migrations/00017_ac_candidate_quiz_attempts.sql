-- ============================================================
-- VIFM Assessment Center - Candidate self-serve AI quizzes (G3)
--
-- A candidate can launch a short AI-generated quiz on any single
-- competency from their bound role profile. The 7-question deck is
-- frozen at attempt-start time (stored as JSONB on the attempt) so
-- score and review remain reproducible even if the AI prompt or
-- behavioural indicators change later. Answers are stored alongside
-- the questions, so the results page never re-asks the AI.
--
-- Question shape (one element of `questions` jsonb array):
--   {
--     id: "q-1",
--     type: "true_false" | "multiple_choice" | "pattern_recognition",
--     prompt_en: string,
--     prompt_ar: string | null,
--     options_en: string[],
--     options_ar: string[] | null,
--     correct_index: number,
--     points: number,
--     difficulty: "easy" | "medium" | "hard",
--     explanation_en: string,
--     explanation_ar: string | null,
--     // Optional, only when type == "pattern_recognition"
--     sequence: (string | number | null)[]
--   }
--
-- Answer shape (one element of `answers` jsonb array, indexed by
-- question position):
--   { question_id: string, picked_index: number | null, answered_at: timestamptz }
-- ============================================================

CREATE TYPE candidate_quiz_status AS ENUM ('in_progress', 'completed', 'abandoned');

CREATE TABLE candidate_quiz_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id          uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  competency_id         uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  status                candidate_quiz_status NOT NULL DEFAULT 'in_progress',
  questions             jsonb NOT NULL,
  answers               jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_pct             numeric(5,2),                  -- 0.00 to 100.00, null until completed
  correct_count         int,
  total_count           int NOT NULL,
  passing_score_pct     numeric(5,2) NOT NULL DEFAULT 70.00,
  time_taken_seconds    int,                           -- null until completed/abandoned
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidate_quiz_attempts_candidate ON candidate_quiz_attempts(candidate_id);
CREATE INDEX idx_candidate_quiz_attempts_competency ON candidate_quiz_attempts(competency_id);
CREATE INDEX idx_candidate_quiz_attempts_status ON candidate_quiz_attempts(status);

CREATE TRIGGER candidate_quiz_attempts_updated_at
  BEFORE UPDATE ON candidate_quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE candidate_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY candidate_quiz_attempts_all_admin ON candidate_quiz_attempts
  FOR ALL USING (auth_role() = 'admin');

-- Candidates read + write their own attempts. Matched via the
-- candidates.profile_id link, mirroring the existing
-- candidates_select_own / candidate_reports_select_own pattern.
CREATE POLICY candidate_quiz_attempts_own ON candidate_quiz_attempts
  FOR ALL USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE profile_id = auth.uid()
    )
  );

-- Clients read attempts for candidates in their org's engagements
-- (read-only; clients should never write to candidate-owned data).
CREATE POLICY candidate_quiz_attempts_select_client ON candidate_quiz_attempts
  FOR SELECT USING (
    auth_role() = 'client'
    AND candidate_id IN (
      SELECT c.id
      FROM candidates c
      JOIN engagements e ON e.id = c.engagement_id
      WHERE e.organization_id = (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
