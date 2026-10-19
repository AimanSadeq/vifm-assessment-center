-- ============================================================
-- 00238 - Exclude a voucher redemption from its company cohort.
--   Internal trial runs (a VIFM consultant testing a client's batch) were
--   counted as client delegates on /ara/admin/vouchers/insights, in the
--   cohort CSV, the all-reports ZIP and the cohort PDF. An admin can now mark
--   a redemption as a test run; it drops out of every cohort figure and
--   download, and can be restored. The delegate's own report is untouched.
-- ADDITIVE and idempotent.
-- ============================================================

ALTER TABLE ara_voucher_redemptions
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz;

COMMENT ON COLUMN ara_voucher_redemptions.excluded_at IS
  'Set when an admin marks the redemption as a test run. Excluded from company cohort insights and downloads. NULL = counted.';
