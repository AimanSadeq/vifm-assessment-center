-- ════════════════════════════════════════════════════════════════
-- Admin-configurable assessment timers
--
-- One keyed table for every assessment's time limit, so admins control how long
-- a sitting runs. `scope` identifies what the timer applies to:
--   • type-level (no per-instance record): 'quiz', 'fluent'
--   • per-instance (set where the assessment is configured):
--       'ara:<assessmentId>', 'tech_domain:<key>', 'tech_function:<id>'
--   (the Sandbox keeps its own per-blueprint block times.)
-- `minutes` NULL means "no time limit". Readers fall back to a code default when
-- a scope row is absent, so the table is optional/tolerant.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE assessment_timers (
  scope      text PRIMARY KEY,
  minutes    integer,                       -- NULL = no time limit
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_timers_minutes_sane CHECK (minutes IS NULL OR (minutes >= 1 AND minutes <= 600))
);

-- Seed the two type-level defaults (admins can change them in Settings).
INSERT INTO assessment_timers (scope, minutes) VALUES ('quiz', 5), ('fluent', 15)
  ON CONFLICT (scope) DO NOTHING;

CREATE TRIGGER trg_assessment_timers_updated_at
  BEFORE UPDATE ON assessment_timers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: admins manage; runtime reads go through the service-role client in server
-- components / API routes (so no public SELECT policy is needed).
ALTER TABLE assessment_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessment_timers_admin_all ON assessment_timers
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
