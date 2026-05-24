-- ============================================================
-- VIFM Fluent — English placement results (persistence)
--
-- The Fluent prototype scored a placement test (reading + listening
-- auto-scored, writing + speaking Claude-scored) but never persisted
-- anything — each run vanished on reload. This table stores one row
-- per completed test so we can (a) issue a CEFR certificate that
-- survives a refresh, and (b) aggregate a cohort report for admins.
--
-- Design notes:
--   - No FK to candidates/profiles: Fluent is self-served and
--     anonymous (the taker optionally types their own name/email).
--     This mirrors the ARA respondent model — writes happen through a
--     service-role API route, not client-side, so RLS need only gate
--     the admin read path.
--   - Flat columns carry everything the cohort report aggregates;
--     `result` jsonb keeps the full FluentResult (per-criterion scores,
--     bilingual feedback, transcript) for the certificate + detail view.
--   - ui_language is the language the taker navigated in (en|ar), not
--     a language proficiency — the test content is always English.
-- ============================================================

CREATE TABLE eng_fluent_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  taker_name          text,
  taker_email         text,
  ui_language         text NOT NULL DEFAULT 'en',
  overall_cefr        text NOT NULL,
  reading_correct     int  NOT NULL DEFAULT 0,
  reading_total       int  NOT NULL DEFAULT 0,
  reading_cefr        text,
  listening_correct   int  NOT NULL DEFAULT 0,
  listening_total     int  NOT NULL DEFAULT 0,
  listening_cefr      text,
  writing_cefr        text,
  speaking_attempted  boolean NOT NULL DEFAULT false,
  speaking_cefr       text,
  ai_generated        boolean NOT NULL DEFAULT false,  -- was the test AI-authored
  ai_scored           boolean NOT NULL DEFAULT false,  -- was writing/speaking AI-scored
  result              jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Cohort report lists newest-first; an email lookup supports "my results".
CREATE INDEX eng_fluent_results_created_idx ON eng_fluent_results (created_at DESC);
CREATE INDEX eng_fluent_results_email_idx   ON eng_fluent_results (lower(taker_email));

-- ────────────────────────────────────────────────────────────
-- RLS — admins read the cohort; writes use the service role (API route).
-- ────────────────────────────────────────────────────────────
ALTER TABLE eng_fluent_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY eng_fluent_results_select_admin ON eng_fluent_results
  FOR SELECT USING (auth_role() = 'admin');
