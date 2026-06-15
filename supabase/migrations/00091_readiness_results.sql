-- Stored readiness snapshot per candidate per engagement, with the config that
-- produced it. Reports render from this; recompute overwrites it.
-- (Renumbered from handover 00082.)
CREATE TABLE readiness_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id    uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id     uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  role_profile_id  uuid REFERENCES role_profiles(id) ON DELETE SET NULL,
  status           text NOT NULL CHECK (status IN ('ready_now','ready_soon','developing','not_ready','insufficient_data')),
  tier             text CHECK (tier IN ('ready_now','ready_soon','developing','not_ready')),
  weighted_others  numeric(4,2),
  weighted_target  numeric(4,2),
  overall_gap      numeric(4,2),
  coverage_pct     numeric(4,3) NOT NULL,
  knockout_applied boolean NOT NULL DEFAULT false,
  year_label       text,
  per_competency   jsonb,             -- full CompetencyReadiness[] for the report
  config_snapshot  jsonb NOT NULL,    -- the ReadinessConfig used
  computed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, candidate_id)
);

CREATE INDEX idx_readiness_results_engagement ON readiness_results(engagement_id);

ALTER TABLE readiness_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_results_all_admin ON readiness_results
  FOR ALL USING (auth_role() = 'admin');
-- Add assessor/client SELECT policies mirroring how candidate_reports is scoped,
-- if clients are to view readiness in-portal.
