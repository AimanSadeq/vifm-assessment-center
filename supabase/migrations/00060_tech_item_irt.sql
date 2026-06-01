-- ════════════════════════════════════════════════════════════════
-- Technical Assessment — IRT calibration on the item bank (Phase-3 #2)
--
-- Adaptive (CAT) groundwork. The Rasch engine (src/lib/scoring/irt.ts, reused
-- from Fluent) selects the next item by maximum information at the taker's
-- current ability — which needs each item's difficulty on the logit scale.
-- We store a calibrated `irt_b` per item: estimated from its proportion-correct
-- once it has enough administrations (the times_administered/times_correct
-- substrate from 00053), else seeded from the easy/medium/hard prior.
--
-- Null irt_b = uncalibrated. The CAT flow stays dark until a skill's bank is
-- calibrated (mirrors Fluent's status='live' gate); the classical confidence
-- band ships on every result regardless.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE tech_assessment_items
  ADD COLUMN IF NOT EXISTS irt_b         numeric,        -- Rasch difficulty (logit)
  ADD COLUMN IF NOT EXISTS irt_se        numeric,        -- SE of the difficulty estimate
  ADD COLUMN IF NOT EXISTS calibrated_at timestamptz;    -- when irt_b was last set

-- Fast lookup of a skill's calibrated pool (the CAT candidate set).
CREATE INDEX IF NOT EXISTS idx_tech_items_calibrated
  ON tech_assessment_items(skill) WHERE irt_b IS NOT NULL;
