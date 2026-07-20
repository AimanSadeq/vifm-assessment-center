-- ════════════════════════════════════════════════════════════════
-- 00195 - Pre-Hire audit log: detach the requisition/candidate FKs
--
-- 00162 added DELETE + (00051) UPDATE guards so the audit trail can
-- never be rewritten or erased, and *intended* to flip the FKs from
-- ON DELETE CASCADE to SET NULL. Two problems, both observed live
-- (2026-07-20):
--   1. The 00162 rename matched constraints BY NAME (IF EXISTS on
--      'prehire_audit_log_candidate_id_fkey'); on DBs where the
--      auto-generated names differ it silently skipped, leaving
--      CASCADE - so deleting a candidate cascaded into the DELETE
--      guard and failed.
--   2. Even where SET NULL landed, it can never work: the FK-driven
--      nulling is an UPDATE, which the 00051 BEFORE UPDATE guard
--      blocks. Any candidate with audit rows is undeletable either
--      way - which also breaks the nightly retention purge for
--      Pre-Hire (deletes: prehire_candidates).
--
-- Fix: an append-only log should not hold enforced FKs to mutable
-- rows at all. Drop the requisition/candidate FK constraints and keep
-- the plain uuid columns - the trail keeps its pseudonymous ids
-- untouched (better for defensibility than nulling them), deletes of
-- candidates/requisitions no longer touch the log, and the retention
-- purge works. The UPDATE + DELETE guards stay: the log remains
-- immutable. detail already never contains PII (00051 design), so a
-- dangling uuid after a retention purge is pseudonymous, not personal.
-- Idempotent - safe on any DB regardless of which 00162 branch ran.
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.prehire_audit_log'::regclass
      AND c.contype = 'f'
      AND a.attname IN ('requisition_id', 'candidate_id')
  LOOP
    EXECUTE format('ALTER TABLE public.prehire_audit_log DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;
