-- Assessment Center: who assesses whom, and how many of them there are.
--
-- The BPS standard sets hard staffing floors that nothing in the platform
-- checked:
--   5.18  more than one assessor shall assess each participant
--   5.21  at least one assessor for every three participants
--   5.20  assessor and role-player workload shall not be too great
--   5.36  schedules shall avoid an assessor who knows the participant
--   4.16  exercise design shall take account of assessor capacity
--
-- The first three are computed from the assignments already in the database, so
-- they need no schema. The last needs somewhere to record that a particular
-- assessor must not see a particular participant, and 5.22's "confirm before the
-- centre commences" needs a way to record a deliberate, justified exception
-- rather than letting one pass silently.

CREATE TABLE IF NOT EXISTS ac_assessor_conflicts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  assessor_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  reason        text,
  declared_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, assessor_id, candidate_id)
);

COMMENT ON TABLE ac_assessor_conflicts IS
  'An assessor who must not assess a particular participant, because they know them or have another interest. Assignment creation refuses a declared pair (BPS 5.36).';

CREATE INDEX IF NOT EXISTS idx_ac_conflicts_engagement ON ac_assessor_conflicts(engagement_id);

ALTER TABLE ac_assessor_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_conflicts_admin ON ac_assessor_conflicts;
CREATE POLICY ac_conflicts_admin ON ac_assessor_conflicts
  FOR ALL USING (auth_role() = 'admin');

-- Assessors may see the conflicts recorded against themselves, so a person can
-- check that a conflict they raised was acted on.
DROP POLICY IF EXISTS ac_conflicts_own_select ON ac_assessor_conflicts;
CREATE POLICY ac_conflicts_own_select ON ac_assessor_conflicts
  FOR SELECT USING (assessor_id = auth.uid());

-- A recorded, reasoned exception to the staffing floors. Activating a centre
-- that does not meet them requires this; it is never implied.
ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS staffing_override_reason text,
  ADD COLUMN IF NOT EXISTS staffing_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS staffing_override_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN engagements.staffing_override_reason IS
  'Why this centre was activated without meeting the staffing floors (BPS 5.18, 5.21). Null = the floors were met, or the centre pre-dates the check.';
