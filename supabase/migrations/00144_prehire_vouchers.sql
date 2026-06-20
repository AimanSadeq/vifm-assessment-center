-- Pre-Hire vouchers: a client-distributable redeemable code (or seat-pool batch)
-- tied to a REQUISITION. A no-account applicant self-redeems at /prehire/redeem,
-- which creates a prehire_candidate on that requisition and drops them straight
-- into the existing apply flow (consent -> quiz -> fluent -> cbi -> demographics).
-- Mirrors the technical_sandbox_vouchers model: an atomic claim RPC consumes a
-- seat, and a release RPC rolls it back if downstream provisioning fails.

CREATE TABLE IF NOT EXISTS prehire_vouchers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,                 -- normalized (uppercase), e.g. VIFM-HIRE-7K3M-9QX2
  label             text,                                 -- admin note, e.g. "ADNOC analyst intake"
  batch_id          uuid,                                 -- groups codes generated together
  requisition_id    uuid NOT NULL REFERENCES prehire_requisitions(id) ON DELETE CASCADE,
  organization_name text,                                 -- denormalized client tag for the batch
  max_uses          int  NOT NULL DEFAULT 1 CHECK (max_uses >= 1),  -- seat-pool size
  used_count        int  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  assigned_name     text,                                 -- set for named single-use delegate codes
  assigned_email    text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prehire_vouchers_requisition ON prehire_vouchers(requisition_id);
CREATE INDEX IF NOT EXISTS idx_prehire_vouchers_batch ON prehire_vouchers(batch_id);

-- One row per redemption. candidate_id soft-links the prehire_candidate the
-- redemption provisioned (SET NULL if the candidate is later removed).
CREATE TABLE IF NOT EXISTS prehire_voucher_redemptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id     uuid NOT NULL REFERENCES prehire_vouchers(id) ON DELETE CASCADE,
  redeemer_name  text NOT NULL,
  redeemer_email text NOT NULL,
  company_name   text,
  candidate_id   uuid REFERENCES prehire_candidates(id) ON DELETE SET NULL,
  ip             text,
  user_agent     text,
  redeemed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prehire_voucher_redemptions_voucher ON prehire_voucher_redemptions(voucher_id);

-- Atomic seat claim: increments used_count iff the code is active, not expired,
-- and has a free seat. Returns the requisition to provision against (empty set
-- when the code is invalid/disabled/expired/exhausted).
CREATE OR REPLACE FUNCTION prehire_voucher_claim(p_code text)
RETURNS TABLE (id uuid, requisition_id uuid, organization_name text)
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE prehire_vouchers v
     SET used_count = v.used_count + 1
   WHERE v.code = upper(btrim(p_code))
     AND v.status = 'active'
     AND v.used_count < v.max_uses
     AND (v.expires_at IS NULL OR v.expires_at > now())
  RETURNING v.id, v.requisition_id, v.organization_name;
$$;

-- Roll back a claimed seat when downstream provisioning (candidate insert) fails.
CREATE OR REPLACE FUNCTION prehire_voucher_release(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE prehire_vouchers
     SET used_count = GREATEST(used_count - 1, 0)
   WHERE id = p_id;
$$;

ALTER TABLE prehire_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prehire_voucher_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin-only direct access (create/list/disable go through the service-role
-- client in the app; redemption uses the SECURITY DEFINER RPC above).
CREATE POLICY prehire_vouchers_all_admin ON prehire_vouchers
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY prehire_voucher_redemptions_all_admin ON prehire_voucher_redemptions
  FOR ALL USING (auth_role() = 'admin');
