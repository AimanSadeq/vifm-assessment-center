-- ════════════════════════════════════════════════════════════════
-- 00156 - Atomic Role Readiness voucher seat claim / release
--
-- Replaces the read-then-write seat logic in redeemRoleReadinessVoucher with
-- single-statement atomic ops, so two concurrent redeems of a SHARED (pool)
-- voucher can never over-redeem the last seat. The increment + the bound are
-- evaluated together under the row lock.
--
-- EXECUTE is locked to service_role only (the redeem flow uses the service
-- client); anon/authenticated must NOT be able to consume seats via PostgREST.
-- ════════════════════════════════════════════════════════════════

-- Claim a seat: succeeds only while uses < max_uses; returns the voucher's
-- role_config_id + organization_id (so the caller can provision the candidate).
CREATE OR REPLACE FUNCTION rr_claim_voucher_seat(p_code text)
RETURNS TABLE (role_config_id uuid, organization_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE rr_vouchers
     SET uses = uses + 1
   WHERE code = p_code
     AND uses < max_uses
  RETURNING role_config_id, organization_id;
$$;

-- Release a seat (compensation when candidate provisioning fails after a claim).
CREATE OR REPLACE FUNCTION rr_release_voucher_seat(p_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE rr_vouchers
     SET uses = GREATEST(uses - 1, 0)
   WHERE code = p_code;
$$;

REVOKE ALL ON FUNCTION rr_claim_voucher_seat(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rr_release_voucher_seat(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rr_claim_voucher_seat(text) TO service_role;
GRANT EXECUTE ON FUNCTION rr_release_voucher_seat(text) TO service_role;
