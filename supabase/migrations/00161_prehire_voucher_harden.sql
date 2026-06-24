-- ════════════════════════════════════════════════════════════════
-- 00161 - Pre-Hire voucher hardening (audit fix)
--
-- 00144 wrote both SECURITY DEFINER RPCs without the hardening
-- pattern that 00157 (Persona), 00158 (ARC), 00159 (Logica), and
-- 00160 (Techno) all carry:
--   1) pin search_path = public on both functions (schema-injection
--      defence: a shadowing pg_catalog object cannot run under the
--      function's elevated privileges when the path is fixed).
--   2) lock EXECUTE to service_role only - PostgreSQL grants EXECUTE
--      to PUBLIC by default; without REVOKE any caller with the anon
--      key can invoke the RPCs directly via the PostgREST /rpc/
--      endpoint, enabling: brute-force code enumeration, seat
--      exhaustion (claim seats without provisioning), and fraudulent
--      seat release (prehire_voucher_release(any_uuid)).
-- Signatures are byte-identical to 00144 (no return-type change).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prehire_voucher_claim(p_code text)
RETURNS TABLE (id uuid, requisition_id uuid, organization_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE prehire_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.requisition_id, v.organization_name;
$$;

CREATE OR REPLACE FUNCTION prehire_voucher_release(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE prehire_vouchers
     SET used_count = GREATEST(used_count - 1, 0)
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION prehire_voucher_claim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION prehire_voucher_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prehire_voucher_claim(text) TO service_role;
GRANT EXECUTE ON FUNCTION prehire_voucher_release(uuid) TO service_role;
