-- ════════════════════════════════════════════════════════════════
-- 00123 - Admin-pinned scope on Persona vouchers (SD-1 competency scoping)
--
-- A Persona voucher can now PIN the assessment configuration so the admin
-- (not the candidate) decides it: the purpose (hiring vs development), the
-- target role profile (for the hiring fit), and the competency SCOPE the
-- assessment draws items from. The candidate just redeems and takes the
-- pre-configured test.
--
--   purpose                NULL  -> legacy/unpinned: candidate picks (unchanged)
--                          'hiring' | 'development' -> pinned by the admin
--   target_role_profile_id the role the hiring fit is computed against
--   scoped_competency_ids  NULL/empty -> full bank (all competencies)
--                          non-empty   -> the assessment serves ONLY these
--                                         competencies' items (~4 items each)
--
-- Also records the scope actually served on each session for reproducibility
-- + report scoping. Idempotent (ADD COLUMN IF NOT EXISTS); existing vouchers
-- and sessions are unaffected (NULL = full/unpinned).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE persona_vouchers
  ADD COLUMN IF NOT EXISTS purpose text
    CHECK (purpose IS NULL OR purpose IN ('development', 'hiring')),
  ADD COLUMN IF NOT EXISTS target_role_profile_id uuid REFERENCES role_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scoped_competency_ids uuid[];

ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS scoped_competency_ids uuid[];
