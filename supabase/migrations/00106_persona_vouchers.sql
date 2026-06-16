-- ════════════════════════════════════════════════════════════════
-- Persona voucher system - redeemable access codes for the standalone Persona
-- behavioural self-assessment (/ac/persona), mirroring Fluent/Cognitive.
-- Its own independent tables. Results live in behavioral_assessment_sessions;
-- this adds org scoping + a voucher link there. AC-family service, org FK ->
-- organizations.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE persona_vouchers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,                 -- e.g. VIFM-PER-7K3M-9QX2
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
CREATE INDEX idx_persona_vouchers_code  ON persona_vouchers(code);
CREATE INDEX idx_persona_vouchers_batch ON persona_vouchers(batch_id);
CREATE INDEX idx_persona_vouchers_org   ON persona_vouchers(organization_id);

CREATE TRIGGER trg_persona_vouchers_updated_at
  BEFORE UPDATE ON persona_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE persona_voucher_redemptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id        uuid NOT NULL REFERENCES persona_vouchers(id) ON DELETE CASCADE,
  redemption_token  uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  redeemer_name     text NOT NULL,
  redeemer_email    text NOT NULL,
  company_name      text NOT NULL,
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  result_id         uuid REFERENCES behavioral_assessment_sessions(id) ON DELETE SET NULL,
  ip                text,
  user_agent        text,
  redeemed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_persona_redemptions_voucher ON persona_voucher_redemptions(voucher_id);
CREATE INDEX idx_persona_redemptions_company ON persona_voucher_redemptions(company_name);
CREATE INDEX idx_persona_redemptions_token   ON persona_voucher_redemptions(redemption_token);

-- Org scoping + voucher linkage on the persona session row.
ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_redemption_id uuid REFERENCES persona_voucher_redemptions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_behavioral_sessions_org ON behavioral_assessment_sessions(organization_id);

CREATE OR REPLACE FUNCTION persona_voucher_claim(p_code text)
RETURNS TABLE (id uuid, organization_id uuid, client_name text, default_language text)
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE persona_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.organization_id, v.client_name, v.default_language;
$$;

ALTER TABLE persona_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY persona_vouchers_all_admin ON persona_vouchers
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY persona_redemptions_all_admin ON persona_voucher_redemptions
  FOR ALL USING (auth_role() = 'admin');
