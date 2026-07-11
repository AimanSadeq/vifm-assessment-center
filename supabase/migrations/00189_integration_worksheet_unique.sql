-- ============================================================
-- AC core review - integration worksheet upsert key (finding #12)
--
-- saveIntegrationAction did a non-atomic delete-then-insert to emulate an
-- upsert (the table had no unique constraint on its natural key). If the DELETE
-- succeeded but the INSERT then failed (a transient blip), the assessor's saved
-- preliminary rating for that competency was destroyed with no recovery.
--
-- Add the natural-key unique index so the action can do a single atomic upsert.
-- Dedupe any accidental duplicates first (there should be none - the old path
-- deleted before inserting - but guard so the index build can't fail), keeping
-- the most recent row per key.
-- ============================================================

DELETE FROM integration_worksheets a
USING integration_worksheets b
WHERE a.engagement_id = b.engagement_id
  AND a.assessor_id   = b.assessor_id
  AND a.candidate_id  = b.candidate_id
  AND a.competency_id = b.competency_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_worksheets_key
  ON integration_worksheets (engagement_id, assessor_id, candidate_id, competency_id);
