-- ============================================================
-- VIFM Courses — Block 7: NOTE
--
-- Adds an optional free-text "note" block to the course catalogue
-- alongside the six PDF blocks (overview / target competencies /
-- objectives / audience / methodology / outline). The note is for
-- internal admin annotations — things like:
--   * "Run only with senior cohort"
--   * "Drop the GPU lab if delivery is virtual"
--   * "Pricing reviewed Q1 2026 — see catalogue Excel"
--
-- The note is NOT extracted from the source PDF (the PDFs don't
-- have a notes block); it's populated manually by the admin via
-- /admin/courses/[id]. Bilingual to match the other text blocks.
--
-- Idempotent via IF NOT EXISTS so re-running on environments that
-- already have the columns is a no-op.
-- ============================================================

ALTER TABLE vifm_courses ADD COLUMN IF NOT EXISTS note_en text;
ALTER TABLE vifm_courses ADD COLUMN IF NOT EXISTS note_ar text;
