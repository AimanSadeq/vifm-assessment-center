-- Assessment Center: demographic monitoring and fairness analysis.
--
-- BPS standard:
--   3.19  the client and service provider shall agree monitoring procedures,
--         INCLUDING the collection of demographic data from participants for
--         monitoring purposes
--   3.5   both shall consider the demographics of the participants and how
--         outcomes will be made and reported
--   4.22  exercise design shall not unfairly aid or disadvantage any sub-group
--   5.37  the diversity of participants shall be taken into account when
--         allocating them to centres and groups, and the rationale documented
--   9.9   the evaluation plan shall address diversity
--
-- Pre-Hire has done this since migration 00051: voluntary self-identification,
-- decoupled from scoring, feeding a 4/5ths adverse-impact view that only an
-- admin sees. The Assessment Center - the older and more consequential product -
-- had none of it, so nobody could answer whether a centre's outcomes fell
-- differently on one group than another.
--
-- The vocabulary deliberately matches prehire_candidates so one engine serves
-- both. candidates.gender already uses male / female / prefer_not_to_say; only
-- the other two dimensions are missing.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS age_band text
    CHECK (age_band IN ('under_25', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS nationality_group text
    CHECK (nationality_group IN ('national', 'expatriate', 'prefer_not_to_say')),
  -- Stamped when the participant answers, including when they decline every
  -- question: "asked and declined" and "never asked" are different facts.
  ADD COLUMN IF NOT EXISTS demographics_submitted_at timestamptz;

COMMENT ON COLUMN candidates.age_band IS
  'Voluntary self-identification for fairness monitoring (BPS 3.19). Never used in scoring, never shown per participant, never exported.';
COMMENT ON COLUMN candidates.nationality_group IS
  'Voluntary self-identification, GCC-appropriate national/expatriate split (BPS 3.19). Matches prehire_candidates so one adverse-impact engine serves both.';

-- 5.37: the diversity rationale for how participants were allocated to this
-- centre and to groups within it. "Should be documented" - so it is a text
-- field on the design, not a checkbox.
ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS grouping_rationale text;

COMMENT ON COLUMN engagements.grouping_rationale IS
  'How participants were allocated to this centre and to groups within it, and why (BPS 5.37).';
