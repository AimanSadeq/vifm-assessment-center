-- Assessment Center: who chaired the integration meeting, and what evidence
-- from outside the centre was allowed into it.
--
-- BPS standard:
--   7.10  the Chair shall ensure data integration complies with the agreed design
--   7.11  the Chair shall ensure evidence is heard from ALL assessors
--   7.12  the Chair shall ensure the outcome is determined on relevant centre evidence
--   7.13  where assessors differ, the Chair should encourage discussion of the divergence
--   7.14  clear guidance shall be given on the degree to which, IF AT ALL, external
--         evidence may be considered in arriving at a centre outcome
--   7.15  external evidence may only count towards overall ratings if relevant data
--         exists for ALL participants, can be mapped to the centre's criteria, and
--         was collected with care to ensure validity
--   7.16  where it is used, the framework for integrating it shall have been
--         established during DESIGN
--   7.17  the Centre Manager shall ensure external evidence is only presented when
--         it has been agreed to be relevant
--
-- The wash-up already reconciles the assessors' worksheets, but nobody was
-- named as answerable for it and nothing recorded that every assessor had
-- actually been heard - so an assessor whose evidence was skipped left no
-- trace. And nothing said whether a manager's opinion, a previous appraisal or
-- a psychometric profile could be brought into the room at all: in practice
-- assessors decided in the moment, which is the undocumented rule 7.14 exists
-- to prevent.

-- ───────────────────── Design-time rule on external evidence ──────────────────
ALTER TABLE engagements
  -- 'not_permitted' is a complete and defensible answer to 7.14, and the safer
  -- default: silence is what the clause forbids, not refusal.
  ADD COLUMN IF NOT EXISTS external_evidence_rule text
    CHECK (external_evidence_rule IN ('not_permitted', 'permitted')),
  -- The 7.16 framework: how such evidence maps onto the criteria and what it
  -- may do to a rating. Required before the rule can be set to permitted.
  ADD COLUMN IF NOT EXISTS external_evidence_framework text,
  ADD COLUMN IF NOT EXISTS external_evidence_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_evidence_confirmed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN engagements.external_evidence_rule IS
  'Whether evidence from outside the centre may count towards a rating (BPS 7.14). not_permitted is a valid and safer answer; permitted requires the integration framework in external_evidence_framework (7.16).';

-- ─────────────── The meeting: who chaired it, and who was heard ───────────────
ALTER TABLE overall_assessment_ratings
  ADD COLUMN IF NOT EXISTS chair_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chair_name text,
  -- One entry per assessor who submitted a worksheet for this participant, with
  -- whether their evidence was heard. A list rather than a single tick, because
  -- "evidence was heard from all assessors" asserted in one checkbox is exactly
  -- the claim that cannot be checked afterwards.
  ADD COLUMN IF NOT EXISTS evidence_heard jsonb,
  ADD COLUMN IF NOT EXISTS evidence_heard_at timestamptz,
  -- 7.17: external evidence presented at this meeting, and the confirmation
  -- that it was agreed to be relevant.
  ADD COLUMN IF NOT EXISTS external_evidence_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_evidence_note text;

COMMENT ON COLUMN overall_assessment_ratings.evidence_heard IS
  'Per-assessor record that their evidence was heard at the integration meeting (BPS 7.11): [{assessor_id, name, heard}].';
COMMENT ON COLUMN overall_assessment_ratings.chair_id IS
  'Who chaired the integration meeting and is answerable for 7.10 to 7.13.';
