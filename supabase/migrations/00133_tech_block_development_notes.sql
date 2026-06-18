-- ════════════════════════════════════════════════════════════════
-- 00133 - Technical sandbox per-block development notes cache
--
-- A single jsonb bag of generated per-block development narratives for a
-- technical sitting, mirroring 00126 report_extras: generated once (at first
-- report render) and reused so the on-screen view + the PDF share identical
-- copy and views do not re-spend tokens. Additive, idempotent, tolerant -
-- NULL / a missing block key means "not generated yet" -> the report
-- regenerates (and best-effort persists) on the next render.
--
-- Shape (keyed by skill_block_id; only blocks with at least one MISSED
-- checkpoint get an entry - a fully-passed block is a strength, no note):
--   {
--     "<skill_block_id>": { "en": "<2-3 sentence note>", "ar": "<...>" },
--     ...
--   }
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_sandbox_sessions
  ADD COLUMN IF NOT EXISTS block_development_notes jsonb;
