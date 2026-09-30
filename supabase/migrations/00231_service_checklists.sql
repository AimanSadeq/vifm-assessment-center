-- Engagement checklists: one master list per service, ticked per client
-- engagement so consultants, admin and business development can see what has
-- been done and what is missing, before the agreement and before delivery.
--
-- Only the PEOPLE's ticks are stored. Items the platform can answer itself
-- (purpose set, pack published, report generated) are read from the record at
-- display time and never stored, so the checklist cannot contradict the data.
--
-- subject_id is the engagement's own id in its service: engagements.id for the
-- Assessment Center, ara_assessments.id for the AI Readiness Compass. No FK,
-- because the subject table depends on the service; a deleted subject simply
-- leaves orphan ticks that nothing reads.

CREATE TABLE IF NOT EXISTS service_checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key   text NOT NULL CHECK (service_key IN ('ac', 'arc')),
  subject_id    uuid NOT NULL,
  item_key      text NOT NULL,
  done_at       timestamptz,
  done_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  done_by_name  text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_key, subject_id, item_key)
);

COMMENT ON TABLE service_checklist_items IS
  'A person''s tick on an engagement checklist item (one master list per service; automatic items are computed, not stored). subject_id = engagements.id (ac) or ara_assessments.id (arc).';

CREATE INDEX IF NOT EXISTS idx_service_checklist_subject ON service_checklist_items(service_key, subject_id);

ALTER TABLE service_checklist_items ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS service_checklist_items_updated_at ON service_checklist_items;
CREATE TRIGGER service_checklist_items_updated_at
  BEFORE UPDATE ON service_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admins see and tick everything. Consultants see and tick the checklist of an
-- AI Readiness assessment they own; the Assessment Center is admin-run.
DROP POLICY IF EXISTS service_checklist_items_admin ON service_checklist_items;
CREATE POLICY service_checklist_items_admin ON service_checklist_items
  FOR ALL USING (auth_role() = 'admin');

DROP POLICY IF EXISTS service_checklist_items_consultant ON service_checklist_items;
CREATE POLICY service_checklist_items_consultant ON service_checklist_items
  FOR ALL USING (
    auth_role() = 'consultant'
    AND service_key = 'arc'
    AND ara_is_assessment_owner(subject_id)
  );
