-- ============================================================
-- 00068 — Per-competency validation-evidence trail on competencies
-- ============================================================
-- Mirrors 00028 (ara_questions.validation_evidence) for the
-- Assessment Center behavioural framework. Until now the 38 AC
-- competencies carried NO scientific-provenance metadata in the
-- database — their validity lived only in external documents. This
-- adds a `validation_evidence` JSONB column so every competency can
-- record the published instrument(s) / literature it content-aligns
-- with, plus a human-review status so AI-suggested anchors don't ship
-- un-vetted.
--
-- Shape (TypeScript-equivalent — identical to the ARC trail so the
-- admin UI + AI suggester pattern carries over 1:1):
--
--   {
--     "anchor_instruments": [
--       {
--         "name": "Spencer & Spencer competency model",
--         "citation": "Spencer, L. M., & Spencer, S. M. (1993). ...",
--         "doi": null,
--         "confidence": "direct_adaptation" | "construct_aligned" | "novel",
--         "rationale": "Competency adapts the achievement-orientation cluster"
--       }
--     ],
--     "construct_summary": "Results orientation — achievement drive",
--     "review_status": "ai_proposed" | "verified" | "edited" | "rejected",
--     "reviewed_by": "admin@vifm.ae",
--     "reviewed_at": "2026-06-07T...",
--     "ai_model": "claude-sonnet-4-20250514"   -- only when AI-proposed
--   }
--
-- The `review_status` gate works exactly as ARC: items in status
-- `ai_proposed` are NOT surfaced in any client-facing deliverable —
-- only `verified` or `edited` (post-human-review) anchors propagate.
-- This is the hallucination guard.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE competencies
  ADD COLUMN IF NOT EXISTS validation_evidence jsonb;

-- GIN index so the Evidence & Validity Map can filter / aggregate
-- across the JSONB efficiently (e.g., "all competencies anchored to
-- the ITAG Guidelines" or "count verified vs ai_proposed").
CREATE INDEX IF NOT EXISTS competencies_validation_evidence_gin
  ON competencies USING gin (validation_evidence);

COMMENT ON COLUMN competencies.validation_evidence IS
  'Per-competency validation-evidence trail (mirrors ara_questions.validation_evidence, migration 00028). Anchors a competency construct to published assessment-centre / competency-modelling literature. Items in review_status=ai_proposed are NOT surfaced to clients — only verified or edited anchors propagate. Surfaced + aggregated in the admin Evidence & Validity Map (/admin/evidence-map) and managed at /admin/ac-evidence.';
