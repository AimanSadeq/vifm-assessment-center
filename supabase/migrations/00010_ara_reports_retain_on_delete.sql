-- ============================================================
-- VIFM ARA - retention purge fix
-- Migration 00010: Make ara_reports.assessment_id nullable and
-- switch the foreign key from ON DELETE CASCADE to ON DELETE SET NULL.
--
-- Background: handover §15.3 says generated reports must be retained
-- indefinitely as VIFM business records, even after the underlying
-- assessment is purged at 3-year retention. The original schema had
-- assessment_id NOT NULL + ON DELETE CASCADE, which means reports were
-- deleted together with their assessment - the opposite of the spec -
-- and the retention-purge code that tries to detach reports by setting
-- assessment_id = null would fail at runtime on the NOT NULL constraint.
-- ============================================================

-- Drop the existing foreign key (name assigned automatically by Postgres)
ALTER TABLE ara_reports
  DROP CONSTRAINT ara_reports_assessment_id_fkey;

-- Relax the NOT NULL so a purged assessment can leave the report orphaned
ALTER TABLE ara_reports
  ALTER COLUMN assessment_id DROP NOT NULL;

-- Re-add the FK with SET NULL behaviour
ALTER TABLE ara_reports
  ADD CONSTRAINT ara_reports_assessment_id_fkey
  FOREIGN KEY (assessment_id)
  REFERENCES ara_assessments(id)
  ON DELETE SET NULL;
