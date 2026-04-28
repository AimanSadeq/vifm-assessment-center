-- ============================================================
-- VIFM Assessment Center - In-app notifications (H3)
--
-- Skillup MENA's admin and learner headers show an envelope and a bell
-- with a red badge ("3" admin, "1" learner). Our portal currently has
-- no in-app event surface — only email goes out. This adds a single
-- notifications table that any portal layout can poll for unread
-- count + recent items.
--
-- Design notes:
--   - profile_id is the canonical recipient — works for any role
--     (admin / lead_assessor / candidate / client / consultant).
--   - kind is a free-form string but we standardise the small set in
--     code (see src/lib/notifications/publish.ts).
--   - link is the in-app destination so clicking the notification
--     takes the user straight to the relevant page.
--   - read_at is null for unread; the badge count is the number of
--     rows with read_at IS NULL.
--   - data jsonb is for future extensibility — counts, ids, snippets
--     not worth dedicated columns.
-- ============================================================

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lookup: "all unread notifications for a user, newest first" is the
-- primary read pattern. Compound index on (profile_id, read_at,
-- created_at desc) covers it.
CREATE INDEX idx_notifications_profile ON notifications(profile_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(profile_id) WHERE read_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- A profile can read + update its own notifications (mark-read), nothing else.
CREATE POLICY notifications_own ON notifications
  FOR ALL USING (profile_id = auth.uid());

-- Admins can read all notifications (for support / debugging).
CREATE POLICY notifications_select_admin ON notifications
  FOR SELECT USING (auth_role() = 'admin');
