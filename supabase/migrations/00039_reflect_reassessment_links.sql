-- ============================================================
-- VIFM Reflect 360 - P2 parity pass
-- Migration 00039: Annual reassessment links
--
-- Adds two nullable self-FK columns:
--   reflect_engagements.prior_engagement_id
--   reflect_participants.prior_participant_id
--
-- Mirrors the existing ARA + AC reassessment pattern exactly
-- (00020 in the AC/ARA schema). The new engagement clones the
-- framework + selected participants from the prior run; each new
-- participant carries a prior_participant_id pointer so the
-- report can render an "↑+0.4 vs prior" delta on every score.
--
-- ON DELETE SET NULL because deleting an old engagement should
-- silently break the link, not cascade and wipe the new one.
-- ============================================================

ALTER TABLE reflect_engagements
  ADD COLUMN IF NOT EXISTS prior_engagement_id uuid
    REFERENCES reflect_engagements(id) ON DELETE SET NULL;

ALTER TABLE reflect_participants
  ADD COLUMN IF NOT EXISTS prior_participant_id uuid
    REFERENCES reflect_participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reflect_engagements_prior
  ON reflect_engagements(prior_engagement_id)
  WHERE prior_engagement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reflect_participants_prior
  ON reflect_participants(prior_participant_id)
  WHERE prior_participant_id IS NOT NULL;

COMMENT ON COLUMN reflect_engagements.prior_engagement_id IS
  'Links a reassessment engagement to its prior run. Lets the report show year-on-year deltas.';
COMMENT ON COLUMN reflect_participants.prior_participant_id IS
  'Links a participant in a reassessment to their record in the prior engagement.';
