-- ════════════════════════════════════════════════════════════════
-- 00190 - Techno voucher: authoritative organization_id (tenancy binding)
--
-- Migration 00187 added technical_sandbox_sessions.organization_id, but a
-- CLIENT-PORTAL-issued voucher still carried only a free-text organization_name,
-- so the session's org id was RESOLVED from that label at redeem time - and the
-- redeemer can type any company. Two orgs sharing a name (organizations.name has
-- no UNIQUE constraint) therefore both resolve to NULL and fall back to name-
-- equality gating in the client portal, letting one read the other's sittings.
--
-- The client-portal issuance path already knows the caller's authoritative org id
-- (resolved from their profile, never trusted from client input - see
-- src/lib/clients/voucher-issue.ts). Give the Techno voucher engine a column to
-- carry it, so a client-issued voucher binds its session to the ISSUING org id
-- (proof of issuance), not a redeemer-typed label. The admin free-text path
-- leaves it NULL and keeps the existing unique-name resolution.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_sandbox_vouchers
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS technical_sandbox_vouchers_org_idx
  ON technical_sandbox_vouchers (organization_id)
  WHERE organization_id IS NOT NULL;
