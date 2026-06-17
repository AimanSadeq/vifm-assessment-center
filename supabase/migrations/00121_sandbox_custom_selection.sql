-- ════════════════════════════════════════════════════════════════
-- 00121 - Pick-and-choose custom technical assessment (within a function)
--
-- A custom sitting lets an admin assemble a narrower assessment from ONE
-- function: pick a subset of its skills (the MCQ knowledge section is then
-- restricted to those skills) and/or a subset of its hands-on tasks (the
-- sandbox section runs only the chosen blocks). This is an INDICATIVE
-- result by design - a hand-picked subset is not the function's full
-- certified blueprint, so a custom sitting issues NO credential.
--
-- Resolution (in the service layer):
--   • selected_skills      NULL/empty -> all function skills (full MCQ)
--   • selected_block_ids   NULL/empty -> all active blocks (full sandbox)
--   • is_custom = true     -> never certify (no credential), even if the
--                             chosen tasks happen to be SME-approved.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Backward compatible: existing
-- sittings have NULL selections + is_custom=false, i.e. the full blueprint.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_sandbox_sessions
  ADD COLUMN IF NOT EXISTS is_custom          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_skills    text[],   -- MCQ section restricted to these function skills (NULL = all)
  ADD COLUMN IF NOT EXISTS selected_block_ids uuid[];   -- sandbox section restricted to these blocks (NULL = all)
