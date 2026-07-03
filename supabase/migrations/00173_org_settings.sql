-- 00173: org-level portal settings (integrity pass).
--
-- One jsonb settings bag on organizations, written only via service-role server
-- actions (admin, or a client_manager scoped to their own org by the action).
-- First key in use:
--   fluent_proctoring_required (boolean) - when true, EVERY Fluent voucher
--   sitting for this client runs with camera proctoring, regardless of the
--   per-voucher proctor_enabled flag. Lets a client organization mandate (or
--   leave off) monitoring to match its own legal/ethical requirements.
--
-- No RLS change: organizations' existing policies stay as-is; the jsonb is
-- read server-side (service role) by the Fluent take page and the client portal.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN organizations.settings IS
  'Org-level portal settings, e.g. {"fluent_proctoring_required": true}. Service-role writes only (portal/admin server actions).';
