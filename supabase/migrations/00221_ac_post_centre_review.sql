-- Assessment Center: what we learned from running it, and consistency across a
-- series of centres.
--
-- BPS standard:
--   9.1   after the centre, learning points shall be collated - what went well
--         and what did not, covering the assessment process AND participant
--         perceptions, acceptability, and use of the outcomes
--   9.2   ALL centre personnel shall be asked for their feedback, and it shall
--         be collated and consulted when designing future centres
--   9.3   participants should be asked for their evaluation of the centre
--   9.4   where IT delivers exercises, its fitness for purpose should be reviewed
--   9.12  quantitative results should feed the final evaluation
--   9.13  the recommendations SHALL inform decisions about the design
--   5.19  where there is a series of centres, there shall be a clear process to
--         assure consistency across them
--
-- The platform ended at the report. Whatever was learned from running a centre
-- lived in the heads of whoever ran it, so the second centre repeated the first
-- centre's mistakes and nobody could show a client that the third one had been
-- improved by either. 9.13 is the clause that makes this matter: the
-- recommendations SHALL inform the design, which is impossible if they were
-- never written down.

-- ───────────────────────── The review of a centre ─────────────────────────────
CREATE TABLE IF NOT EXISTS ac_centre_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  -- 9.1 asks for both sides. Kept apart so "what went well" cannot quietly
  -- become the whole review, which is what happens when there is one box.
  went_well     text,
  did_not       text,
  -- 9.1: participant perceptions and acceptability, which are not the same as
  -- whether the process ran smoothly.
  participant_perceptions text,
  -- 9.4: the technology, where it delivered exercises.
  it_review     text,
  -- 9.13: what should change, and whether it was acted on. A recommendation
  -- with no decision beside it is the failure mode of every review document.
  recommendations text,
  design_changes  text,
  completed_at  timestamptz,
  completed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_name text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id)
);

COMMENT ON TABLE ac_centre_reviews IS
  'The post-centre review (BPS 9.1-9.4, 9.12, 9.13). Recommendations sit beside what was actually changed, because 9.13 requires them to inform the design rather than be filed.';

ALTER TABLE ac_centre_reviews ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS ac_centre_reviews_updated_at ON ac_centre_reviews;
CREATE TRIGGER ac_centre_reviews_updated_at
  BEFORE UPDATE ON ac_centre_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS ac_centre_reviews_admin ON ac_centre_reviews;
CREATE POLICY ac_centre_reviews_admin ON ac_centre_reviews
  FOR ALL USING (auth_role() = 'admin');

-- ─────────────── What the people who worked it thought (9.2, 9.3) ─────────────
CREATE TABLE IF NOT EXISTS ac_centre_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  -- 9.2 covers everyone who worked the centre; 9.3 adds participants. Their
  -- views answer different questions and are kept distinguishable.
  source        text NOT NULL CHECK (source IN ('staff', 'participant')),
  profile_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  candidate_id  uuid REFERENCES candidates(id) ON DELETE CASCADE,
  author_name   text,
  role_key      text,
  went_well     text,
  could_improve text,
  -- A simple 1-5 on how the centre felt to be in. Optional: a number without a
  -- comment is thin, and a comment without a number is still useful.
  rating        integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_centre_feedback IS
  'What centre staff (BPS 9.2) and participants (9.3) said about the centre itself, as distinct from the assessment of anyone.';

CREATE INDEX IF NOT EXISTS idx_ac_centre_feedback_engagement ON ac_centre_feedback(engagement_id, source);

ALTER TABLE ac_centre_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_centre_feedback_admin ON ac_centre_feedback;
CREATE POLICY ac_centre_feedback_admin ON ac_centre_feedback
  FOR ALL USING (auth_role() = 'admin');

-- Staff and participants may add their own, and read back what they wrote.
-- Deliberately not each other's: a staff member reading a participant's view of
-- them, or the reverse, changes what either writes.
DROP POLICY IF EXISTS ac_centre_feedback_own_insert ON ac_centre_feedback;
CREATE POLICY ac_centre_feedback_own_insert ON ac_centre_feedback
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_centre_feedback.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ac_centre_feedback_own_select ON ac_centre_feedback;
CREATE POLICY ac_centre_feedback_own_select ON ac_centre_feedback
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = ac_centre_feedback.candidate_id
        AND c.profile_id = auth.uid()
    )
  );

-- ─────────────────── A series of centres run the same way (5.19) ──────────────
-- prior_engagement_id already links a re-engagement to the centre it came from
-- (migration 00020), so a series is discoverable without new structure. What is
-- missing is the deliberate statement that these centres are one series and
-- meant to be comparable.
ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS series_name text,
  ADD COLUMN IF NOT EXISTS series_note text;

COMMENT ON COLUMN engagements.series_name IS
  'Names a set of centres intended to run to the same design, so drift between them can be checked (BPS 5.19). Results are only comparable within a series.';

CREATE INDEX IF NOT EXISTS idx_engagements_series ON engagements(series_name) WHERE series_name IS NOT NULL;
