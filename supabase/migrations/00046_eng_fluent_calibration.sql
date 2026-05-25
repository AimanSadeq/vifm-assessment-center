-- ============================================================
-- VIFM Fluent — AI-score calibration (writing + speaking)
--
-- Automated CEFR scoring is only credible if it agrees with human raters.
-- The field-standard metric is Quadratic Weighted Kappa (QWK ≥ 0.70). These
-- tables let a human re-rate persisted results and let us compute QWK
-- (Claude vs human) per skill, plus keep an audit of each AI scoring run
-- (useful once ensemble/self-consistency sampling is enabled).
--
--   eng_fluent_human_ratings : a human rater's CEFR + criteria for a result/skill
--   eng_fluent_score_runs    : one row per AI scoring run (model, cefr, samples)
--
-- Both are admin-only read; writes go through the service-role API/actions.
-- Tolerant: the scoring route writes score_runs best-effort, so a DB without
-- this migration keeps working.
-- ============================================================

CREATE TABLE IF NOT EXISTS eng_fluent_human_ratings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id    uuid NOT NULL REFERENCES eng_fluent_results(id) ON DELETE CASCADE,
  skill        text NOT NULL CHECK (skill IN ('writing', 'speaking')),
  rater_id     text NOT NULL DEFAULT '',   -- admin email/name (self-entered for now)
  human_cefr   text NOT NULL,              -- A1 … C2
  criteria     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- the four 1–5 sub-scores
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eng_fluent_human_ratings_result_idx ON eng_fluent_human_ratings (result_id);
CREATE UNIQUE INDEX IF NOT EXISTS eng_fluent_human_ratings_unique
  ON eng_fluent_human_ratings (result_id, skill, rater_id);

CREATE TABLE IF NOT EXISTS eng_fluent_score_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id    uuid REFERENCES eng_fluent_results(id) ON DELETE CASCADE,
  skill        text NOT NULL CHECK (skill IN ('writing', 'speaking')),
  model        text,
  ai_cefr      text,
  criteria     jsonb NOT NULL DEFAULT '{}'::jsonb,
  samples      int NOT NULL DEFAULT 1,
  raw          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eng_fluent_score_runs_result_idx ON eng_fluent_score_runs (result_id);

ALTER TABLE eng_fluent_human_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE eng_fluent_score_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eng_fluent_human_ratings_admin ON eng_fluent_human_ratings;
CREATE POLICY eng_fluent_human_ratings_admin ON eng_fluent_human_ratings
  FOR SELECT USING (auth_role() = 'admin');

DROP POLICY IF EXISTS eng_fluent_score_runs_admin ON eng_fluent_score_runs;
CREATE POLICY eng_fluent_score_runs_admin ON eng_fluent_score_runs
  FOR SELECT USING (auth_role() = 'admin');
