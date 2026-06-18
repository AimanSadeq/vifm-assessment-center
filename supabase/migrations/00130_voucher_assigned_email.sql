-- 00130_voucher_assigned_email.sql
-- CAL-PER-405 + CAL-TA-205: when an admin emails a voucher redeem link to a
-- specific delegate, record which delegate the code was sent to. Lets the
-- vouchers list show who a single-use code belongs to. Best-effort column;
-- the email actions tolerate this migration not being applied.

ALTER TABLE persona_vouchers ADD COLUMN IF NOT EXISTS assigned_email text;
ALTER TABLE cognitive_vouchers ADD COLUMN IF NOT EXISTS assigned_email text;
