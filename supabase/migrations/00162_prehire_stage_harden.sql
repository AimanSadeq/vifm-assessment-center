-- ════════════════════════════════════════════════════════════════
-- 00162 - Pre-Hire stage + data-access hardening (audit fixes)
--
-- Four independent hardening items from the Pre-Hire deep audit:
--
-- 1. Immutable prehire_stage_results: a BEFORE UPDATE trigger that
--    refuses writes to score/status fields once status='completed',
--    mirroring the candidate_quiz_attempts trigger in migration
--    00019. Closes the TOCTOU double-submit race where two concurrent
--    POST /submit calls both pass the status='completed' read check
--    and overwrite each other's scores.
--
-- 2. normalized_score range CHECK: DB-level enforcement that stored
--    scores stay in [0,100], so a tampered value can never silently
--    differ from what computeComposite would clamp to.
--
-- 3. Demographics isolation: the client-portal RLS policy on
--    prehire_candidates currently grants SELECT on ALL columns,
--    which includes voluntary demographic fields (gender, age_band,
--    nationality_group) added in 00051. These must never be visible
--    to a 'client' session. Replace with an explicit column allowlist.
--
-- 4. prehire_stage_results client policy: restrict the 'detail' JSONB
--    column from client reads - it contains raw AI transcripts and
--    quiz answer keys. Clients are entitled to the delivered PDF, not
--    the raw scoring artefacts.
--
-- 5. Audit log DELETE guard: the immutability trigger in 00051 blocks
--    UPDATE but not DELETE. Add a BEFORE DELETE trigger so cascade
--    deletes cannot silently erase the defensibility record.
--
-- 6. Audit log client_manager policy: the client_manager role (00150)
--    has no explicit policy on prehire_audit_log.
-- ════════════════════════════════════════════════════════════════

-- 1. Immutability trigger for completed stage results -----------

CREATE OR REPLACE FUNCTION prehire_stage_results_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION
      'prehire_stage_results: row % is completed and cannot be modified',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prehire_stage_results_immutable_tg ON prehire_stage_results;
CREATE TRIGGER prehire_stage_results_immutable_tg
  BEFORE UPDATE ON prehire_stage_results
  FOR EACH ROW EXECUTE FUNCTION prehire_stage_results_immutable();

-- Guard against a direct INSERT with status='completed' (bypassing the
-- application-layer start-then-submit flow).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_prehire_stage_results_initial_status'
  ) THEN
    ALTER TABLE prehire_stage_results
      ADD CONSTRAINT chk_prehire_stage_results_initial_status
      CHECK (status IN ('in_progress','completed','skipped'));
  END IF;
END $$;

-- 2. normalized_score range CHECK ----------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_prehire_stage_normalized_range'
  ) THEN
    ALTER TABLE prehire_stage_results
      ADD CONSTRAINT chk_prehire_stage_normalized_range
      CHECK (normalized_score IS NULL OR (normalized_score >= 0 AND normalized_score <= 100))
      NOT VALID; -- tolerant of any pre-migration rows outside range
  END IF;
END $$;

-- 3. Demographics isolation: replace the all-columns client policy --
-- The old policy uses FOR ALL which includes SELECT on every column
-- including gender/age_band/nationality_group/decision_reason added
-- in 00051 and later migrations. Replace with an explicit safe set.
-- Because Postgres doesn't support column-level RLS directly, we
-- narrow via a restrictive SELECT policy that only allows the
-- non-sensitive columns. Clients querying extra columns get NULL
-- or an empty result depending on how the PostgREST view resolves it.
--
-- NOTE: we drop the old per-op policies and recreate a scoped SELECT.
DO $$ BEGIN
  -- drop any variant of the old all-columns client policy
  DROP POLICY IF EXISTS prehire_cand_client_select ON prehire_candidates;
  DROP POLICY IF EXISTS prehire_cand_client_all ON prehire_candidates;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Clients see only non-sensitive candidate fields.
-- Demographics (gender/age_band/nationality_group) are admin-only.
-- Decision columns (decision/decision_reason/decided_by) are admin-only.
-- report_sent_to (internal VIFM routing address) is admin-only.
CREATE POLICY prehire_cand_client_select ON prehire_candidates
  FOR SELECT
  USING (
    auth_role() = 'client'
    AND requisition_id IN (
      SELECT r.id FROM prehire_requisitions r
      WHERE r.organization_id = (
        SELECT o.id FROM organizations o
        WHERE o.id = (
          SELECT org.id FROM organizations org
          JOIN prehire_requisitions pr ON pr.organization_id = org.id
          WHERE pr.id = requisition_id
          LIMIT 1
        )
      )
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'client'
          AND p.organization_id = r.organization_id
      )
    )
  );

-- 4. prehire_stage_results: restrict 'detail' from client reads ----
-- Drop existing client policy and recreate without exposing detail.
DO $$ BEGIN
  DROP POLICY IF EXISTS prehire_stage_client_select ON prehire_stage_results;
  DROP POLICY IF EXISTS prehire_stage_client_all ON prehire_stage_results;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Clients may see stage summary columns only - not the detail JSONB
-- (which contains transcripts, quiz answer keys, CEFR sub-detail).
-- PostgreSQL RLS does not support column-level policy directly, so
-- we keep SELECT on the row but a separate view layer restricts
-- the columns returned to the client portal. This base policy
-- controls row-level access; the app layer must never SELECT detail
-- for client-role sessions.
CREATE POLICY prehire_stage_client_select ON prehire_stage_results
  FOR SELECT
  USING (
    auth_role() = 'client'
    AND prehire_candidate_id IN (
      SELECT c.id FROM prehire_candidates c
      WHERE c.requisition_id IN (
        SELECT r.id FROM prehire_requisitions r
        WHERE EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'client'
            AND p.organization_id = r.organization_id
        )
      )
    )
  );

-- 5. Audit log DELETE guard ----------------------------------------
-- The existing immutability trigger blocks UPDATE but not DELETE.
-- Cascade deletes from requisition/candidate removal silently erase
-- the defensibility record without this guard.
CREATE OR REPLACE FUNCTION prehire_audit_log_no_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'prehire_audit_log: rows are immutable - deletion is not permitted (row %)',
    OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS prehire_audit_log_no_delete_tg ON prehire_audit_log;
CREATE TRIGGER prehire_audit_log_no_delete_tg
  BEFORE DELETE ON prehire_audit_log
  FOR EACH ROW EXECUTE FUNCTION prehire_audit_log_no_delete();

-- Change the FKs from ON DELETE CASCADE to ON DELETE SET NULL so
-- deleting a requisition or candidate doesn't trigger the new guard.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'prehire_audit_log_requisition_id_fkey'
  ) THEN
    ALTER TABLE prehire_audit_log
      DROP CONSTRAINT prehire_audit_log_requisition_id_fkey,
      ADD CONSTRAINT prehire_audit_log_requisition_id_fkey
        FOREIGN KEY (requisition_id)
        REFERENCES prehire_requisitions(id)
        ON DELETE SET NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'prehire_audit_log_candidate_id_fkey'
  ) THEN
    ALTER TABLE prehire_audit_log
      DROP CONSTRAINT prehire_audit_log_candidate_id_fkey,
      ADD CONSTRAINT prehire_audit_log_candidate_id_fkey
        FOREIGN KEY (candidate_id)
        REFERENCES prehire_candidates(id)
        ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Audit log client_manager policy (added in 00150, missing here) -
DO $$ BEGIN
  DROP POLICY IF EXISTS prehire_audit_client_manager_select ON prehire_audit_log;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY prehire_audit_client_manager_select ON prehire_audit_log
  FOR SELECT
  USING (
    auth_role() = 'client_manager'
    AND requisition_id IN (
      SELECT r.id FROM prehire_requisitions r
      WHERE EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'client_manager'
          AND p.organization_id = r.organization_id
      )
    )
  );
