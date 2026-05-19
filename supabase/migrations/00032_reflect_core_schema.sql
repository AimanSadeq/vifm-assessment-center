-- ============================================================
-- VIFM Reflect (360° Leadership Feedback) - Core Schema
-- Migration 00032: All reflect_* tables, indexes, triggers, RLS
--
-- Non-breaking: every table prefixed 'reflect_'. No existing
-- AC or ARA table is modified. All tables ship with RLS
-- enabled.
--
-- Rater access (token-based) is NOT enforced here via RLS -
-- it is enforced through service-role API routes at M3.
-- RLS here locks rater + response tables to admin + the
-- engagement's consultant owner; anonymous rater reads go
-- through the API layer.
--
-- Reuses from ARA where the concept is identical:
--   - ara_organizations    (clients are the same entities)
--   - ara_region, ara_sector, ara_language, ara_report_language
--   - update_updated_at()  trigger function
--   - auth_role()          helper function
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- GROUP 1: Engagements & Frameworks
-- ────────────────────────────────────────────────────────────

CREATE TABLE reflect_engagements (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid REFERENCES ara_organizations(id) ON DELETE SET NULL,
  consultant_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                     text NOT NULL,
  region                   ara_region,
  sector                   ara_sector,
  status                   reflect_engagement_status NOT NULL DEFAULT 'draft',
  default_language         ara_language NOT NULL DEFAULT 'en',
  report_language          ara_report_language NOT NULL DEFAULT 'bilingual',
  scale_type               reflect_scale_type NOT NULL DEFAULT 'frequency_5pt',
  -- Min raters per rater_role group before peer/direct_report
  -- scores are revealed in reports. Default 3 = industry standard;
  -- consultant can override per engagement.
  anonymity_min_n          integer NOT NULL DEFAULT 3 CHECK (anonymity_min_n >= 1),
  -- Soft target population. Doesn't constrain participants count
  -- but feeds dashboards + quote ops.
  participant_target_count integer,
  field_window_start       date,
  field_window_end         date,
  is_sandbox               boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  launched_at              timestamptz,
  closed_at                timestamptz,
  archived_at              timestamptz
);

CREATE INDEX idx_reflect_engagements_org ON reflect_engagements(organization_id);
CREATE INDEX idx_reflect_engagements_consultant ON reflect_engagements(consultant_id);
CREATE INDEX idx_reflect_engagements_status ON reflect_engagements(status);
CREATE INDEX idx_reflect_engagements_sandbox ON reflect_engagements(is_sandbox);

CREATE TRIGGER reflect_engagements_updated_at
  BEFORE UPDATE ON reflect_engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE reflect_frameworks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Library templates have engagement_id IS NULL and is_template = true.
  -- Engagement frameworks have engagement_id NOT NULL and is_template = false.
  engagement_id   uuid REFERENCES reflect_engagements(id) ON DELETE CASCADE,
  name_en         text NOT NULL,
  name_ar         text,
  description_en  text,
  description_ar  text,
  source          reflect_framework_source NOT NULL DEFAULT 'custom',
  is_template     boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  approved_at     timestamptz,
  approved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reflect_framework_template_or_engagement CHECK (
    (is_template = true  AND engagement_id IS NULL)
    OR (is_template = false AND engagement_id IS NOT NULL)
  )
);

CREATE INDEX idx_reflect_frameworks_engagement ON reflect_frameworks(engagement_id);
CREATE INDEX idx_reflect_frameworks_template ON reflect_frameworks(is_template) WHERE is_template = true;

CREATE TRIGGER reflect_frameworks_updated_at
  BEFORE UPDATE ON reflect_frameworks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE reflect_competencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    uuid NOT NULL REFERENCES reflect_frameworks(id) ON DELETE CASCADE,
  name_en         text NOT NULL,
  name_ar         text,
  description_en  text,
  description_ar  text,
  display_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reflect_competencies_framework ON reflect_competencies(framework_id);


CREATE TABLE reflect_behaviors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id   uuid NOT NULL REFERENCES reflect_competencies(id) ON DELETE CASCADE,
  level_tier      reflect_level_tier NOT NULL DEFAULT 'all',
  text_en         text NOT NULL,
  text_ar         text,
  source          reflect_behavior_source NOT NULL DEFAULT 'manual',
  ai_rationale    text,
  display_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reflect_behaviors_competency ON reflect_behaviors(competency_id);
CREATE INDEX idx_reflect_behaviors_tier ON reflect_behaviors(level_tier);


-- ────────────────────────────────────────────────────────────
-- GROUP 2: Participants & Raters
-- ────────────────────────────────────────────────────────────

CREATE TABLE reflect_participants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id         uuid NOT NULL REFERENCES reflect_engagements(id) ON DELETE CASCADE,
  full_name             text NOT NULL,
  full_name_ar          text,
  email                 text NOT NULL,
  role_title            text,
  business_unit         text,
  level_tier            reflect_level_tier NOT NULL DEFAULT 'manager',
  manager_email         text,
  language_preference   ara_language NOT NULL DEFAULT 'en',
  status                reflect_participant_status NOT NULL DEFAULT 'invited',
  -- Lightweight debrief ops: status flag + scheduled date.
  -- Outlook stays the system of record for the calendar invite.
  debrief_status        reflect_debrief_status NOT NULL DEFAULT 'not_scheduled',
  debrief_scheduled_at  timestamptz,
  debrief_completed_at  timestamptz,
  assigned_coach_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reflect_participants_engagement ON reflect_participants(engagement_id);
CREATE INDEX idx_reflect_participants_email ON reflect_participants(email);
CREATE INDEX idx_reflect_participants_status ON reflect_participants(status);
CREATE INDEX idx_reflect_participants_debrief ON reflect_participants(debrief_status);
CREATE INDEX idx_reflect_participants_coach ON reflect_participants(assigned_coach_id);

CREATE TRIGGER reflect_participants_updated_at
  BEFORE UPDATE ON reflect_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE reflect_raters (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id      uuid NOT NULL REFERENCES reflect_participants(id) ON DELETE CASCADE,
  rater_role          reflect_rater_role NOT NULL,
  full_name           text NOT NULL,
  email               text NOT NULL,
  language_preference ara_language NOT NULL DEFAULT 'en',
  access_token        text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status              reflect_rater_status NOT NULL DEFAULT 'pending',
  invited_at          timestamptz,
  first_opened_at     timestamptz,
  last_active_at      timestamptz,
  completed_at        timestamptz,
  reminder_count      integer NOT NULL DEFAULT 0,
  last_reminder_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reflect_raters_participant ON reflect_raters(participant_id);
CREATE INDEX idx_reflect_raters_token ON reflect_raters(access_token);
CREATE INDEX idx_reflect_raters_role ON reflect_raters(rater_role);
CREATE INDEX idx_reflect_raters_status ON reflect_raters(status);
-- Self ratings should be one per participant. Other rater roles can
-- repeat (multiple peers, multiple direct reports). The partial unique
-- index enforces the self-uniqueness without constraining the rest.
CREATE UNIQUE INDEX idx_reflect_raters_one_self_per_participant
  ON reflect_raters(participant_id) WHERE rater_role = 'self';


-- ────────────────────────────────────────────────────────────
-- GROUP 3: Responses
-- ────────────────────────────────────────────────────────────

CREATE TABLE reflect_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id      uuid NOT NULL REFERENCES reflect_raters(id) ON DELETE CASCADE,
  behavior_id   uuid NOT NULL REFERENCES reflect_behaviors(id) ON DELETE CASCADE,
  score         smallint CHECK (score IS NULL OR score BETWEEN 1 AND 5),
  is_na         boolean NOT NULL DEFAULT false,
  comment_text  text,
  answered_at   timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, behavior_id),
  -- N/A means no score; a real score means is_na is false.
  CHECK ((is_na = true AND score IS NULL) OR (is_na = false))
);

CREATE INDEX idx_reflect_responses_rater ON reflect_responses(rater_id);
CREATE INDEX idx_reflect_responses_behavior ON reflect_responses(behavior_id);

CREATE TRIGGER reflect_responses_updated_at
  BEFORE UPDATE ON reflect_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- GROUP 4: IDPs (Individual Development Plans)
-- ────────────────────────────────────────────────────────────

CREATE TABLE reflect_idps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id      uuid NOT NULL UNIQUE REFERENCES reflect_participants(id) ON DELETE CASCADE,
  top_priorities      jsonb,   -- [{competency_id, behaviors[], why}]
  action_plan         jsonb,   -- [{action, owner, deadline, support}]
  success_measures    text,
  target_review_date  date,
  status              reflect_idp_status NOT NULL DEFAULT 'draft',
  signed_off_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reflect_idps_status ON reflect_idps(status);

CREATE TRIGGER reflect_idps_updated_at
  BEFORE UPDATE ON reflect_idps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- GROUP 5: Reports
-- ────────────────────────────────────────────────────────────

CREATE TABLE reflect_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   uuid NOT NULL REFERENCES reflect_engagements(id) ON DELETE CASCADE,
  participant_id  uuid REFERENCES reflect_participants(id) ON DELETE CASCADE,
  -- participant_id NULL => engagement-level cohort report
  report_kind     text NOT NULL CHECK (report_kind IN ('participant', 'cohort')),
  language        ara_report_language NOT NULL DEFAULT 'bilingual',
  file_url        text,
  scores_snapshot jsonb,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  generated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version         integer NOT NULL DEFAULT 1
);

CREATE INDEX idx_reflect_reports_engagement ON reflect_reports(engagement_id);
CREATE INDEX idx_reflect_reports_participant ON reflect_reports(participant_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 6: Logs (email + audit)
-- ────────────────────────────────────────────────────────────

CREATE TABLE reflect_email_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id       uuid REFERENCES reflect_engagements(id) ON DELETE SET NULL,
  participant_id      uuid REFERENCES reflect_participants(id) ON DELETE SET NULL,
  rater_id            uuid REFERENCES reflect_raters(id) ON DELETE SET NULL,
  email_type          text NOT NULL,
  recipient_email     text NOT NULL,
  language            ara_language,
  is_sandbox_redirect boolean NOT NULL DEFAULT false,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'sent'
);

CREATE INDEX idx_reflect_email_engagement ON reflect_email_log(engagement_id);
CREATE INDEX idx_reflect_email_participant ON reflect_email_log(participant_id);
CREATE INDEX idx_reflect_email_rater ON reflect_email_log(rater_id);


CREATE TABLE reflect_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action       text NOT NULL,
  target_table text NOT NULL,
  target_id    uuid NOT NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb
);

CREATE INDEX idx_reflect_audit_target ON reflect_audit_log(target_table, target_id);


-- ────────────────────────────────────────────────────────────
-- Helper: is current user a consultant who owns this engagement
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reflect_is_engagement_owner(engagement_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM reflect_engagements e
    WHERE e.id = engagement_uuid
      AND e.consultant_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- Convenience: derive engagement ownership through a participant
CREATE OR REPLACE FUNCTION reflect_participant_owner_engagement(participant_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM reflect_participants p
    JOIN reflect_engagements e ON e.id = p.engagement_id
    WHERE p.id = participant_uuid
      AND e.consultant_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ────────────────────────────────────────────────────────────
-- ENABLE RLS on every table
-- ────────────────────────────────────────────────────────────

ALTER TABLE reflect_engagements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_frameworks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_competencies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_behaviors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_raters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_idps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_email_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflect_audit_log     ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- RLS POLICIES
--
-- Principle:
--   admin      -> full access (reuses existing auth_role())
--   consultant -> read/write their own engagements and children
--   rater      -> token-based access enforced by server API
--                 routes using the service-role key + token
--                 validation (no RLS rule here)
-- ────────────────────────────────────────────────────────────

-- ──── reflect_engagements ───────────────────────────────────
CREATE POLICY reflect_eng_admin_all ON reflect_engagements
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_eng_consultant_own ON reflect_engagements
  FOR ALL USING (
    auth_role() = 'consultant' AND consultant_id = auth.uid()
  ) WITH CHECK (
    auth_role() = 'consultant' AND consultant_id = auth.uid()
  );


-- ──── reflect_frameworks ────────────────────────────────────
-- Templates (engagement_id IS NULL) are global reference data,
-- readable by both admin and consultant. Engagement-bound
-- frameworks scope to the engagement owner.
CREATE POLICY reflect_fw_admin_all ON reflect_frameworks
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_fw_consultant_read_templates ON reflect_frameworks
  FOR SELECT USING (
    auth_role() = 'consultant' AND is_template = true
  );

CREATE POLICY reflect_fw_consultant_own_engagement ON reflect_frameworks
  FOR ALL USING (
    auth_role() = 'consultant'
    AND engagement_id IS NOT NULL
    AND reflect_is_engagement_owner(engagement_id)
  ) WITH CHECK (
    auth_role() = 'consultant'
    AND engagement_id IS NOT NULL
    AND reflect_is_engagement_owner(engagement_id)
  );


-- ──── reflect_competencies ──────────────────────────────────
CREATE POLICY reflect_comp_admin_all ON reflect_competencies
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_comp_consultant_read_templates ON reflect_competencies
  FOR SELECT USING (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM reflect_frameworks f
      WHERE f.id = framework_id AND f.is_template = true
    )
  );

CREATE POLICY reflect_comp_consultant_own ON reflect_competencies
  FOR ALL USING (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM reflect_frameworks f
      WHERE f.id = framework_id
        AND f.engagement_id IS NOT NULL
        AND reflect_is_engagement_owner(f.engagement_id)
    )
  ) WITH CHECK (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM reflect_frameworks f
      WHERE f.id = framework_id
        AND f.engagement_id IS NOT NULL
        AND reflect_is_engagement_owner(f.engagement_id)
    )
  );


-- ──── reflect_behaviors ─────────────────────────────────────
CREATE POLICY reflect_beh_admin_all ON reflect_behaviors
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_beh_consultant_read_templates ON reflect_behaviors
  FOR SELECT USING (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM reflect_competencies c
      JOIN reflect_frameworks f ON f.id = c.framework_id
      WHERE c.id = competency_id AND f.is_template = true
    )
  );

CREATE POLICY reflect_beh_consultant_own ON reflect_behaviors
  FOR ALL USING (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM reflect_competencies c
      JOIN reflect_frameworks f ON f.id = c.framework_id
      WHERE c.id = competency_id
        AND f.engagement_id IS NOT NULL
        AND reflect_is_engagement_owner(f.engagement_id)
    )
  ) WITH CHECK (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM reflect_competencies c
      JOIN reflect_frameworks f ON f.id = c.framework_id
      WHERE c.id = competency_id
        AND f.engagement_id IS NOT NULL
        AND reflect_is_engagement_owner(f.engagement_id)
    )
  );


-- ──── reflect_participants ──────────────────────────────────
CREATE POLICY reflect_part_admin_all ON reflect_participants
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_part_consultant_own ON reflect_participants
  FOR ALL USING (
    auth_role() = 'consultant' AND reflect_is_engagement_owner(engagement_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND reflect_is_engagement_owner(engagement_id)
  );


-- ──── reflect_raters ────────────────────────────────────────
CREATE POLICY reflect_raters_admin_all ON reflect_raters
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_raters_consultant_own ON reflect_raters
  FOR ALL USING (
    auth_role() = 'consultant' AND reflect_participant_owner_engagement(participant_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND reflect_participant_owner_engagement(participant_id)
  );


-- ──── reflect_responses ─────────────────────────────────────
-- Raters write responses via server API routes using the
-- service-role key, which bypasses RLS. So RLS here is purely
-- for admin + consultant read access to scored data.
CREATE POLICY reflect_resp_admin_all ON reflect_responses
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_resp_consultant_own ON reflect_responses
  FOR SELECT USING (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM reflect_raters r
      WHERE r.id = rater_id
        AND reflect_participant_owner_engagement(r.participant_id)
    )
  );


-- ──── reflect_idps ──────────────────────────────────────────
CREATE POLICY reflect_idp_admin_all ON reflect_idps
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_idp_consultant_own ON reflect_idps
  FOR ALL USING (
    auth_role() = 'consultant' AND reflect_participant_owner_engagement(participant_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND reflect_participant_owner_engagement(participant_id)
  );


-- ──── reflect_reports ───────────────────────────────────────
CREATE POLICY reflect_rpt_admin_all ON reflect_reports
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_rpt_consultant_own ON reflect_reports
  FOR ALL USING (
    auth_role() = 'consultant' AND reflect_is_engagement_owner(engagement_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND reflect_is_engagement_owner(engagement_id)
  );


-- ──── reflect_email_log ─────────────────────────────────────
CREATE POLICY reflect_email_admin_all ON reflect_email_log
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY reflect_email_consultant_read_own ON reflect_email_log
  FOR SELECT USING (
    auth_role() = 'consultant'
    AND (
      engagement_id IS NULL
      OR reflect_is_engagement_owner(engagement_id)
    )
  );


-- ──── reflect_audit_log ─────────────────────────────────────
CREATE POLICY reflect_audit_admin_all ON reflect_audit_log
  FOR ALL USING (auth_role() = 'admin');
