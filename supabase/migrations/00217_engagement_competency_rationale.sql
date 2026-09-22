-- Assessment Center: carry the job link into the engagement (BPS 4.4).
--
-- The JD extractor and the role profiles both produce a one-sentence link
-- between each criterion and the job it is drawn from - exactly what 4.4 asks
-- for - and the wizard dropped it on the way in, so every engagement started
-- life unable to say why it assessed what it assessed. Migration 00216 added
-- the columns; this teaches the create path to fill them.
--
-- Same signature as 00204, so CREATE OR REPLACE keeps the function's existing
-- privileges: the 00188 lockdown (service_role only, no PUBLIC) still stands
-- and is deliberately not re-issued here.

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
AS $func$
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
    INSERT INTO engagement_competencies (engagement_id, competency_id, weight, rationale, source)
    VALUES (
      v_engagement_id,
      (v_comp->>'competencyId')::uuid,
      (v_comp->>'weight')::numeric,
      NULLIF(v_comp->>'rationale', ''),
      NULLIF(v_comp->>'source', '')
    );
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
$func$;
