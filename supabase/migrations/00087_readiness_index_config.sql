-- Admin-tunable parameters for the Succession Readiness index.
-- One global default row (organization_id IS NULL). Optional per-org overrides.
-- (Renumbered from handover 00078 - 00078..00086 were already taken.)
CREATE TABLE readiness_index_config (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  -- Tier gap cutoffs (weighted_others - weighted_target). Must be descending.
  ready_now_gap_cut        numeric(3,2) NOT NULL DEFAULT 0.00,
  ready_soon_gap_cut       numeric(3,2) NOT NULL DEFAULT -0.50,
  developing_gap_cut       numeric(3,2) NOT NULL DEFAULT -1.00,
  -- Knockout guardrail.
  knockout_enabled         boolean NOT NULL DEFAULT true,
  knockout_priority        text NOT NULL DEFAULT 'high' CHECK (knockout_priority IN ('high','medium','low')),
  knockout_gap             numeric(3,2) NOT NULL DEFAULT 1.00,
  knockout_cap_tier        text NOT NULL DEFAULT 'developing'
                             CHECK (knockout_cap_tier IN ('ready_now','ready_soon','developing','not_ready')),
  -- Aggregation + data sufficiency.
  use_weights              boolean NOT NULL DEFAULT true,
  min_others_per_competency integer NOT NULL DEFAULT 1 CHECK (min_others_per_competency >= 1),
  coverage_min_pct         numeric(4,3) NOT NULL DEFAULT 0.700 CHECK (coverage_min_pct BETWEEN 0 AND 1),
  -- Optional year layer.
  year_layer_enabled       boolean NOT NULL DEFAULT false,
  year_map                 jsonb NOT NULL DEFAULT
    '{"ready_now":"0-2 years","ready_soon":"1-3 years","developing":"3-5 years","not_ready":"Beyond 5 years / not in pipeline"}'::jsonb,
  updated_by               uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- At most one row per scope (one global, one per org).
  CONSTRAINT readiness_config_one_per_scope UNIQUE (organization_id)
);

-- Ordering sanity so the admin panel can't save inverted cutoffs.
ALTER TABLE readiness_index_config ADD CONSTRAINT readiness_cutoffs_descending
  CHECK (ready_now_gap_cut >= ready_soon_gap_cut AND ready_soon_gap_cut >= developing_gap_cut);

CREATE UNIQUE INDEX readiness_config_global_singleton
  ON readiness_index_config ((organization_id IS NULL)) WHERE organization_id IS NULL;

CREATE TRIGGER readiness_config_updated_at
  BEFORE UPDATE ON readiness_index_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed the global default (mirrors DEFAULT_READINESS_CONFIG in readiness.ts).
INSERT INTO readiness_index_config (organization_id) VALUES (NULL);

ALTER TABLE readiness_index_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_config_all_admin ON readiness_index_config
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY readiness_config_select_auth ON readiness_index_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
