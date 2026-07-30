-- ════════════════════════════════════════════════════════════════
-- 00197 - Bespoke bundle vouchers (multi-seat redeemable link)
--
-- Parity with the other portals' voucher model, for a composed bespoke bundle
-- (the one-sitting Persona + Logica flow). A voucher is a redeemable code:
--   * pool       - one code shared by many (max_uses = N seats)
--   * individual - one code per recipient (max_uses = 1, recipient set)
-- Redeeming a code provisions a bundle_candidates row and forwards to
-- /bundle/apply/[token]. The voucher IS the seat accounting (N seats = N
-- sittings) - no allocation ledger interaction. ADDITIVE; mirrors
-- rr_vouchers (00154/00156/00193) exactly, including expiry enforced from day 1.
-- Service-role redeem (the public /bundle/redeem flow is auth-bypassed).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bundle_vouchers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_service_id uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  organization_id    uuid REFERENCES organizations(id) ON DELETE SET NULL,
  code               text NOT NULL UNIQUE,
  max_uses           int NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  uses               int NOT NULL DEFAULT 0 CHECK (uses >= 0),
  recipient_email    text,           -- set for individual vouchers
  recipient_name     text,
  label              text,
  expires_at         timestamptz,
  is_sample          boolean NOT NULL DEFAULT false,
  created_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bundle_voucher_uses_within_max CHECK (uses <= max_uses)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_vouchers_code ON bundle_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_bundle_vouchers_service ON bundle_vouchers(bespoke_service_id);
CREATE INDEX IF NOT EXISTS idx_bundle_vouchers_org ON bundle_vouchers(organization_id);

DROP TRIGGER IF EXISTS bundle_vouchers_updated_at ON bundle_vouchers;
CREATE TRIGGER bundle_vouchers_updated_at BEFORE UPDATE ON bundle_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bundle_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bundle_vouchers_admin ON bundle_vouchers;
CREATE POLICY bundle_vouchers_admin ON bundle_vouchers
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- client_manager reads its own org's vouchers (issuance + redeem go via service-role).
DROP POLICY IF EXISTS bundle_vouchers_cm_select ON bundle_vouchers;
CREATE POLICY bundle_vouchers_cm_select ON bundle_vouchers
  FOR SELECT USING (auth_role() = 'client_manager' AND organization_id = cm_org_id());

-- ── Atomic seat claim / release (mirrors rr_claim_voucher_seat, expiry-enforced) ──

CREATE OR REPLACE FUNCTION bundle_voucher_claim(p_code text)
RETURNS TABLE (bespoke_service_id uuid, organization_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE bundle_vouchers
     SET uses = uses + 1
   WHERE code = upper(btrim(p_code))
     AND uses < max_uses
     AND (expires_at IS NULL OR expires_at > now())
  RETURNING bespoke_service_id, organization_id;
$$;

-- Release is a COMPENSATING action for a failed provision - must still work on an
-- expired voucher so a seat consumed moments before expiry can be handed back.
CREATE OR REPLACE FUNCTION bundle_voucher_release_seat(p_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE bundle_vouchers
     SET uses = GREATEST(uses - 1, 0)
   WHERE code = upper(btrim(p_code));
$$;

REVOKE ALL ON FUNCTION bundle_voucher_claim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bundle_voucher_release_seat(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bundle_voucher_claim(text) TO service_role;
GRANT EXECUTE ON FUNCTION bundle_voucher_release_seat(text) TO service_role;

COMMENT ON TABLE bundle_vouchers IS
  'Multi-seat redeemable voucher for a bespoke bundle (one-sitting Persona + Logica). Redeeming provisions a bundle_candidates row. Mirrors rr_vouchers.';
