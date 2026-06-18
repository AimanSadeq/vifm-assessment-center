-- ============================================================
-- 00134 - ARC talent lens (acquisition vs development)
-- ============================================================
-- ARC needs to know whether a run is "Talent Acquisition" (hiring)
-- or "Talent Development" so the personal report can frame itself
-- correctly. The signal is captured PURELY from the launching pillar
-- via a ?lens= query param on /ara (accepted tradeoff: the lens is
-- lost on a deep link, so it defaults to NULL = generic framing).
--
-- The persisted lens drives four report changes (R4-R7):
--   R4 - report header shows the lens ("Talent Acquisition" /
--        "Talent Development")
--   R5 - "Develop with VIFM" course recommendations render only
--        under development (or NULL); suppressed for acquisition
--   R6 - purpose-aware per-factor narrative: development shows
--        coaching ("where to focus next"); acquisition shows a
--        descriptive read of the candidate at their measured level
--   R7 - the "Maps to VIFM AC" competency lines render only under
--        development (or NULL) - development-context info, not
--        hiring-context info
--
-- NULL is the legacy / anonymous default and must reproduce today's
-- output exactly (no regression).
--
-- Tolerant: ADD COLUMN IF NOT EXISTS. Column-level CHECK admits the
-- two known values OR NULL, so a NULL (default) row always passes.
-- ============================================================

ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS talent_lens text;

-- A column-level CHECK that permits NULL plus the two known values.
-- Wrapped in a guard so re-running the migration doesn't fail on the
-- already-present constraint (CHECK has no IF NOT EXISTS in Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ara_assessments_talent_lens_check'
  ) THEN
    ALTER TABLE ara_assessments
      ADD CONSTRAINT ara_assessments_talent_lens_check
      CHECK (talent_lens IS NULL OR talent_lens IN ('acquisition', 'development'));
  END IF;
END $$;

COMMENT ON COLUMN ara_assessments.talent_lens IS
  'Optional talent lens for the personal report: ''acquisition'' (hiring) or ''development'' (growing). Captured from the launching pillar via /ara?lens=. NULL = generic framing (legacy / anonymous / deep-linked). Drives R4-R7 on the personal snapshot results page + PDFs.';
