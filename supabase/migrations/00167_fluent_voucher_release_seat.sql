-- ════════════════════════════════════════════════════════════════
-- 00167 - Fluent voucher seat-release  (Phase 0, voucher consolidation)
--
-- Fluent was the ONLY instrument without a seat-release RPC. Its redeem flow
-- claims a seat (eng_fluent_voucher_claim, 00104/00165) then inserts a
-- redemption row; if that insert failed, the claimed seat was permanently
-- burned (no compensation). This adds the release function every other
-- instrument already has (ara_voucher_release_seat 00158,
-- persona_voucher_release_seat 00157, rr_release_voucher_seat 00156, ...),
-- so src/lib/fluent/vouchers.ts can hand the seat back on provisioning failure.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION eng_fluent_voucher_release_seat(p_code text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE eng_fluent_vouchers SET used_count = GREATEST(used_count - 1, 0)
   WHERE code = upper(btrim(p_code));
$$;

REVOKE ALL ON FUNCTION eng_fluent_voucher_release_seat(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION eng_fluent_voucher_release_seat(text) TO service_role;
