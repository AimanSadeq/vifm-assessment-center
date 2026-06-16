-- ── Widen the credential type whitelist to admit the Reflect 360 credential ──
-- Brings Reflect 360 to the ARC bar: a verifiable completion credential for the
-- leadership-feedback participant, checkable at /verify/[code]. The CHECK (last
-- set in 00102) enumerated academy_completion / ac_ready_now / fluent_cefr /
-- technical_proficiency / ai_readiness; add reflect_360.

ALTER TABLE vifm_credentials DROP CONSTRAINT IF EXISTS vifm_credentials_credential_type_check;
ALTER TABLE vifm_credentials ADD CONSTRAINT vifm_credentials_credential_type_check
  CHECK (credential_type IN (
    'academy_completion',
    'ac_ready_now',
    'fluent_cefr',
    'technical_proficiency',
    'ai_readiness',
    'reflect_360'
  ));
