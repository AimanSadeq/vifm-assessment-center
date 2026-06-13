-- ════════════════════════════════════════════════════════════════
-- ARA voucher system — redeemable access codes for PRACTICE AI Readiness
-- Compass (ARC) runs.
--
-- An admin generates voucher codes (single or a seat-pool batch, optionally
-- tagged to a client org). A delegate redeems a code on a public page —
-- entering their name, email, and COMPANY NAME (required, for future per-company
-- insights) — which provisions an individual ARA run flagged is_sandbox=true
-- (practice) and drops them into /ara/respond/{token}.
--
-- Reuses the existing individual-assessment provisioning recipe (see
-- src/app/ara/consultant/personal-deep-dive/new/actions.ts): ara_organizations
-- → ara_assessments (engagement_stage='individual') → ara_respondents.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE ara_vouchers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,                 -- normalized (uppercase), e.g. VIFM-ARC-7K3M-9QX2
  label             text,                                 -- admin note, e.g. "ADNOC pilot"
  batch_id          uuid,                                 -- groups codes generated together
  organization_id   uuid REFERENCES ara_organizations(id) ON DELETE SET NULL,
  client_name       text,                                 -- denormalized client tag for the batch
  tier              text NOT NULL DEFAULT 'snapshot' CHECK (tier IN ('snapshot','deep_dive')),
  region            text NOT NULL DEFAULT 'uae'  CHECK (region IN ('uae','saudi')),
  default_language  text NOT NULL DEFAULT 'en'   CHECK (default_language IN ('en','ar')),
  max_uses          int  NOT NULL DEFAULT 1 CHECK (max_uses >= 1),   -- seat pool size
  used_count        int  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_practice       boolean NOT NULL DEFAULT true,         -- provisions runs with is_sandbox=true
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by        uuid,                                  -- platform_users.id (admin)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ara_vouchers_code  ON ara_vouchers(code);
CREATE INDEX idx_ara_vouchers_batch ON ara_vouchers(batch_id);
CREATE INDEX idx_ara_vouchers_org   ON ara_vouchers(organization_id);

CREATE TRIGGER trg_ara_vouchers_updated_at
  BEFORE UPDATE ON ara_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- One row per redemption — audit + linkage + the required company tag.
CREATE TABLE ara_voucher_redemptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id        uuid NOT NULL REFERENCES ara_vouchers(id) ON DELETE CASCADE,
  redeemer_name     text NOT NULL,
  redeemer_email    text NOT NULL,
  company_name      text NOT NULL,                         -- required; powers per-company insights
  ara_assessment_id uuid REFERENCES ara_assessments(id) ON DELETE SET NULL,
  ara_respondent_id uuid REFERENCES ara_respondents(id) ON DELETE SET NULL,
  ip                text,
  user_agent        text,
  redeemed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ara_voucher_redemptions_voucher ON ara_voucher_redemptions(voucher_id);
CREATE INDEX idx_ara_voucher_redemptions_company ON ara_voucher_redemptions(company_name);

-- Atomic claim: validate (active, not expired, seats left) AND consume one seat
-- in a single statement so concurrent redemptions can't oversell a seat pool.
-- Returns the voucher's provisioning fields, or no rows when invalid/exhausted.
CREATE OR REPLACE FUNCTION ara_voucher_claim(p_code text)
RETURNS TABLE (
  id uuid, tier text, region text, default_language text,
  organization_id uuid, client_name text, is_practice boolean
)
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE ara_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.tier, v.region, v.default_language,
            v.organization_id, v.client_name, v.is_practice;
$$;

-- RLS: admin manages vouchers + reads redemptions. The public redeem flow and
-- the admin pages both go through the service-role client (which bypasses RLS);
-- these policies are the session-scoped guard for when AUTH_ENABLED flips on.
ALTER TABLE ara_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ara_voucher_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ara_vouchers_all_admin ON ara_vouchers
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY ara_voucher_redemptions_all_admin ON ara_voucher_redemptions
  FOR ALL USING (auth_role() = 'admin');
