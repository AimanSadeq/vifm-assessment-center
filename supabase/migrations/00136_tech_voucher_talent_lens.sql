-- ============================================================
-- 00136 - Technical voucher: talent lens carry-through
-- ============================================================
-- A technical sitting can be issued under a talent lens (00135).
-- The direct-link + custom-builder paths already carry it onto the
-- session. The VOUCHER path provisions the session at REDEMPTION time
-- (not at issuance), so the lens must ride on the voucher row and be
-- copied onto the session when a delegate redeems - otherwise an
-- acquisition-launched voucher cohort would silently fall back to the
-- development framing on its reports.
--
-- Tolerant: ADD COLUMN IF NOT EXISTS + guarded CHECK admitting NULL
-- plus the two known values, so a NULL (default) row always passes and
-- the column matches technical_sandbox_sessions.talent_lens exactly.
-- ============================================================

ALTER TABLE technical_sandbox_vouchers
  ADD COLUMN IF NOT EXISTS talent_lens text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'technical_sandbox_vouchers_talent_lens_check'
  ) THEN
    ALTER TABLE technical_sandbox_vouchers
      ADD CONSTRAINT technical_sandbox_vouchers_talent_lens_check
      CHECK (talent_lens IS NULL OR talent_lens IN ('acquisition', 'development'));
  END IF;
END $$;

COMMENT ON COLUMN technical_sandbox_vouchers.talent_lens IS
  'Optional talent lens copied onto the session at redemption (00135). NULL = development framing. Drives the VIFM Academy course block on the report.';
