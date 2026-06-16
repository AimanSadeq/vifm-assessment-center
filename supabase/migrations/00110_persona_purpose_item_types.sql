-- ════════════════════════════════════════════════════════════════
-- 00110 - Persona: purpose, target role, randomization, item types
--
-- Two upgrades to the behavioural self-assessment (Persona):
--
--   1. Purpose-by-pillar. A Persona run is now either a DEVELOPMENT read
--      (explanation + suggestions per competency) or a HIRING read (a fit score
--      against a target role profile). The session records which, plus the
--      target role profile when hiring, and the randomization seed used to lay
--      out the items (so a report can reconstruct exactly what the taker saw).
--
--   2. Two item types. Responses now carry an item_type - 'normative' (the 1-5
--      Likert statements) or 'ipsative' (forced-choice "most/least like me"
--      blocks) - plus an answer_data jsonb for the forced-choice block context.
--      Ipsative rows still store a 1-5 raw_score (most=5, least=1) so they flow
--      through the SAME per-competency rollup as Likert items; the new columns
--      are for audit + reproducibility.
--
-- Additive + tolerant: every column is IF NOT EXISTS with a safe default, so
-- existing rows + the pre-migration code path keep working unchanged.
-- Depends on 00094 (behavioral_assessment_*) + 00014 (role_profiles).
-- ════════════════════════════════════════════════════════════════

-- 1. Session: purpose + target role + seed.
ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'development'
    CHECK (purpose IN ('development','hiring'));

ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS target_role_profile_id uuid
    REFERENCES role_profiles(id) ON DELETE SET NULL;

ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS randomization_seed bigint;

-- 2. Responses: item type + forced-choice answer context.
ALTER TABLE behavioral_assessment_responses
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'normative'
    CHECK (item_type IN ('normative','ipsative'));

ALTER TABLE behavioral_assessment_responses
  ADD COLUMN IF NOT EXISTS answer_data jsonb;
