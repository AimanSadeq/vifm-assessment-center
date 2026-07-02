-- ============================================================
-- Bespoke bundles: per-service configuration
-- The generic 'bundle' composer already persists WHICH services a
-- package combines (service_keys). This adds HOW each is scoped,
-- e.g. {"logica": {"subtests": ["inductive"]}}. '{}' = no per-service
-- options (every pre-existing row).
-- ============================================================

ALTER TABLE bespoke_services
  ADD COLUMN IF NOT EXISTS service_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bespoke_services.service_config IS
  'Per-service options for bundle rows, keyed by service id (e.g. {"logica":{"subtests":["inductive"]}}). Empty object = defaults.';
