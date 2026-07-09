-- Reflect 360: formal framework-approval gate.
--
-- A per-engagement Reflect framework is AI-decomposed - Claude turns the client's
-- values / leadership competencies into observable rater behaviours (wizard step 2).
-- Before this gate, those AI-authored behaviours reached raters with only informal
-- review. This adds an explicit human sign-off: a consultant must APPROVE the
-- framework before the engagement can launch (draft -> live) and invitations go out.
--
-- Seat / client-portal shells clone a pre-reviewed library template (source='manual'),
-- so those are approved by construction at invite time (see seat/reflect.ts) and are
-- never blocked by this gate.

ALTER TABLE reflect_engagements
  ADD COLUMN IF NOT EXISTS framework_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS framework_approved_by uuid;

COMMENT ON COLUMN reflect_engagements.framework_approved_at IS
  'When the AI-decomposed framework was human-approved. NULL = not approved; launch/invites are blocked until set.';

-- Grandfather: any engagement already past draft has a framework in active use
-- (raters were already invited), so mark it approved - the gate must only affect
-- NEW launches, never block resends or break already-live engagements.
UPDATE reflect_engagements
  SET framework_approved_at = COALESCE(launched_at, now())
  WHERE framework_approved_at IS NULL AND status <> 'draft';
