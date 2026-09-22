-- Assessment Center: the design record, and the centre plan.
--
-- BPS standard, section 4 (design) and 3.26 (the plan):
--   3.26  a detailed plan shall be agreed and documented with the client: the
--         assessment rationale, the scope of the criteria, the methods and
--         procedures, the management of data and reporting, the resources in
--         personnel and facilities, and the timing and scheduling
--   4.1   the design shall be recommended having explored the client's needs
--         and CONSIDERED ALTERNATIVES
--   4.4   the job analysis shall clearly demonstrate the link between each
--         assessment criterion and effective performance in the target job
--   4.5   the number of criteria shall not be greater than can be effectively
--         assessed within the confines of the design
--   4.9   the design shall represent the type of work, the activities, the work
--         context and the systems and processes of the target role
--   4.11  how the assessment methods relate to the work context should be documented
--   4.12  the methods shall cover the range of key activities and contexts
--   4.13  recommendations on the type and range of methods shall be made
--   4.14  recommendations for selecting or designing specific exercises
--   4.19  no exercise shall let performance in it restrict or enhance performance
--         against the criteria in another
--   4.20  exercises in combination shall collect evidence on all performance
--         indicators within the criteria
--   4.21  exercises shall use the job's own output modes - written, spoken, email
--   4.23  type and difficulty shall match the challenges in the job, reviewed by
--         job content experts
--   4.27  non-exercise methods shall be relevant to the criteria and appropriate
--         for the participants
--   4.28  existing or adapted exercises shall meet the same standards as new ones
--
-- Caliber makes these decisions - it just never wrote down why. The JD
-- extractor already produces the 4.4 link, one sentence per competency saying
-- which job requirement it maps to, and then DISCARDS it: engagement_competencies
-- stored nothing but a weight. So a centre could be challenged on why it
-- assessed what it assessed and the answer existed only in whoever ran it.

-- ─────────────── Why each criterion is here (4.4, and 4.12 in part) ───────────
ALTER TABLE engagement_competencies
  ADD COLUMN IF NOT EXISTS rationale text,
  -- Where the criterion came from, which is itself evidence about the job
  -- analysis: an AI-proposed criterion nobody reviewed is a weaker claim than
  -- one taken from a validated role profile.
  ADD COLUMN IF NOT EXISTS source text
    CHECK (source IN ('jd_extractor', 'role_profile', 'manual'));

COMMENT ON COLUMN engagement_competencies.rationale IS
  'Why this criterion is assessed at this centre, linked to performance in the target role (BPS 4.4). Populated from the JD extractor''s reasoning, editable by hand.';

-- ────────────────────── The design record (section 4) ─────────────────────────
ALTER TABLE engagements
  -- 4.1: what was considered and why this shape was recommended.
  ADD COLUMN IF NOT EXISTS design_rationale text,
  ADD COLUMN IF NOT EXISTS alternatives_considered text,
  -- 4.4 / 4.9 / 4.23: where the criteria came from and what the job is like.
  ADD COLUMN IF NOT EXISTS job_analysis_method text
    CHECK (job_analysis_method IN ('jd_extraction', 'role_profile', 'interviews', 'observation', 'workshop', 'other')),
  ADD COLUMN IF NOT EXISTS job_analysis_note text,
  ADD COLUMN IF NOT EXISTS work_context text,
  -- 4.23: job content experts reviewing the difficulty of the exercises.
  ADD COLUMN IF NOT EXISTS sme_review_note text,
  -- 4.19: a design declaration, because no query can tell whether one exercise
  -- leaks into another - only a person reading both can.
  ADD COLUMN IF NOT EXISTS exercise_independence_note text,
  -- 4.28: existing or adapted exercises held to the same standard.
  ADD COLUMN IF NOT EXISTS existing_exercises_note text,
  -- 4.5: acknowledging a design that carries more criteria than the exercises
  -- can carry. Recorded rather than blocked, because the honest answer is
  -- sometimes "the client insisted", and that is worth being on the record.
  ADD COLUMN IF NOT EXISTS criteria_load_ack text,
  -- 3.26: the plan, agreed with the client.
  ADD COLUMN IF NOT EXISTS plan_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_approved_client_name text,
  ADD COLUMN IF NOT EXISTS facilities_note text;

COMMENT ON COLUMN engagements.plan_approved_client_name IS
  'Who at the client agreed the centre plan, and when (BPS 3.26). The plan is agreed WITH the client, so an internal sign-off alone does not satisfy it.';
COMMENT ON COLUMN engagements.criteria_load_ack IS
  'Why this centre assesses more criteria than its exercises can comfortably carry (BPS 4.5). Present only when someone chose to proceed anyway.';
