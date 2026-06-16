-- ── Widen the credential type whitelist to admit the ARC "AI Readiness" type ──
-- The CHECK (last set in 00053) enumerated academy_completion / ac_ready_now /
-- fluent_cefr / technical_proficiency, so an INSERT of an ai_readiness credential
-- would be rejected at the DB. Re-create the constraint to include it.
--
-- ARC issues this individual, verifiable credential when a person completes a
-- personal AI-readiness assessment (Mode A snapshot, Mode B deep-dive, or a
-- Mode C individual respondent). It is checkable at /verify/[code], parallel to
-- the Fluent CEFR + Technical proficiency credentials.

ALTER TABLE vifm_credentials DROP CONSTRAINT IF EXISTS vifm_credentials_credential_type_check;
ALTER TABLE vifm_credentials ADD CONSTRAINT vifm_credentials_credential_type_check
  CHECK (credential_type IN (
    'academy_completion',
    'ac_ready_now',
    'fluent_cefr',
    'technical_proficiency',
    'ai_readiness'
  ));
