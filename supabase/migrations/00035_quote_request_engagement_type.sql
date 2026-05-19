-- ============================================================
-- 00035 — Quote requests: engagement_type discriminator + Reflect FKs
-- ============================================================
-- The public training-catalogue quote-request flow (00030) was designed
-- around someone browsing /courses anonymously and asking for a quote.
-- Reflect (M7) extends that flow: when a participant sees a recommended
-- programme on their 360° report, they can request a quote with the
-- engagement context attached.
--
-- This migration:
--   - Adds engagement_type to discriminate where a request came from.
--     Default 'direct' = the original /courses public flow.
--     New values: 'ac', 'ara', 'reflect' for engagement-context flows.
--   - Adds nullable FKs to reflect_engagements + reflect_participants
--     so the admin inbox can trace a Reflect quote back to its source.
--   - Indexes (engagement_type, created_at) for fast filtering in the
--     admin inbox.
--
-- Existing rows: backfill is automatic via the NOT NULL DEFAULT. The
-- new FK columns stay NULL on legacy 'direct' requests.
-- ============================================================

ALTER TABLE vifm_course_quote_requests
  ADD COLUMN IF NOT EXISTS engagement_type text NOT NULL DEFAULT 'direct';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vifm_course_quote_requests_engagement_type_check'
  ) THEN
    ALTER TABLE vifm_course_quote_requests
      ADD CONSTRAINT vifm_course_quote_requests_engagement_type_check
        CHECK (engagement_type IN ('direct', 'ac', 'ara', 'reflect'));
  END IF;
END $$;

ALTER TABLE vifm_course_quote_requests
  ADD COLUMN IF NOT EXISTS reflect_engagement_id uuid
    REFERENCES reflect_engagements(id) ON DELETE SET NULL;

ALTER TABLE vifm_course_quote_requests
  ADD COLUMN IF NOT EXISTS reflect_participant_id uuid
    REFERENCES reflect_participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vifm_course_quote_requests_engagement_type_idx
  ON vifm_course_quote_requests (engagement_type, created_at DESC);

CREATE INDEX IF NOT EXISTS vifm_course_quote_requests_reflect_engagement_idx
  ON vifm_course_quote_requests (reflect_engagement_id)
  WHERE reflect_engagement_id IS NOT NULL;

COMMENT ON COLUMN vifm_course_quote_requests.engagement_type IS
  'Discriminator: direct = browsed /courses; ac/ara/reflect = clicked from a diagnostic report.';
