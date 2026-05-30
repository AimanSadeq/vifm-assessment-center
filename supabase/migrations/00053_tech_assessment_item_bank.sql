-- ════════════════════════════════════════════════════════════════
-- VIFM Technical Assessment — SME-reviewed item bank + cut-scores (Tier 2)
--
-- Turns the technical assessment from an INDICATIVE-only signal into a
-- DEFENSIBLE proficiency certification. The credibility (not the test) is the
-- product, so a 'technical_proficiency' credential is only ever issued when:
--   1. the test was assembled entirely from SME-APPROVED bank items
--      (status='approved'), never raw, un-reviewed AI output, AND
--   2. the score cleared the domain's documented cut-score
--      (tech_assessment_cut_scores.pass_pct).
-- Below either bar the flow still runs, but stays INDICATIVE (no credential) —
-- exactly the honest line drawn in src/lib/ai/technical-assessment.ts.
--
-- Items are AI-DRAFTED then HUMAN-APPROVED: an admin/SME reviews, edits, and
-- approves each item in the review console before it can be administered for
-- certification. The answer key never leaves the server (the existing
-- sessions/00052 integrity model is unchanged).
--
-- RLS: admin-only on the bank + cut-scores (the review console is admin); the
-- candidate/taker never reads items directly — assembly is service-role.
-- ════════════════════════════════════════════════════════════════

-- ── Item bank: the SME-reviewable pool of technical items ──
CREATE TABLE tech_assessment_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key     text NOT NULL,                  -- TechDomainKey (app-validated)
  skill          text NOT NULL,                  -- one of the domain's skills
  question_en    text NOT NULL,
  question_ar    text,
  options_en     jsonb NOT NULL,                 -- string[4]
  options_ar     jsonb,                          -- string[4] | null
  correct_index  smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  difficulty     text NOT NULL DEFAULT 'medium'
                   CHECK (difficulty IN ('easy', 'medium', 'hard')),
  explanation_en text,                           -- why the key is correct (review aid + learner feedback)

  -- Review workflow ───────────────────────────────────────────
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'retired')),
  source         text NOT NULL DEFAULT 'ai_generated'
                   CHECK (source IN ('ai_generated', 'human_authored')),
  reviewed_by    uuid,                           -- admin/SME profile id (app-recorded; nullable in dev)
  reviewer_name  text,                           -- denormalized for the audit trail
  reviewed_at    timestamptz,
  review_notes   text,

  -- Light psychometrics (accumulate as the item is administered) ──
  times_administered integer NOT NULL DEFAULT 0,
  times_correct      integer NOT NULL DEFAULT 0,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tech_items_domain        ON tech_assessment_items(domain_key);
CREATE INDEX idx_tech_items_domain_status ON tech_assessment_items(domain_key, status);

-- ── Cut-scores: the documented passing standard per domain ──
-- One row per domain. pass_pct is the minimum score to certify; min_items is
-- the smallest approved-item count a certified test must draw (a defensibility
-- floor — a 3-item "test" can't certify). method/rationale capture HOW the
-- standard was set (e.g. a modified-Angoff SME panel) for the audit file.
CREATE TABLE tech_assessment_cut_scores (
  domain_key   text PRIMARY KEY,                 -- TechDomainKey
  pass_pct     numeric(5, 2) NOT NULL DEFAULT 70,
  min_items    smallint NOT NULL DEFAULT 8 CHECK (min_items >= 1),
  method       text,                             -- e.g. "Modified Angoff, 3-SME panel"
  rationale    text,
  set_by       uuid,
  set_by_name  text,
  set_at       timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Traceability on results: was this a certified run, and did it certify? ──
ALTER TABLE tech_assessment_results
  ADD COLUMN IF NOT EXISTS certified        boolean NOT NULL DEFAULT false, -- drawn entirely from approved bank items
  ADD COLUMN IF NOT EXISTS passed_cut       boolean,                        -- score_pct >= cut-score (null = not a certified run)
  ADD COLUMN IF NOT EXISTS cut_pct          numeric(5, 2),                  -- the cut-score in force at scoring time
  ADD COLUMN IF NOT EXISTS credential_code  uuid;                           -- issued technical_proficiency credential, if any

-- updated_at touch triggers (re-uses the shared helper from earlier migrations)
CREATE TRIGGER trg_tech_items_updated_at
  BEFORE UPDATE ON tech_assessment_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tech_cut_scores_updated_at
  BEFORE UPDATE ON tech_assessment_cut_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Widen the credential type whitelist (00049) to admit the new type ──
-- The CHECK in 00049 enumerated only academy_completion / ac_ready_now /
-- fluent_cefr, so an INSERT of a technical_proficiency credential would be
-- rejected at the DB. Re-create the constraint to include it.
ALTER TABLE vifm_credentials DROP CONSTRAINT IF EXISTS vifm_credentials_credential_type_check;
ALTER TABLE vifm_credentials ADD CONSTRAINT vifm_credentials_credential_type_check
  CHECK (credential_type IN ('academy_completion', 'ac_ready_now', 'fluent_cefr', 'technical_proficiency'));

-- ── RLS: admin-all on both; takers never touch the bank (service-role assembly) ──
ALTER TABLE tech_assessment_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_assessment_cut_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_items_admin_all ON tech_assessment_items
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY tech_cut_scores_admin_all ON tech_assessment_cut_scores
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
