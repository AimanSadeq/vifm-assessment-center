-- Assessment Center: what the participant was actually told, and by whom.
--
-- BPS standard:
--   8.3   assessment outcomes shall be communicated to participants as part of
--         the feedback process, during or after the centre
--   8.5   reports shall be provided as soon as possible
--   8.14  where the centre is for development, feedback SHALL be provided
--   8.15  where it is for assessment, feedback should be provided
--   8.16  feedback should be comprehensive and soon after the centre
--   8.21  where feedback is oral, the participant should get a WRITTEN RECORD
--         of what was discussed
--   8.22  a development centre's feedback should contain an oral element
--   8.23  the content shall be a written summary, a detailed written report, or
--         oral feedback from feedback-trained assessors
--   8.24  whoever gives feedback shall have access to the centre's evaluations
--   8.17  and shall be trained in giving feedback and familiar with the centre
--
-- Releasing a report is not the same as giving feedback, and the platform only
-- knew about the first. A participant who was talked through their results in a
-- half-hour conversation has had the most valuable thing the centre produces,
-- and nothing recorded that it happened, what was said, or who said it. When
-- someone later asks whether a development centre met its obligation, the
-- answer lived in somebody's calendar.

CREATE TABLE IF NOT EXISTS ac_feedback_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  -- 8.23: which of the permitted forms this was.
  form          text NOT NULL CHECK (form IN ('written_report', 'oral', 'both')),
  delivered_at  timestamptz NOT NULL DEFAULT now(),
  delivered_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  delivered_by_name text NOT NULL,
  -- 8.21: the written record of an oral session. Required by the application
  -- whenever the form includes an oral element - a conversation nobody wrote
  -- down is one the participant cannot refer back to or challenge.
  summary       text,
  -- 8.17: whether the person giving it was recorded as feedback-trained AT THE
  -- TIME. Stored rather than derived, because competence records change and
  -- this is a statement about the moment the feedback was given.
  deliverer_trained boolean NOT NULL DEFAULT false,
  -- The participant confirming they received it. Their word, not ours.
  acknowledged_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_feedback_records IS
  'What each participant was told about their results, in what form and by whom (BPS 8.3, 8.14-8.24). Releasing a report is not the same as giving feedback.';
COMMENT ON COLUMN ac_feedback_records.deliverer_trained IS
  'Whether the person giving feedback held a current feedback-generator competence record at the time (BPS 8.17). A statement about that moment, not a live lookup.';

CREATE INDEX IF NOT EXISTS idx_ac_feedback_engagement ON ac_feedback_records(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ac_feedback_candidate ON ac_feedback_records(candidate_id, delivered_at DESC);

DROP TRIGGER IF EXISTS ac_feedback_records_updated_at ON ac_feedback_records;
CREATE TRIGGER ac_feedback_records_updated_at
  BEFORE UPDATE ON ac_feedback_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ac_feedback_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_feedback_admin ON ac_feedback_records;
CREATE POLICY ac_feedback_admin ON ac_feedback_records
  FOR ALL USING (auth_role() = 'admin');

-- The participant reads their own record: it is what they were told, and 8.21
-- says they should have it in writing.
DROP POLICY IF EXISTS ac_feedback_candidate_select ON ac_feedback_records;
CREATE POLICY ac_feedback_candidate_select ON ac_feedback_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_feedback_records.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

-- They may acknowledge receipt, and nothing else. The trigger below holds them
-- to that; an account of what was said is not theirs to edit, and neither is
-- the claim that it happened.
DROP POLICY IF EXISTS ac_feedback_candidate_ack ON ac_feedback_records;
CREATE POLICY ac_feedback_candidate_ack ON ac_feedback_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_feedback_records.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

-- Assessors who worked the centre can see that feedback was given and by whom,
-- which is how a feedback generator knows the participant has already been
-- spoken to. Not the summary of what was said - that is between the participant
-- and whoever gave it.
DROP POLICY IF EXISTS ac_feedback_assessor_select ON ac_feedback_records;
CREATE POLICY ac_feedback_assessor_select ON ac_feedback_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assessor_assignments aa
      WHERE aa.engagement_id = ac_feedback_records.engagement_id
        AND aa.assessor_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION ac_feedback_protect() RETURNS trigger AS $func$
BEGIN
  IF NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
     OR NEW.engagement_id IS DISTINCT FROM OLD.engagement_id
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
     OR NEW.delivered_by IS DISTINCT FROM OLD.delivered_by
     OR NEW.delivered_by_name IS DISTINCT FROM OLD.delivered_by_name THEN
    RAISE EXCEPTION 'Who gave this feedback, to whom and when cannot be changed; record a further session instead';
  END IF;
  IF OLD.summary IS NOT NULL AND NEW.summary IS DISTINCT FROM OLD.summary THEN
    RAISE EXCEPTION 'The written record of what was discussed cannot be rewritten; record a further session instead';
  END IF;
  IF OLD.acknowledged_at IS NOT NULL AND NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN
    RAISE EXCEPTION 'An acknowledgement cannot be altered';
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ac_feedback_protect_trg ON ac_feedback_records;
CREATE TRIGGER ac_feedback_protect_trg
  BEFORE UPDATE ON ac_feedback_records
  FOR EACH ROW EXECUTE FUNCTION ac_feedback_protect();
