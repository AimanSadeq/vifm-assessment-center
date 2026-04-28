-- ============================================================
-- VIFM Assessment Center - Auth hardening for Skillup-parity tables
-- Migration 00019:
--   1. notifications: stop candidates writing self-spoofed rows; lock
--      down which fields a recipient can mutate (read_at only).
--   2. candidate_quiz_attempts: stop candidates rewriting score / status
--      / questions JSONB after completion. Server actions use the
--      service-role client for the privileged writes (status flip +
--      score), so triggers fire only for direct candidate JS-SDK calls.
--
-- Pattern mirrors the ARA auth hardening (commit 4012054, migration
-- 00011): identify the gap, drop+recreate policy, add a trigger to
-- enforce field-level immutability that RLS alone can't express.
--
-- Behaviour-preserving while AUTH_ENABLED=false: the trigger short-
-- circuits to allow when auth_role() is null (which is what happens
-- under the dev-bypass + service-role contexts).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. notifications - prevent self-spoof + lock recipient mutations
--
-- Before: FOR ALL USING (profile_id = auth.uid()) — this lets a
-- candidate INSERT a row with their own profile_id and arbitrary
-- title/body/link, then have it appear in their own bell as if it
-- came from the system. Recipients could also UPDATE the title /
-- body / kind of an existing row, blunting the audit trail.
--
-- After:
--   - SELECT own (unchanged)
--   - UPDATE own (but trigger restricts to read_at only)
--   - DELETE own (dismiss)
--   - No INSERT policy → publishers must use the service-role client
--     in src/lib/notifications/publish.ts.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS notifications_own ON notifications;

CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE USING (profile_id = auth.uid());

-- Recipients can move read_at (mark-read) but nothing else.
CREATE OR REPLACE FUNCTION notifications_only_read_at_movable()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role + admin + dev-bypass (auth.uid() null) skip the gate.
  IF auth_role() IS NULL OR auth_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id  IS DISTINCT FROM OLD.profile_id  THEN RAISE EXCEPTION 'profile_id is immutable'; END IF;
  IF NEW.kind        IS DISTINCT FROM OLD.kind        THEN RAISE EXCEPTION 'kind is set by the publisher'; END IF;
  IF NEW.title       IS DISTINCT FROM OLD.title       THEN RAISE EXCEPTION 'title is set by the publisher'; END IF;
  IF NEW.body        IS DISTINCT FROM OLD.body        THEN RAISE EXCEPTION 'body is set by the publisher'; END IF;
  IF NEW.link        IS DISTINCT FROM OLD.link        THEN RAISE EXCEPTION 'link is set by the publisher'; END IF;
  IF NEW.data        IS DISTINCT FROM OLD.data        THEN RAISE EXCEPTION 'data is set by the publisher'; END IF;
  IF NEW.created_at  IS DISTINCT FROM OLD.created_at  THEN RAISE EXCEPTION 'created_at is immutable'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_only_read_at_movable_check
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION notifications_only_read_at_movable();


-- ────────────────────────────────────────────────────────────
-- 2. candidate_quiz_attempts - prevent score / question tampering
--
-- Before: FOR ALL USING (...) lets the row owner UPDATE *any* column.
-- A candidate could finish a quiz at 14% and then call the JS SDK
-- directly to set score_pct=100, correct_count=7. They could also
-- substitute an easier `questions` JSONB mid-quiz.
--
-- Two parts to the fix:
--
-- (a) Server actions completeQuizAttemptAction and
--     abandonQuizAttemptAction switch to the service-role client for
--     the privileged write. The trigger short-circuits for service-
--     role contexts (auth_role() = null), so admin work continues to
--     succeed.
--
-- (b) BEFORE UPDATE trigger refuses any change to immutable / score
--     fields from a candidate context, AND refuses any update once
--     status != 'in_progress'. saveQuizAnswerAction is unaffected
--     because it only touches the `answers` JSONB.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION candidate_quiz_attempts_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role + admin + dev-bypass skip the gate (server-side scoring).
  IF auth_role() IS NULL OR auth_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Once finalised, no more candidate-side updates.
  IF OLD.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Quiz attempt is finalised; no further candidate updates allowed';
  END IF;

  -- Strictly-immutable fields, even during in_progress.
  IF NEW.questions          IS DISTINCT FROM OLD.questions          THEN RAISE EXCEPTION 'questions is set at start and immutable'; END IF;
  IF NEW.total_count        IS DISTINCT FROM OLD.total_count        THEN RAISE EXCEPTION 'total_count is immutable'; END IF;
  IF NEW.passing_score_pct  IS DISTINCT FROM OLD.passing_score_pct  THEN RAISE EXCEPTION 'passing_score_pct is immutable'; END IF;
  IF NEW.candidate_id       IS DISTINCT FROM OLD.candidate_id       THEN RAISE EXCEPTION 'candidate_id is immutable'; END IF;
  IF NEW.competency_id      IS DISTINCT FROM OLD.competency_id      THEN RAISE EXCEPTION 'competency_id is immutable'; END IF;
  IF NEW.started_at         IS DISTINCT FROM OLD.started_at         THEN RAISE EXCEPTION 'started_at is immutable'; END IF;

  -- Score-related fields are server-set only; candidates can't move them.
  IF NEW.score_pct          IS DISTINCT FROM OLD.score_pct          THEN RAISE EXCEPTION 'score_pct is set by completeQuizAttemptAction'; END IF;
  IF NEW.correct_count      IS DISTINCT FROM OLD.correct_count      THEN RAISE EXCEPTION 'correct_count is set by completeQuizAttemptAction'; END IF;
  IF NEW.time_taken_seconds IS DISTINCT FROM OLD.time_taken_seconds THEN RAISE EXCEPTION 'time_taken_seconds is set by completeQuizAttemptAction'; END IF;
  IF NEW.completed_at       IS DISTINCT FROM OLD.completed_at       THEN RAISE EXCEPTION 'completed_at is set by completeQuizAttemptAction'; END IF;
  IF NEW.status             IS DISTINCT FROM OLD.status             THEN RAISE EXCEPTION 'status is set by complete or abandon action'; END IF;

  -- During in_progress, candidate may update only `answers` (and `updated_at`
  -- via the existing pre-update trigger). Both are intentionally allowed.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidate_quiz_attempts_immutable_check_trigger
  BEFORE UPDATE ON candidate_quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION candidate_quiz_attempts_immutable_check();


-- ────────────────────────────────────────────────────────────
-- 3. candidate_quiz_attempts - block fabricated initial inserts
--
-- Even with the trigger above, a candidate could INSERT a fresh row
-- with status='completed' and score_pct=100 — RLS only checks
-- candidate_id maps to their profile, not the row's contents. Lock
-- this with a CHECK constraint that forces every newly-inserted row
-- to start in 'in_progress' with score fields null.
-- ────────────────────────────────────────────────────────────

ALTER TABLE candidate_quiz_attempts
  ADD CONSTRAINT candidate_quiz_attempts_initial_state_check
  CHECK (
    -- in_progress rows must have null score / completion fields
    (status = 'in_progress'
      AND score_pct IS NULL
      AND correct_count IS NULL
      AND completed_at IS NULL
      AND time_taken_seconds IS NULL)
    -- finalised rows must have a non-null completed_at
    OR (status IN ('completed', 'abandoned')
      AND completed_at IS NOT NULL)
  );
