-- Hard link from a Reflect competency to its AC catalogue competency, so the
-- readiness engine maps 360 scores onto role-profile competencies reliably
-- instead of matching on name.
-- (Renumbered from handover 00079.)
ALTER TABLE reflect_competencies
  ADD COLUMN ac_competency_id uuid REFERENCES competencies(id) ON DELETE SET NULL;

CREATE INDEX idx_reflect_competencies_ac ON reflect_competencies(ac_competency_id);

-- Best-effort backfill for any existing frameworks whose names already match.
UPDATE reflect_competencies rc
SET ac_competency_id = c.id
FROM competencies c
WHERE rc.ac_competency_id IS NULL
  AND lower(trim(rc.name_en)) = lower(trim(c.name));
