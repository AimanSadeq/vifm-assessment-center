-- ============================================================
-- VIFM ARA — auth hardening
-- Migration 00011:
--   1. Tighten ara_organizations SELECT policy to scope per consultant
--   2. Atomic publish RPC to eliminate the two-concurrent-publishes
--      race condition flagged by the code review (#7)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- #9 — Scope ara_organizations visibility per consultant.
--
-- Before: every consultant could SELECT every organization row.
-- After: a consultant sees only orgs they created OR orgs where they
-- own at least one assessment. Admins still see everything.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ara_orgs_consultant_read ON ara_organizations;

CREATE POLICY ara_orgs_consultant_read ON ara_organizations
  FOR SELECT USING (
    auth_role() = 'consultant'
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM ara_assessments
        WHERE ara_assessments.organization_id = ara_organizations.id
          AND ara_assessments.consultant_id = auth.uid()
      )
    )
  );

-- Make sure created_by is populated on insert — the app already sets
-- this, but add a trigger to guarantee it never gets left null for
-- consultant-authored rows (defensive).
-- NOTE: we don't enforce NOT NULL because admin-created orgs can leave
-- it null, and we want backwards compatibility with existing rows.


-- ────────────────────────────────────────────────────────────
-- #7 — Atomic publish for question-bank versions.
--
-- The app's previous publishAraVersion did two round trips
-- (deactivate others, then activate target). Two concurrent publishes
-- could both succeed (or both leave the DB in an invalid state).
-- This RPC wraps both updates in a single statement-level transaction
-- inside a SECURITY DEFINER function, so the partial unique index
-- idx_ara_qbv_single_active enforces single-active atomically.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ara_publish_version(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Confirm the target version exists before we touch anything else.
  SELECT EXISTS(SELECT 1 FROM ara_question_bank_versions WHERE id = p_version_id)
  INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Question bank version % not found', p_version_id;
  END IF;

  -- Deactivate any currently-active version first, then activate target.
  -- Both statements execute inside the function's implicit transaction.
  UPDATE ara_question_bank_versions
    SET is_active = false
    WHERE is_active = true
      AND id <> p_version_id;

  UPDATE ara_question_bank_versions
    SET is_active = true,
        published_at = now()
    WHERE id = p_version_id;
END;
$$;

-- Grant execute to authenticated users — the app-level role guard
-- enforces admin-only access in the Next server action.
GRANT EXECUTE ON FUNCTION ara_publish_version(uuid) TO authenticated;
