-- CAL-PER-403: capture the taker's email on standalone Persona sessions.
-- Used for lead capture + results delivery. Nullable at the DB level; the
-- runner requires it only for the hiring (Talent Acquisition) purpose and
-- leaves it optional for development (Talent Management). The session-create
-- path is tolerant of this column being absent, so applying this is safe and
-- non-breaking either way.
ALTER TABLE behavioral_assessment_sessions ADD COLUMN IF NOT EXISTS taker_email text;

-- Match the other taker tables (eng_fluent_results / psy_results): a
-- case-insensitive index so a taker can be looked up by email.
CREATE INDEX IF NOT EXISTS idx_behavioral_sessions_taker_email
  ON behavioral_assessment_sessions (lower(taker_email));
