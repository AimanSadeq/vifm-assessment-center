-- ════════════════════════════════════════════════════════════════
-- 00112 - Tighten cbi_sessions RLS to own-assignment scope
--
-- 00040 gave every assessor FULL access to ALL cbi_sessions
-- (auth_role() IN ('lead_assessor','associate_assessor')), so any assessor
-- could read/modify another assessor's AI-interview drafts via direct
-- PostgREST. The app write-paths use the service-role client and now enforce
-- role + assignment ownership in the server actions, but this closes the
-- direct-query hole too (defense in depth).
--
-- New policy: an assessor may touch a cbi_session only when its
-- assessor_assignment belongs to them. Rows with a NULL assessor_assignment_id
-- (standalone/demo drafts) are no longer assessor-readable via RLS - those
-- flows go through the service client, which bypasses RLS. Admin keeps full
-- access. Idempotent / re-runnable.
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS cbi_sessions_assessor_all ON cbi_sessions;
DROP POLICY IF EXISTS cbi_sessions_assessor_own ON cbi_sessions;

CREATE POLICY cbi_sessions_assessor_own ON cbi_sessions
  FOR ALL
  USING (
    auth_role() IN ('lead_assessor', 'associate_assessor')
    AND assessor_assignment_id IN (
      SELECT id FROM assessor_assignments WHERE assessor_id = auth.uid()
    )
  );
