-- ════════════════════════════════════════════════════════════════
-- 00153 - Role Readiness engine (Persona + Techno) + Bespoke Services persistence
--
-- A role-configurable engine that bundles Persona (behavioural self-assessment,
-- reusing the existing behavioral_assessment_* tables + the 41-competency
-- framework) and a Techno-style technical section (role-authored areas + items,
-- ISOLATED here so sample/seed data can never leak into the real Techno bank) into
-- ONE candidate sitting that yields a ready/not-ready verdict + a development plan.
--
-- Surfaces as a configurable product inside the existing landing "Bespoke Services"
-- section (persisted in bespoke_services - that section is front-end-only today).
--
-- ADDITIVE: only new enums/tables/policies. Nothing existing is altered. Mirrors the
-- Pre-Hire pattern (00050): service-role token candidate flow, admin-only RLS, plus
-- a client_manager read scope via cm_org_id() (00151). Idempotent / re-runnable.
-- Distinct from the existing "Succession Readiness" product (readiness_results).
-- ════════════════════════════════════════════════════════════════

-- ── Enums (guarded) ─────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE rr_config_status    AS ENUM ('draft','active','archived');         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rr_candidate_status AS ENUM ('invited','in_progress','completed');  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rr_verdict          AS ENUM ('ready','not_ready','incomplete');     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rr_section          AS ENUM ('persona','technical');                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bespoke_service_kind AS ENUM ('role_readiness','bundle');           EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Job families (the grouping above a role) ────────────────────
CREATE TABLE IF NOT EXISTS job_families (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en          text NOT NULL,
  name_ar          text,
  organization_id  uuid REFERENCES organizations(id) ON DELETE CASCADE, -- null = global library
  sort_order       int NOT NULL DEFAULT 0,
  is_sample        boolean NOT NULL DEFAULT false,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Role config (a readiness role = behavioural targets + technical areas + thresholds) ──
-- Behavioural competencies + per-competency targets are reused from role_profiles /
-- role_profile_competencies.target_proficiency (00097); this row references one.
CREATE TABLE IF NOT EXISTS rr_role_configs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_family_id      uuid REFERENCES job_families(id) ON DELETE SET NULL,
  role_profile_id    uuid REFERENCES role_profiles(id) ON DELETE SET NULL,
  organization_id    uuid REFERENCES organizations(id) ON DELETE CASCADE, -- null = global template
  name_en            text NOT NULL,
  name_ar            text,
  description        text,
  persona_pass_pct   int NOT NULL DEFAULT 60 CHECK (persona_pass_pct BETWEEN 0 AND 100),
  technical_pass_pct int NOT NULL DEFAULT 60 CHECK (technical_pass_pct BETWEEN 0 AND 100),
  status             rr_config_status NOT NULL DEFAULT 'draft',
  is_sample          boolean NOT NULL DEFAULT false,
  created_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rr_role_configs_family ON rr_role_configs(job_family_id);
CREATE INDEX IF NOT EXISTS idx_rr_role_configs_org    ON rr_role_configs(organization_id);

-- ── Technical areas for a role (role-authored; per-area target) ──
CREATE TABLE IF NOT EXISTS rr_technical_areas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_config_id  uuid NOT NULL REFERENCES rr_role_configs(id) ON DELETE CASCADE,
  name_en         text NOT NULL,
  name_ar         text,
  target_pct      int NOT NULL DEFAULT 60 CHECK (target_pct BETWEEN 0 AND 100),
  suggestion_en   text,   -- SME-editable development-plan text for this area
  suggestion_ar   text,
  sort_order      int NOT NULL DEFAULT 0,
  is_sample       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rr_tech_areas_config ON rr_technical_areas(role_config_id);

-- ── Technical items (MCQ; ISOLATED from tech_assessment_items - no leak path) ──
CREATE TABLE IF NOT EXISTS rr_technical_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id       uuid NOT NULL REFERENCES rr_technical_areas(id) ON DELETE CASCADE,
  stem_en       text NOT NULL,
  stem_ar       text,
  options_en    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  options_ar    jsonb,                               -- string[] (optional)
  correct_index int NOT NULL CHECK (correct_index >= 0),
  sort_order    int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  is_sample     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rr_tech_items_area ON rr_technical_items(area_id);

-- ── Per-competency SME suggestion override (dev plan; defaults to development_tips) ──
CREATE TABLE IF NOT EXISTS rr_competency_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_config_id  uuid NOT NULL REFERENCES rr_role_configs(id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  suggestion_en   text,
  suggestion_ar   text,
  UNIQUE (role_config_id, competency_id)
);

-- ── Candidates (one combined sitting; token-gated, no account; mirrors prehire) ──
CREATE TABLE IF NOT EXISTS rr_candidates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_config_id      uuid NOT NULL REFERENCES rr_role_configs(id) ON DELETE CASCADE,
  organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,
  full_name           text NOT NULL,
  email               text NOT NULL,
  access_token        uuid NOT NULL DEFAULT gen_random_uuid(),
  persona_session_id  uuid REFERENCES behavioral_assessment_sessions(id) ON DELETE SET NULL,
  status              rr_candidate_status NOT NULL DEFAULT 'invited',
  verdict             rr_verdict NOT NULL DEFAULT 'incomplete',
  consent_at          timestamptz,
  invited_at          timestamptz,
  completed_at        timestamptz,
  is_sample           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_cand_token  ON rr_candidates(access_token);
CREATE INDEX IF NOT EXISTS idx_rr_cand_config        ON rr_candidates(role_config_id);
CREATE INDEX IF NOT EXISTS idx_rr_cand_org           ON rr_candidates(organization_id);

-- ── Section results (per section: persona / technical) ──────────
CREATE TABLE IF NOT EXISTS rr_section_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES rr_candidates(id) ON DELETE CASCADE,
  section       rr_section NOT NULL,
  score_pct     numeric(5,2),
  passed        boolean,
  breakdown     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- per-competency / per-area detail
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, section)
);
CREATE INDEX IF NOT EXISTS idx_rr_section_cand ON rr_section_results(candidate_id);

-- ── Bespoke services (persist + surface configured products in the section) ──
CREATE TABLE IF NOT EXISTS bespoke_services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             bespoke_service_kind NOT NULL DEFAULT 'role_readiness',
  name_en          text NOT NULL,
  name_ar          text,
  description      text,
  organization_id  uuid REFERENCES organizations(id) ON DELETE CASCADE, -- assigned client; null = template
  role_config_id   uuid REFERENCES rr_role_configs(id) ON DELETE CASCADE,
  service_keys     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- for the generic 'bundle' composer
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  is_sample        boolean NOT NULL DEFAULT false,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bespoke_services_org  ON bespoke_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_bespoke_services_kind ON bespoke_services(kind);

-- ── updated_at triggers ─────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'job_families','rr_role_configs','rr_technical_areas','rr_technical_items',
    'rr_candidates','rr_section_results','bespoke_services'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ── Row-Level Security ──────────────────────────────────────────
-- Admin full on every table; the token candidate flow uses the service-role client
-- (no candidate policy, mirrors prehire). client_manager gets a read scope on the
-- surfacing + monitoring tables, scoped to their own org via cm_org_id() (00151).
ALTER TABLE job_families              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_role_configs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_technical_areas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_technical_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_competency_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_candidates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_section_results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bespoke_services          ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'job_families','rr_role_configs','rr_technical_areas','rr_technical_items',
    'rr_competency_suggestions','rr_candidates','rr_section_results','bespoke_services'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_admin ON %I;', t, t);
    EXECUTE format('CREATE POLICY %I_admin ON %I FOR ALL USING (auth_role() = ''admin'') WITH CHECK (auth_role() = ''admin'');', t, t);
  END LOOP;
END $$;

-- client_manager read scopes (own org; global templates where org IS NULL).
DROP POLICY IF EXISTS bespoke_services_cm_select ON bespoke_services;
CREATE POLICY bespoke_services_cm_select ON bespoke_services
  FOR SELECT USING (auth_role() = 'client_manager' AND organization_id = cm_org_id());

DROP POLICY IF EXISTS rr_role_configs_cm_select ON rr_role_configs;
CREATE POLICY rr_role_configs_cm_select ON rr_role_configs
  FOR SELECT USING (auth_role() = 'client_manager' AND (organization_id = cm_org_id() OR organization_id IS NULL));

DROP POLICY IF EXISTS rr_candidates_cm_select ON rr_candidates;
CREATE POLICY rr_candidates_cm_select ON rr_candidates
  FOR SELECT USING (auth_role() = 'client_manager' AND organization_id = cm_org_id());

DROP POLICY IF EXISTS rr_section_results_cm_select ON rr_section_results;
CREATE POLICY rr_section_results_cm_select ON rr_section_results
  FOR SELECT USING (
    auth_role() = 'client_manager'
    AND candidate_id IN (SELECT id FROM rr_candidates WHERE organization_id = cm_org_id())
  );
