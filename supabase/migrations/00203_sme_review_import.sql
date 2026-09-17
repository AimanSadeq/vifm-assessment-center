-- SME review import: status columns for the banks that lacked them, and an
-- immutable log of every decision loaded back from a returned SME workbook.
--
-- The SME validation workbooks go out with each item's primary key in a grey
-- "Item ID (do not edit)" column. scripts/sme-import/sme_import.py reads a
-- returned workbook, previews the changes against the live bank, and on
-- approval writes them. Five banks already carry a review status
-- (tech_assessment_items, persona_items, psy_items, ara_questions,
-- eng_fluent_items). Three did not, so an SME approval had nowhere to live:
--
--   behavioral_indicators  - Assessment Center rating anchors + development tips
--   reflect_behaviors      - Reflect 360 behaviour statements
--   rr_technical_items     - Role Readiness technical items
--
-- sme_status is a RECORD of expert sign-off, not a serving gate: nothing that
-- reads these tables filters on it, so adding it changes no live behaviour.
-- Every existing row starts 'pending', the honest state - none has been
-- SME-reviewed yet.

ALTER TABLE behavioral_indicators
  ADD COLUMN IF NOT EXISTS sme_status text NOT NULL DEFAULT 'pending'
    CHECK (sme_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS sme_reviewer_name text,
  ADD COLUMN IF NOT EXISTS sme_reviewed_at timestamptz;

ALTER TABLE reflect_behaviors
  ADD COLUMN IF NOT EXISTS sme_status text NOT NULL DEFAULT 'pending'
    CHECK (sme_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS sme_reviewer_name text,
  ADD COLUMN IF NOT EXISTS sme_reviewed_at timestamptz;

ALTER TABLE rr_technical_items
  ADD COLUMN IF NOT EXISTS sme_status text NOT NULL DEFAULT 'pending'
    CHECK (sme_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS sme_reviewer_name text,
  ADD COLUMN IF NOT EXISTS sme_reviewed_at timestamptz;

-- The reviewers are consultants, not necessarily platform users, so the
-- existing uuid reviewer columns cannot hold them. A name column keeps the
-- sign-off attributable on the banks that only had a uuid.
ALTER TABLE persona_items ADD COLUMN IF NOT EXISTS sme_reviewer_name text;
ALTER TABLE psy_items     ADD COLUMN IF NOT EXISTS sme_reviewer_name text;
ALTER TABLE ara_questions ADD COLUMN IF NOT EXISTS sme_reviewer_name text;

-- ── Immutable import log ────────────────────────────────────────
-- One row per workbook row the importer acted on, applied or held. "held"
-- rows record decisions the importer would not write automatically (text
-- drift, a free-text fix that needs a human edit, a coverage drop) so the
-- reviewer's judgement is never lost even when it is not applied.
CREATE TABLE IF NOT EXISTS sme_review_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at      timestamptz NOT NULL DEFAULT now(),
  imported_by      text,
  reviewer_name    text NOT NULL,
  bank             text NOT NULL,     -- technical | persona | logica | arc | ac | reflect | role_readiness | fluent
  target_table     text,
  item_id          uuid,              -- null for sheet-level judgements and new inserts before write
  action           text NOT NULL CHECK (action IN
                     ('approve', 'revise', 'reject', 'insert', 'cut_score', 'note', 'held')),
  verdict          text,              -- the reviewer's own verdict cell, verbatim
  before           jsonb,
  after            jsonb,
  review           jsonb,             -- every yellow column on the row, keyed by header
  held_reason      text,
  applied          boolean NOT NULL DEFAULT false,
  workbook_file    text NOT NULL,
  workbook_sha256  text NOT NULL,
  sheet            text NOT NULL,
  row_number       integer
);

CREATE INDEX IF NOT EXISTS sme_review_log_item_idx     ON sme_review_log(item_id);
CREATE INDEX IF NOT EXISTS sme_review_log_workbook_idx ON sme_review_log(workbook_sha256);
CREATE INDEX IF NOT EXISTS sme_review_log_bank_idx     ON sme_review_log(bank, imported_at DESC);

CREATE OR REPLACE FUNCTION sme_review_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'sme_review_log rows are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sme_review_log_no_update ON sme_review_log;
CREATE TRIGGER sme_review_log_no_update
  BEFORE UPDATE OR DELETE ON sme_review_log
  FOR EACH ROW EXECUTE FUNCTION sme_review_log_immutable();

-- Writes come only from the service-role importer; admins may read the trail.
ALTER TABLE sme_review_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sme_review_log_admin_select ON sme_review_log;
CREATE POLICY sme_review_log_admin_select ON sme_review_log
  FOR SELECT USING (auth_role() = 'admin');
