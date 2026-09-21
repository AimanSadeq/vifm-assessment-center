-- Assessment Center: what a participant can do, and what they get told.
--
-- BPS standard, participant rights:
--   5.43  participants shall be given a named contact for questions      (00207)
--   5.44  participants shall be able to raise concerns before, during
--         and after the centre
--   5.48  there shall be a procedure for appealing against a result
--   6.11  concerns raised during the centre shall be dealt with
--   5.9   participants shall be told the decision made on their
--         assessment, and when it was made
--   5.50  a participant disturbed or taken ill during the centre shall be
--         offered re-assessment
--
-- Today a participant has no route at all: the report names a contact
-- (migration 00207) but there is nowhere for them to say anything, nothing
-- records that they did, and no evidence that anyone answered. An appeals
-- route that exists only as a sentence in a PDF is not a route.

-- ───────────────────── Concerns and appeals (5.44, 5.48, 6.11) ────────────────
CREATE TABLE IF NOT EXISTS ac_participant_concerns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id     uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id      uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  -- A concern is about how the centre was run; an appeal is against a result.
  -- They are kept apart because they are answered by different people and an
  -- appeal has to be traceable to the rating it disputes.
  kind              text NOT NULL CHECK (kind IN ('concern', 'appeal')),
  stage             text NOT NULL CHECK (stage IN ('before', 'during', 'after')),
  body              text NOT NULL,
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'acknowledged', 'resolved', 'withdrawn')),
  response          text,
  raised_at         timestamptz NOT NULL DEFAULT now(),
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  responded_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  responded_by_name text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_participant_concerns IS
  'Concerns about how a centre was run and appeals against a result, with the answer given (BPS 5.44, 5.48, 6.11). Raised by the participant, answered by VIFM.';

CREATE INDEX IF NOT EXISTS idx_ac_concerns_engagement ON ac_participant_concerns(engagement_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_concerns_candidate ON ac_participant_concerns(candidate_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_concerns_open ON ac_participant_concerns(status) WHERE status IN ('open', 'acknowledged');

DROP TRIGGER IF EXISTS ac_participant_concerns_updated_at ON ac_participant_concerns;
CREATE TRIGGER ac_participant_concerns_updated_at
  BEFORE UPDATE ON ac_participant_concerns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ac_participant_concerns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_concerns_admin ON ac_participant_concerns;
CREATE POLICY ac_concerns_admin ON ac_participant_concerns
  FOR ALL USING (auth_role() = 'admin');

-- The participant reads their own and raises new ones. Deliberately no UPDATE
-- and no DELETE for them: the answer is written by VIFM, and a raised concern
-- cannot be made to disappear. Withdrawing one is a status change an admin
-- makes on request, which leaves the record intact.
DROP POLICY IF EXISTS ac_concerns_candidate_select ON ac_participant_concerns;
CREATE POLICY ac_concerns_candidate_select ON ac_participant_concerns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_participant_concerns.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ac_concerns_candidate_insert ON ac_participant_concerns;
CREATE POLICY ac_concerns_candidate_insert ON ac_participant_concerns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_participant_concerns.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

-- A response, once given, is part of the record: it can be added but not
-- rewritten or erased, and the status cannot walk backwards out of resolved.
-- Admins can still correct a typo in an unanswered row.
CREATE OR REPLACE FUNCTION ac_concerns_protect_response() RETURNS trigger AS $$
BEGIN
  IF OLD.response IS NOT NULL AND NEW.response IS DISTINCT FROM OLD.response THEN
    RAISE EXCEPTION 'A response that has been given cannot be rewritten; add a further response instead';
  END IF;
  IF OLD.status = 'resolved' AND NEW.status <> 'resolved' THEN
    RAISE EXCEPTION 'A resolved concern cannot be reopened; the participant raises a new one';
  END IF;
  IF NEW.raised_at IS DISTINCT FROM OLD.raised_at
     OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
     OR NEW.engagement_id IS DISTINCT FROM OLD.engagement_id
     OR NEW.body IS DISTINCT FROM OLD.body THEN
    RAISE EXCEPTION 'What was raised, by whom and when cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ac_concerns_protect ON ac_participant_concerns;
CREATE TRIGGER ac_concerns_protect
  BEFORE UPDATE ON ac_participant_concerns
  FOR EACH ROW EXECUTE FUNCTION ac_concerns_protect_response();

-- ───────────────────────── Re-assessment (5.50) ───────────────────────────────
CREATE TABLE IF NOT EXISTS ac_reassessment_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id    uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  -- Null exercise = the whole centre is being re-run for this participant.
  exercise_id     uuid REFERENCES exercises(id) ON DELETE SET NULL,
  -- The event that caused it, where one was logged. Keeps the reason and the
  -- record of what happened joined up rather than retyped.
  delivery_log_id uuid REFERENCES ac_delivery_log(id) ON DELETE SET NULL,
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'scheduled', 'completed', 'declined')),
  scheduled_for   timestamptz,
  outcome_note    text,
  requested_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requested_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_reassessment_requests IS
  'Re-assessment offered to a participant disturbed or taken ill during a centre (BPS 5.50). declined records that it was offered and turned down, which is as important as arranging it.';

CREATE INDEX IF NOT EXISTS idx_ac_reassessment_engagement ON ac_reassessment_requests(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ac_reassessment_candidate ON ac_reassessment_requests(candidate_id);

DROP TRIGGER IF EXISTS ac_reassessment_updated_at ON ac_reassessment_requests;
CREATE TRIGGER ac_reassessment_updated_at
  BEFORE UPDATE ON ac_reassessment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ac_reassessment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_reassessment_admin ON ac_reassessment_requests;
CREATE POLICY ac_reassessment_admin ON ac_reassessment_requests
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS ac_reassessment_candidate_select ON ac_reassessment_requests;
CREATE POLICY ac_reassessment_candidate_select ON ac_reassessment_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_reassessment_requests.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ac_reassessment_assessor_select ON ac_reassessment_requests;
CREATE POLICY ac_reassessment_assessor_select ON ac_reassessment_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assessor_assignments aa
      WHERE aa.engagement_id = ac_reassessment_requests.engagement_id
        AND aa.assessor_id = auth.uid()
    )
  );

-- ─────────────────── Decision, and telling the participant (5.9) ──────────────
-- The decision belongs to the client; VIFM assesses. What the standard requires
-- of us is that the participant is told what was decided and when, so these
-- columns record the client's decision as reported to us, and the moment the
-- participant was informed. decision_communicated_at is the clause; the rest is
-- what makes it meaningful.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS decision_outcome text,
  ADD COLUMN IF NOT EXISTS decision_made_at date,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS decision_communicated_at timestamptz;

COMMENT ON COLUMN candidates.decision_outcome IS
  'The decision the client made following the assessment, as reported to VIFM. Recorded so the participant can be told (BPS 5.9); VIFM does not make the decision.';
COMMENT ON COLUMN candidates.decision_communicated_at IS
  'When the participant was told the decision (BPS 5.9). Null means they have not been told.';
