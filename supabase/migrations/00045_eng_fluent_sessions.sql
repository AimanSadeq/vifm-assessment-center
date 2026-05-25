-- ============================================================
-- VIFM Fluent — server-side test sessions (integrity)
--
-- Until now the generated test (including every `correct_index`) was sent
-- to the browser and the client posted its answers back for grading — a
-- test-taker could read the key in DevTools or forge a perfect answer map.
--
-- This table holds the FULL test server-side. On "start" the API stores the
-- test here and returns only an answer-key-STRIPPED test + a session_id; on
-- "score" the server loads the stored test by session_id and grades it. The
-- key never reaches the browser.
--
-- The scoring route is tolerant: if this table is absent (migration not yet
-- applied) it falls back to the legacy client-graded path, so deployment is
-- non-breaking. Apply this migration to switch on the secure flow.
--
--   test         : the full FluentTest jsonb (server-only — has correct_index)
--   consumed_at  : set when a session is scored (audit; not enforced)
--   expires_at   : sessions are short-lived (API sets ~3h)
-- ============================================================

CREATE TABLE IF NOT EXISTS eng_fluent_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  ui_language   text NOT NULL DEFAULT 'en',
  test          jsonb NOT NULL,
  candidate_id  uuid REFERENCES candidates(id) ON DELETE SET NULL,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
  consumed_at   timestamptz,
  expires_at    timestamptz
);

CREATE INDEX IF NOT EXISTS eng_fluent_sessions_created_idx ON eng_fluent_sessions (created_at DESC);

-- RLS: admin SELECT only; the test (with the answer key) is written and read
-- by the service-role API route, never by a browser client.
ALTER TABLE eng_fluent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eng_fluent_sessions_select_admin ON eng_fluent_sessions;
CREATE POLICY eng_fluent_sessions_select_admin ON eng_fluent_sessions
  FOR SELECT USING (auth_role() = 'admin');
