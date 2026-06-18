-- ============================================================
-- 00135 - Technical sitting: assessment title + talent lens
-- ============================================================
-- TECH-1: a custom (pick-and-choose) technical sitting can now be
-- NAMED so it is trackable later (e.g. "SDAIA Treasury screen - Q3").
-- The title is captured in the custom builder's design step, before
-- any delegate is assigned, and copied onto every delegate's session.
--
-- TECH-5: the technical report is purpose-aware via a talent lens,
-- captured from the launching pillar (/admin/tech-sandbox?lens=...):
--   - 'acquisition' (hiring)  -> descriptive read, NO course block
--   - 'development' (growing) -> the report adds a "Develop with VIFM"
--      VIFM Academy course block driven by the weak technical areas
--   - NULL (legacy / direct)  -> behaves like development (the report
--      has always been a development read), so no regression
--
-- Tolerant: ADD COLUMN IF NOT EXISTS. Column-level CHECK admits the
-- two known lens values OR NULL, so a NULL (default) row always passes.
-- ============================================================

ALTER TABLE technical_sandbox_sessions
  ADD COLUMN IF NOT EXISTS assessment_title text;

ALTER TABLE technical_sandbox_sessions
  ADD COLUMN IF NOT EXISTS talent_lens text;

-- Column-level CHECK that permits NULL plus the two known values.
-- Wrapped in a guard so re-running the migration doesn't fail on the
-- already-present constraint (CHECK has no IF NOT EXISTS in Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'technical_sandbox_sessions_talent_lens_check'
  ) THEN
    ALTER TABLE technical_sandbox_sessions
      ADD CONSTRAINT technical_sandbox_sessions_talent_lens_check
      CHECK (talent_lens IS NULL OR talent_lens IN ('acquisition', 'development'));
  END IF;
END $$;

COMMENT ON COLUMN technical_sandbox_sessions.assessment_title IS
  'Optional admin-facing name for a custom technical sitting, captured in the builder design step before delegates are assigned (TECH-1). Copied onto every delegate session in a batch.';
COMMENT ON COLUMN technical_sandbox_sessions.talent_lens IS
  'Optional talent lens for the technical report: ''acquisition'' (hiring) or ''development'' (growing). Captured from the launching pillar via /admin/tech-sandbox?lens=. NULL = development framing (legacy / direct). Drives the VIFM Academy course block on the report (TECH-5).';
