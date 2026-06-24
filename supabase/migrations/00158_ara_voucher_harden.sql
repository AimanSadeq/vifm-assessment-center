-- ════════════════════════════════════════════════════════════════
-- 00158 - ARC (ARA) voucher hardening (audit fixes)
--
-- 1) ara_voucher_release_seat: atomic compensation so a claimed seat is handed
--    back if redemption provisioning fails (mirrors persona_voucher_release_seat
--    / rr_release_voucher_seat). Without it a failed redeem burned a seat.
-- 2) Lock down EXECUTE on the voucher RPCs to service_role only - the redeem flow
--    calls them via the service client; anon/authenticated must not be able to
--    claim/release seats (or brute-force codes) through PostgREST RPC.
-- 3) Pin search_path on both SECURITY DEFINER functions.
-- 4) Sanity CHECK on items_per_factor (00143) - was validated client-side only.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ara_voucher_claim(p_code text)
RETURNS TABLE (
  id uuid, tier text, region text, default_language text,
  organization_id uuid, client_name text, is_practice boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE ara_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.tier, v.region, v.default_language,
            v.organization_id, v.client_name, v.is_practice;
$$;

CREATE OR REPLACE FUNCTION ara_voucher_release_seat(p_code text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE ara_vouchers SET used_count = GREATEST(used_count - 1, 0)
   WHERE code = upper(btrim(p_code));
$$;

REVOKE ALL ON FUNCTION ara_voucher_claim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ara_voucher_release_seat(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ara_voucher_claim(text) TO service_role;
GRANT EXECUTE ON FUNCTION ara_voucher_release_seat(text) TO service_role;

-- items_per_factor bounds (NOT VALID so legacy rows aren't re-checked; enforced
-- on new writes). Guarded so it's tolerant + idempotent.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ara_vouchers' AND column_name = 'items_per_factor')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ara_vouchers_ipf') THEN
    ALTER TABLE ara_vouchers
      ADD CONSTRAINT chk_ara_vouchers_ipf
      CHECK (items_per_factor IS NULL OR (items_per_factor BETWEEN 1 AND 15)) NOT VALID;
  END IF;
END $$;
