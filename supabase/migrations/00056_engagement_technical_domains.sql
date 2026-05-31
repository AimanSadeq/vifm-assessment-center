-- ════════════════════════════════════════════════════════════════
-- Engagement → technical certification program
--
-- The paid, organizational layer for the technical assessment: an AC engagement
-- can declare which technical domains are IN SCOPE for its certification program.
-- The engagement's candidates are then assigned those domain tests (bound to
-- candidate_id/engagement_id), and a passing CERTIFIED sitting issues the
-- technical_proficiency credential — so a client can certify their own staff.
--
-- Just the scope link lives here; results + credentials already exist on
-- tech_assessment_results / vifm_credentials, keyed by candidate_id+engagement_id.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE engagement_technical_domains (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  domain_key    text NOT NULL REFERENCES technical_domains(key) ON DELETE CASCADE,
  -- whether this domain's program aims to certify (vs. an indicative benchmark).
  certified     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, domain_key)
);
CREATE INDEX idx_eng_tech_domains_eng ON engagement_technical_domains(engagement_id);

-- RLS: admin manages; authenticated users may read (the admin panel reads via the
-- service client, so dev with auth off still works; this policy covers prod).
ALTER TABLE engagement_technical_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY eng_tech_domains_select_auth ON engagement_technical_domains
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY eng_tech_domains_all_admin ON engagement_technical_domains
  FOR ALL USING (auth_role() = 'admin');
