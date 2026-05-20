-- ============================================================
-- VIFM Reflect 360 - P1 parity pass
-- Migration 00037: Self + Manager critical-competency picks
--
-- Adds a uuid[] column to reflect_raters that stores which
-- competencies the rater considers role-critical. Only the Self
-- and Manager raters fill this in — peer / direct_report / other
-- roles never see the picker. The report computes the alignment %
-- between Self's picks and the Manager's picks, which is the
-- single most-quoted coaching metric across competitor 360s.
--
-- Stored as uuid[] (not a separate join table) because:
--   1) at most one Self + one Manager rater per participant, so
--      the row count is small
--   2) the picks are written + read together (the form saves the
--      whole array, the scorer reads the whole array)
--   3) no need for per-pick metadata (e.g. "why this one")
--
-- Default is empty array so existing rows continue to work
-- unchanged; the picker simply renders nothing-picked-yet until
-- the rater chooses something.
-- ============================================================

ALTER TABLE reflect_raters
  ADD COLUMN IF NOT EXISTS critical_competency_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN reflect_raters.critical_competency_ids IS
  'Self + Manager only: competency_ids the rater considers most critical for this role. Empty array = not yet picked.';
