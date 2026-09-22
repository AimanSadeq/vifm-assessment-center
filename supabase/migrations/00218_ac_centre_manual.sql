-- Assessment Center: the centre manual, who has a copy, and readiness.
--
-- BPS standard:
--   4.39  a centre manual shall be produced containing ALL documentation
--         relating to the centre, including procedures and briefing materials
--   4.40  operational manuals compiled from the relevant contents should be
--         produced for each of the centre's operational roles
--   4.41  a process shall be designed for the SECURE maintenance and
--         DISTRIBUTION of all manuals
--   5.25  a checklist of the materials required shall be prepared: manuals,
--         participant materials, assessor materials, role-player materials,
--         stationery, technology, and anything needed for agreed adjustments
--   5.33  briefing documentation shall be prepared for all personnel in each
--         role, with security measures where it includes confidential material
--   6.3   the Centre Manager shall confirm venue, equipment and documentation
--         are ready before the centre commences
--   6.9   the Centre Manager shall maintain the security of assessment
--         materials and participant records throughout delivery
--
-- The manual itself is GENERATED from the design (src/lib/ac/centre-manual.ts),
-- like the centre plan, so it cannot describe a centre other than the one that
-- will run. What the database has to hold is the part a document cannot: which
-- version went to whom, and whether anyone has confirmed the centre is ready.
--
-- 4.41 is the reason this table exists at all. A manual contains exercise
-- briefs, role-player prompts and assessor guidance; a copy in the wrong hands
-- compromises every future use of those exercises. "Secure distribution" with
-- no record of distribution is not secure, it is just quiet.

CREATE TABLE IF NOT EXISTS ac_manual_issues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  -- Which manual: a centre role key, or 'full' for the complete manual.
  variant       text NOT NULL,
  -- The design can change after a manual is issued, so the version it was cut
  -- from is recorded with it. A recipient holding version 2 of a centre now on
  -- version 3 is a fact worth being able to see.
  version       integer NOT NULL DEFAULT 1,
  issued_to     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issued_to_name  text NOT NULL,
  issued_to_email text,
  -- True when that variant contains exercise content, role-player prompts or
  -- assessor guidance - the material whose exposure would compromise reuse.
  confidential  boolean NOT NULL DEFAULT true,
  issued_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issued_by_name text,
  issued_at     timestamptz NOT NULL DEFAULT now(),
  -- Recorded when a copy is confirmed destroyed or returned after the centre
  -- (6.9's "accounting of all assessment materials").
  returned_at   timestamptz,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_manual_issues IS
  'Who was given which centre manual, cut from which version (BPS 4.41, 5.33, 6.9). Secure distribution with no record of distribution is not secure.';

CREATE INDEX IF NOT EXISTS idx_ac_manual_issues_engagement ON ac_manual_issues(engagement_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_manual_issues_outstanding ON ac_manual_issues(engagement_id) WHERE returned_at IS NULL;

ALTER TABLE ac_manual_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_manual_issues_admin ON ac_manual_issues;
CREATE POLICY ac_manual_issues_admin ON ac_manual_issues
  FOR ALL USING (auth_role() = 'admin');

-- You can see what you were given. Not who else holds a copy - that is the
-- centre manager's business, and a list of everyone holding exercise material
-- is itself worth keeping narrow.
DROP POLICY IF EXISTS ac_manual_issues_own ON ac_manual_issues;
CREATE POLICY ac_manual_issues_own ON ac_manual_issues
  FOR SELECT USING (issued_to = auth.uid());

ALTER TABLE engagements
  -- Bumped whenever the design changes in a way that invalidates copies
  -- already out. Starts at 1 so an un-versioned centre still reads sensibly.
  ADD COLUMN IF NOT EXISTS manual_version integer NOT NULL DEFAULT 1,
  -- 6.3: the Centre Manager's confirmation, before the day, that the venue,
  -- the equipment and the documentation are actually ready.
  ADD COLUMN IF NOT EXISTS readiness_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS readiness_confirmed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS readiness_confirmed_name text,
  ADD COLUMN IF NOT EXISTS readiness_note text;

COMMENT ON COLUMN engagements.manual_version IS
  'Incremented when the design changes after manuals have been issued, so a recipient holding an older cut can be identified (BPS 4.41).';
COMMENT ON COLUMN engagements.readiness_confirmed_at IS
  'When the Centre Manager confirmed venue, equipment and documentation were ready (BPS 6.3).';
