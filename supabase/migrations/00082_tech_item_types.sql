-- ════════════════════════════════════════════════════════════════
-- VIFM Technical Assessment — richer item formats in the SME bank
--
-- The indicative engine already supports single / multi-select / scenario items
-- (and now true/false). This migration brings the SME-APPROVED certified bank up
-- to the same parity, so a credential-eligible certified test can include them -
-- not just classic single-answer MCQ.
--
--   question_type   - 'single' (one correct, 4 options) | 'multi' (select-all,
--                     2+ correct, 4-6 options) | 'scenario' (case stem + single
--                     best answer, 4 options) | 'true_false' (2 options, 1 correct)
--   correct_indices - the full set of correct positions for a 'multi' item
--                     (jsonb int[]); single/scenario/true_false keep correct_index
--   scenario_en/ar  - the case stem shown above a 'scenario' item's question
--
-- Backward compatible: existing rows default to question_type='single' and are
-- untouched. The correct_index CHECK is widened from 0-3 to 0-5 so a multi item
-- with up to 6 options stays valid (correct_index holds its first correct pos).
-- Every reader is tolerant of this migration being absent (assembly no-ops to the
-- indicative path), mirroring the rest of the credentials stack.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE tech_assessment_items
  ADD COLUMN IF NOT EXISTS question_type   text NOT NULL DEFAULT 'single'
    CHECK (question_type IN ('single', 'multi', 'scenario', 'true_false')),
  ADD COLUMN IF NOT EXISTS correct_indices jsonb,   -- multi: int[] of correct positions
  ADD COLUMN IF NOT EXISTS scenario_en     text,    -- scenario: case stem (EN)
  ADD COLUMN IF NOT EXISTS scenario_ar     text;    -- scenario: case stem (AR)

-- Widen the single-only correct_index bound (was BETWEEN 0 AND 3) so multi items
-- (up to 6 options) remain valid. single/scenario stay 0-3, true_false 0-1 by app
-- validation; the DB just allows the wider range.
ALTER TABLE tech_assessment_items DROP CONSTRAINT IF EXISTS tech_assessment_items_correct_index_check;
ALTER TABLE tech_assessment_items ADD CONSTRAINT tech_assessment_items_correct_index_check
  CHECK (correct_index BETWEEN 0 AND 5);

-- Optional helper index: filter the certifiable pool by type (e.g. keep the
-- adaptive/CAT pool single-only) without a table scan.
CREATE INDEX IF NOT EXISTS idx_tech_items_type ON tech_assessment_items(question_type);
