-- ════════════════════════════════════════════════════════════════
-- Technical sandbox voucher system — redeemable access codes for the
-- performance-based technical assessment.
--
-- Mirrors the ARC voucher system (00075). An admin generates codes (single or a
-- seat-pool batch, tagged to a client org and bound to ONE function, e.g. FP&A
-- 1.7). A delegate redeems a code on a public page — name + email + company —
-- which provisions a technical_sandbox_session and drops them into
-- /tech-sandbox/{token}. Lets a client self-distribute "give me 20 codes".
-- ════════════════════════════════════════════════════════════════

CREATE TABLE technical_sandbox_vouchers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,                 -- normalized (uppercase), e.g. VIFM-TECH-7K3M-9QX2
  label             text,                                 -- admin note, e.g. "ADNOC FP&A pilot"
  batch_id          uuid,                                 -- groups codes generated together
  function_id       uuid NOT NULL REFERENCES technical_functions(id) ON DELETE CASCADE,
  organization_name text,                                 -- denormalized client tag for the batch
  max_uses          int  NOT NULL DEFAULT 1 CHECK (max_uses >= 1),  -- seat pool size
  used_count        int  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tech_vouchers_code     ON technical_sandbox_vouchers(code);
CREATE INDEX idx_tech_vouchers_batch    ON technical_sandbox_vouchers(batch_id);
CREATE INDEX idx_tech_vouchers_function ON technical_sandbox_vouchers(function_id);

CREATE TRIGGER trg_technical_sandbox_vouchers_updated_at
  BEFORE UPDATE ON technical_sandbox_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE technical_sandbox_voucher_redemptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id     uuid NOT NULL REFERENCES technical_sandbox_vouchers(id) ON DELETE CASCADE,
  redeemer_name  text NOT NULL,
  redeemer_email text NOT NULL,
  company_name   text NOT NULL,
  session_id     uuid REFERENCES technical_sandbox_sessions(id) ON DELETE SET NULL,
  ip             text,
  user_agent     text,
  redeemed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tech_voucher_redemptions_voucher ON technical_sandbox_voucher_redemptions(voucher_id);
CREATE INDEX idx_tech_voucher_redemptions_company ON technical_sandbox_voucher_redemptions(company_name);

-- Atomic claim: validate + consume one seat in a single statement so concurrent
-- redemptions can't oversell a seat pool. Returns the function + org, or no rows.
CREATE OR REPLACE FUNCTION technical_sandbox_voucher_claim(p_code text)
RETURNS TABLE (id uuid, function_id uuid, organization_name text)
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE technical_sandbox_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.function_id, v.organization_name;
$$;

-- Release a consumed seat (used when post-claim provisioning fails) so a
-- transient error doesn't permanently burn a seat. Never drops below zero.
CREATE OR REPLACE FUNCTION technical_sandbox_voucher_release(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE technical_sandbox_vouchers
     SET used_count = GREATEST(used_count - 1, 0)
   WHERE id = p_id;
$$;

ALTER TABLE technical_sandbox_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_sandbox_voucher_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_vouchers_all_admin ON technical_sandbox_vouchers
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY tech_voucher_redemptions_all_admin ON technical_sandbox_voucher_redemptions
  FOR ALL USING (auth_role() = 'admin');
