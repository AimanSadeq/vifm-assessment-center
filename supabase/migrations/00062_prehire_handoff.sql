-- ════════════════════════════════════════════════════════════════
-- VIFM Pre-Hire — handoff tracker (NOT a hiring decision)
--
-- VIFM is the assessor, not the decider: the in-app advance/reject "decision"
-- was removed (the composite is a screening SIGNAL, never an auto-reject). But
-- a recruiter still needs to track their own workflow — which candidates they've
-- reviewed and handed off to the client. These columns capture that handoff
-- workflow ONLY. They carry no hiring outcome (no advance/reject/decline); the
-- client always makes the actual decision.
--
--   handoff_status : null = New (not yet actioned) → reviewed → shared_with_client → closed
--   handoff_note   : optional free note (e.g. "shared with hiring panel 1 Jun")
--   handoff_by/at  : who moved it + when (audited)
--
-- Additive to 00050/00051/00061.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prehire_candidates
  ADD COLUMN IF NOT EXISTS handoff_status text
    CHECK (handoff_status IN ('reviewed','shared_with_client','closed')),
  ADD COLUMN IF NOT EXISTS handoff_note   text,
  ADD COLUMN IF NOT EXISTS handoff_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_at     timestamptz;

COMMENT ON COLUMN prehire_candidates.handoff_status IS
  'VIFM handoff workflow only (reviewed/shared_with_client/closed); null = New. NOT a hiring decision — never advance/reject.';
