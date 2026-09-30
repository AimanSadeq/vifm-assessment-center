-- Engagement checklists for every service (00231 covered the Assessment
-- Center and the AI Readiness Compass).
--
-- subject_id per service:
--   ac       engagements.id
--   arc      ara_assessments.id
--   reflect  reflect_engagements.id
--   prehire  prehire_requisitions.id
--   persona  persona_vouchers.batch_id (the issuance), or the voucher id when
--            the row predates batches
--   logica   cognitive_vouchers.batch_id, same rule
--   fluent   eng_fluent_vouchers.batch_id, same rule
--   techno   technical_sandbox_vouchers.batch_id, same rule
--
-- The voucher services have no engagement record: the client-facing unit is
-- the batch of codes issued to one organisation, so that is what the
-- checklist follows.

ALTER TABLE service_checklist_items DROP CONSTRAINT IF EXISTS service_checklist_items_service_key_check;
ALTER TABLE service_checklist_items
  ADD CONSTRAINT service_checklist_items_service_key_check
  CHECK (service_key IN ('ac', 'arc', 'reflect', 'prehire', 'persona', 'logica', 'fluent', 'techno'));

COMMENT ON TABLE service_checklist_items IS
  'A person''s tick on an engagement checklist item (one master list per service; automatic items are computed, not stored). subject_id = engagements.id (ac), ara_assessments.id (arc), reflect_engagements.id (reflect), prehire_requisitions.id (prehire) or the voucher batch_id (persona, logica, fluent, techno).';

-- A consultant ticks the checklist of a Reflect 360 engagement they own, as
-- they already do for an AI Readiness assessment. The rest stay admin-run.
DROP POLICY IF EXISTS service_checklist_items_consultant_reflect ON service_checklist_items;
CREATE POLICY service_checklist_items_consultant_reflect ON service_checklist_items
  FOR ALL USING (
    auth_role() = 'consultant'
    AND service_key = 'reflect'
    AND reflect_is_engagement_owner(subject_id)
  );
