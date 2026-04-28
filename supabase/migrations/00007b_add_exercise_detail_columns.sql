-- Add exercise detail columns (these were added via Supabase Dashboard SQL Editor
-- but need a migration for reproducibility and deployment)

-- Exercise timing and briefing fields
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS prep_minutes integer;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS meeting_minutes integer;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_minutes integer;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS participant_brief text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS scenario_context text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS assessor_notes text;

-- Role player prompt detail fields
ALTER TABLE role_player_prompts ADD COLUMN IF NOT EXISTS character_name text;
ALTER TABLE role_player_prompts ADD COLUMN IF NOT EXISTS character_role text;
ALTER TABLE role_player_prompts ADD COLUMN IF NOT EXISTS character_attitude text;
ALTER TABLE role_player_prompts ADD COLUMN IF NOT EXISTS meeting_objectives text;

-- Add UNIQUE constraint on integration_worksheets to prevent duplicates
-- (Fixes the race condition identified in the assessor audit)
-- Wrapped in DO block because Postgres doesn't support
-- `ADD CONSTRAINT ... IF NOT EXISTS` — needed for idempotent re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'integration_worksheets_unique'
  ) THEN
    ALTER TABLE integration_worksheets
      ADD CONSTRAINT integration_worksheets_unique
      UNIQUE (engagement_id, assessor_id, candidate_id, competency_id);
  END IF;
END $$;
