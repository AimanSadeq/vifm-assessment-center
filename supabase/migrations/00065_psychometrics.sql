-- ════════════════════════════════════════════════════════════════
-- VIFM Psychometrics — cognitive ability + Big-Five personality (Tier 1)
--
-- The "Foundations" layer of the layered measurement model: cognitive ability
-- and personality PREDICT the behavioural competencies (see the psychometrics
-- proposal + construct_competency_links). Tier 1 = indicative: AI-/IPIP-sourced
-- items, classical scoring, no local norms yet — issues no credential.
--
-- Security mirrors Fluent/Technical: the full keyed test is held server-side in
-- psy_sessions (single-use), grading happens server-side, results are
-- admin-SELECT only, and every write goes through a service-role API route.
-- psy_items is the forward home for a future SME-reviewed, IRT-calibrated bank;
-- Tier 1 generates the test from code (Mini-IPIP + AI), so the runner does not
-- depend on seeded items.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS psy_instruments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind IN ('cognitive','personality')),
  code       text NOT NULL,
  name_en    text NOT NULL,
  name_ar    text,
  version    text NOT NULL DEFAULT 'v1',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS psy_scales (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES psy_instruments(id) ON DELETE CASCADE,
  key           text NOT NULL,
  name_en       text NOT NULL,
  name_ar       text,
  sort_order    int NOT NULL DEFAULT 0,
  UNIQUE (instrument_id, key)
);

-- Forward bank: SME-reviewed, eventually IRT-calibrated items (Tier 2+).
CREATE TABLE IF NOT EXISTS psy_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id          uuid NOT NULL REFERENCES psy_scales(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('mcq','likert')),
  stem_en           text NOT NULL,
  stem_ar           text,
  options_en        jsonb,
  options_ar        jsonb,
  correct_index     int,                       -- mcq only
  reverse_keyed     boolean NOT NULL DEFAULT false,  -- likert only
  difficulty        text CHECK (difficulty IN ('easy','medium','hard')),
  status            text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','in_review','approved','retired')),
  source            text NOT NULL DEFAULT 'seed',
  times_administered int NOT NULL DEFAULT 0,
  times_correct      int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psy_items_scale_idx ON psy_items(scale_id);

-- The full keyed test, held server-side so the answer key never reaches the
-- browser. Single-use (consumed on score) to defeat replay; ~3h TTL.
CREATE TABLE IF NOT EXISTS psy_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES psy_instruments(id) ON DELETE SET NULL,
  kind          text NOT NULL,
  test          jsonb NOT NULL,
  candidate_id  uuid REFERENCES candidates(id) ON DELETE SET NULL,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
  taker_email   text,
  consumed      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '3 hours')
);

-- One row per completed test.
CREATE TABLE IF NOT EXISTS psy_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES psy_instruments(id) ON DELETE SET NULL,
  kind          text NOT NULL,
  candidate_id  uuid REFERENCES candidates(id) ON DELETE SET NULL,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
  taker_name    text,
  taker_email   text,
  scales        jsonb NOT NULL,   -- per-scale: {key, raw, normalized, band, ...}
  overall       jsonb,            -- cognitive: g composite
  validity      jsonb,            -- personality: social-desirability / inconsistency flags
  result        jsonb NOT NULL,   -- full detail for the report
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psy_results_candidate_idx ON psy_results(candidate_id);
CREATE INDEX IF NOT EXISTS psy_results_engagement_idx ON psy_results(engagement_id);

-- Per-item response log (calibration substrate for Tier 2).
CREATE TABLE IF NOT EXISTS psy_item_responses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id  uuid NOT NULL REFERENCES psy_results(id) ON DELETE CASCADE,
  item_ref   text,             -- generated item id (code-side) or psy_items.id
  scale_key  text,
  response   int,
  correct    boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE psy_instruments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE psy_scales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE psy_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE psy_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE psy_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE psy_item_responses  ENABLE ROW LEVEL SECURITY;

-- Admin manages the bank + reads results; the runner reads/writes via the
-- service role (bypasses RLS). sessions + item_responses get no policy at all,
-- so non-service clients are denied outright.
DROP POLICY IF EXISTS psy_instruments_admin ON psy_instruments;
CREATE POLICY psy_instruments_admin ON psy_instruments FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS psy_scales_admin ON psy_scales;
CREATE POLICY psy_scales_admin ON psy_scales FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS psy_items_admin ON psy_items;
CREATE POLICY psy_items_admin ON psy_items FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS psy_results_admin ON psy_results;
CREATE POLICY psy_results_admin ON psy_results FOR SELECT USING (auth_role() = 'admin');
