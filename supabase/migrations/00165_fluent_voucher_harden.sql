-- ════════════════════════════════════════════════════════════════
-- 00165 - Fluent (English placement) voucher hardening (audit fix)
--
-- The claim is already atomic (00104) - the only gaps were the SECURITY DEFINER
-- hardening the other instruments received (Persona 00157, ARC 00158, Cognitive
-- 00159, Techno 00160, Pre-Hire 00161):
--   1) pin search_path = public so the definer body can't be hijacked by a
--      caller-set search_path,
--   2) lock EXECUTE to service_role only. The redeem flow runs through the
--      service-role client; anon/authenticated must not be able to claim seats
--      or brute-force voucher codes through the PostgREST RPC surface.
-- The signature is byte-identical to 00104 (no return-type change), so existing
-- callers (src/lib/fluent/vouchers.ts) are unaffected.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION eng_fluent_voucher_claim(p_code text)
RETURNS TABLE (id uuid, organization_id uuid, client_name text, default_language text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE eng_fluent_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.organization_id, v.client_name, v.default_language;
$$;

REVOKE ALL ON FUNCTION eng_fluent_voucher_claim(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION eng_fluent_voucher_claim(text) TO service_role;
