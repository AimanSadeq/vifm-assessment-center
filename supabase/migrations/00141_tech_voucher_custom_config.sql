-- Carry a custom (pick-and-choose) sitting design on a technical voucher.
--
-- The custom assessment builder previously issued ONE direct session link per
-- delegate. We are unifying it onto the standard voucher system (codes + redeem
-- links), but a custom sitting selects a SUBSET of skills + hands-on blocks +
-- a title. Without persisting that on the voucher, a redeemed code would
-- provision the function DEFAULT test, not the custom design.
--
-- custom_config holds { skills: text[], blockIds: text[], title: text }; the
-- redeem path reads it and provisions a matching custom session. NULL = the full
-- function default (an ordinary voucher).
ALTER TABLE technical_sandbox_vouchers
  ADD COLUMN IF NOT EXISTS custom_config jsonb;

COMMENT ON COLUMN technical_sandbox_vouchers.custom_config IS
  'Custom sitting design for vouchers issued from the custom builder: { skills: text[], blockIds: text[], title: text }. NULL = full function default.';
