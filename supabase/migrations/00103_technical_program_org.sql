-- Technical programs: bind to a first-class platform client.
-- A program previously carried only the free-text organization_name. The
-- standalone pattern (matching ARC / Reflect) registers the client through the
-- shared registry (createClientOrganization) and links it here by id, so the
-- program's org is a real, cross-service platform client. Nullable + ON DELETE
-- SET NULL so legacy rows (and the name-only fallback) keep working.

ALTER TABLE technical_programs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_technical_programs_org ON technical_programs(organization_id);
