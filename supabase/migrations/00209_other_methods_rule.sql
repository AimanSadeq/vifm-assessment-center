-- Assessment Center: what happens to results that did not come from an exercise.
--
-- BPS 4.32: "A procedure shall be established for converting the results from
-- assessment methods that are not Exercises onto the same rating scale used for
-- the Exercises." BPS 4.27 adds that such methods must be relevant to the
-- assessment criteria and appropriate for the participants.
--
-- Caliber can attach a lot to a centre: Persona self-report, a technical test,
-- Fluent English, Logica, a competency-based interview, a Reflect 360. Today
-- none of that is converted, and no rule says whether an assessor may let a test
-- result move a competency rating. In practice assessors see the figures, so the
-- absence of a rule is itself a rule, just an undocumented one.
--
-- Two honest positions, recorded per engagement:
--   context_only            - other results inform the discussion but never move
--                             a rating. The rating stays evidence from exercises.
--   documented_conversion   - the client agreed a stated conversion onto the 1-5
--                             scale; the rule itself goes in the note.
-- Default is null, meaning the question has not been answered for that centre.

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS other_methods_rule text
    CHECK (other_methods_rule IN ('context_only', 'documented_conversion')),
  ADD COLUMN IF NOT EXISTS other_methods_note text;

COMMENT ON COLUMN engagements.other_methods_rule IS
  'How results from methods other than exercises (tests, questionnaires, interviews, 360) relate to the 1-5 competency ratings: context_only (they inform but never move a rating) or documented_conversion (a stated rule, written in other_methods_note). Null = not decided for this centre (BPS 4.32).';
