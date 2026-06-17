-- ════════════════════════════════════════════════════════════════
-- 00114 - Backfill SAMA CSF requirement-level applies_to_sectors
--
-- The original 00113 requirement INSERT omitted the applies_to_sectors
-- column, so the 6 SAU_SAMA_01..06 rows inherited the table default
-- '["all"]'::jsonb (00007). The framework-level gate (applies_to_sectors
-- = ["banking"]) already scopes SAMA to banking, so this is harmless
-- today - but it breaks the 00008 convention where every sector-
-- restricted framework propagates its sector onto its requirement rows
-- (defense-in-depth for any path that loads requirements directly).
--
-- 00113 has since been edited to seed ["banking"] on fresh installs;
-- this migration corrects DBs that already applied the original 00113.
--
-- Idempotent: the WHERE clause only touches the SAMA requirement rows
-- and re-running is a no-op once they are already ["banking"].
-- ════════════════════════════════════════════════════════════════

UPDATE ara_regulatory_requirements
SET applies_to_sectors = '["banking"]'::jsonb
WHERE framework_id = (
  SELECT id FROM ara_regulatory_frameworks WHERE framework_code = 'SAU_SAMA_CSF'
)
AND applies_to_sectors <> '["banking"]'::jsonb;
