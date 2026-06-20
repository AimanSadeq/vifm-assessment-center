-- Per-client ARC question-count lever.
--
-- A Personal ARC voucher can cap how many individual-layer questions PER FACTOR
-- a redeemed run serves, so the same instrument can be issued at different
-- lengths per client need. NULL = the full deep-dive (all items). The value is
-- copied onto the provisioned assessment at redeem time and honoured by the
-- respondent loader, which keeps the objective (scenario / knowledge) items so a
-- shorter run still supports the self-vs-objective calibration read.
--
-- Both columns are nullable + additive, so existing rows (NULL) keep serving the
-- full deep-dive with no behaviour change.

ALTER TABLE ara_vouchers    ADD COLUMN IF NOT EXISTS items_per_factor smallint;
ALTER TABLE ara_assessments ADD COLUMN IF NOT EXISTS items_per_factor smallint;

COMMENT ON COLUMN ara_vouchers.items_per_factor IS
  'ARC per-client length lever: max individual-layer questions per factor a redeemed code serves. NULL = full deep-dive (all items).';
COMMENT ON COLUMN ara_assessments.items_per_factor IS
  'ARC per-client length lever: max individual-layer questions per factor served by the respondent loader. NULL = no cap (full).';
