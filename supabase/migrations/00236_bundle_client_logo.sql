-- ============================================================
-- 00236 - Bespoke bundle: client logo on the candidate screens.
--
-- SDC asked for its logo on the sign-in and welcome screens (Suzanne,
-- 13 Oct 2026). The logo is a file shipped with the platform under
-- /client-logos/, so a candidate's browser loads nothing from another
-- host (keeps the client's whitelisting to the platform domain).
-- ADDITIVE: NULL keeps the current VIFM-only screens.
-- Idempotent / re-runnable.
-- ============================================================

ALTER TABLE bundle_settings ADD COLUMN IF NOT EXISTS client_logo_url text;

ALTER TABLE bundle_settings DROP CONSTRAINT IF EXISTS bundle_settings_client_logo_url_check;
ALTER TABLE bundle_settings ADD CONSTRAINT bundle_settings_client_logo_url_check
  CHECK (client_logo_url IS NULL OR client_logo_url ~ '^/client-logos/[A-Za-z0-9._-]+\.(png|svg|jpg|jpeg|webp)$');
