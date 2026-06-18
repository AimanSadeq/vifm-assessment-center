-- ════════════════════════════════════════════════════════════════
-- 00128 - add the missing FK on persona_competency_norms.competency_id
--
-- 00127 created competency_id as a bare uuid, but every sibling table that
-- stores a competency references competencies(id) ON DELETE CASCADE
-- (role_profile_competencies, behavioral_assessment_responses, ...). Add it
-- here so a stale/typo'd competency_id can't be seeded and norm rows cascade
-- away with their competency. Idempotent: guarded so it is safe whether or not
-- 00127 was applied with the constraint, and applies cleanly to the live DB.
-- No backfill risk: norms are seeded only from real competency ids.
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_competency_norms_competency_id_fkey'
      AND conrelid = 'persona_competency_norms'::regclass
  ) THEN
    ALTER TABLE persona_competency_norms
      ADD CONSTRAINT persona_competency_norms_competency_id_fkey
      FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE;
  END IF;
END $$;
