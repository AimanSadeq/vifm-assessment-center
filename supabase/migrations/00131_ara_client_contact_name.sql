-- ════════════════════════════════════════════════════════════════
-- ARC client contact name (client-level)
--
-- The named client contact who receives collected delegate results when
-- the org's send-to-client delivery is used. Complements the
-- client_contact_email + send_results_to_client columns from migration
-- 00108. Used to personalise the salutation on the results-to-client
-- email and labelled in the org edit form.
--
-- Idempotent / re-runnable.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE ara_organizations
  ADD COLUMN IF NOT EXISTS client_contact_name text;
