-- ════════════════════════════════════════════════════════════════
-- Standalone technical certification programs (ARA-style)
--
-- The technical assessment's commercial container for selling certification on
-- its own — independent of an AC behavioural engagement. Mirrors how ARA is
-- packaged: an organization commissions a program at a department / division /
-- enterprise tier, picks the in-scope domains, and invites participants who
-- take the assigned domain test via a token link (no account). A passing
-- CERTIFIED sitting issues the participant a technical_proficiency credential.
--
-- Distinct from migration 00056 (engagement_technical_domains), which layers the
-- same instrument onto an AC engagement for a bundled program. Both feed the
-- same tech_assessment_results / vifm_credentials.
-- ════════════════════════════════════════════════════════════════

CREATE TYPE technical_program_tier AS ENUM ('department', 'division', 'enterprise');
CREATE TYPE technical_program_status AS ENUM ('draft', 'active', 'completed', 'archived');

CREATE TABLE technical_programs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  organization_name text NOT NULL,
  tier              technical_program_tier NOT NULL DEFAULT 'department',
  status            technical_program_status NOT NULL DEFAULT 'draft',
  owner_id          uuid,                       -- admin/consultant who created it (nullable in dev)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_technical_programs_updated_at
  BEFORE UPDATE ON technical_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- In-scope domains for the program (which certifications it offers).
CREATE TABLE technical_program_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES technical_programs(id) ON DELETE CASCADE,
  domain_key text NOT NULL REFERENCES technical_domains(key) ON DELETE CASCADE,
  certified  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, domain_key)
);
CREATE INDEX idx_tech_prog_domains_prog ON technical_program_domains(program_id);

-- Participants — no account; reached via access_token (mirrors ara_respondents).
CREATE TABLE technical_program_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   uuid NOT NULL REFERENCES technical_programs(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  email        text,
  access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tech_prog_participants_prog ON technical_program_participants(program_id);

-- Bind sittings + results to a program participant (the standalone path). Both
-- nullable so the existing anonymous + AC-candidate paths are unaffected.
ALTER TABLE tech_assessment_results
  ADD COLUMN program_id     uuid REFERENCES technical_programs(id) ON DELETE SET NULL,
  ADD COLUMN participant_id uuid REFERENCES technical_program_participants(id) ON DELETE SET NULL;
ALTER TABLE tech_assessment_sessions
  ADD COLUMN program_id     uuid,
  ADD COLUMN participant_id uuid;
CREATE INDEX idx_tech_results_program ON tech_assessment_results(program_id);

-- ── RLS: admin manages; authenticated may read; participant writes go through
--    the service client (token flow), so no public policy is needed. ──
ALTER TABLE technical_programs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_program_domains      ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_program_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_programs_select_auth ON technical_programs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_programs_all_admin ON technical_programs
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY tech_prog_domains_select_auth ON technical_program_domains
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_prog_domains_all_admin ON technical_program_domains
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY tech_prog_participants_select_auth ON technical_program_participants
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_prog_participants_all_admin ON technical_program_participants
  FOR ALL USING (auth_role() = 'admin');
