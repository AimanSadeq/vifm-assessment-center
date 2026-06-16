-- ════════════════════════════════════════════════════════════════
-- 00111 - Cognitive inductive/deductive links: insert BY competency_id
--
-- Fixes a latent bug in 00109. That migration seeded the inductive + deductive
-- `construct_competency_links` predicts-rows by JOINing on competencies.name -
-- but the behavioural 38 were renamed to the current scheme (e.g. id ...004 is
-- now "Critical Analysis", not "Analytical Reasoning") AFTER 00066 was written,
-- so the name-join matched zero rows and no inductive/deductive links landed.
-- (00109's DELETE of the old "abstract" rows did run, so the bank is simply
-- missing the two new subtests' links until this backfill.)
--
-- This migration is rename-proof: it inserts by the stable competency UUIDs,
-- aligned with src/lib/psychometrics/framework.ts COGNITIVE_SUBTESTS:
--   inductive -> Creative Problem-Solving (..006), Navigating Complexity (..007)
--   deductive -> Critical Analysis (..004),        Sound Judgement (..005)
--
-- Idempotent (ON CONFLICT DO NOTHING on the table's unique key); additive;
-- runs identically on the live DB (backfill) and a fresh install (the 00109
-- name-join is a harmless no-op there too). Depends on 00064 + 00002.
-- ════════════════════════════════════════════════════════════════

INSERT INTO construct_competency_links
  (source_kind, source_key, competency_id, relation, layer, weight, validated, rationale)
SELECT 'cognitive', v.source_key, c.id, 'predicts', 'foundations', v.weight, false, v.rationale
FROM (VALUES
  -- inductive = infer the rule from patterns (fluid intelligence)
  ('inductive', 'a0000001-0000-0000-0000-000000000006'::uuid, 2, 'Inferring rules from patterns predicts novel, inventive problem-solving.'),
  ('inductive', 'a0000001-0000-0000-0000-000000000007'::uuid, 2, 'Inductive (fluid) reasoning predicts handling of complex, ambiguous problems.'),
  -- deductive = apply rules/premises to a valid conclusion (logical validity)
  ('deductive', 'a0000001-0000-0000-0000-000000000004'::uuid, 2, 'Deductive reasoning predicts rigorous, logically sound analysis.'),
  ('deductive', 'a0000001-0000-0000-0000-000000000005'::uuid, 2, 'Reasoning to valid conclusions predicts sound, defensible decisions.')
) AS v(source_key, competency_id, weight, rationale)
JOIN competencies c ON c.id = v.competency_id
ON CONFLICT (source_kind, source_key, competency_id) DO NOTHING;
