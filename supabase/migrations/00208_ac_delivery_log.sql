-- Assessment Center: what happened on the day.
--
-- BPS standard, centre delivery:
--   6.10  the Centre Manager shall keep a record of events during delivery that
--         may affect the assessment process, including how they were dealt with
--   6.8   unscheduled events shall be handled effectively
--   6.7   deviations from the agreed procedures and timetable shall be recorded
--   6.13  performance issues of centre staff shall be dealt with
--
-- A fire alarm mid-exercise, a candidate taken ill, a role-player who broke
-- character, an assessor who arrived late: each can change what a score means.
-- Today none of it is written down anywhere, so a challenged result has no
-- context to be read against. This is that record.

CREATE TABLE IF NOT EXISTS ac_delivery_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  -- Who or what it touched. Null candidate = the event affected the whole centre.
  candidate_id   uuid REFERENCES candidates(id) ON DELETE SET NULL,
  exercise_id    uuid REFERENCES exercises(id) ON DELETE SET NULL,
  kind           text NOT NULL CHECK (kind IN ('incident', 'deviation', 'staff', 'other')),
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  summary        text NOT NULL,
  action_taken   text,
  affects_assessment boolean NOT NULL DEFAULT false,
  logged_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  logged_by_name text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_delivery_log IS
  'Events during centre delivery and how they were handled (BPS 6.7, 6.8, 6.10, 6.13). affects_assessment marks the ones a reader of the results needs to know about.';

CREATE INDEX IF NOT EXISTS idx_ac_delivery_log_engagement ON ac_delivery_log(engagement_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_delivery_log_candidate ON ac_delivery_log(candidate_id);

ALTER TABLE ac_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_delivery_log_admin ON ac_delivery_log;
CREATE POLICY ac_delivery_log_admin ON ac_delivery_log
  FOR ALL USING (auth_role() = 'admin');

-- Assessors record what they saw, on centres they are actually working.
DROP POLICY IF EXISTS ac_delivery_log_assessor_select ON ac_delivery_log;
CREATE POLICY ac_delivery_log_assessor_select ON ac_delivery_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assessor_assignments aa
      WHERE aa.engagement_id = ac_delivery_log.engagement_id
        AND aa.assessor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ac_delivery_log_assessor_insert ON ac_delivery_log;
CREATE POLICY ac_delivery_log_assessor_insert ON ac_delivery_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessor_assignments aa
      WHERE aa.engagement_id = ac_delivery_log.engagement_id
        AND aa.assessor_id = auth.uid()
    )
  );

-- The log is a record of what happened, so entries are not editable or
-- deletable: a correction is a new entry. Only a cascade from the engagement
-- removes them.
CREATE OR REPLACE FUNCTION ac_delivery_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ac_delivery_log entries cannot be changed; add a further entry instead';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ac_delivery_log_no_update ON ac_delivery_log;
CREATE TRIGGER ac_delivery_log_no_update
  BEFORE UPDATE ON ac_delivery_log
  FOR EACH ROW EXECUTE FUNCTION ac_delivery_log_immutable();
