-- ════════════════════════════════════════════════════════════════
-- Fluent voucher system - redeemable access codes for the English
-- placement test, mirroring the ARC + Technical voucher model.
--
-- An admin generates voucher codes (single or a seat-pool batch, tagged to a
-- client org). A delegate redeems a code on a public page (name + email +
-- COMPANY, required), which records a redemption + drops them into the test.
-- On completion the result is stamped with the client org, so the cohort report
-- can be filtered per client. Fluent is an AC-family service, so the org FK
-- points at `organizations` (the AC + Pre-Hire store).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE eng_fluent_vouchers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,                 -- normalized (uppercase), e.g. VIFM-ENG-7K3M-9QX2
  label             text,                                 -- admin note, e.g. "ADNOC intake Q3"
  batch_id          uuid,                                 -- groups codes generated together
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  client_name       text,                                 -- denormalized client tag
  default_language  text NOT NULL DEFAULT 'en' CHECK (default_language IN ('en','ar')),
  max_uses          int  NOT NULL DEFAULT 1 CHECK (max_uses >= 1),   -- seat pool size
  used_count        int  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eng_fluent_vouchers_code  ON eng_fluent_vouchers(code);
CREATE INDEX idx_eng_fluent_vouchers_batch ON eng_fluent_vouchers(batch_id);
CREATE INDEX idx_eng_fluent_vouchers_org   ON eng_fluent_vouchers(organization_id);

CREATE TRIGGER trg_eng_fluent_vouchers_updated_at
  BEFORE UPDATE ON eng_fluent_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- One row per redemption - audit + the required company tag + an unguessable
-- redemption_token the runner carries so the completed result links back.
CREATE TABLE eng_fluent_voucher_redemptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id        uuid NOT NULL REFERENCES eng_fluent_vouchers(id) ON DELETE CASCADE,
  redemption_token  uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  redeemer_name     text NOT NULL,
  redeemer_email    text NOT NULL,
  company_name      text NOT NULL,
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  result_id         uuid REFERENCES eng_fluent_results(id) ON DELETE SET NULL,
  ip                text,
  user_agent        text,
  redeemed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eng_fluent_redemptions_voucher ON eng_fluent_voucher_redemptions(voucher_id);
CREATE INDEX idx_eng_fluent_redemptions_company ON eng_fluent_voucher_redemptions(company_name);
CREATE INDEX idx_eng_fluent_redemptions_token   ON eng_fluent_voucher_redemptions(redemption_token);

-- Org scoping + voucher linkage on the result row.
ALTER TABLE eng_fluent_results
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_redemption_id uuid REFERENCES eng_fluent_voucher_redemptions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_eng_fluent_results_org ON eng_fluent_results(organization_id);

-- Atomic claim: validate (active, not expired, seats left) AND consume one seat
-- in a single statement so concurrent redemptions can't oversell a seat pool.
CREATE OR REPLACE FUNCTION eng_fluent_voucher_claim(p_code text)
RETURNS TABLE (id uuid, organization_id uuid, client_name text, default_language text)
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE eng_fluent_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.organization_id, v.client_name, v.default_language;
$$;

-- RLS: admin manages vouchers + reads redemptions. The public redeem flow and
-- the admin pages go through the service-role client (which bypasses RLS); these
-- are the session-scoped guard.
ALTER TABLE eng_fluent_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE eng_fluent_voucher_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY eng_fluent_vouchers_all_admin ON eng_fluent_vouchers
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY eng_fluent_redemptions_all_admin ON eng_fluent_voucher_redemptions
  FOR ALL USING (auth_role() = 'admin');
