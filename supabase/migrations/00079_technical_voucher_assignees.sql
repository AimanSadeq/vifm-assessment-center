-- ════════════════════════════════════════════════════════════════
-- Technical sandbox vouchers — optional per-delegate assignment.
--
-- Lets an admin generate a NAMED code per employee (from a pasted/CSV list or
-- manual entry) so codes can be sent personally and tracked by person. Anonymous
-- batch generation (no assignee) is unchanged.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_sandbox_vouchers
  ADD COLUMN IF NOT EXISTS assigned_name  text,
  ADD COLUMN IF NOT EXISTS assigned_email text;

CREATE INDEX IF NOT EXISTS idx_tech_vouchers_assigned_email
  ON technical_sandbox_vouchers(assigned_email);
