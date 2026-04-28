-- ============================================================
-- VIFM ARA — Individual / Personal stage
--
-- Adds a fourth tier to the engagement_stage hierarchy:
--   department → division → enterprise → individual
--
-- The `individual` stage is the self-served, single-respondent
-- mode: a person opens /ara/personal/start, enters their name +
-- email, and gets a personal magic link to a short (~5-7 min)
-- assessment focused on AI behaviours rather than the org's
-- 8-pillar capability maturity. Output is the Personal AI
-- Readiness Snapshot — a short bilingual report with VIFM
-- training-course recommendations.
--
-- Factor model (VIFM-native, mapped to the existing 4-domain
-- AC framework from migration 00002 so the structure feels
-- consistent across AC and ARA):
--
--   THINKING → thinking_sense_check     (AI Sense-Check)
--   RESULTS  → results_working_practice (AI Working Practice)
--   PEOPLE   → people_collaboration     (AI Collaboration)
--   SELF     → self_adaptive_mindset    (AI Adaptive Mindset)
--
-- Items live in the existing ara_questions table — distinguished
-- by the new individual_factor_id column. Pillar_id stays NOT
-- NULL in the schema, so individual-stage questions still pick
-- a notional pillar (we use 'talent' uniformly because all four
-- factors are people-facing) but the recommender keys off
-- individual_factor_id, not pillar_id, when the assessment is
-- in individual stage.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- 1) Extend the enum.
ALTER TYPE ara_engagement_stage ADD VALUE IF NOT EXISTS 'individual';

-- 2) Tag column on ara_questions for the four factors. NULL
--    means "this is a regular pillar question, not an individual
--    factor item" — preserves backward compatibility with the
--    125-question vetted production bank.
ALTER TABLE ara_questions
  ADD COLUMN IF NOT EXISTS individual_factor_id text;

-- Constraint added separately so re-runs on environments that
-- already have the column don't fail — an ALTER TABLE ... ADD
-- CONSTRAINT IF NOT EXISTS isn't supported in older PG versions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ara_questions_individual_factor_check'
  ) THEN
    ALTER TABLE ara_questions
      ADD CONSTRAINT ara_questions_individual_factor_check
      CHECK (individual_factor_id IS NULL OR individual_factor_id IN (
        'thinking_sense_check',
        'results_working_practice',
        'people_collaboration',
        'self_adaptive_mindset'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ara_questions_individual_factor
  ON ara_questions(individual_factor_id)
  WHERE individual_factor_id IS NOT NULL;
