-- ARC: OPTIONAL respondent demographics for the dashboard's Segments view.
--
-- The interactive dashboard slices readiness by grade, tenure, gender and
-- nationality. None of that was captured; the August sample invented it. The
-- client decision (2026-09-02) is to make segments OPTIONAL: a respondent may
-- answer a short "about you" block or skip it entirely, and the Segments tab
-- appears only when enough people answered for a slice to be meaningful.
--
-- One jsonb column rather than four typed columns: the option sets are
-- product vocabulary (defined once in code, bilingual) and may grow; a
-- respondent who skips has NULL, not four NULLs. Values are validated in the
-- application against the fixed option keys before they are written.
--
-- Privacy posture: gender and nationality are sensitive in GCC deployments.
-- They are never shown per person - only as aggregates, and only when a
-- segment has at least the anonymity minimum (see dashboard-tree.ts). The
-- individual report does not print them.

ALTER TABLE ara_respondents
  ADD COLUMN IF NOT EXISTS demographics jsonb;

COMMENT ON COLUMN ara_respondents.demographics IS
  'Optional self-declared segments {grade, tenure, gender, nationality}, keys validated in code against ARA_DEMOGRAPHICS. NULL = skipped. Aggregated only; never surfaced per person.';
