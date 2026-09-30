-- Assessment Center: validity evidence (BPS 3.10, 3.20, 9.6-9.11).
--
-- BPS standard:
--   3.10  evidence-based approach; clients get documentation supporting validity
--   3.20  clients encouraged to agree post-centre procedures: validation
--         studies, applicant reaction studies, business-outcome evaluation
--   9.6   the long-term evaluation plan shall be carried out
--   9.8   an ongoing series is evaluated at least annually; a major review
--         every three to five years or on substantial change
--   9.9   evaluation addresses reliability, validity, diversity, participant
--         impact and utility
--   9.10  quantitative work only where the number of participants gives it
--         power (about 100 for a validation study)
--
-- Today Caliber can show reliability (assessor agreement), fairness (adverse
-- impact) and participant reactions, but it holds NO evidence that a centre's
-- ratings relate to later performance, because nothing ever asks the client
-- how an appointee actually did. Three additions:
--
--   engagements.evaluation_plan   what was agreed with the client (3.20): which
--                                 studies, and what triggers the evaluation
--   ac_outcome_followups          the criterion measure: for each rated
--                                 participant, whether the decision was made,
--                                 and a manager's performance rating six and
--                                 twelve months on. This is the data a validity
--                                 study is made of, and it can only be collected
--                                 as time passes, so the structure has to exist
--                                 before the centres run.
--   ac_evaluations                the evaluation record itself (9.6, 9.8): per
--                                 engagement or per series, what was found under
--                                 each of the five 9.9 headings, who did it, and
--                                 when the next one is due.
--
-- Validity itself is computed, never stored: a correlation is only as good as
-- the follow-ups behind it on the day it is read, and a stored number would
-- outlive its evidence.

-- ─────────────────── 3.20  the evaluation plan ───────────────────
ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS evaluation_plan jsonb;

COMMENT ON COLUMN engagements.evaluation_plan IS
  'What was agreed with the client for after the centre (BPS 3.20): {validation, reaction, utility: boolean; trigger: "participants" | "date"; trigger_participants: int; trigger_date: date; criterion: text; note: text}. Null until agreed.';

-- ─────────────────── the criterion measure ───────────────────
CREATE TABLE IF NOT EXISTS ac_outcome_followups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id   uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  -- Which follow-up this is. Six and twelve months are the house schedule;
  -- 'custom' is for a client whose review cycle falls elsewhere.
  wave           text NOT NULL CHECK (wave IN ('6m', '12m', 'custom')),
  due_on         date NOT NULL,
  status         text NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'collected', 'not_available')),
  -- Whether the person was appointed, promoted or moved into the role the
  -- centre assessed for. A validity study needs the people who were, and the
  -- ones who were not are the range-restriction caveat.
  in_role        boolean,
  -- The criterion: the line manager's rating of performance in the role, on the
  -- same 1-5 scale the centre used, so the two can be compared without a
  -- conversion. rating_basis says what the manager looked at.
  performance_rating smallint CHECK (performance_rating IS NULL OR (performance_rating BETWEEN 1 AND 5)),
  rating_basis   text,
  rater_name     text,
  rater_role     text,
  collected_at   timestamptz,
  collected_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, wave)
);

COMMENT ON TABLE ac_outcome_followups IS
  'Post-centre outcome follow-ups (BPS 3.20, 9.9 validity): per rated participant, whether they went into the role and how a manager rates their performance 6 and 12 months on. The raw material of a criterion validity study; collected by VIFM from the client, never by the participant.';

CREATE INDEX IF NOT EXISTS idx_ac_outcome_followups_engagement ON ac_outcome_followups(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ac_outcome_followups_due ON ac_outcome_followups(status, due_on);

ALTER TABLE ac_outcome_followups ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS ac_outcome_followups_updated_at ON ac_outcome_followups;
CREATE TRIGGER ac_outcome_followups_updated_at
  BEFORE UPDATE ON ac_outcome_followups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admin only. A follow-up carries a manager's judgement of a named person; it
-- is not for the participant, and it reaches the client only as part of the
-- aggregate evidence pack.
DROP POLICY IF EXISTS ac_outcome_followups_admin ON ac_outcome_followups;
CREATE POLICY ac_outcome_followups_admin ON ac_outcome_followups
  FOR ALL USING (auth_role() = 'admin');

-- ─────────────────── the evaluation record (9.6, 9.8) ───────────────────
CREATE TABLE IF NOT EXISTS ac_evaluations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One of the two: an evaluation of a single centre, or of a named series
  -- (9.8 speaks of an ongoing series).
  engagement_id   uuid REFERENCES engagements(id) ON DELETE CASCADE,
  series_name     text,
  kind            text NOT NULL CHECK (kind IN ('annual', 'major', 'ad_hoc')),
  period_start    date,
  period_end      date,
  participants    integer,
  -- The five headings of 9.9, each a short written finding. Numbers that can be
  -- computed (agreement, adverse impact, criterion correlation) are computed at
  -- read time and printed beside these; the text is the evaluator's reading.
  reliability     text,
  validity        text,
  diversity       text,
  participant_impact text,
  utility         text,
  recommendations text,
  conducted_by_name text NOT NULL,
  conducted_at    date NOT NULL,
  next_due_on     date,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (engagement_id IS NOT NULL OR series_name IS NOT NULL)
);

COMMENT ON TABLE ac_evaluations IS
  'The evaluation record the standard requires (BPS 9.6, 9.8, 9.9): per centre or per series, findings under reliability, validity, diversity, participant impact and utility, who conducted it and when the next is due.';

CREATE INDEX IF NOT EXISTS idx_ac_evaluations_engagement ON ac_evaluations(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ac_evaluations_series ON ac_evaluations(series_name);

ALTER TABLE ac_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ac_evaluations_admin ON ac_evaluations;
CREATE POLICY ac_evaluations_admin ON ac_evaluations
  FOR ALL USING (auth_role() = 'admin');
