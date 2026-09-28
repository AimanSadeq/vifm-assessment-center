-- ════════════════════════════════════════════════════════════════
-- B19 - rating anchors (BPS "Design and Delivery of Assessment Centres").
--
-- 4.31 (mandatory): descriptive anchors for at least two points of the rating
--   scale, so every assessor reads a score the same way; a fully defined BARS
--   where possible. Until now the 1-5 scale was generic - the same words for
--   every competency. competency_scale_anchors holds what a 1..5 looks like
--   FOR THIS competency (all five points = a full BARS).
-- 4.24 (recommended): exercise-specific examples of the indicators, to help
--   assessors classify evidence. exercise_indicator_examples holds what good
--   and poor look like for a competency IN a given exercise.
--
-- Both carry the same SME review fields as behavioral_indicators (00203), so
-- the review workbooks and importer treat them alike. AI drafts start as
-- 'pending' and are shown to assessors marked as drafts until approved.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competency_scale_anchors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id     uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  scale_point       smallint NOT NULL CHECK (scale_point BETWEEN 1 AND 5),
  anchor_en         text NOT NULL,
  anchor_ar         text,
  source            text NOT NULL DEFAULT 'ai_draft' CHECK (source IN ('ai_draft', 'sme', 'manual')),
  sme_status        text NOT NULL DEFAULT 'pending' CHECK (sme_status IN ('pending', 'approved', 'rejected')),
  sme_reviewer_name text,
  sme_reviewed_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competency_id, scale_point)
);
CREATE INDEX IF NOT EXISTS idx_scale_anchors_competency ON competency_scale_anchors (competency_id);

CREATE TABLE IF NOT EXISTS exercise_indicator_examples (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id       uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  competency_id     uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  polarity          text NOT NULL CHECK (polarity IN ('positive', 'negative')),
  example_en        text NOT NULL,
  example_ar        text,
  sort_order        smallint NOT NULL DEFAULT 0,
  source            text NOT NULL DEFAULT 'ai_draft' CHECK (source IN ('ai_draft', 'sme', 'manual')),
  sme_status        text NOT NULL DEFAULT 'pending' CHECK (sme_status IN ('pending', 'approved', 'rejected')),
  sme_reviewer_name text,
  sme_reviewed_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercise_examples_pair ON exercise_indicator_examples (exercise_id, competency_id);

-- Same access as behavioral_indicators: framework content any signed-in
-- user may read (assessors need it on the rating screen); admins manage it.
ALTER TABLE competency_scale_anchors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scale_anchors_select_auth ON competency_scale_anchors;
CREATE POLICY scale_anchors_select_auth ON competency_scale_anchors FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS scale_anchors_all_admin ON competency_scale_anchors;
CREATE POLICY scale_anchors_all_admin ON competency_scale_anchors FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

ALTER TABLE exercise_indicator_examples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exercise_examples_select_auth ON exercise_indicator_examples;
CREATE POLICY exercise_examples_select_auth ON exercise_indicator_examples FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS exercise_examples_all_admin ON exercise_indicator_examples;
CREATE POLICY exercise_examples_all_admin ON exercise_indicator_examples FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

NOTIFY pgrst, 'reload schema';
