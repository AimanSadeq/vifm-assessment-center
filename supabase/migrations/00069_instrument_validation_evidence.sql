-- ============================================================
-- 00069 — validation-evidence trail for four more instruments
-- ============================================================
-- Extends the per-construct validation-evidence pattern (00028 ARC
-- questions, 00068 AC competencies) to the remaining four instruments
-- surfaced on the Evidence & Validity Map, so every instrument can
-- anchor its constructs to published literature with the same
-- AI-propose → human-verify gate.
--
-- The natural "construct unit" differs per instrument, so the column
-- lands on the table that owns the construct:
--   • Fluent (English)  → eng_fluent_items      (per reading/listening item)
--   • Technical Cert    → tech_assessment_items (per job-knowledge item)
--   • Reflect 360       → reflect_competencies  (per competency; mirrors AC)
--   • Psychometrics     → psy_scales            (per measured scale)
--
-- Shape is identical to 00028 / 00068 (see those migrations) so the
-- admin UI + AI suggester pattern carries over 1:1. review_status =
-- ai_proposed never ships to a client; only verified/edited propagate.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- ============================================================

ALTER TABLE eng_fluent_items
  ADD COLUMN IF NOT EXISTS validation_evidence jsonb;
ALTER TABLE tech_assessment_items
  ADD COLUMN IF NOT EXISTS validation_evidence jsonb;
ALTER TABLE reflect_competencies
  ADD COLUMN IF NOT EXISTS validation_evidence jsonb;
ALTER TABLE psy_scales
  ADD COLUMN IF NOT EXISTS validation_evidence jsonb;

-- GIN indexes so the Evidence & Validity Map can filter / aggregate the
-- JSONB efficiently (verified vs ai_proposed counts per instrument).
CREATE INDEX IF NOT EXISTS eng_fluent_items_validation_evidence_gin
  ON eng_fluent_items USING gin (validation_evidence);
CREATE INDEX IF NOT EXISTS tech_assessment_items_validation_evidence_gin
  ON tech_assessment_items USING gin (validation_evidence);
CREATE INDEX IF NOT EXISTS reflect_competencies_validation_evidence_gin
  ON reflect_competencies USING gin (validation_evidence);
CREATE INDEX IF NOT EXISTS psy_scales_validation_evidence_gin
  ON psy_scales USING gin (validation_evidence);

COMMENT ON COLUMN eng_fluent_items.validation_evidence IS
  'Per-item validation-evidence trail (mirrors 00028/00068). Anchors the reading/listening item to published language-testing / CEFR literature. ai_proposed is internal-only; managed at /admin/evidence/fluent, aggregated in /admin/evidence-map.';
COMMENT ON COLUMN tech_assessment_items.validation_evidence IS
  'Per-item validation-evidence trail (mirrors 00028/00068). Anchors the technical item to content-validity / credentialing literature. ai_proposed is internal-only; managed at /admin/evidence/technical, aggregated in /admin/evidence-map.';
COMMENT ON COLUMN reflect_competencies.validation_evidence IS
  'Per-competency validation-evidence trail (mirrors 00068). Anchors the 360 competency to multisource-feedback / competency-modelling literature. ai_proposed is internal-only; managed at /admin/evidence/reflect, aggregated in /admin/evidence-map.';
COMMENT ON COLUMN psy_scales.validation_evidence IS
  'Per-scale validation-evidence trail (mirrors 00068). Anchors the psychometric scale to construct-validity / reliability literature. ai_proposed is internal-only; managed at /admin/evidence/psy, aggregated in /admin/evidence-map.';
