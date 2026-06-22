-- 00151: client_service_allocations - the admin-granted voucher/seat quota that a
-- client manager draws from, per (organization, service). ADDITIVE: a new table,
-- new helper functions, atomic claim/release RPCs, and RLS on the new table only.
-- Nothing existing is altered. Requires 00150 (the 'client_manager' role value +
-- caliber_service enum) applied first.

-- ── The allocation ledger ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_service_allocations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Canonical AC-store org (the one profiles.organization_id uses).
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Matching ARA-store org, resolved at grant via the registry (for ARC/Reflect).
  ara_organization_id uuid REFERENCES ara_organizations(id) ON DELETE SET NULL,
  service             caliber_service NOT NULL,
  seats_total         int NOT NULL DEFAULT 0 CHECK (seats_total >= 0),
  seats_used          int NOT NULL DEFAULT 0 CHECK (seats_used >= 0),
  expires_at          timestamptz,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  -- Admin-pinned per-service config the client cannot override (e.g. Persona
  -- purpose/target role, Techno function, ARC tier/region).
  service_config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes               text,
  granted_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT csa_seats_within_total CHECK (seats_used <= seats_total),
  CONSTRAINT csa_org_service_unique UNIQUE (organization_id, service)
);

CREATE INDEX IF NOT EXISTS idx_csa_org ON client_service_allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_csa_service ON client_service_allocations(service);

DROP TRIGGER IF EXISTS client_service_allocations_updated_at ON client_service_allocations;
CREATE TRIGGER client_service_allocations_updated_at
  BEFORE UPDATE ON client_service_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Client-manager org-scoping helpers (mirror ara_is_assessment_owner) ───────
CREATE OR REPLACE FUNCTION cm_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM profiles
  WHERE id = auth.uid() AND role = 'client_manager';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION cm_ara_org_id()
RETURNS uuid AS $$
  SELECT ara_organization_id FROM client_service_allocations
  WHERE organization_id = cm_org_id() AND ara_organization_id IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION cm_has_allocation(p_service caliber_service)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_service_allocations a
    WHERE a.organization_id = cm_org_id()
      AND a.service = p_service
      AND a.status = 'active'
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND a.seats_used < a.seats_total
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Atomic seat claim / release (race-safe, mirrors eng_fluent_voucher_claim) ─
-- claim returns the updated allocation row, or NULL when there is no active,
-- unexpired allocation with enough remaining seats (caller treats NULL as
-- "over quota / expired / not granted").
CREATE OR REPLACE FUNCTION claim_allocation_seats(
  p_org uuid, p_service caliber_service, p_count int
) RETURNS client_service_allocations AS $$
DECLARE
  result client_service_allocations;
BEGIN
  IF p_count <= 0 THEN
    RAISE EXCEPTION 'claim_allocation_seats: count must be positive';
  END IF;
  UPDATE client_service_allocations a
     SET seats_used = a.seats_used + p_count,
         updated_at = now()
   WHERE a.organization_id = p_org
     AND a.service = p_service
     AND a.status = 'active'
     AND (a.expires_at IS NULL OR a.expires_at > now())
     AND a.seats_used + p_count <= a.seats_total
   RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION release_allocation_seats(
  p_org uuid, p_service caliber_service, p_count int
) RETURNS void AS $$
BEGIN
  UPDATE client_service_allocations a
     SET seats_used = GREATEST(0, a.seats_used - p_count),
         updated_at = now()
   WHERE a.organization_id = p_org
     AND a.service = p_service;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS: admin full; client_manager reads only their own org's allocations ────
-- (Service-role server actions bypass RLS; these are the defense-in-depth
-- backstop for the authenticated client-manager session.)
ALTER TABLE client_service_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS csa_all_admin ON client_service_allocations;
CREATE POLICY csa_all_admin ON client_service_allocations
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS csa_select_cm ON client_service_allocations;
CREATE POLICY csa_select_cm ON client_service_allocations
  FOR SELECT USING (auth_role() = 'client_manager' AND organization_id = cm_org_id());
