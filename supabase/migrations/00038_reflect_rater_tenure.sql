-- ============================================================
-- VIFM Reflect 360 - P2 parity pass
-- Migration 00038: Rater tenure ("how long have you known this person")
--
-- Adds a small enum + nullable column to reflect_raters. Captured
-- on the welcome step of the rater form. Surfaces in the report
-- as: (a) median tenure on the Summary page so the participant
-- knows the depth behind the feedback, and (b) per-verbatim chip
-- so the consultant can read "STOP doing X — from a peer of 5+
-- years" with the right weight.
--
-- New raters who skip this question stay NULL; the report just
-- shows "tenure not provided" for that respondent.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reflect_rater_tenure') THEN
    CREATE TYPE reflect_rater_tenure AS ENUM (
      'less_than_6mo',   -- < 6 months
      'six_mo_to_2yr',   -- 6 months – 2 years
      'two_to_5yr',      -- 2 – 5 years
      'over_5yr'         -- > 5 years
    );
  END IF;
END
$$;

ALTER TABLE reflect_raters
  ADD COLUMN IF NOT EXISTS tenure reflect_rater_tenure;

COMMENT ON COLUMN reflect_raters.tenure IS
  'How long the rater has worked with the participant. Optional — NULL means not provided.';
