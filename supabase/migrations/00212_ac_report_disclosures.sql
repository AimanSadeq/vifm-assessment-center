-- Assessment Center: giving a report to someone the participant did not agree to.
--
-- BPS standard:
--   8.13  the participant's express permission shall be sought before providing
--         reports to people other than those mentioned in gaining initial consent
--   5.3   the service provider shall only use the data for the agreed purpose
--   3.18  the client shall only use the data within the bounds of the consent
--         the participant gave
--
-- The joining pack names who receives reports and the participant agrees to
-- that list before attending (migration 00211, clause 5.13). This is what
-- happens when someone outside it asks: a request the participant answers,
-- recorded either way. Refused is as important as granted - it is the record
-- that shows the question was asked at all.

CREATE TABLE IF NOT EXISTS ac_report_disclosures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id     uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id      uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  recipient_name    text NOT NULL,
  recipient_role    text,
  -- Why they want it. The participant is being asked to decide, so they are
  -- owed the reason.
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'granted', 'refused', 'withdrawn')),
  participant_note  text,
  requested_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requested_by_name text,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  decided_at        timestamptz,
  -- Stamped when the report was actually handed over, which may be never.
  released_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_report_disclosures IS
  'Express permission to give a candidate report to someone outside the recipients named in the joining pack (BPS 8.13). A refusal is kept: it evidences that the participant was asked.';

CREATE INDEX IF NOT EXISTS idx_ac_disclosures_engagement ON ac_report_disclosures(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ac_disclosures_candidate ON ac_report_disclosures(candidate_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_disclosures_pending ON ac_report_disclosures(status) WHERE status = 'pending';

DROP TRIGGER IF EXISTS ac_report_disclosures_updated_at ON ac_report_disclosures;
CREATE TRIGGER ac_report_disclosures_updated_at
  BEFORE UPDATE ON ac_report_disclosures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ac_report_disclosures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_disclosures_admin ON ac_report_disclosures;
CREATE POLICY ac_disclosures_admin ON ac_report_disclosures
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS ac_disclosures_candidate_select ON ac_report_disclosures;
CREATE POLICY ac_disclosures_candidate_select ON ac_report_disclosures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_report_disclosures.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

-- The participant answers their own request, and answers nothing else: the
-- trigger below keeps them to the status and their own note.
DROP POLICY IF EXISTS ac_disclosures_candidate_update ON ac_report_disclosures;
CREATE POLICY ac_disclosures_candidate_update ON ac_report_disclosures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_report_disclosures.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

-- Who asked, for what and why cannot be edited after the fact, and a decision
-- cannot be quietly reversed into a fresh request. Withdrawing permission
-- already granted is allowed, because a participant may change their mind.
CREATE OR REPLACE FUNCTION ac_disclosures_protect() RETURNS trigger AS $$
BEGIN
  IF NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
     OR NEW.recipient_role IS DISTINCT FROM OLD.recipient_role
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
     OR NEW.engagement_id IS DISTINCT FROM OLD.engagement_id
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
    RAISE EXCEPTION 'What was asked for, by whom and when cannot be changed; raise a new request';
  END IF;
  IF OLD.status <> 'pending' AND NEW.status = 'pending' THEN
    RAISE EXCEPTION 'A decided request cannot be returned to pending; raise a new request';
  END IF;
  IF OLD.status = 'refused' AND NEW.status = 'granted' THEN
    RAISE EXCEPTION 'A refusal cannot be overwritten with a grant; ask again in a new request';
  END IF;
  IF OLD.released_at IS NOT NULL AND NEW.released_at IS DISTINCT FROM OLD.released_at THEN
    RAISE EXCEPTION 'A report that has been handed over cannot be un-handed-over';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ac_disclosures_protect_trg ON ac_report_disclosures;
CREATE TRIGGER ac_disclosures_protect_trg
  BEFORE UPDATE ON ac_report_disclosures
  FOR EACH ROW EXECUTE FUNCTION ac_disclosures_protect();
