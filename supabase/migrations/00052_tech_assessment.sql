-- ════════════════════════════════════════════════════════════════
-- VIFM Technical Competency Assessment
-- The third capability pillar (with the AC behavioural 38 + Fluent language).
-- Measures INDICATIVE technical proficiency per domain (finance, treasury,
-- accounting, …) via a server-graded assessment. The taxonomy lives in code
-- (src/lib/competencies/technical-framework.ts); only sessions + results persist.
--
-- Integrity model mirrors Fluent (migration 00045/00042):
--   • the full test WITH the answer key is held server-side in
--     tech_assessment_sessions; the browser only ever gets a key-stripped copy.
--   • grading happens server-side from the stored session.
--   • RLS: admin-SELECT only; every write goes through the service-role API.
-- ════════════════════════════════════════════════════════════════

-- ── Sessions: full generated test (with answer key), held server-side ──
CREATE TABLE tech_assessment_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key    text NOT NULL,           -- TechDomainKey (app-validated)
  ui_language   text NOT NULL DEFAULT 'en',
  test          jsonb NOT NULL,          -- full test incl. correct_index
  candidate_id  uuid REFERENCES candidates(id) ON DELETE SET NULL,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
  expires_at    timestamptz,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tech_sessions_candidate ON tech_assessment_sessions(candidate_id);

-- ── Results: one row per completed assessment ──
CREATE TABLE tech_assessment_results (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taker_name     text,
  taker_email    text,
  domain_key     text NOT NULL,
  ui_language    text NOT NULL DEFAULT 'en',
  score_correct  integer NOT NULL DEFAULT 0,
  score_total    integer NOT NULL DEFAULT 0,
  score_pct      numeric(5, 2) NOT NULL DEFAULT 0,
  -- indicative 1–5 proficiency band derived from score_pct
  level          smallint NOT NULL DEFAULT 1,
  level_label    text,
  -- full per-skill detail for the result view (never the answer key)
  result         jsonb,
  ai_generated   boolean NOT NULL DEFAULT false,
  candidate_id   uuid REFERENCES candidates(id) ON DELETE SET NULL,
  engagement_id  uuid REFERENCES engagements(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tech_results_candidate ON tech_assessment_results(candidate_id);
CREATE INDEX idx_tech_results_domain    ON tech_assessment_results(domain_key);
CREATE INDEX idx_tech_results_email     ON tech_assessment_results(taker_email);

-- ── RLS: admin SELECT only; writes are service-role (bypass RLS) ──
ALTER TABLE tech_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_assessment_results  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_sessions_admin_select ON tech_assessment_sessions
  FOR SELECT USING (auth_role() = 'admin');
CREATE POLICY tech_results_admin_select ON tech_assessment_results
  FOR SELECT USING (auth_role() = 'admin');
