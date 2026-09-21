-- Assessment Center: record what a centre is FOR.
--
-- The BPS Division of Occupational Psychology standard for assessment centres
-- requires the purpose of a centre to be defined (clause 3.7) and the data
-- integration approach to follow from it (clause 7.4: an arithmetic rule is
-- required wherever the centre supports selection decisions, where consensus
-- discussion is the weaker method). Until now an engagement recorded a target
-- role but never said whether it was selecting, developing or planning
-- succession, so nothing downstream could behave differently.
--
-- Nullable on purpose: existing engagements were run without the question being
-- asked, and back-filling a guess would be a false record. Null reads as "not
-- recorded"; the wizard requires a purpose for every new engagement.

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS purpose text
    CHECK (purpose IN ('selection', 'development', 'succession'));

COMMENT ON COLUMN engagements.purpose IS
  'What the centre is for: selection (hiring or promotion decisions), development (growth, with feedback owed to the participant), or succession. Drives the integration rule and the feedback duties. Null = pre-dates the field.';

CREATE INDEX IF NOT EXISTS idx_engagements_purpose ON engagements(purpose);

-- The create path is the SECURITY DEFINER RPC from 00005, locked to service_role
-- in 00188. Adding a parameter would leave two overloads and PostgREST cannot
-- choose between them, so drop the old signature and recreate it.
DROP FUNCTION IF EXISTS create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb);

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
  p_matrix jsonb DEFAULT '[]',
  p_purpose text DEFAULT NULL
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
  INSERT INTO engagements (organization_id, name, target_role, status, start_date, end_date, created_by, purpose)
  VALUES (p_organization_id, p_name, p_target_role, p_status::engagement_status, p_start_date, p_end_date,
          p_created_by, p_purpose)
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

-- Same lockdown as 00188: no implicit PUBLIC grant, service_role only.
REVOKE ALL ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb, text)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb, text)
      FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb, text)
      FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION create_engagement_atomic(uuid, text, text, text, date, date, uuid, jsonb, uuid[], jsonb, text)
      TO service_role;
  END IF;
END
$$;
