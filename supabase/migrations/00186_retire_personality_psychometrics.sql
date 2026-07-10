-- Retire the Big-Five / OCEAN personality psychometrics instrument.
--
-- The behavioural self-report instrument is Persona (the 41-competency
-- self-assessment); the personality (Mini-IPIP / IPIP-50) construct was removed
-- from the app. This migration purges the orphaned personality rows so the
-- cognitive-only code path never encounters a personality instrument/scale/item
-- or a personality result that would now mis-render as cognitive.
--
-- Idempotent + defensive: DELETEs simply match nothing on a fresh DB that never
-- held personality data. construct_competency_links personality rows were
-- already removed in 00095; the DELETE here is a no-op safety net.

-- 1) Per-item response log + results for any personality sittings (indicative
--    test data only; no credential was ever issued from personality).
delete from psy_item_responses
  where result_id in (select id from psy_results where kind = 'personality');
delete from psy_results where kind = 'personality';

-- 2) The bank itself: items → scales → instrument (child-first; also covers
--    envs where the FKs are not ON DELETE CASCADE).
delete from psy_items
  where scale_id in (
    select s.id from psy_scales s
    join psy_instruments i on i.id = s.instrument_id
    where i.kind = 'personality'
  );
delete from psy_scales
  where instrument_id in (select id from psy_instruments where kind = 'personality');
delete from psy_instruments where kind = 'personality';

-- 3) Norm group + foundations bridge links for personality (bridge links are
--    already gone via 00095; this is a safety net).
delete from psy_norms where kind = 'personality';
delete from construct_competency_links where source_kind = 'personality';
