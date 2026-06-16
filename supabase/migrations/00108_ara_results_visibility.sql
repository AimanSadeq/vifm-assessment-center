-- ════════════════════════════════════════════════════════════════
-- ARC results visibility + direct-to-client delivery (client-level)
--
-- A client may not want delegates to see their own results, and may want
-- the results sent to the client contact instead. These preferences live on
-- the client org (ara_organizations) - "the setup of the client" - and gate
-- the three places a delegate sees results (the personal results page, the
-- personal PDF, and the auto results email).
--
-- Anonymous Mode A snapshots have no org, so they keep the permissive default
-- (the delegate always sees their own free snapshot).
--
-- Idempotent / re-runnable.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE ara_organizations
  -- Default true preserves today's behaviour: delegates see their results.
  ADD COLUMN IF NOT EXISTS respondent_can_view_results boolean NOT NULL DEFAULT true,
  -- Where to send results when send_results_to_client is on.
  ADD COLUMN IF NOT EXISTS client_contact_email text,
  -- Consultant-controlled opt-in: email the delegate's results PDF to the
  -- client contact on completion. Off by default (no auto-send to clients).
  ADD COLUMN IF NOT EXISTS send_results_to_client boolean NOT NULL DEFAULT false;
