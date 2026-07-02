-- ============================================================
-- Bespoke bundle candidates - one-sitting delegate flow
-- A composed bundle (bespoke_services kind='bundle', e.g. Persona +
-- Logica-inductive) runs as ONE chained sitting for an invited
-- candidate, mirroring Role Readiness: token link -> consent ->
-- each runnable service in order -> done. Each stage produces its
-- NATIVE record (Persona -> behavioral_assessment_sessions, Logica
-- -> psy_results) so every existing surface keeps working; this
-- table is the thin chain that tracks the sitting.
-- ============================================================

CREATE TABLE IF NOT EXISTS bundle_candidates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_service_id  uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  organization_id     uuid REFERENCES organizations(id) ON DELETE CASCADE,
  full_name           text NOT NULL,
  email               text NOT NULL,
  access_token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status              text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','in_progress','completed')),
  consent_at          timestamptz,
  persona_session_id  uuid,   -- behavioral_assessment_sessions.id (soft link)
  cognitive_result_id uuid,   -- psy_results.id (soft link)
  completed_at        timestamptz,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundle_candidates_service ON bundle_candidates(bespoke_service_id);
CREATE INDEX IF NOT EXISTS idx_bundle_candidates_org     ON bundle_candidates(organization_id);

DROP TRIGGER IF EXISTS bundle_candidates_updated_at ON bundle_candidates;
CREATE TRIGGER bundle_candidates_updated_at BEFORE UPDATE ON bundle_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: admin full; client_manager reads their own org's candidates; the token
-- candidate flow uses the service-role client only (mirrors rr_candidates).
ALTER TABLE bundle_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bundle_candidates_admin ON bundle_candidates;
CREATE POLICY bundle_candidates_admin ON bundle_candidates
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS bundle_candidates_cm_select ON bundle_candidates;
CREATE POLICY bundle_candidates_cm_select ON bundle_candidates
  FOR SELECT USING (auth_role() = 'client_manager' AND organization_id = cm_org_id());
