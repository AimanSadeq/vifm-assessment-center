-- ============================================================
-- VIFM Fluent — bind a placement result to a candidate record
--
-- Fluent started life self-served and anonymous. This lets an admin run
-- the test "for" a specific candidate (launch /ac/fluent?candidateId=…),
-- so the English placement lands on that candidate's record alongside
-- their AC competency scores.
--
--   candidate_id  : nullable FK to candidates (SET NULL on candidate delete
--                   so the result row + certificate survive).
--   engagement_id : the engagement the candidate belongs to (for scoping
--                   the candidate-side surface).
--
-- Written best-effort by the scoring route AFTER the core insert, so a
-- database still on 00042/00043 keeps persisting anonymous results — these
-- columns stay null until this migration is applied.
-- ============================================================

ALTER TABLE eng_fluent_results
  ADD COLUMN IF NOT EXISTS candidate_id  uuid REFERENCES candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS eng_fluent_results_candidate_idx ON eng_fluent_results (candidate_id);
