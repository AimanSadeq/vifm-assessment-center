-- ============================================================
-- 00098 - Persona standalone (anonymous) self-assessment
--
-- Lets Persona run as its own assessment - just a name, no candidate and no
-- engagement - exactly like the Cognitive runner (psy_results) and the ARA
-- personal snapshot. The candidate-bound path stays the readiness "self" feed
-- and is unchanged.
--
-- How: relax the two NOT NULL FKs on behavioral_assessment_sessions and add a
-- taker_name label. The UNIQUE(engagement_id, candidate_id) is kept; Postgres
-- treats NULLs as distinct, so many anonymous sessions (both columns NULL) are
-- allowed while the one-per-candidate rule still holds for bound runs.
--
-- behavioral_competency_scores (the readiness rollup) is intentionally NOT
-- touched: anonymous runs have no candidate/engagement to roll up to, so the
-- anonymous submit scores in-memory and returns the profile without writing it.
--
-- Idempotent / re-runnable.
-- ============================================================

ALTER TABLE behavioral_assessment_sessions ALTER COLUMN engagement_id DROP NOT NULL;
ALTER TABLE behavioral_assessment_sessions ALTER COLUMN candidate_id  DROP NOT NULL;
ALTER TABLE behavioral_assessment_sessions ADD COLUMN IF NOT EXISTS taker_name text;
