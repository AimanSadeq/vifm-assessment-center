-- ARC custom scope (client request 2026-08-12): alongside the standard tiers
-- (department=4 pillars, division=6, enterprise=8, full question sets), a
-- consultant can now CUSTOMIZE an assessment: any pillar combination plus a
-- per-pillar question budget (e.g. HR department, all 8 pillars, 6 questions
-- per pillar = a 48-item form).
--
-- Which pillars: already stored in ara_assessments.pillars_in_scope (00029) -
-- the create action's exactly-4/exactly-6 cardinality rule is relaxed in app
-- code when the wizard's custom-scope toggle is on. This migration adds only
-- the question budget:
--
--   questions_per_pillar - cap each in-scope pillar's Layer-1 questions to N,
--   keeping the bank's curated order (objective items first, then ratings, by
--   question_number) so every respondent gets the same reduced form.
--   NULL = standard full form (the SOP, unchanged). Mirrors the individual
--   layer's items_per_factor lever (00143).

alter table ara_assessments
  add column if not exists questions_per_pillar integer
  check (questions_per_pillar is null or (questions_per_pillar between 1 and 20));

comment on column ara_assessments.questions_per_pillar is
  'Custom-scope question budget: cap each in-scope pillar to N Layer-1 questions (curated order). NULL = full standard form.';
