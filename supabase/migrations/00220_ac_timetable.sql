-- Assessment Center: when everything happens, where, and with whom.
--
-- BPS standard:
--   5.35   the service provider shall prepare: a centre timetable showing the
--          sequence of events; a matrix allocating participants to assessors,
--          role-players and fact-find administrators across exercises; a master
--          timetable combining both with ROOM allocations; and INDIVIDUAL
--          timetables for participants, assessors and role-players saying what
--          they are doing, with whom, where and when
--   5.35.5 timetables shall not compromise the performance of anyone involved
--   4.33.4 an outline timetable shall be prepared for all roles
--   6.4    the Centre Manager shall brief everyone on logistics and timetabling
--   6.7    agreed timetables shall be followed, and delivery standardised
--
-- Caliber knew WHO assessed WHOM in WHICH exercise (assessor_assignments) and
-- nothing at all about when or where. So the platform could not answer the
-- question every participant and every assessor asks first, and 5.35.5 - the
-- one clause here that protects people rather than paperwork - had nothing to
-- check: an assessor booked to watch two participants at once, or a candidate
-- running five hours without a break, was invisible.

CREATE TABLE IF NOT EXISTS ac_schedule_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  -- Breaks and briefings are part of a timetable, not gaps between one. 5.35.5
  -- cannot be checked without them: a day with no break scheduled is not a day
  -- with a break somebody forgot to write down.
  kind          text NOT NULL DEFAULT 'exercise'
                  CHECK (kind IN ('exercise', 'briefing', 'break', 'lunch', 'washup', 'feedback', 'other')),
  exercise_id   uuid REFERENCES exercises(id) ON DELETE SET NULL,
  -- Null candidate = the whole cohort (a briefing, lunch). Null assessor = a
  -- slot nobody observes.
  candidate_id  uuid REFERENCES candidates(id) ON DELETE CASCADE,
  assessor_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  room          text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ac_schedule_slots_ends_after_start CHECK (ends_at > starts_at)
);

COMMENT ON TABLE ac_schedule_slots IS
  'The centre timetable: every event, who is in it, where and when (BPS 5.35). Breaks and briefings are slots too, because 5.35.5 cannot be checked without them.';

CREATE INDEX IF NOT EXISTS idx_ac_slots_engagement ON ac_schedule_slots(engagement_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_ac_slots_candidate ON ac_schedule_slots(candidate_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_ac_slots_assessor ON ac_schedule_slots(assessor_id, starts_at);

DROP TRIGGER IF EXISTS ac_schedule_slots_updated_at ON ac_schedule_slots;
CREATE TRIGGER ac_schedule_slots_updated_at
  BEFORE UPDATE ON ac_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ac_schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_slots_admin ON ac_schedule_slots;
CREATE POLICY ac_slots_admin ON ac_schedule_slots
  FOR ALL USING (auth_role() = 'admin');

-- 5.35.4 says individual timetables go to participants and staff, so each of
-- them can read their own slots and the cohort-wide ones.
DROP POLICY IF EXISTS ac_slots_candidate_select ON ac_schedule_slots;
CREATE POLICY ac_slots_candidate_select ON ac_schedule_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_schedule_slots.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ac_slots_assessor_select ON ac_schedule_slots;
CREATE POLICY ac_slots_assessor_select ON ac_schedule_slots
  FOR SELECT USING (
    assessor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM assessor_assignments aa
      WHERE aa.engagement_id = ac_schedule_slots.engagement_id
        AND aa.assessor_id = auth.uid()
    )
  );
