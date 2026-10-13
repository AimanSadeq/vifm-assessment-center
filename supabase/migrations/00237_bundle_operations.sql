-- ============================================================
-- 00237 - Bespoke bundle operations (Ali's recommendations, 13 Oct 2026):
--   1. "Scored" after "Completed": set when a candidate's report is first
--      generated (scored_at).
--   2. A per-bundle "complete by" date shown to candidates, a follow-up
--      threshold, and an opt-in switch for invitation / reminder emails.
--   3. A contact log per roster person: every resend, reminder and manual
--      chase, so follow-up is visible.
--   4. Report filing: each generated report PDF is kept in a private bucket,
--      foldered by company / assessment / candidate.
-- ADDITIVE and idempotent. Nothing changes for a bundle until it is used.
-- ============================================================

-- 1. Scored status ------------------------------------------------------------
ALTER TABLE bundle_candidates DROP CONSTRAINT IF EXISTS bundle_candidates_status_check;
ALTER TABLE bundle_candidates ADD CONSTRAINT bundle_candidates_status_check
  CHECK (status IN ('invited','in_progress','completed','scored'));
ALTER TABLE bundle_candidates ADD COLUMN IF NOT EXISTS scored_at timestamptz;

-- 2. Deadline, follow-up threshold, email switch ------------------------------
ALTER TABLE bundle_settings ADD COLUMN IF NOT EXISTS complete_by timestamptz;
ALTER TABLE bundle_settings ADD COLUMN IF NOT EXISTS followup_days int NOT NULL DEFAULT 2;
ALTER TABLE bundle_settings DROP CONSTRAINT IF EXISTS bundle_settings_followup_days_check;
ALTER TABLE bundle_settings ADD CONSTRAINT bundle_settings_followup_days_check CHECK (followup_days BETWEEN 1 AND 30);
-- Off by default: a client's IT may only have approved the platform's web
-- address, not mail from it.
ALTER TABLE bundle_settings ADD COLUMN IF NOT EXISTS emails_enabled boolean NOT NULL DEFAULT false;

-- 3. Contact log --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bundle_contact_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_service_id  uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  roster_id           uuid REFERENCES bundle_roster(id) ON DELETE CASCADE,
  bundle_candidate_id uuid REFERENCES bundle_candidates(id) ON DELETE CASCADE,
  email_norm          text NOT NULL,
  kind                text NOT NULL CHECK (kind IN ('email_invite','email_reminder','manual')),
  channel             text CHECK (channel IS NULL OR channel IN ('email','phone','whatsapp','in_person','client','other')),
  note                text CHECK (note IS NULL OR length(note) <= 500),
  ok                  boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundle_contact_log_service ON bundle_contact_log(bespoke_service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bundle_contact_log_roster ON bundle_contact_log(roster_id);

-- 4. Filed reports ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bundle_report_files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_service_id  uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  bundle_candidate_id uuid NOT NULL REFERENCES bundle_candidates(id) ON DELETE CASCADE,
  organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,
  kind                text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]{1,39}$'),
  storage_path        text NOT NULL,
  file_name           text NOT NULL,
  size_bytes          int,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- One filed copy per candidate and report kind; regenerating replaces it.
  CONSTRAINT bundle_report_files_unique UNIQUE (bundle_candidate_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_bundle_report_files_service ON bundle_report_files(bespoke_service_id);
CREATE INDEX IF NOT EXISTS idx_bundle_report_files_org ON bundle_report_files(organization_id);

-- Private bucket: service-role uploads, signed URLs for staff downloads.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('bundle-reports', 'bundle-reports', false)
  ON CONFLICT (id) DO NOTHING;

-- RLS: admin full; a client_manager reads their own organisation's rows.
-- The app reads and writes with the service-role client.
ALTER TABLE bundle_contact_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_report_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bundle_contact_log_admin ON bundle_contact_log;
CREATE POLICY bundle_contact_log_admin ON bundle_contact_log
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS bundle_report_files_admin ON bundle_report_files;
CREATE POLICY bundle_report_files_admin ON bundle_report_files
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS bundle_report_files_cm_select ON bundle_report_files;
CREATE POLICY bundle_report_files_cm_select ON bundle_report_files
  FOR SELECT USING (auth_role() = 'client_manager' AND organization_id = cm_org_id());
