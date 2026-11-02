-- ============================================================
-- 00240 - Voucher batches decide whether delegates receive their own report.
--   Default (false): the delegate sees a thank-you on completion and nothing
--   else; VIFM sends the reports from the cohort page. When an admin switches
--   a batch on, each delegate is emailed their Personal AI Readiness Report
--   as a PDF the moment they complete. Existing batches keep the default.
-- ADDITIVE and idempotent.
-- ============================================================

ALTER TABLE ara_vouchers
  ADD COLUMN IF NOT EXISTS send_report_to_delegate boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ara_vouchers.send_report_to_delegate IS
  'When true, a delegate who completes a sitting from this code is emailed their personal report PDF. Default false: VIFM sends reports.';
