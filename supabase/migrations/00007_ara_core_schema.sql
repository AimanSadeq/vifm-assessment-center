-- ============================================================
-- VIFM ARA — Core Schema
-- Migration 00007: All ara_* tables, indexes, triggers, RLS
--
-- Non-breaking: every table prefixed 'ara_'. No existing
-- tables modified. All tables ship with RLS enabled.
--
-- Respondent access (token-based) is NOT enforced here via RLS —
-- it will be enforced through service-role API routes at M3.
-- RLS here locks respondent tables to admin + assessment's
-- consultant owner; anonymous respondent reads use server-side
-- token validation.
-- ============================================================

-- Helper function ara_is_assessment_owner(uuid) is defined later
-- in this migration, after the ara_assessments table exists.


-- ────────────────────────────────────────────────────────────
-- GROUP 1: Client Organizations & Assessments
-- ────────────────────────────────────────────────────────────

CREATE TABLE ara_organizations (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                         text NOT NULL,
  name_ar                      text,
  sector                       ara_sector NOT NULL,
  region                       ara_region NOT NULL,
  data_erasure_requested       boolean NOT NULL DEFAULT false,
  data_erasure_requested_at    timestamptz,
  data_anonymized              boolean NOT NULL DEFAULT false,
  data_anonymized_at           timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ara_orgs_region ON ara_organizations(region);
CREATE INDEX idx_ara_orgs_sector ON ara_organizations(sector);


CREATE TABLE ara_question_bank_versions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number          text NOT NULL UNIQUE,
  version_label           text,
  published_at            timestamptz,
  published_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active               boolean NOT NULL DEFAULT false,
  release_notes           text,
  supersedes_version_id   uuid REFERENCES ara_question_bank_versions(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Only one version may be active at a time — enforced by partial unique index
CREATE UNIQUE INDEX idx_ara_qbv_single_active
  ON ara_question_bank_versions((is_active)) WHERE is_active = true;


CREATE TABLE ara_assessments (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            uuid REFERENCES ara_organizations(id) ON DELETE CASCADE,
  consultant_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  region                     ara_region NOT NULL,
  sector                     ara_sector NOT NULL,
  default_language           ara_language NOT NULL DEFAULT 'en',
  status                     ara_assessment_status NOT NULL DEFAULT 'draft',
  phase                      ara_assessment_phase NOT NULL DEFAULT 'phase1',
  is_sandbox                 boolean NOT NULL DEFAULT false,
  question_bank_version_id   uuid REFERENCES ara_question_bank_versions(id) ON DELETE SET NULL,
  pillar_weights             jsonb NOT NULL DEFAULT '{
    "strategy": 12.5,
    "data": 12.5,
    "technology": 12.5,
    "talent": 12.5,
    "culture": 12.5,
    "governance": 12.5,
    "operations": 12.5,
    "model_management": 12.5
  }'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  completed_at               timestamptz,
  frozen_at                  timestamptz,
  archived_at                timestamptz,
  scheduled_deletion_date    date GENERATED ALWAYS AS (
    (archived_at + INTERVAL '3 years')::date
  ) STORED,
  assessment_year            integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())
);

CREATE INDEX idx_ara_assessments_org ON ara_assessments(organization_id);
CREATE INDEX idx_ara_assessments_consultant ON ara_assessments(consultant_id);
CREATE INDEX idx_ara_assessments_status ON ara_assessments(status);
CREATE INDEX idx_ara_assessments_sandbox ON ara_assessments(is_sandbox);

CREATE TRIGGER ara_assessments_updated_at
  BEFORE UPDATE ON ara_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- GROUP 2: Respondents & Pillar Assignments
-- ────────────────────────────────────────────────────────────

CREATE TABLE ara_respondents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id          uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  name_ar                text,
  email                  text NOT NULL,
  role_key               text,
  role_label_en          text,
  role_label_ar          text,
  access_token           text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  language_preference    ara_language NOT NULL DEFAULT 'en',
  invited_at             timestamptz,
  first_opened_at        timestamptz,
  last_active_at         timestamptz,
  completed_at           timestamptz,
  reminder_count         integer NOT NULL DEFAULT 0,
  last_reminder_sent_at  timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ara_respondents_assessment ON ara_respondents(assessment_id);
CREATE INDEX idx_ara_respondents_token ON ara_respondents(access_token);
CREATE INDEX idx_ara_respondents_email ON ara_respondents(email);


CREATE TABLE ara_respondent_pillar_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id  uuid NOT NULL REFERENCES ara_respondents(id) ON DELETE CASCADE,
  pillar_id      text NOT NULL,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (respondent_id, pillar_id)
);

CREATE INDEX idx_ara_rpa_respondent ON ara_respondent_pillar_assignments(respondent_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 3: Question Bank & Responses
-- ────────────────────────────────────────────────────────────

CREATE TABLE ara_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id        uuid NOT NULL REFERENCES ara_question_bank_versions(id) ON DELETE CASCADE,
  pillar_id         text NOT NULL,
  question_number   integer NOT NULL,
  question_text_en  text NOT NULL,
  question_text_ar  text NOT NULL,
  question_type     ara_question_type NOT NULL,
  options_en        jsonb,
  options_ar        jsonb,
  score_map         jsonb,
  help_text_en      text,
  help_text_ar      text,
  region            text NOT NULL DEFAULT 'both'
    CHECK (region IN ('uae', 'saudi', 'both')),
  sector            text NOT NULL DEFAULT 'all'
    CHECK (sector IN ('government', 'banking', 'general', 'all')),
  layer             integer NOT NULL DEFAULT 1 CHECK (layer IN (1, 2)),
  display_order     integer NOT NULL DEFAULT 0,
  valid_from        timestamptz NOT NULL DEFAULT now(),
  valid_until       timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ara_questions_version ON ara_questions(version_id);
CREATE INDEX idx_ara_questions_pillar ON ara_questions(pillar_id);
CREATE INDEX idx_ara_questions_layer ON ara_questions(layer);
CREATE INDEX idx_ara_questions_region ON ara_questions(region);
CREATE INDEX idx_ara_questions_sector ON ara_questions(sector);


CREATE TABLE ara_responses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  respondent_id       uuid NOT NULL REFERENCES ara_respondents(id) ON DELETE CASCADE,
  question_id         uuid NOT NULL REFERENCES ara_questions(id) ON DELETE CASCADE,
  answer_value        text,
  answer_text         text,
  question_score      numeric(4, 2),
  needs_verification  boolean NOT NULL DEFAULT false,
  verified_at         timestamptz,
  answered_at         timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (respondent_id, question_id)
);

CREATE INDEX idx_ara_responses_assessment ON ara_responses(assessment_id);
CREATE INDEX idx_ara_responses_respondent ON ara_responses(respondent_id);
CREATE INDEX idx_ara_responses_question ON ara_responses(question_id);

CREATE TRIGGER ara_responses_updated_at
  BEFORE UPDATE ON ara_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- GROUP 4: Scoring
-- ────────────────────────────────────────────────────────────

CREATE TABLE ara_pillar_scores (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id                uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  pillar_id                    text NOT NULL,
  raw_score                    numeric(4, 2),
  weighted_score               numeric(4, 2),
  pillar_weight                numeric(5, 2) NOT NULL DEFAULT 12.5,
  maturity_level               integer CHECK (maturity_level BETWEEN 1 AND 5),
  maturity_label_en            text,
  maturity_label_ar            text,
  self_assessment_score        numeric(4, 2),
  consultant_validated_score   numeric(4, 2),
  perception_gap               numeric(4, 2),
  benchmark_gap                numeric(4, 2),
  calculated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, pillar_id)
);

CREATE INDEX idx_ara_pscores_assessment ON ara_pillar_scores(assessment_id);


CREATE TABLE ara_assessment_scores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id      uuid NOT NULL UNIQUE REFERENCES ara_assessments(id) ON DELETE CASCADE,
  overall_score      numeric(4, 2),
  overall_label_en   text,
  overall_label_ar   text,
  score_frozen_at    timestamptz,
  calculated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ara_ascores_assessment ON ara_assessment_scores(assessment_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 5: Consultant Notes, Reports, Supporting Materials
-- ────────────────────────────────────────────────────────────

CREATE TABLE ara_consultant_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  pillar_id           text,
  note_text           text NOT NULL,
  include_in_report   boolean NOT NULL DEFAULT false,
  note_language       ara_language NOT NULL DEFAULT 'en',
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ara_cnotes_assessment ON ara_consultant_notes(assessment_id);
CREATE INDEX idx_ara_cnotes_pillar ON ara_consultant_notes(pillar_id);

CREATE TRIGGER ara_consultant_notes_updated_at
  BEFORE UPDATE ON ara_consultant_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE ara_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  language          ara_report_language NOT NULL DEFAULT 'bilingual',
  file_url          text,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  generated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version           integer NOT NULL DEFAULT 1,
  scores_snapshot   jsonb
);

CREATE INDEX idx_ara_reports_assessment ON ara_reports(assessment_id);


CREATE TABLE ara_supporting_materials (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id          uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  respondent_id          uuid REFERENCES ara_respondents(id) ON DELETE SET NULL,
  material_type          ara_material_type NOT NULL,
  material_name          text NOT NULL,
  file_url               text,
  file_name              text,
  file_size_bytes        bigint,
  link_url               text,
  uploaded_at            timestamptz NOT NULL DEFAULT now(),
  consultant_reviewed    boolean NOT NULL DEFAULT false,
  consultant_notes       text,
  consultant_reviewed_at timestamptz,
  reviewed_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claude_analysis        jsonb,
  -- Type/URL/file integrity: URL type must have link_url; file types must have file_url
  CHECK (
    (material_type = 'url' AND link_url IS NOT NULL AND file_url IS NULL)
    OR (material_type IN ('word', 'pdf', 'powerpoint') AND file_url IS NOT NULL AND link_url IS NULL)
  )
);

CREATE INDEX idx_ara_smat_assessment ON ara_supporting_materials(assessment_id);
CREATE INDEX idx_ara_smat_respondent ON ara_supporting_materials(respondent_id);


-- ────────────────────────────────────────────────────────────
-- GROUP 6: Regulatory Frameworks & Compliance
-- ────────────────────────────────────────────────────────────

CREATE TABLE ara_regulatory_frameworks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region                ara_region NOT NULL,
  framework_code        text NOT NULL UNIQUE,
  framework_name_en     text NOT NULL,
  framework_name_ar     text NOT NULL,
  authority_name_en     text,
  authority_name_ar     text,
  framework_category    ara_framework_category NOT NULL,
  tier                  integer NOT NULL CHECK (tier IN (1, 2, 3)),
  is_mandatory          boolean NOT NULL DEFAULT true,
  applies_to_sectors    jsonb NOT NULL DEFAULT '["all"]'::jsonb,
  description_en        text,
  description_ar        text,
  official_url          text,
  display_order         integer NOT NULL DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_ara_rfw_region ON ara_regulatory_frameworks(region);
CREATE INDEX idx_ara_rfw_category ON ara_regulatory_frameworks(framework_category);


CREATE TABLE ara_regulatory_requirements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id          uuid NOT NULL REFERENCES ara_regulatory_frameworks(id) ON DELETE CASCADE,
  requirement_code      text NOT NULL UNIQUE,
  requirement_text_en   text NOT NULL,
  requirement_text_ar   text NOT NULL,
  requirement_category  text,
  pillar_id             text,
  applies_to_sectors    jsonb NOT NULL DEFAULT '["all"]'::jsonb,
  severity              ara_severity NOT NULL DEFAULT 'mandatory',
  display_order         integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_ara_rreq_framework ON ara_regulatory_requirements(framework_id);
CREATE INDEX idx_ara_rreq_pillar ON ara_regulatory_requirements(pillar_id);


CREATE TABLE ara_compliance_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       uuid NOT NULL REFERENCES ara_assessments(id) ON DELETE CASCADE,
  requirement_id      uuid NOT NULL REFERENCES ara_regulatory_requirements(id) ON DELETE CASCADE,
  status              ara_compliance_status NOT NULL DEFAULT 'unknown',
  compliance_score    numeric(3, 2),
  status_label_en     text,
  status_label_ar     text,
  evidence_note       text,
  source_question_ids jsonb,
  evaluated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, requirement_id)
);

CREATE INDEX idx_ara_cres_assessment ON ara_compliance_results(assessment_id);


CREATE TABLE ara_regulatory_documents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region                  text NOT NULL CHECK (region IN ('uae', 'saudi', 'global')),
  document_name_en        text NOT NULL,
  document_name_ar        text,
  authority_name_en       text,
  authority_name_ar       text,
  framework_category      text,
  tier                    integer CHECK (tier IN (1, 2, 3)),
  publication_date        date,
  file_path               text,
  file_name               text,
  uploaded_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at             timestamptz NOT NULL DEFAULT now(),
  processing_status       ara_document_processing_status NOT NULL DEFAULT 'pending',
  is_active               boolean NOT NULL DEFAULT true,
  version_number          integer NOT NULL DEFAULT 1,
  supersedes_document_id  uuid REFERENCES ara_regulatory_documents(id) ON DELETE SET NULL,
  notes                   text
);


-- ────────────────────────────────────────────────────────────
-- GROUP 7: Logs
-- ────────────────────────────────────────────────────────────

CREATE TABLE ara_email_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id         uuid REFERENCES ara_respondents(id) ON DELETE SET NULL,
  assessment_id         uuid REFERENCES ara_assessments(id) ON DELETE SET NULL,
  email_type            text NOT NULL,
  recipient_email       text NOT NULL,
  language              ara_language,
  is_sandbox_redirect   boolean NOT NULL DEFAULT false,
  sent_at               timestamptz NOT NULL DEFAULT now(),
  status                text NOT NULL DEFAULT 'sent'
);

CREATE INDEX idx_ara_email_assessment ON ara_email_log(assessment_id);


CREATE TABLE ara_data_management_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action         text NOT NULL,
  target_table   text NOT NULL,
  target_id      uuid NOT NULL,
  performed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at   timestamptz NOT NULL DEFAULT now(),
  reason         text,
  client_request boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_ara_dmlog_target ON ara_data_management_log(target_table, target_id);


-- ────────────────────────────────────────────────────────────
-- Helper: is current user a consultant who owns this assessment
-- (defined after ara_assessments table exists, so SQL-language
-- function validation succeeds)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ara_is_assessment_owner(assessment_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM ara_assessments a
    WHERE a.id = assessment_uuid
      AND a.consultant_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ────────────────────────────────────────────────────────────
-- ENABLE RLS ON ALL TABLES
-- ────────────────────────────────────────────────────────────

ALTER TABLE ara_organizations                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_question_bank_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_assessments                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_respondents                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_respondent_pillar_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_questions                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_responses                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_pillar_scores                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_assessment_scores               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_consultant_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_reports                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_supporting_materials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_regulatory_frameworks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_regulatory_requirements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_compliance_results              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_regulatory_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_email_log                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_data_management_log             ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- RLS POLICIES
--
-- Principle:
--   admin                     → full access (reuses existing auth_role())
--   consultant                → read/write their own assessments and children
--   regulatory reference data → readable by admin + consultant
--   respondent token access   → enforced by server API routes using
--                               service-role key + token validation,
--                               not by RLS policies
-- ────────────────────────────────────────────────────────────

-- ──── ara_organizations ──────────────────────────────────────
CREATE POLICY ara_orgs_admin_all ON ara_organizations
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_orgs_consultant_read ON ara_organizations
  FOR SELECT USING (auth_role() = 'consultant');

CREATE POLICY ara_orgs_consultant_insert ON ara_organizations
  FOR INSERT WITH CHECK (auth_role() = 'consultant');


-- ──── ara_question_bank_versions ─────────────────────────────
CREATE POLICY ara_qbv_admin_all ON ara_question_bank_versions
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_qbv_consultant_read ON ara_question_bank_versions
  FOR SELECT USING (auth_role() = 'consultant');


-- ──── ara_assessments ────────────────────────────────────────
CREATE POLICY ara_assess_admin_all ON ara_assessments
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_assess_consultant_own ON ara_assessments
  FOR ALL USING (
    auth_role() = 'consultant' AND consultant_id = auth.uid()
  ) WITH CHECK (
    auth_role() = 'consultant' AND consultant_id = auth.uid()
  );


-- ──── ara_respondents ────────────────────────────────────────
CREATE POLICY ara_resp_admin_all ON ara_respondents
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_resp_consultant_own ON ara_respondents
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── ara_respondent_pillar_assignments ──────────────────────
CREATE POLICY ara_rpa_admin_all ON ara_respondent_pillar_assignments
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_rpa_consultant_own ON ara_respondent_pillar_assignments
  FOR ALL USING (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM ara_respondents r
      WHERE r.id = respondent_id
        AND ara_is_assessment_owner(r.assessment_id)
    )
  ) WITH CHECK (
    auth_role() = 'consultant'
    AND EXISTS (
      SELECT 1 FROM ara_respondents r
      WHERE r.id = respondent_id
        AND ara_is_assessment_owner(r.assessment_id)
    )
  );


-- ──── ara_questions (read for admin + consultant; write admin only) ──
CREATE POLICY ara_q_admin_all ON ara_questions
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_q_consultant_read ON ara_questions
  FOR SELECT USING (auth_role() = 'consultant');


-- ──── ara_responses ──────────────────────────────────────────
CREATE POLICY ara_resp_answers_admin_all ON ara_responses
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_resp_answers_consultant_own ON ara_responses
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── ara_pillar_scores ──────────────────────────────────────
CREATE POLICY ara_pscores_admin_all ON ara_pillar_scores
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_pscores_consultant_own ON ara_pillar_scores
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── ara_assessment_scores ──────────────────────────────────
CREATE POLICY ara_ascores_admin_all ON ara_assessment_scores
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_ascores_consultant_own ON ara_assessment_scores
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── ara_consultant_notes ───────────────────────────────────
CREATE POLICY ara_cnotes_admin_all ON ara_consultant_notes
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_cnotes_consultant_own ON ara_consultant_notes
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── ara_reports ────────────────────────────────────────────
CREATE POLICY ara_reports_admin_all ON ara_reports
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_reports_consultant_own ON ara_reports
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── ara_supporting_materials ───────────────────────────────
CREATE POLICY ara_smat_admin_all ON ara_supporting_materials
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_smat_consultant_own ON ara_supporting_materials
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── Regulatory reference data (global read for admin + consultant) ──
CREATE POLICY ara_rfw_admin_all ON ara_regulatory_frameworks
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_rfw_read ON ara_regulatory_frameworks
  FOR SELECT USING (auth_role() IN ('admin', 'consultant'));

CREATE POLICY ara_rreq_admin_all ON ara_regulatory_requirements
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_rreq_read ON ara_regulatory_requirements
  FOR SELECT USING (auth_role() IN ('admin', 'consultant'));


-- ──── ara_compliance_results ─────────────────────────────────
CREATE POLICY ara_cres_admin_all ON ara_compliance_results
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_cres_consultant_own ON ara_compliance_results
  FOR ALL USING (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  ) WITH CHECK (
    auth_role() = 'consultant' AND ara_is_assessment_owner(assessment_id)
  );


-- ──── ara_regulatory_documents ───────────────────────────────
CREATE POLICY ara_rdocs_admin_all ON ara_regulatory_documents
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_rdocs_consultant_read ON ara_regulatory_documents
  FOR SELECT USING (auth_role() = 'consultant');


-- ──── ara_email_log ──────────────────────────────────────────
CREATE POLICY ara_email_admin_all ON ara_email_log
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY ara_email_consultant_own ON ara_email_log
  FOR SELECT USING (
    auth_role() = 'consultant'
    AND (
      assessment_id IS NULL
      OR ara_is_assessment_owner(assessment_id)
    )
  );


-- ──── ara_data_management_log ────────────────────────────────
CREATE POLICY ara_dmlog_admin_all ON ara_data_management_log
  FOR ALL USING (auth_role() = 'admin');
