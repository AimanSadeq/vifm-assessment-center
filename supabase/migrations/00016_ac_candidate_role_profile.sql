-- ============================================================
-- VIFM Assessment Center - Bind candidates to role profiles
--
-- G1 from the Skillup MENA gap analysis. Without this link the
-- shipped role profile library is admin-only — gap badges can't
-- render in candidate-facing views because there's no "target"
-- to compare BARS scores against. Nullable so existing data
-- stays valid; a candidate without a profile shows the
-- "No Position Assigned" placeholder in the learner dashboard.
-- ============================================================

ALTER TABLE candidates
  ADD COLUMN role_profile_id uuid REFERENCES role_profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_candidates_role_profile ON candidates(role_profile_id);
