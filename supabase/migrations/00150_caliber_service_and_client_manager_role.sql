-- 00150: client_manager role + caliber_service enum
-- Foundation for the client self-service portal. ADDITIVE ONLY: a new role enum
-- value and a new type. No existing role, table, policy, or column is changed.
--
-- NOTE: ALTER TYPE ... ADD VALUE adds the value but it cannot be USED in the same
-- transaction it was added in. That is why the policies that reference
-- 'client_manager' live in later migrations (00151+), applied separately.

-- A VIFM-provisioned client manager who runs their org's assessment programme.
-- Distinct from the read-only 'client' role so existing client SELECT policies
-- are not widened.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client_manager';

-- The seven services a client voucher allocation can cover.
DO $$
BEGIN
  CREATE TYPE caliber_service AS ENUM (
    'arc', 'techno', 'logica', 'prehire', 'persona', 'fluent', 'reflect'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
