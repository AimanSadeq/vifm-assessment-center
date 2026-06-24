-- ════════════════════════════════════════════════════════════════
-- 00159 - Logica (cognitive) voucher hardening (audit fixes)
--
-- 1) cognitive_voucher_release_seat: atomic compensation so a claimed seat is
--    handed back if redemption provisioning fails (mirrors 00157/00158).
-- 2) Lock EXECUTE on the voucher RPCs to service_role only (the redeem flow uses
--    the service client; anon/authenticated must not claim/release/brute-force).
-- 3) Pin search_path on both SECURITY DEFINER functions.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cognitive_voucher_claim(p_code text)
RETURNS TABLE (id uuid, organization_id uuid, client_name text, default_language text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE cognitive_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.organization_id, v.client_name, v.default_language;
$$;

CREATE OR REPLACE FUNCTION cognitive_voucher_release_seat(p_code text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE cognitive_vouchers SET used_count = GREATEST(used_count - 1, 0)
   WHERE code = upper(btrim(p_code));
$$;

REVOKE ALL ON FUNCTION cognitive_voucher_claim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cognitive_voucher_release_seat(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cognitive_voucher_claim(text) TO service_role;
GRANT EXECUTE ON FUNCTION cognitive_voucher_release_seat(text) TO service_role;
