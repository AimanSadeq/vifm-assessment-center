-- ============================================================
-- 00028 — Per-item validation-evidence trail on ara_questions
-- ============================================================
-- Adds a `validation_evidence` JSONB column that holds the chain
-- of published instruments each question content-aligns with, plus
-- a human-review status so AI-suggested anchors don't ship un-vetted.
--
-- Shape (TypeScript-equivalent):
--
--   {
--     "anchor_instruments": [
--       {
--         "name": "Technology Acceptance Model",
--         "citation": "Davis, F. D. (1989). ...",
--         "doi": "10.2307/249008",
--         "confidence": "direct_adaptation" | "construct_aligned" | "novel",
--         "rationale": "Item adapts the perceived-usefulness construct"
--       }
--     ],
--     "construct_summary": "Technology adoption — perceived usefulness",
--     "review_status": "ai_proposed" | "verified" | "edited" | "rejected",
--     "reviewed_by": "asadeq@viftraining.com",
--     "reviewed_at": "2026-04-30T...",
--     "ai_model": "claude-opus-4-7"        -- only when AI-proposed
--   }
--
-- The `review_status` field is the gate: items with status
-- `ai_proposed` are NOT shown in the consultant report appendix —
-- only `verified` or `edited` (post-human-review) items surface in
-- the bibliography that goes to the client. This is the
-- hallucination guard.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE ara_questions
  ADD COLUMN IF NOT EXISTS validation_evidence jsonb;

-- GIN index so admin bibliography views can filter / aggregate
-- across the JSONB efficiently (e.g., "all questions anchored to
-- the Technology Acceptance Model").
CREATE INDEX IF NOT EXISTS ara_questions_validation_evidence_gin
  ON ara_questions USING gin (validation_evidence);

COMMENT ON COLUMN ara_questions.validation_evidence IS
  'Per-item validation-evidence trail. Items in review_status=ai_proposed are NOT surfaced in the client report — only verified or edited items propagate. See docs/ARA-Methodology-Brief.md §6 for the curated anchor instruments.';
