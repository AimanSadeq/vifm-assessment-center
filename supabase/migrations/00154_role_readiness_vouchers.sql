-- ════════════════════════════════════════════════════════════════
-- 00154 - Role Readiness vouchers (parity with the other portals' voucher model)
--
-- A voucher is a redeemable code for a Role Readiness programme. Two shapes:
--   * individual - one voucher per recipient (max_uses = 1, recipient_email set)
--   * pool       - one voucher shared by many (max_uses = N)
-- Redeeming a code provisions an rr_candidate and forwards to the apply flow.
-- ADDITIVE; mirrors the prehire/ARC voucher pattern. Service-role redeem.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rr_vouchers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_config_id   uuid NOT NULL REFERENCES rr_role_configs(id) ON DELETE CASCADE,
  organization_id  uuid REFERENCES organizations(id) ON DELETE SET NULL,
  code             text NOT NULL UNIQUE,
  max_uses         int NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  uses             int NOT NULL DEFAULT 0 CHECK (uses >= 0),
  recipient_email  text,           -- set for individual vouchers
  label            text,
  is_sample        boolean NOT NULL DEFAULT false,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rr_voucher_uses_within_max CHECK (uses <= max_uses)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_vouchers_code ON rr_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_rr_vouchers_config ON rr_vouchers(role_config_id);
CREATE INDEX IF NOT EXISTS idx_rr_vouchers_org ON rr_vouchers(organization_id);

DROP TRIGGER IF EXISTS rr_vouchers_updated_at ON rr_vouchers;
CREATE TRIGGER rr_vouchers_updated_at BEFORE UPDATE ON rr_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE rr_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rr_vouchers_admin ON rr_vouchers;
CREATE POLICY rr_vouchers_admin ON rr_vouchers
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- client_manager reads its own org's vouchers (issuance + redeem go via service-role).
DROP POLICY IF EXISTS rr_vouchers_cm_select ON rr_vouchers;
CREATE POLICY rr_vouchers_cm_select ON rr_vouchers
  FOR SELECT USING (auth_role() = 'client_manager' AND organization_id = cm_org_id());
