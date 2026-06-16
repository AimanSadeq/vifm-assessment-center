-- ════════════════════════════════════════════════════════════════
-- Cognitive Ability voucher system - redeemable access codes for the
-- standalone Cognitive runner (/ac/cognitive), mirroring Fluent (00104).
-- Independent of any "psychometrics" umbrella: its own tables, its own
-- delegate flow. Results live in psy_results (the cognitive results table);
-- this adds org scoping + a voucher link there. AC-family service, so the
-- org FK points at `organizations`.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE cognitive_vouchers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,                 -- e.g. VIFM-COG-7K3M-9QX2
  label             text,
  batch_id          uuid,
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  client_name       text,
  default_language  text NOT NULL DEFAULT 'en' CHECK (default_language IN ('en','ar')),
  max_uses          int  NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count        int  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cognitive_vouchers_code  ON cognitive_vouchers(code);
CREATE INDEX idx_cognitive_vouchers_batch ON cognitive_vouchers(batch_id);
CREATE INDEX idx_cognitive_vouchers_org   ON cognitive_vouchers(organization_id);

CREATE TRIGGER trg_cognitive_vouchers_updated_at
  BEFORE UPDATE ON cognitive_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE cognitive_voucher_redemptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id        uuid NOT NULL REFERENCES cognitive_vouchers(id) ON DELETE CASCADE,
  redemption_token  uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  redeemer_name     text NOT NULL,
  redeemer_email    text NOT NULL,
  company_name      text NOT NULL,
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  result_id         uuid REFERENCES psy_results(id) ON DELETE SET NULL,
  ip                text,
  user_agent        text,
  redeemed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cognitive_redemptions_voucher ON cognitive_voucher_redemptions(voucher_id);
CREATE INDEX idx_cognitive_redemptions_company ON cognitive_voucher_redemptions(company_name);
CREATE INDEX idx_cognitive_redemptions_token   ON cognitive_voucher_redemptions(redemption_token);

-- Org scoping + voucher linkage on the cognitive result row.
ALTER TABLE psy_results
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_redemption_id uuid REFERENCES cognitive_voucher_redemptions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_psy_results_org ON psy_results(organization_id);

CREATE OR REPLACE FUNCTION cognitive_voucher_claim(p_code text)
RETURNS TABLE (id uuid, organization_id uuid, client_name text, default_language text)
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE cognitive_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.organization_id, v.client_name, v.default_language;
$$;

ALTER TABLE cognitive_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cognitive_vouchers_all_admin ON cognitive_vouchers
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY cognitive_redemptions_all_admin ON cognitive_voucher_redemptions
  FOR ALL USING (auth_role() = 'admin');
