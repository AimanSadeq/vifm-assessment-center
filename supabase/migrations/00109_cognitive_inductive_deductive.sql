-- ════════════════════════════════════════════════════════════════
-- Cognitive subtests: split "abstract" → "inductive" + "deductive"
--
-- The cognitive instrument now measures four subtests (numerical, verbal,
-- inductive, deductive) instead of three (numerical, verbal, abstract). The
-- code framework (src/lib/psychometrics/framework.ts) is already updated; the
-- Tier-1 runner generates from code, so the live test does not depend on this
-- migration. This migration reconciles the DB-side artefacts that referenced the
-- retired "abstract" scale_key:
--
--   1. construct_competency_links — the Foundations→competency `predicts` rows
--      seeded in 00066. We retire the two "abstract" rows and seed inductive +
--      deductive rows in their place (inductive ≈ fluid pattern reasoning;
--      deductive ≈ logical validity → analysis/decisions).
--   2. psy_scales / psy_items — any SME-bank rows keyed "abstract" (cognitive)
--      are remapped to "inductive" (the nearest construct). The cognitive bank
--      is normally empty at Tier 1, so this is a no-op on a fresh DB.
--   3. psy_norms — any "abstract" cognitive norm row is removed (a single
--      abstract norm cannot be split across two new scales; norms re-accumulate
--      from pilot data per the Tier-2 path).
--
-- Idempotent + tolerant: guarded by table existence, re-runnable, additive.
-- Depends on 00064 (construct_competency_links) + 00066 (psy links) + 00002.
-- ════════════════════════════════════════════════════════════════

-- 1. construct_competency_links — retire abstract, seed inductive + deductive.
DELETE FROM construct_competency_links
 WHERE source_kind = 'cognitive' AND source_key = 'abstract';

INSERT INTO construct_competency_links
  (source_kind, source_key, competency_id, relation, layer, weight, validated, rationale)
SELECT 'cognitive', v.source_key, c.id, 'predicts', 'foundations', v.weight, false, v.rationale
FROM (VALUES
  -- inductive = infer the rule from patterns (fluid intelligence)
  ('inductive', 'Manages Complexity',    2, 'Inductive (fluid) reasoning predicts handling of complex, ambiguous problems.'),
  ('inductive', 'Cultivates Innovation', 2, 'Inferring rules from patterns predicts novel, inventive problem-solving.'),
  -- deductive = apply rules/premises to a valid conclusion (logical validity)
  ('deductive', 'Analytical Reasoning',  2, 'Deductive reasoning predicts rigorous, logically sound analysis.'),
  ('deductive', 'Decision Quality',      2, 'Reasoning to valid conclusions predicts sound, defensible decisions.')
) AS v(source_key, competency_name, weight, rationale)
JOIN competencies c ON c.name = v.competency_name
ON CONFLICT (source_kind, source_key, competency_id) DO NOTHING;

-- 2. psy_scales / psy_items — remap any "abstract" cognitive bank rows to
--    "inductive". No-op on a fresh DB (the cognitive bank is empty at Tier 1).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'psy_items' AND column_name = 'scale_key') THEN
    UPDATE psy_items SET scale_key = 'inductive'
     WHERE scale_key = 'abstract';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'psy_scales' AND column_name = 'scale_key') THEN
    -- Only rename if an "inductive" scale row does not already exist for the
    -- same instrument (avoids a UNIQUE collision); otherwise drop the orphan.
    UPDATE psy_scales sc SET scale_key = 'inductive'
     WHERE sc.scale_key = 'abstract'
       AND NOT EXISTS (
         SELECT 1 FROM psy_scales d
          WHERE d.instrument_id = sc.instrument_id AND d.scale_key = 'inductive');
    DELETE FROM psy_scales WHERE scale_key = 'abstract';
  END IF;
END $$;

-- 3. psy_norms — remove any abstract cognitive norm (cannot split one→two).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'psy_norms' AND column_name = 'scale_key') THEN
    DELETE FROM psy_norms WHERE kind = 'cognitive' AND scale_key = 'abstract';
  END IF;
END $$;
