-- ════════════════════════════════════════════════════════════════
-- Psychometrics → competency bridge (the Foundations layer links)
--
-- Registers the Tier-1 psychometrics scales (cognitive ability subtests +
-- general mental ability g, and the Big-Five personality traits) into the
-- unified construct_competency_links table (00064) as `predicts`/`foundations`
-- rows — the principled home for "this disposition/ability predicts that
-- behavioural competency".
--
--   relation = predicts   (foundations → predict competencies; weakest evidence
--                          tier — must be validated before high-stakes use, so
--                          validated stays false and weight is conservative)
--   layer    = foundations
--   source_kind = cognitive | personality
--   source_key  = the scale id the runner/scorer uses
--                 (cognitive subtests: numerical | verbal | abstract; g = 'g';
--                  personality traits: O | C | E | A | S)
--
-- Resolved by competency NAME (mirrors 00054's name-join discipline); a name
-- that doesn't match the seeded 38 is silently skipped. Idempotent via the
-- table's UNIQUE (source_kind, source_key, competency_id) + ON CONFLICT.
-- Additive + tolerant: re-runnable, depends only on 00002 (competencies) + 00064.
-- ════════════════════════════════════════════════════════════════

-- Cognitive (ability) → predicts. weight 2 for the focused subtests, 1 for the
-- broad g composite (a general predictor, deliberately diffuse).
INSERT INTO construct_competency_links
  (source_kind, source_key, competency_id, relation, layer, weight, validated, rationale)
SELECT 'cognitive', v.source_key, c.id, 'predicts', 'foundations', v.weight, false, v.rationale
FROM (VALUES
  -- subtests
  ('numerical', 'Financial Acumen',         2, 'Numerical reasoning predicts quantitative financial judgement.'),
  ('numerical', 'Analytical Reasoning',      2, 'Numerical reasoning predicts data-driven analysis.'),
  ('numerical', 'Decision Quality',          2, 'Quantitative reasoning predicts sound, evidence-based decisions.'),
  ('verbal',    'Communicates Effectively',  2, 'Verbal reasoning predicts clarity of written/spoken communication.'),
  ('verbal',    'Analytical Reasoning',      2, 'Comprehension and critical reading predict analytical work.'),
  ('abstract',  'Manages Complexity',        2, 'Abstract pattern reasoning predicts handling of complex, ambiguous problems.'),
  ('abstract',  'Cultivates Innovation',     2, 'Fluid reasoning predicts novel, inventive problem-solving.'),
  -- general mental ability (g) — broad, diffuse predictor
  ('g',         'Analytical Reasoning',      1, 'General mental ability is a broad predictor of analytical performance.'),
  ('g',         'Decision Quality',          1, 'General mental ability broadly predicts decision quality.'),
  ('g',         'Manages Complexity',        1, 'General mental ability broadly predicts handling of complexity.')
) AS v(source_key, competency_name, weight, rationale)
JOIN competencies c ON c.name = v.competency_name
ON CONFLICT (source_kind, source_key, competency_id) DO NOTHING;

-- Personality (Big-Five) → predicts. weight 2 throughout.
INSERT INTO construct_competency_links
  (source_kind, source_key, competency_id, relation, layer, weight, validated, rationale)
SELECT 'personality', v.source_key, c.id, 'predicts', 'foundations', 2, false, v.rationale
FROM (VALUES
  ('O', 'Cultivates Innovation', 'Openness predicts creative, inventive behaviour.'),
  ('O', 'Nimble Learning',       'Openness predicts curiosity-driven, experimental learning.'),
  ('O', 'Manages Complexity',    'Openness predicts comfort with novel, complex information.'),
  ('C', 'Drives Results',        'Conscientiousness predicts diligent delivery of results.'),
  ('C', 'Plans and Aligns',      'Conscientiousness predicts organised planning and follow-through.'),
  ('C', 'Action Oriented',       'Conscientiousness predicts proactive, energetic execution.'),
  ('E', 'Communicates Effectively', 'Extraversion predicts confident, outgoing communication.'),
  ('E', 'Persuades',             'Extraversion predicts assertive, persuasive influence.'),
  ('E', 'Builds Networks',       'Extraversion predicts relationship-building and networking.'),
  ('A', 'Collaboration',         'Agreeableness predicts cooperative, partnership-oriented work.'),
  ('A', 'Develops Talent',       'Agreeableness predicts supportive development of others.'),
  ('A', 'Emotional Intelligence','Agreeableness predicts empathy and social awareness.'),
  ('S', 'Being Resilient',       'Emotional stability predicts resilience under pressure.'),
  ('S', 'Manages Ambiguity',     'Emotional stability predicts calm under uncertainty.'),
  ('S', 'Self-Awareness',        'Emotional stability predicts steady, reflective self-management.')
) AS v(source_key, competency_name, rationale)
JOIN competencies c ON c.name = v.competency_name
ON CONFLICT (source_kind, source_key, competency_id) DO NOTHING;
