-- 00152: lock down the allocation seat RPCs to service_role only (security fix).
--
-- claim_allocation_seats / release_allocation_seats (00151) are SECURITY DEFINER
-- and trust a CALLER-SUPPLIED p_org (not derived from auth.uid()). By default
-- Postgres grants EXECUTE on a function to PUBLIC and PostgREST exposes
-- public-schema RPCs to the authenticated role - so a logged-in client_manager
-- could call these straight from the browser with ANOTHER org's id and tamper
-- with that org's seat ledger (deplete remaining seats, or zero seats_used).
-- The server actions call them via the service-role client (createServiceClient),
-- so revoke the implicit PUBLIC/authenticated EXECUTE and grant only service_role.
--
-- Also adds the missing non-negative-count guard to release_allocation_seats
-- (claim already has it) so a future off-by-one / negative count can't inflate
-- seats_used. ADDITIVE: only re-defines one function body + adjusts grants.

-- Re-define release with a guard (best-effort path -> RETURN, not RAISE, since
-- the caller wrapper swallows errors and a non-positive release is a no-op).
CREATE OR REPLACE FUNCTION release_allocation_seats(
  p_org uuid, p_service caliber_service, p_count int
) RETURNS void AS $$
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN;
  END IF;
  UPDATE client_service_allocations a
     SET seats_used = GREATEST(0, a.seats_used - p_count),
         updated_at = now()
   WHERE a.organization_id = p_org
     AND a.service = p_service;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lock down EXECUTE: revoke the implicit PUBLIC grant (which also reaches anon /
-- authenticated / service_role via role inheritance), then grant ONLY to
-- service_role. The explicit anon/authenticated revokes are belt-and-suspenders.
REVOKE EXECUTE ON FUNCTION claim_allocation_seats(uuid, caliber_service, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION release_allocation_seats(uuid, caliber_service, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_allocation_seats(uuid, caliber_service, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION release_allocation_seats(uuid, caliber_service, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_allocation_seats(uuid, caliber_service, int) TO service_role;
GRANT EXECUTE ON FUNCTION release_allocation_seats(uuid, caliber_service, int) TO service_role;

-- NOTE: cm_org_id() / cm_ara_org_id() / cm_has_allocation() are intentionally
-- left PUBLIC-executable - they self-derive the org from auth.uid() (cm_org_id),
-- so a client_manager calling them only ever sees their OWN org; no cross-tenant
-- surface. They also back the RLS USING clauses, which run as the table owner.
