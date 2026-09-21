-- Assessment Center: how the overall rating is reached, and the record of it.
--
-- The BPS standard requires the integration rule to be fixed when the centre is
-- designed, not settled in the room (clauses 4.34, 4.35, 7.2, 7.3), and requires
-- an ARITHMETIC rule wherever the centre supports selection decisions (7.4),
-- because combining scores by calculation validates better than a panel talking
-- its way to a verdict. Development centres keep the discussion (7.9) and the
-- panel's judgement.
--
-- Two halves:
--   1. engagements carries the rule, and the weights it depends on carry a
--      confirmation. An arithmetic rating computed from weights an AI proposed
--      and nobody approved would be worse than the consensus it replaces, so the
--      rating is refused until the weights are confirmed (clause 7.3: weighting
--      shall come from the job analysis).
--   2. overall_assessment_ratings keeps the computed decimal, the inputs it was
--      computed from, and any panel disagreement. overall_score stays the whole
--      number 1-5 it always was, so nothing that reads it changes meaning, and
--      no delivered result moves.

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS integration_method text
    CHECK (integration_method IN ('weighted_average', 'consensus')),
  ADD COLUMN IF NOT EXISTS integration_notes text,
  ADD COLUMN IF NOT EXISTS weights_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS weights_confirmed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN engagements.integration_method IS
  'How the overall rating is reached: weighted_average (required for selection centres, BPS 7.4) or consensus (development centres). Null = pre-dates the field; the wash-up falls back to the purpose.';
COMMENT ON COLUMN engagements.weights_confirmed_at IS
  'When a human confirmed the competency weights for this engagement. No arithmetic overall rating is produced until this is set (BPS 7.3).';

ALTER TABLE overall_assessment_ratings
  ADD COLUMN IF NOT EXISTS computed_score numeric(4, 2),
  ADD COLUMN IF NOT EXISTS method text CHECK (method IN ('weighted_average', 'consensus')),
  ADD COLUMN IF NOT EXISTS computation jsonb,
  ADD COLUMN IF NOT EXISTS panel_disagrees boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS panel_comment text;

COMMENT ON COLUMN overall_assessment_ratings.computed_score IS
  'The arithmetic overall rating to two decimals, kept unrounded so the calculation stays visible. overall_score remains the banded whole number.';
COMMENT ON COLUMN overall_assessment_ratings.computation IS
  'Snapshot of what the rating was computed from: each competency, its weight and its agreed rating. Lets the number be reconstructed later (BPS 8.8).';
COMMENT ON COLUMN overall_assessment_ratings.panel_disagrees IS
  'The panel recorded that it disagrees with the computed rating. The computed rating still stands as the centre outcome (BPS 7.6); the disagreement is documented, not applied.';

-- Backfill the rule for engagements that already recorded a purpose, so the
-- wash-up does not have to guess. Engagements with no purpose stay null and
-- behave exactly as they did before.
UPDATE engagements
   SET integration_method = CASE WHEN purpose = 'selection' THEN 'weighted_average' ELSE 'consensus' END
 WHERE purpose IS NOT NULL AND integration_method IS NULL;
