-- ============================================================
-- VIFM Fluent depth — proctoring integrity flags + results-email audit
--
-- Adds two columns to eng_fluent_results:
--   integrity_flags : lightweight client-side proctoring signals captured
--                     during the test (tab/window blur count, paste events
--                     in the writing box). Advisory only — surfaced to
--                     admins on the cohort report, never used to auto-fail.
--   email_sent_at   : set when the taker's results email (link + CEFR level
--                     + certificate) was dispatched, so the cohort report
--                     can show who was emailed.
--
-- Both are written best-effort by the scoring route AFTER the core insert,
-- so a database still on migration 00042 keeps persisting results — these
-- columns simply stay at their defaults until this migration is applied.
-- ============================================================

ALTER TABLE eng_fluent_results
  ADD COLUMN IF NOT EXISTS integrity_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_sent_at   timestamptz;
