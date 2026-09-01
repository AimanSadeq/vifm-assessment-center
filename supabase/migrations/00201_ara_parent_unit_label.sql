-- ARC: record the unit ABOVE the one being assessed, at creation time.
--
-- The org tree is Department -> Division -> Enterprise. Migration 00200 gave
-- us parent_assessment_id, which links a unit to a rollup - but that link can
-- only be made once the rollup EXISTS. The real commercial sequence runs the
-- other way round:
--
--   1. A client buys one department assessment. Vouchers are issued, people
--      answer, a report lands.
--   2. They like it and come back: "do another department in the same
--      division, and give us a division report".
--   3. By then nobody records which division the FIRST department belonged
--      to. It was never asked. Grouping becomes archaeology.
--
-- So the division name is captured up front, on the department, even though no
-- division rollup exists yet and may never. It costs one text field at
-- creation and turns step 3 from guesswork into a filter.
--
-- Named parent_unit_label rather than division_label because the same need
-- exists one level up: a division belongs to an enterprise or group. The UI
-- labels the field for the stage being created ("Division" on a department,
-- "Enterprise or group" on a division).
--
-- This is a LABEL, deliberately not a foreign key. At the moment it is
-- captured the parent may not exist as a row, and forcing one would mean
-- creating an empty division assessment nobody asked for. parent_assessment_id
-- remains the authoritative link once a rollup is actually built; this field
-- is how you find the candidates to link.

ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS parent_unit_label text;

COMMENT ON COLUMN ara_assessments.parent_unit_label IS
  'Name of the unit ABOVE this one - the division a department sits in, or the enterprise/group a division sits in. Captured at creation so departments assessed months apart can later be grouped into a division rollup. A label, not an FK: the parent may not exist as a row yet. parent_assessment_id is the authoritative link once a rollup exists.';

-- The lookup is "unlinked assessments in this org whose parent unit matches",
-- so index the org + label pair, case-folded to match how the UI compares.
CREATE INDEX IF NOT EXISTS idx_ara_assessments_parent_unit_label
  ON ara_assessments (organization_id, lower(parent_unit_label))
  WHERE parent_unit_label IS NOT NULL;

-- Vouchers carry it too, so a department assessment provisioned by redemption
-- inherits the division it was sold into. Without this the voucher path - the
-- exact path in the scenario above - would be the one that loses the data.
ALTER TABLE ara_vouchers
  ADD COLUMN IF NOT EXISTS parent_unit_label text;

COMMENT ON COLUMN ara_vouchers.parent_unit_label IS
  'Division (or enterprise/group) this voucher''s assessments belong to. Copied onto ara_assessments.parent_unit_label at redemption.';

-- Also carry the unit's OWN name on the voucher. Redemption currently derives
-- scope_label from the redeemer + company name, which produces "Sara Ali ·
-- Acme Bank" - fine for a practice sitting, useless as a unit name in a
-- division rollup, where the rows need to read "Compensation" and "Training".
ALTER TABLE ara_vouchers
  ADD COLUMN IF NOT EXISTS unit_label text;

COMMENT ON COLUMN ara_vouchers.unit_label IS
  'Name of the unit being assessed (e.g. "Compensation"). When set, redemption uses it as the assessment scope_label instead of the redeemer/company fallback, so rollup rows carry unit names.';
