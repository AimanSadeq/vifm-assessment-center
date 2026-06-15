-- ════════════════════════════════════════════════════════════════
-- Per-instance time limit for an ARC (AI Readiness) assessment
--
-- The consultant sets an optional time limit when creating the assessment.
-- NULL = no limit (the historical default). The respondent's clock is anchored
-- to `started_at` (stamped when they first click Start), so the deadline survives
-- pausing + returning via the same link and can't be reset by refreshing.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS time_limit_minutes integer
    CHECK (time_limit_minutes IS NULL OR (time_limit_minutes >= 1 AND time_limit_minutes <= 600));

ALTER TABLE ara_respondents
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
