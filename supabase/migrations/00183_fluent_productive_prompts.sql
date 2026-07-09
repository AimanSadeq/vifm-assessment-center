-- Fluent: bring the productive skills (writing + speaking) into the item bank.
--
-- Reading + listening are auto-scored MCQs (already in eng_fluent_items). Writing
-- + speaking are AI-scored open tasks - the "item" is a PROMPT (no answer key).
-- Before this, the served prompts lived only in code (a fixed rotation). This
-- widens the skill CHECK so the vetted prompts can live in the same bank behind
-- the same SME review gate, visible on the readiness dashboard.
--
-- The prompt stem shape is { prompt_en, prompt_ar, cefr_target, min_words? |
-- min_seconds? } (no options / correct_index). content_hash stays the stable
-- identity (sha256 of skill + prompt + cefr).

-- The 00048 CHECK is an inline (auto-named) constraint, so drop whatever
-- skill-check constraint exists by definition rather than guessing its name.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'eng_fluent_items'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%skill%'
  LOOP
    EXECUTE format('ALTER TABLE eng_fluent_items DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE eng_fluent_items
  ADD CONSTRAINT eng_fluent_items_skill_check
  CHECK (skill IN ('reading', 'listening', 'writing', 'speaking'));
