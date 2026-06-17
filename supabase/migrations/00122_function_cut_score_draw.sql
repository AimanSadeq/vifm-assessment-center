-- ════════════════════════════════════════════════════════════════
-- 00122 - Per-sitting DRAW count on a function's passing standard
--
-- Exposure control for the certified MCQ knowledge bank. The assembler
-- (buildCertifiedFunctionTest) already draws a RANDOM subset per skill
-- per sitting (shuffle + slice). It just had no tunable draw size and no
-- reason to build a surplus, so when the approved pool equalled the draw,
-- every candidate saw the identical form.
--
-- draw_per_skill = how many approved items per skill are SERVED in one
-- sitting. For real exposure control the approved POOL per skill should
-- exceed this draw (e.g. pool 10, draw 4 -> 210 distinct combinations).
-- Distinct from min_items_per_skill, which is the FLOOR required to
-- certify at all.
--
-- NULL = fall back to the code default (DEFAULT_DRAW_PER_SKILL = 4), so
-- existing rows are unaffected. Idempotent (ADD COLUMN IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_function_cut_scores
  ADD COLUMN IF NOT EXISTS draw_per_skill smallint
    CHECK (draw_per_skill IS NULL OR draw_per_skill BETWEEN 1 AND 20);
