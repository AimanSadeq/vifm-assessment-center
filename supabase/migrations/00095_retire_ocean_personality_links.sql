-- ============================================================
-- 00095 - Retire the OCEAN Big-Five personality instrument
--
-- The psychometric portal's behavioural instrument is now Persona (the
-- 38-competency behavioural self-assessment), not the 5-trait OCEAN Big Five.
-- OCEAN is removed from every product surface in code; this migration cleans up
-- its only DATA footprint that would otherwise dangle: the personality
-- `predicts`/`foundations` rows in construct_competency_links (seeded by 00066).
--
-- Cognitive ability links are untouched. The shared psy_* tables stay (cognitive
-- still uses them). Any historical personality psy_results rows are left in place
-- (audit) but are no longer produced or surfaced. Idempotent.
-- ============================================================

DELETE FROM construct_competency_links WHERE source_kind = 'personality';
