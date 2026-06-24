-- ════════════════════════════════════════════════════════════════
-- 00157 - Persona voucher hardening (audit fixes)
--
-- 1) persona_voucher_release_seat: atomic compensation so a claimed seat is
--    handed back if redemption provisioning fails (mirrors rr_release_voucher_seat
--    in 00156). Without it a failed redeem permanently burned a seat.
-- 2) Lock down EXECUTE on the voucher RPCs to service_role only - the redeem flow
--    calls them via the service client; anon/authenticated must not be able to
--    claim/release seats (or brute-force codes) through PostgREST RPC.
-- 3) Pin search_path on both SECURITY DEFINER functions.
-- ════════════════════════════════════════════════════════════════

-- Recreate claim with a pinned search_path (body unchanged from 00106).
CREATE OR REPLACE FUNCTION persona_voucher_claim(p_code text)
RETURNS TABLE (id uuid, organization_id uuid, client_name text, default_language text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE persona_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.organization_id, v.client_name, v.default_language;
$$;

CREATE OR REPLACE FUNCTION persona_voucher_release_seat(p_code text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE persona_vouchers
     SET used_count = GREATEST(used_count - 1, 0)
   WHERE code = upper(btrim(p_code));
$$;

REVOKE ALL ON FUNCTION persona_voucher_claim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION persona_voucher_release_seat(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION persona_voucher_claim(text) TO service_role;
GRANT EXECUTE ON FUNCTION persona_voucher_release_seat(text) TO service_role;
