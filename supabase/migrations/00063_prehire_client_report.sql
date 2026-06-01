-- ════════════════════════════════════════════════════════════════
-- VIFM Pre-Hire — deliver the report to the client (replaces the handoff tracker)
--
-- VIFM runs the screening as a service: the client provides the candidate
-- (name / email / phone / employee ID), VIFM invites them, they take the tests,
-- and VIFM DELIVERS THE REPORT to the client — who makes the hiring decision.
-- There is no VIFM-side "handoff" workflow to track (that was the wrong model),
-- so the 00062 handoff_* columns are dropped. Instead:
--
--   prehire_requisitions.client_recipient_email : where this req's reports go
--   prehire_candidates.report_sent_at / report_sent_to : delivery record
--
-- Additive otherwise; safe because the handoff columns were just added (empty).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prehire_candidates
  DROP COLUMN IF EXISTS handoff_status,
  DROP COLUMN IF EXISTS handoff_note,
  DROP COLUMN IF EXISTS handoff_by,
  DROP COLUMN IF EXISTS handoff_at,
  ADD COLUMN IF NOT EXISTS report_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_sent_to text;

ALTER TABLE prehire_requisitions
  ADD COLUMN IF NOT EXISTS client_recipient_email text;

COMMENT ON COLUMN prehire_requisitions.client_recipient_email IS
  'Client contact who receives the per-candidate screening reports for this requisition.';
COMMENT ON COLUMN prehire_candidates.report_sent_at IS
  'When the screening report was last emailed to the client (null = not sent).';
