-- ============================================================
-- 00099 - Succession Readiness: combined-mode wiring
--
-- The combined service (Persona self + Reflect 360 others vs a role) had every
-- engine piece but no way to assemble it through the UI. This adds the two
-- structural links the setup UI writes:
--   1. engagements.reflect_engagement_id - binds an AC engagement to the
--      Reflect 360 engagement that supplies its "others" view.
--   2. reflect_participants.suppress_self - in combined mode Persona carries
--      self, so the 360's own self-rater is suppressed (no double self).
--
-- assessment_mode (00090), reflect_participants.candidate_id (00089) and
-- reflect_competencies.ac_competency_id (00088) already exist; the setup
-- action populates them. Idempotent / re-runnable.
-- ============================================================

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS reflect_engagement_id uuid REFERENCES reflect_engagements(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_engagements_reflect_engagement ON engagements(reflect_engagement_id);

ALTER TABLE reflect_participants
  ADD COLUMN IF NOT EXISTS suppress_self boolean NOT NULL DEFAULT false;
