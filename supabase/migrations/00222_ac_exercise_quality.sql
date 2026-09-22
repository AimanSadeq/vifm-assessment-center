-- Assessment Center: is this exercise fit to assess anyone?
--
-- BPS standard:
--   4.36  exercises SHALL be checked for: content validity, face validity,
--         timings, level of complexity, benchmarks for ratings, clarity and
--         relevance of instructions, comprehensiveness of materials, and that
--         adequate and appropriate evidence can be collected for the criteria
--   4.37  exercises NEW for a centre shall be trialled, with people
--         representative of the intended participants who will not themselves
--         be participants
--   4.38  after trialling, the centre process should be piloted
--   4.24  exercise-specific examples of performance indicators should be
--         provided to help assessors classify evidence
--
-- 4.36 is unusual in the standard: it names eight distinct checks rather than
-- asking for a general judgement. So they are eight rows, not one "reviewed"
-- flag - a single tick would let seven of them go unasked, and the one most
-- often skipped (can adequate evidence actually be collected for these
-- criteria?) is the one that decides whether the exercise works at all.
--
-- An exercise lives in the library and is reused across centres, so the checks
-- belong to the exercise rather than to an engagement. A centre using an
-- unchecked exercise is told at design time.

CREATE TABLE IF NOT EXISTS ac_exercise_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  -- The eight of 4.36, by key. Not an enum: the list is versioned in code with
  -- the question each one asks (src/lib/ac/exercise-quality.ts).
  check_key   text NOT NULL,
  status      text NOT NULL CHECK (status IN ('pass', 'concern', 'not_applicable')),
  -- A pass with no note is an assertion; the note is what makes it a check.
  note        text,
  checked_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  checked_by_name text,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, check_key)
);

COMMENT ON TABLE ac_exercise_checks IS
  'The eight checks BPS 4.36 requires of every exercise, one row each. Eight rows rather than one flag, because a single tick lets seven of them go unasked.';

CREATE INDEX IF NOT EXISTS idx_ac_exercise_checks_exercise ON ac_exercise_checks(exercise_id);

DROP TRIGGER IF EXISTS ac_exercise_checks_updated_at ON ac_exercise_checks;
CREATE TRIGGER ac_exercise_checks_updated_at
  BEFORE UPDATE ON ac_exercise_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ac_exercise_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_exercise_checks_admin ON ac_exercise_checks;
CREATE POLICY ac_exercise_checks_admin ON ac_exercise_checks
  FOR ALL USING (auth_role() = 'admin');

-- Assessors read them: an assessor about to rate against an exercise is
-- entitled to know whether anyone has checked that it can produce the evidence.
DROP POLICY IF EXISTS ac_exercise_checks_assessor_select ON ac_exercise_checks;
CREATE POLICY ac_exercise_checks_assessor_select ON ac_exercise_checks
  FOR SELECT USING (auth_role() IN ('lead_assessor', 'associate_assessor'));

-- ───────────────────────── Trialling a new exercise (4.37) ────────────────────
CREATE TABLE IF NOT EXISTS ac_exercise_trials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  trialled_on   date NOT NULL,
  -- 4.37 is specific: representative of the intended participants, and NOT
  -- themselves participants. Both facts are recorded because both can fail.
  participant_count integer,
  representative_note text,
  findings      text,
  changes_made  text,
  -- 4.38: whether the centre process itself was piloted, not just the exercise.
  was_pilot     boolean NOT NULL DEFAULT false,
  recorded_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_by_name text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ac_exercise_trials IS
  'Trialling a new exercise before live use (BPS 4.37) and piloting the process (4.38). representative_note records who it was tried on, since "we tried it on the team" is not a trial.';

CREATE INDEX IF NOT EXISTS idx_ac_exercise_trials_exercise ON ac_exercise_trials(exercise_id, trialled_on DESC);

ALTER TABLE ac_exercise_trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_exercise_trials_admin ON ac_exercise_trials;
CREATE POLICY ac_exercise_trials_admin ON ac_exercise_trials
  FOR ALL USING (auth_role() = 'admin');
