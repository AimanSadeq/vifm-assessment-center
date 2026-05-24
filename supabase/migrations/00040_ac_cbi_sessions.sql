-- ============================================================
-- AI Conversational Assessor — CBI session persistence + audit
-- Migration 00040
--
-- Stores each AI competency-based-interview session: the full
-- transcript, the AI's DRAFT scoring, and the human-reviewed result.
--
-- The human-review gate lives in the application: an assessor reviews
-- (and may edit) the AI draft, then APPROVES. Approval writes the
-- reviewed evidence into `observations` and the reviewed rating into
-- `ratings` — the same tables the manual assessor flow writes to — so
-- AI-assisted evidence flows through the normal integration → wash-up
-- → consensus pipeline. This table is the audit record of what the AI
-- proposed vs. what the human approved.
--
-- Non-breaking: new table only. No existing table is modified.
-- ============================================================

CREATE TABLE cbi_sessions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pipeline context. Nullable so standalone/demo sessions can persist
  -- too; an approved session MUST have an assessor_assignment_id (the
  -- application enforces this before writing to observations/ratings).
  assessor_assignment_id uuid REFERENCES assessor_assignments(id) ON DELETE CASCADE,
  engagement_id          uuid REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id           uuid REFERENCES candidates(id) ON DELETE SET NULL,
  competency_id          uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  language               text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),

  -- The interview + the AI's draft scoring
  transcript             jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{role, text}]
  ai_rating              int CHECK (ai_rating BETWEEN 1 AND 5),
  ai_rationale           text,
  ai_evidence            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{behavior, indicator_type, confidence}]

  -- Human-review gate outcome
  status                 text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'approved', 'discarded')),
  reviewed_rating        int CHECK (reviewed_rating BETWEEN 1 AND 5),
  reviewer_notes         text,
  approved_at            timestamptz,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cbi_sessions_assignment ON cbi_sessions(assessor_assignment_id);
CREATE INDEX idx_cbi_sessions_competency ON cbi_sessions(competency_id);
CREATE INDEX idx_cbi_sessions_status ON cbi_sessions(status);

CREATE TRIGGER cbi_sessions_updated_at
  BEFORE UPDATE ON cbi_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cbi_sessions ENABLE ROW LEVEL SECURITY;

-- Admins manage everything.
CREATE POLICY cbi_sessions_admin_all ON cbi_sessions
  FOR ALL USING (auth_role() = 'admin');

-- Assessors manage CBI sessions (scoped further by assignment in app).
CREATE POLICY cbi_sessions_assessor_all ON cbi_sessions
  FOR ALL USING (auth_role() IN ('lead_assessor', 'associate_assessor'));
