-- ============================================================
-- AC core review - lock down create_engagement_atomic (finding #2)
--
-- 00005 created create_engagement_atomic as SECURITY DEFINER but never
-- restricted EXECUTE. A new function defaults to EXECUTE granted to PUBLIC, so
-- anon + authenticated (i.e. anyone holding the public NEXT_PUBLIC_SUPABASE_ANON_KEY
-- that ships to every browser) could POST /rest/v1/rpc/create_engagement_atomic
-- and, because SECURITY DEFINER runs as the owner and bypasses RLS, create an
-- engagement + competencies + exercises + matrix against ANY organization id.
--
-- The application does NOT call this RPC (createEngagementAction does its inserts
-- directly), so revoking public EXECUTE has ZERO blast radius on the app while
-- closing the privilege-escalation surface. Also pin search_path (SECURITY DEFINER
-- hardening) so the function cannot be hijacked via a mutable search_path.
-- ============================================================

-- Recreate identically but with a fixed search_path (body unchanged from 00005).
CREATE OR REPLACE FUNCTION create_engagement_atomic(
  p_organization_id uuid,
  p_name text,
  p_target_role text DEFAULT NULL,
  p_status text DEFAULT 'draft',
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_competencies jsonb DEFAULT '[]',
  p_exercises uuid[] DEFAULT '{}',
  p_matrix jsonb DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_engagement_id uuid;
  v_comp jsonb;
  v_mat jsonb;
  v_ex_id uuid;
BEGIN
  -- 1. Insert engagement
  INSERT INTO engagements (organization_id, name, target_role, status, start_date, end_date, created_by)
  VALUES (p_organization_id, p_name, p_target_role, p_status::engagement_status, p_start_date, p_end_date, p_created_by)
  RETURNING id INTO v_engagement_id;

  -- 2. Insert engagement_competencies
  FOR v_comp IN SELECT * FROM jsonb_array_elements(p_competencies)
  LOOP
    INSERT INTO engagement_competencies (engagement_id, competency_id, weight)
    VALUES (v_engagement_id, (v_comp->>'competencyId')::uuid, (v_comp->>'weight')::numeric);
  END LOOP;

  -- 3. Insert engagement_exercises
  FOREACH v_ex_id IN ARRAY p_exercises
  LOOP
    INSERT INTO engagement_exercises (engagement_id, exercise_id)
    VALUES (v_engagement_id, v_ex_id);
  END LOOP;

  -- 4. Insert exercise_competency_matrix
  FOR v_mat IN SELECT * FROM jsonb_array_elements(p_matrix)
  LOOP
    INSERT INTO exercise_competency_matrix (engagement_id, exercise_id, competency_id)
    VALUES (v_engagement_id, (v_mat->>'exerciseId')::uuid, (v_mat->>'competencyId')::uuid);
  END LOOP;

  RETURN v_engagement_id;
END;
$$;

-- Remove the implicit PUBLIC grant (this alone closes the anon/authenticated hole,
-- since those roles hold EXECUTE only via the implicit PUBLIC grant).
REVOKE ALL ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb) FROM PUBLIC;

-- Explicit defense-in-depth for the Supabase-managed roles + grant to service_role.
-- Guarded on role existence so a replay against a vanilla Postgres (local db reset /
-- CI) that hasn't provisioned these roles does not abort the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb) TO service_role';
  END IF;
END $$;
