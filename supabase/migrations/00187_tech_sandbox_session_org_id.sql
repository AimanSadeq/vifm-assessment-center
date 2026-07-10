-- ─────────────────────────────────────────────────────────────
-- Techno client-portal tenancy: bind a completed sitting to a REAL
-- organization id, not just a free-text org name.
--
-- The client-portal manager's on-screen development report
-- (/admin/tech-sandbox/results/[token]) and the intelligence-sheet list
-- (src/lib/clients/monitor.ts) scoped a client_manager to their org by
-- organization_name STRING EQUALITY. technical_sandbox_sessions has no
-- ownership id, and organizations.name has no UNIQUE constraint - so two
-- distinct orgs sharing a name (common in the GCC, e.g. "Ministry of
-- Finance") could read each other's candidate PII (name, email, scores,
-- narrative, PDF token).
--
-- This adds an ownership FK. IMPORTANT - it is NOT a cryptographic proof of
-- ownership: the id is RESOLVED from the same free-text org label the sitting
-- was created with (in the voucher path, the redeemer-typed company). Its value
-- is (a) collision-resistance - once a label maps to exactly one org the gate
-- compares ids, so a later same-named org can't start matching an already-bound
-- sitting; and (b) stability - the binding survives an org rename. It is nullable
-- and best-effort: a label resolving to EXACTLY ONE organization (case-
-- insensitive, trimmed) gets the id; ambiguous or unmatched names stay NULL and
-- keep the legacy name-gate (the app gates on the id when present, name
-- otherwise). Exact, trustworthy binding would need the issuing org's id threaded
-- onto the invite/voucher at creation (a follow-up). ON DELETE SET NULL so
-- removing an org never deletes a candidate's sitting.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE technical_sandbox_sessions
  ADD COLUMN IF NOT EXISTS organization_id uuid
    REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tech_sandbox_sessions_org
  ON technical_sandbox_sessions(organization_id);

-- Backfill: stamp the id only where the trimmed, case-insensitive name maps to
-- a SINGLE organization. Duplicate-named orgs (count > 1) are deliberately left
-- NULL - we cannot disambiguate which org a free-text label meant, so those
-- sittings continue to use the name-gate rather than guess an owner.
UPDATE technical_sandbox_sessions s
SET organization_id = m.id
FROM (
  -- One org per name group (HAVING count = 1); array_agg[1] picks it. min()/max()
  -- have no uuid aggregate in Postgres, so pull the single id out of an array.
  SELECT lower(btrim(name)) AS lname, (array_agg(id))[1] AS id
  FROM organizations
  WHERE name IS NOT NULL AND btrim(name) <> ''
  GROUP BY lower(btrim(name))
  HAVING count(*) = 1
) m
WHERE s.organization_id IS NULL
  AND s.organization_name IS NOT NULL
  AND lower(btrim(s.organization_name)) = m.lname;
