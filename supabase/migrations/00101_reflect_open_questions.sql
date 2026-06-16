-- ============================================================
-- 00101 - Reflect 360: five open-ended questions
--
-- Adds the five qualitative questions (strengths, development, a leadership/
-- collaboration example, one piece of advice, anything else) as nullable text
-- columns on reflect_raters, alongside the existing Start/Stop/Continue
-- (00036). The rater answers them on the same form; the participant report
-- renders them grouped by rater_role under the same anonymity_min_n threshold
-- as the numeric scores and the SSC verbatims.
--
-- Non-breaking + idempotent: existing raters keep NULL; nothing renders until
-- a rater fills one. Length is enforced at the app layer (Zod max 2000).
-- ============================================================

ALTER TABLE reflect_raters
  ADD COLUMN IF NOT EXISTS open_strengths   text,
  ADD COLUMN IF NOT EXISTS open_development text,
  ADD COLUMN IF NOT EXISTS open_example     text,
  ADD COLUMN IF NOT EXISTS open_advice      text,
  ADD COLUMN IF NOT EXISTS open_other       text;

COMMENT ON COLUMN reflect_raters.open_strengths   IS 'Q1 - most significant strengths (with examples)';
COMMENT ON COLUMN reflect_raters.open_development IS 'Q2 - areas to develop or improve';
COMMENT ON COLUMN reflect_raters.open_example     IS 'Q3 - a situation of exceptional leadership or collaboration';
COMMENT ON COLUMN reflect_raters.open_advice      IS 'Q4 - one piece of advice to be more effective';
COMMENT ON COLUMN reflect_raters.open_other       IS 'Q5 - anything else not covered above';
