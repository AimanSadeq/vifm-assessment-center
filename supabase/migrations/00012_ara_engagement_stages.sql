-- ============================================================
-- VIFM ARA - Engagement Stages
-- Migration 00012: Three-stage product line
--
-- Stage 1 - Department  (complimentary, pro-bono)
-- Stage 2 - Division    (fee-based engagement)
-- Stage 3 - Enterprise  (fee-based engagement, full corporate)
--
-- Pillar applicability per stage (enforced in app, not DB):
--   Stage 1 (4): data, talent, culture, operations
--   Stage 2 (6): + strategy, governance
--   Stage 3 (8): + technology, model_management
-- ============================================================

CREATE TYPE ara_engagement_stage AS ENUM ('department', 'division', 'enterprise');

ALTER TABLE ara_assessments
  ADD COLUMN engagement_stage ara_engagement_stage NOT NULL DEFAULT 'enterprise',
  ADD COLUMN scope_label text,
  ADD COLUMN scope_label_ar text;

COMMENT ON COLUMN ara_assessments.engagement_stage IS
  'Product stage: department (Stage 1, complimentary), division (Stage 2, paid), enterprise (Stage 3, paid). Drives feature gating in the app.';

COMMENT ON COLUMN ara_assessments.scope_label IS
  'Free-text label for the assessed scope. For department stage: department name (e.g. "Risk Management"). For division stage: division name. For enterprise: optional, usually null.';

-- Existing assessments default to enterprise (the column default does
-- this for new rows; for backfill clarity we set it explicitly even
-- though it is a no-op against the default).
UPDATE ara_assessments SET engagement_stage = 'enterprise' WHERE engagement_stage IS NULL;

CREATE INDEX idx_ara_assessments_stage ON ara_assessments(engagement_stage);
