-- ════════════════════════════════════════════════════════════════
-- 00155 - rr_vouchers.recipient_name
--
-- When a delegate list (name + email) is uploaded, store the delegate's name on
-- the individual voucher so it can be emailed to them and prefilled on redeem.
-- ADDITIVE; nullable; nothing else changes.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE rr_vouchers ADD COLUMN IF NOT EXISTS recipient_name text;
