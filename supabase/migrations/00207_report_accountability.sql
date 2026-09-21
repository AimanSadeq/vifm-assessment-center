-- Assessment Center: what a report must say, and who checked it.
--
-- BPS standard:
--   8.12  every report shall explain how the information may be used, its
--         limitations and its technical qualities
--   8.9   every report shall explain the risks of deciding on the data
--   8.2   the report should state that decisions are the Client's
--   8.20  written feedback shall carry a contact for questions
--   5.49  participants shall be told how to challenge a result
--   8.10  computer-generated reports shall be checked for accuracy before they
--         are made available, and 8.6 requires the report to be accurate
--
-- Most of that is report copy. Two things are not: the report needs a named
-- contact to print, and "it was checked" needs a record of who checked it and
-- when, otherwise the claim is unverifiable.

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS participant_contact_name text,
  ADD COLUMN IF NOT EXISTS participant_contact_email text,
  ADD COLUMN IF NOT EXISTS appeals_note text;

COMMENT ON COLUMN engagements.participant_contact_name IS
  'The person a participant contacts with questions about their assessment or report (BPS 5.43, 8.20). Printed on the report.';
COMMENT ON COLUMN engagements.appeals_note IS
  'How a participant may query or challenge a result on this engagement (BPS 5.49). Printed on the report; falls back to standard wording pointing at the named contact.';

ALTER TABLE candidate_reports
  ADD COLUMN IF NOT EXISTS checked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_by_name text,
  ADD COLUMN IF NOT EXISTS checked_at timestamptz;

COMMENT ON COLUMN candidate_reports.checked_at IS
  'When a person checked this computer-generated report for accuracy before release (BPS 8.10). Set by the release action; null on reports released before the check existed.';
