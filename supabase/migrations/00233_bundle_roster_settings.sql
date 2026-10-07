-- ============================================================
-- 00233 - Bespoke bundle: roster-gated shared link, invitation hold,
-- welcome message + demographic fields, per-bundle reasoning timer.
--
-- Built for the SDC HiPo assessment (one shared link in the client's
-- announcement, but only the 50 approved people may sit, once each),
-- and kept generic so any bundle can switch it on. ADDITIVE: a bundle
-- with no bundle_settings row behaves exactly as before (open, no
-- roster, default copy, global Logica timer).
--
--   bundle_settings  one row per bundle: roster_required, held (closed
--                    until released), welcome_message, demographic_fields,
--                    logica_minutes.
--   bundle_roster    the approved people for a bundle. UNIQUE(bundle,
--                    email_norm) is what enforces one sitting per person;
--                    bundle_candidate_id is set when the person starts.
--                    is_tester lets pilot testers sit while the bundle is held.
--   bundle_candidates gains demographics (+ timestamp) and
--                    cognitive_session_id (the open reasoning session, so a
--                    reload resumes it instead of minting a fresh test).
-- Idempotent / re-runnable.
-- ============================================================

CREATE TABLE IF NOT EXISTS bundle_settings (
  bespoke_service_id  uuid PRIMARY KEY REFERENCES bespoke_services(id) ON DELETE CASCADE,
  roster_required     boolean NOT NULL DEFAULT false,
  held                boolean NOT NULL DEFAULT false,
  released_at         timestamptz,
  released_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  welcome_message     text,
  demographic_fields  jsonb NOT NULL DEFAULT '[]'::jsonb,
  logica_minutes      int CHECK (logica_minutes IS NULL OR logica_minutes BETWEEN 1 AND 600),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS bundle_settings_updated_at ON bundle_settings;
CREATE TRIGGER bundle_settings_updated_at BEFORE UPDATE ON bundle_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS bundle_roster (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_service_id  uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  email_norm          text NOT NULL CHECK (email_norm = lower(btrim(email_norm)) AND email_norm <> ''),
  full_name           text NOT NULL,
  grade               int,
  position            text,
  business_unit       text,
  employee_id         text,
  is_tester           boolean NOT NULL DEFAULT false,
  extra               jsonb NOT NULL DEFAULT '{}'::jsonb,
  bundle_candidate_id uuid REFERENCES bundle_candidates(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bundle_roster_one_per_email UNIQUE (bespoke_service_id, email_norm)
);
CREATE INDEX IF NOT EXISTS idx_bundle_roster_service ON bundle_roster(bespoke_service_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_roster_candidate ON bundle_roster(bundle_candidate_id) WHERE bundle_candidate_id IS NOT NULL;

DROP TRIGGER IF EXISTS bundle_roster_updated_at ON bundle_roster;
CREATE TRIGGER bundle_roster_updated_at BEFORE UPDATE ON bundle_roster
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bundle_candidates ADD COLUMN IF NOT EXISTS demographics jsonb;
ALTER TABLE bundle_candidates ADD COLUMN IF NOT EXISTS demographics_at timestamptz;
ALTER TABLE bundle_candidates ADD COLUMN IF NOT EXISTS cognitive_session_id uuid REFERENCES psy_sessions(id) ON DELETE SET NULL;

-- RLS: admin full; a client_manager reads the rows of their own org's bundles.
-- The public candidate flow uses the service-role client only.
ALTER TABLE bundle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bundle_settings_admin ON bundle_settings;
CREATE POLICY bundle_settings_admin ON bundle_settings
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS bundle_settings_cm_select ON bundle_settings;
CREATE POLICY bundle_settings_cm_select ON bundle_settings
  FOR SELECT USING (auth_role() = 'client_manager' AND EXISTS (
    SELECT 1 FROM bespoke_services s WHERE s.id = bundle_settings.bespoke_service_id AND s.organization_id = cm_org_id()));

DROP POLICY IF EXISTS bundle_roster_admin ON bundle_roster;
CREATE POLICY bundle_roster_admin ON bundle_roster
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS bundle_roster_cm_select ON bundle_roster;
CREATE POLICY bundle_roster_cm_select ON bundle_roster
  FOR SELECT USING (auth_role() = 'client_manager' AND EXISTS (
    SELECT 1 FROM bespoke_services s WHERE s.id = bundle_roster.bespoke_service_id AND s.organization_id = cm_org_id()));
