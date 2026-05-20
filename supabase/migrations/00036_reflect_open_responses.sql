-- ============================================================
-- VIFM Reflect 360 - P0 parity pass
-- Migration 00036: Start / Stop / Continue open-ended questions
--
-- Adds three nullable text columns to reflect_raters to capture
-- the qualitative companion to the numeric ratings. Each rater
-- answers all three on the same form, after the per-behaviour
-- ratings. The participant report renders verbatims grouped by
-- rater_role, applying the engagement's anonymity_min_n threshold
-- the same way the numeric scores do.
--
-- Non-breaking: existing raters keep NULL values; nothing renders
-- until at least one rater fills any of the three.
-- ============================================================

ALTER TABLE reflect_raters
  ADD COLUMN IF NOT EXISTS open_start    text,
  ADD COLUMN IF NOT EXISTS open_stop     text,
  ADD COLUMN IF NOT EXISTS open_continue text;

-- Soft cap aligned with the comment_text field on reflect_responses (2000 chars).
ALTER TABLE reflect_raters
  ADD CONSTRAINT reflect_raters_open_start_length    CHECK (open_start    IS NULL OR char_length(open_start)    <= 2000),
  ADD CONSTRAINT reflect_raters_open_stop_length     CHECK (open_stop     IS NULL OR char_length(open_stop)     <= 2000),
  ADD CONSTRAINT reflect_raters_open_continue_length CHECK (open_continue IS NULL OR char_length(open_continue) <= 2000);

COMMENT ON COLUMN reflect_raters.open_start    IS 'What should this person START doing to be more effective? (Free-text, ≤2000 chars)';
COMMENT ON COLUMN reflect_raters.open_stop     IS 'What should this person STOP doing to be more effective? (Free-text, ≤2000 chars)';
COMMENT ON COLUMN reflect_raters.open_continue IS 'What should this person CONTINUE doing? (Free-text, ≤2000 chars)';
