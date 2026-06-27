-- Persist the client contact captured in the voucher wizard's step 1 across
-- every voucher service. Three nullable text columns on each *_vouchers table:
-- contact_name / contact_title / contact_email. UI-only until now; this stores
-- them on the issued voucher for the record. Idempotent (IF NOT EXISTS).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ara_vouchers',
    'persona_vouchers',
    'cognitive_vouchers',
    'eng_fluent_vouchers',
    'technical_sandbox_vouchers',
    'prehire_vouchers',
    'rr_vouchers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only touch tables that actually exist in this environment.
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS contact_name  text', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS contact_title text', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS contact_email text', t);
    END IF;
  END LOOP;
END $$;

-- rr_vouchers is role-scoped and never had client_name / project_label /
-- expires_at columns (the others do). Add them so Role Readiness can persist the
-- same step-1 details as every other portal.
DO $$
BEGIN
  IF to_regclass('public.rr_vouchers') IS NOT NULL THEN
    ALTER TABLE public.rr_vouchers ADD COLUMN IF NOT EXISTS client_name   text;
    ALTER TABLE public.rr_vouchers ADD COLUMN IF NOT EXISTS project_label text;
    ALTER TABLE public.rr_vouchers ADD COLUMN IF NOT EXISTS expires_at    timestamptz;
  END IF;
END $$;
