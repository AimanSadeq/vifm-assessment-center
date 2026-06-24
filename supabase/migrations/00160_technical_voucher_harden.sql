-- ════════════════════════════════════════════════════════════════
-- 00160 - Techno (technical sandbox) voucher hardening (audit fix)
--
-- The claim is already atomic and a release RPC already exists (00078) - the
-- only gaps were the SECURITY DEFINER hardening the other instruments got:
--   1) pin search_path = public on both functions
--   2) lock EXECUTE to service_role only (the redeem flow uses the service
--      client; anon/authenticated must not be able to claim/release seats or
--      brute-force codes through PostgREST RPC).
-- Signatures are byte-identical to 00078 (no return-type change).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION technical_sandbox_voucher_claim(p_code text)
RETURNS TABLE (id uuid, function_id uuid, organization_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE technical_sandbox_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.function_id, v.organization_name;
$$;

CREATE OR REPLACE FUNCTION technical_sandbox_voucher_release(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE technical_sandbox_vouchers
     SET used_count = GREATEST(used_count - 1, 0)
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION technical_sandbox_voucher_claim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION technical_sandbox_voucher_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION technical_sandbox_voucher_claim(text) TO service_role;
GRANT EXECUTE ON FUNCTION technical_sandbox_voucher_release(uuid) TO service_role;
