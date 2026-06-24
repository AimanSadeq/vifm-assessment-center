-- ════════════════════════════════════════════════════════════════
-- 00163 - Pre-Hire: close the client column-leak + explicit demo flag
--
-- Two audit follow-ups from the Pre-Hire deep review (Batch 1.5):
--
-- A. D-5 / D-6 / D-7 - genuine column-level fix.
--    Migration 00162 tried to hide sensitive columns (voluntary
--    demographics, decision_reason, report_sent_to, the stage `detail`
--    JSONB with transcripts + quiz answer keys) from the 'client' role
--    by recreating row-level SELECT policies. But PostgreSQL RLS is
--    ROW-level only - a USING clause gates which rows are visible, not
--    which columns. Every authenticated user connects as the single
--    Postgres role `authenticated`; a 'client' session can therefore
--    still issue `SELECT <any column> FROM prehire_candidates` via
--    PostgREST and receive demographics for every row that passes the
--    row filter. 00162's own comments concede this ("RLS does not
--    support column-level policy directly ... the app layer must never
--    SELECT detail for client-role sessions").
--
--    A codebase sweep confirmed the real access path: NOTHING reads
--    prehire_requisitions / prehire_candidates / prehire_stage_results
--    through an RLS-enforced (cookie/anon) client. Every read - admin
--    pages, the client portal seat service, and the token candidate
--    routes - goes through createServiceClient() (service-role, which
--    bypasses RLS) plus app-layer organization checks. The three
--    `*_client_select` policies are therefore pure latent attack
--    surface: never used by the app, but exploitable directly against
--    PostgREST with a client JWT. We drop them. Fail-closed: a future
--    authenticated-client read would get zero rows, not a leak. The
--    client portal must continue to read via service-role + the
--    existing org-scoped app checks.
--
--    This also resolves D-1 (client_manager had no policy on these
--    tables): the consistent, intended model is that NEITHER client
--    nor client_manager reads these three tables directly - the portal
--    reads them via service-role. (The prehire_audit_log client +
--    client_manager SELECT policies are deliberately kept: that table
--    is PII-scrubbed by design and is the client-readable trail.)
--
-- B. I-8 - explicit demo flag.
--    The candidate self-view gate (results + report on-screen) keyed on
--    a brittle title string match (title = 'Demo Screening (self-serve)').
--    A real screening that happened to carry that title would leak the
--    candidate their own result - and the guardrail is "results go to
--    the hiring team, not the candidate". Replace the title match with
--    an explicit boolean column the demo seeder owns. Backfill the
--    existing demo requisition(s) by title so nothing breaks.
-- ════════════════════════════════════════════════════════════════

-- A. Drop the unused, leak-prone client SELECT policies ------------
DO $$ BEGIN
  DROP POLICY IF EXISTS prehire_req_client_select   ON prehire_requisitions;
  DROP POLICY IF EXISTS prehire_cand_client_select  ON prehire_candidates;
  DROP POLICY IF EXISTS prehire_stage_client_select ON prehire_stage_results;
  -- legacy FOR ALL variants, if any survived from an earlier revision
  DROP POLICY IF EXISTS prehire_req_client_all   ON prehire_requisitions;
  DROP POLICY IF EXISTS prehire_cand_client_all  ON prehire_candidates;
  DROP POLICY IF EXISTS prehire_stage_client_all ON prehire_stage_results;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- RLS stays ENABLED on all three (the admin FOR ALL policies from
-- 00050 remain). With no client policy, a 'client'/'client_manager'
-- JWT now reads zero rows directly - the portal reads via service-role.

-- B. Explicit demo flag on requisitions ----------------------------
ALTER TABLE prehire_requisitions
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN prehire_requisitions.is_demo IS
  'When true, candidates under this requisition may view their own results + '
  'report on-screen (the self-serve demo). Real screenings keep is_demo=false '
  'so results are delivered to the hiring team only. Set by startPrehireDemoAction.';

-- Backfill the existing self-serve demo requisition(s) by title so the
-- new flag-based gate keeps working for demos created before this column.
UPDATE prehire_requisitions
  SET is_demo = true
  WHERE title = 'Demo Screening (self-serve)'
    AND is_demo IS DISTINCT FROM true;
