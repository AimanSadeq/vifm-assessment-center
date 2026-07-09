-- ════════════════════════════════════════════════════════════════
-- VIFM Psychometrics - Logica cognitive bank: blueprint + review controls
--
-- Moves Logica from live-AI-per-sitting to a fixed, SME-reviewed item bank
-- served against a per-subtest x per-facet blueprint. Additive only - every
-- statement is idempotent and tolerant of a fresh environment.
--
--   psy_items.facet          - the sub-scale grain the blueprint composes on
--                              (e.g. verbal -> verb_analogy / verb_comprehension / verb_vocab)
--   psy_items.rationale      - per-item SME justification (why the key is correct)
--   psy_items.ar_reviewed     - Arabic MSA has had a human pass (advisory quality flag)
--   psy_items.drafted_by/reviewed_by/reviewed_at/rejected_reason
--                              - two-person review: the approver must differ from
--                                the drafter (enforced in the server action)
--   status += 'rejected'      - an SME can reject a draft (matches tech_assessment_items)
--   psy_sessions/results.served_source
--                              - 'bank' | 'ai' | 'static': server-truth for the
--                                "served from the reviewed bank" badge (never inferred)
--   psy_increment_administered(ids) - exposure-control counter the assembler's
--                                least-administered-first rotation depends on
-- ════════════════════════════════════════════════════════════════

-- ── psy_items: blueprint + review-workflow columns ──
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS facet          text;
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS rationale      text;
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS ar_reviewed    boolean NOT NULL DEFAULT false;
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS drafted_by     uuid;
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS reviewed_by    uuid;
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS reviewed_at    timestamptz;
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS rejected_reason text;

-- Widen the status CHECK to admit 'rejected' (the 00065 inline check is auto-named
-- psy_items_status_check). Drop + recreate, guarded so a re-run is a no-op.
ALTER TABLE psy_items DROP CONSTRAINT IF EXISTS psy_items_status_check;
ALTER TABLE psy_items ADD CONSTRAINT psy_items_status_check
  CHECK (status IN ('draft','in_review','approved','retired','rejected'));

-- Assembly reads approved items per (scale, facet, difficulty), least-administered
-- first - index the composite so the blueprint draw stays cheap as the bank grows.
CREATE INDEX IF NOT EXISTS psy_items_assembly_idx
  ON psy_items(scale_id, status, facet, difficulty, times_administered);

-- ── served_source provenance (server-truth, not inferred from ai_generated) ──
ALTER TABLE psy_sessions ADD COLUMN IF NOT EXISTS served_source text;
ALTER TABLE psy_results  ADD COLUMN IF NOT EXISTS served_source text;

-- ── exposure counter: bump times_administered for the served bank items ──
-- The assembler orders by times_administered ASC to rotate items across sittings;
-- without this write every sitting drew the same items (dead rotation). Called
-- best-effort from the runner START handler for bank-served administrations.
CREATE OR REPLACE FUNCTION psy_increment_administered(ids uuid[])
RETURNS void
LANGUAGE sql
AS $$
  UPDATE psy_items
     SET times_administered = times_administered + 1
   WHERE id = ANY(ids);
$$;
