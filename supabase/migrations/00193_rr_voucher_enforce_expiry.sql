-- ============================================================
-- Role Readiness: actually enforce the voucher expiry date
--
-- rr_vouchers.expires_at was added in 00168 so Role Readiness could carry the
-- same step-1 details as every other portal, and BOTH issuing surfaces write it
-- (the admin role editor and the client-portal invite screen, via
-- issueRoleReadinessVouchers -> expires_at). But rr_claim_voucher_seat was
-- written in 00156 and never revisited, so it checked seats only:
--
--     WHERE code = p_code AND uses < max_uses
--
-- The column was therefore write-only: a voucher sold as "valid through Q3"
-- stayed fully redeemable forever, and a client who set an expiry themselves in
-- the portal had no way to know it did nothing. Every other service
-- (ara / persona / cognitive / fluent / technical / prehire) has enforced the
-- same condition since its own hardening migration; this brings the seventh
-- into line.
--
-- Also normalises the code match to upper(btrim(...)), matching the other six.
-- The app layer already normalises before calling (redeemViaDescriptor ->
-- normalizeCode), so this only ever makes the lookup MORE forgiving, never less
-- - it cannot turn away a code that used to work.
--
-- NOTE: rr_vouchers has no `status` column, so unlike the other six there is no
-- deactivate/revoke lever here. That is a separate gap, deliberately not
-- addressed in this migration.
-- ============================================================

CREATE OR REPLACE FUNCTION rr_claim_voucher_seat(p_code text)
RETURNS TABLE (role_config_id uuid, organization_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE rr_vouchers
     SET uses = uses + 1
   WHERE code = upper(btrim(p_code))
     AND uses < max_uses
     AND (expires_at IS NULL OR expires_at > now())
  RETURNING role_config_id, organization_id;
$$;

-- Release is a COMPENSATING action for a failed provision: it must still work
-- on an expired voucher, otherwise a seat consumed moments before the expiry
-- could never be handed back. Only the code match is normalised, so a claim and
-- its matching release always resolve to the same row.
CREATE OR REPLACE FUNCTION rr_release_voucher_seat(p_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE rr_vouchers
     SET uses = GREATEST(uses - 1, 0)
   WHERE code = upper(btrim(p_code));
$$;

REVOKE ALL ON FUNCTION rr_claim_voucher_seat(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rr_release_voucher_seat(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rr_claim_voucher_seat(text) TO service_role;
GRANT EXECUTE ON FUNCTION rr_release_voucher_seat(text) TO service_role;
