-- 00196: HiPo Engagement pillar - manager-rated mini-survey per bundle candidate.
-- Spec: docs/hipo-engagement-pillar-spec.md. One rater (the line manager), six
-- 1-5 Likert items (item 4 reverse-keyed), optional unscored context note.
-- Token-gated (no account) like Reflect raters: the unguessable access_token is
-- the sole credential and all reads/writes on that path go through the service
-- role. Feeds a third "Engagement - will they stay?" gauge on the HiPo report.

CREATE TABLE IF NOT EXISTS hipo_engagement_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_candidate_id uuid NOT NULL REFERENCES bundle_candidates(id) ON DELETE CASCADE,
  manager_name text NOT NULL,
  manager_email text NOT NULL,
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- {itemKey: 1..5}; scored server-side (reverse-keying applied in app code).
  answers jsonb,
  -- Optional manager free text. Consultant/admin-visible only - never rendered
  -- in the client PDF (spec section 6).
  context_note text,
  -- Mean of answered items on the shared 1-5 scale (min 5 of 6 answered).
  score numeric(3,2),
  invited_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hipo_eng_candidate ON hipo_engagement_surveys(bundle_candidate_id);

ALTER TABLE hipo_engagement_surveys ENABLE ROW LEVEL SECURITY;

-- Admin full access.
CREATE POLICY hipo_eng_admin_all ON hipo_engagement_surveys
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- Client managers can SEE their own org's surveys (mirrors bundle_candidates
-- 00172). No client-side INSERT/UPDATE - invites + submissions go through
-- service-role server actions after app-level gating.
CREATE POLICY hipo_eng_cm_select ON hipo_engagement_surveys
  FOR SELECT USING (
    auth_role() = 'client_manager' AND EXISTS (
      SELECT 1 FROM bundle_candidates bc
      WHERE bc.id = bundle_candidate_id AND bc.organization_id = cm_org_id()
    )
  );

COMMENT ON TABLE hipo_engagement_surveys IS
  'HiPo third pillar: line-manager engagement mini-survey (6 Likert items, token-gated, single-use). Score feeds the Engagement gauge on the High-Potential Profile.';
