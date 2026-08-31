-- ARC unit hierarchy: a parent assessment owns the units beneath it.
--
-- The org tree the product sells against is Department -> Division ->
-- Enterprise, where a Division is composed of several departments (HR =
-- Learning & Development + Training + Compensation) and an Enterprise is
-- composed of divisions. Until now the only cross-assessment link was
-- `prior_assessment_id`, which is the SAME unit in a different year. There was
-- no way to say "these three departments are the HR division", so the one
-- finding a single-unit report can never produce - how the units differ - was
-- unreachable.
--
-- Deliberately a self-FK rather than a separate groups table: a rollup IS an
-- assessment (it has an org, a region, a stage, a pillar scope and its own
-- report), so making it the parent row keeps one entity, one RLS policy and
-- one ownership check instead of two.

ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS parent_assessment_id uuid
    REFERENCES ara_assessments(id) ON DELETE SET NULL;

COMMENT ON COLUMN ara_assessments.parent_assessment_id IS
  'The rollup assessment this unit belongs to (a Division rollup over its departments, or an Enterprise rollup over its divisions). NULL for a standalone unit or for a rollup itself. ON DELETE SET NULL so removing a rollup never destroys the unit assessments underneath it.';

-- The rollup reads "all children of X" on every render.
CREATE INDEX IF NOT EXISTS idx_ara_assessments_parent
  ON ara_assessments (parent_assessment_id)
  WHERE parent_assessment_id IS NOT NULL;

-- Integrity: a unit cannot be its own parent. Deeper cycles are prevented in
-- the application layer (linkUnitToRollup refuses a child that is already an
-- ancestor); a CHECK cannot see beyond the row.
ALTER TABLE ara_assessments
  DROP CONSTRAINT IF EXISTS ara_assessments_parent_not_self;
ALTER TABLE ara_assessments
  ADD CONSTRAINT ara_assessments_parent_not_self
  CHECK (parent_assessment_id IS NULL OR parent_assessment_id <> id);

-- No RLS change needed: the existing consultant/admin policies on
-- ara_assessments already scope by ownership, and a rollup and its units are
-- ordinary assessment rows subject to exactly those policies.
