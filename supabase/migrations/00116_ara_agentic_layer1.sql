-- ════════════════════════════════════════════════════════════════
-- 00116 - Make the Agentic-AI Readiness items respondent-answerable
--
-- The 18 agentic seed items (00041, question numbers 201-218) were
-- inserted with layer=2. But saveAraAnswer hard-rejects layer!=1
-- ("Layer 2 questions are not respondent-facing"), so although the
-- respondent flow SERVES the agentic items (when an assessment opts in
-- via include_agentic_layer), no agentic answer could ever persist -
-- the rollup card and the report's Agentic section were always empty.
-- The tier was dead end-to-end.
--
-- Agentic items ARE respondent-facing self-assessment (like the pillar
-- and individual-factor items, which are layer=1). They are identified
-- and partitioned everywhere by agentic_dimension_id, not by layer:
--   - the pillar respondent query already excludes them
--     (.is agentic_dimension_id null),
--   - the individual query excludes them (individual_factor_id not null),
--   - the agentic query selects them purely by agentic_dimension_id.
-- So moving them to layer=1 cannot make them collide with another layer.
--
-- Side effect (intended): the Phase 2 consultant-guide tab loads
-- layer=2 questions, so this also stops the agentic items leaking into
-- the pillar guide tab.
--
-- Idempotent: only touches agentic rows not already on layer 1.
-- ════════════════════════════════════════════════════════════════

UPDATE ara_questions
SET layer = 1
WHERE agentic_dimension_id IS NOT NULL
  AND layer <> 1;
