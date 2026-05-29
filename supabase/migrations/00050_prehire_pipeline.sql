-- ════════════════════════════════════════════════════════════════
-- VIFM Pre-Hire pipeline
-- Commercial pre-employment screening: client organizations run candidates
-- through a configurable funnel (Fluent + competency quiz + AI interview, with
-- the full Assessment Center as a premium final stage). Net-new orchestration
-- layer over the existing instruments - it never duplicates them; each stage
-- soft-links to the instrument's own record.
--
-- Access model (mirrors ARA respondents / Fluent):
--   admin (VIFM)  - full access
--   client        - SELECT only, scoped to their own organization
--   candidate     - NO table access; reaches their flow via access_token,
--                   validated by service-role API routes only.
-- ════════════════════════════════════════════════════════════════

-- ── Enums ───────────────────────────────────────────────────────
CREATE TYPE prehire_requisition_status AS ENUM ('draft', 'open', 'closed', 'archived');
CREATE TYPE prehire_candidate_status   AS ENUM ('invited', 'in_progress', 'scored', 'shortlisted', 'hold', 'declined', 'withdrawn');
CREATE TYPE prehire_stage_kind         AS ENUM ('fluent', 'quiz', 'cbi', 'assessment_center');
CREATE TYPE prehire_stage_status       AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

-- ── Requisitions (one per client role opening) ──────────────────
CREATE TABLE prehire_requisitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  role_profile_id  uuid REFERENCES role_profiles(id) ON DELETE SET NULL,
  level            text,
  -- ordered stage plan: [{ "kind": "fluent", "weight": 0.3, "cut_score": 60, "required": true }, ...]
  stage_config     jsonb NOT NULL DEFAULT '[]'::jsonb,
  english_required boolean NOT NULL DEFAULT false,
  status           prehire_requisition_status NOT NULL DEFAULT 'draft',
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prehire_req_org    ON prehire_requisitions(organization_id);
CREATE INDEX idx_prehire_req_status ON prehire_requisitions(status);

CREATE TRIGGER prehire_requisitions_updated_at
  BEFORE UPDATE ON prehire_requisitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Candidates (one per applicant per requisition; no account) ──
CREATE TABLE prehire_candidates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id   uuid NOT NULL REFERENCES prehire_requisitions(id) ON DELETE CASCADE,
  full_name        text NOT NULL,
  email            text NOT NULL,
  phone            text,
  access_token     uuid NOT NULL DEFAULT gen_random_uuid(),
  status           prehire_candidate_status NOT NULL DEFAULT 'invited',
  current_stage    prehire_stage_kind,
  -- 0-100 composite of normalized stage scores per the requisition weights
  composite_score  numeric(5, 2),
  -- screening signal only - a human confirms the decision downstream (no auto-reject)
  recommendation   text,
  consent_at       timestamptz,
  invited_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_prehire_cand_token ON prehire_candidates(access_token);
CREATE INDEX idx_prehire_cand_req          ON prehire_candidates(requisition_id);
CREATE INDEX idx_prehire_cand_status       ON prehire_candidates(status);

CREATE TRIGGER prehire_candidates_updated_at
  BEFORE UPDATE ON prehire_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Stage results (one row per stage per candidate) ─────────────
-- source_id is a SOFT link to the instrument's native record (eng_fluent_results,
-- candidate_quiz_attempts, cbi_sessions, overall_assessment_ratings). No hard FK:
-- the instruments are independent modules and stay decoupled.
CREATE TABLE prehire_stage_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prehire_candidate_id  uuid NOT NULL REFERENCES prehire_candidates(id) ON DELETE CASCADE,
  kind                  prehire_stage_kind NOT NULL,
  status                prehire_stage_status NOT NULL DEFAULT 'pending',
  source_id             uuid,
  raw_score             numeric(6, 2),   -- instrument-native score
  normalized_score      numeric(5, 2),   -- 0-100, for compositing
  passed                boolean,         -- raw vs the requisition cut_score
  detail                jsonb,           -- snapshot for the recruiter view (CEFR level, %, etc.)
  flags                 jsonb,           -- integrity / review flags (advisory only)
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_prehire_stage_unique ON prehire_stage_results(prehire_candidate_id, kind);
CREATE INDEX idx_prehire_stage_cand          ON prehire_stage_results(prehire_candidate_id);

CREATE TRIGGER prehire_stage_results_updated_at
  BEFORE UPDATE ON prehire_stage_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────
ALTER TABLE prehire_requisitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prehire_candidates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prehire_stage_results  ENABLE ROW LEVEL SECURITY;

-- Requisitions: admin all; client SELECT own org
CREATE POLICY prehire_req_admin ON prehire_requisitions
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY prehire_req_client_select ON prehire_requisitions
  FOR SELECT USING (
    auth_role() = 'client'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Candidates: admin all; client SELECT candidates in their org's requisitions
CREATE POLICY prehire_cand_admin ON prehire_candidates
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY prehire_cand_client_select ON prehire_candidates
  FOR SELECT USING (
    auth_role() = 'client'
    AND requisition_id IN (
      SELECT id FROM prehire_requisitions
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Stage results: admin all; client SELECT results for their org's candidates
CREATE POLICY prehire_stage_admin ON prehire_stage_results
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY prehire_stage_client_select ON prehire_stage_results
  FOR SELECT USING (
    auth_role() = 'client'
    AND prehire_candidate_id IN (
      SELECT c.id FROM prehire_candidates c
      JOIN prehire_requisitions r ON r.id = c.requisition_id
      WHERE r.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );
