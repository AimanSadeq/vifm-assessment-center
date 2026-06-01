-- ════════════════════════════════════════════════════════════════
-- VIFM Pre-Hire — custom candidate fields
--
-- A client recruiter often needs to carry their own identifiers on a candidate
-- (most commonly an internal Employee ID for re-hire / internal-mobility runs,
-- but also req numbers, cost centres, etc.). Rather than add a column per field,
-- a single jsonb bag holds arbitrary key→value pairs the recruiter supplies at
-- "Add candidate" time. These are recruiter metadata only — never scored, never
-- shown to the candidate, never part of adverse-impact. Additive to 00050/00051.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prehire_candidates
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN prehire_candidates.custom_fields IS
  'Recruiter-supplied metadata (e.g. {"employee_id":"E-1234"}). Not scored, not candidate-visible, not in adverse-impact.';
