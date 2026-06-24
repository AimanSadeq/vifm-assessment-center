-- 00164: One credential per (source_id, credential_type) - the DB-level backstop
-- behind issueCredential()'s idempotency pre-check.
--
-- A credential is keyed by its source outcome (a result-row id) plus its type,
-- so a single source can mint at most ONE credential of a given type. This makes
-- every retry / re-score / double-submit / replay path idempotent at the data
-- layer: even if two concurrent issuances slip past the application pre-check,
-- the second insert fails the unique index and issueCredential() falls back to
-- reusing the credential the race winner created.
--
-- Anonymous results (e.g. a Fluent placement with no candidate) carry a NULL
-- source_id and each is a legitimately distinct issuance, so the index is
-- PARTIAL - it constrains only rows WHERE source_id IS NOT NULL. (NULLs are
-- already distinct for uniqueness, but the explicit predicate states the intent
-- and keeps the index small.)

-- 1) De-conflict any pre-existing duplicates so the unique index can be built.
--    Credentials may already sit in a holder's wallet or have been verified
--    externally, so we do NOT delete or revoke them - we keep the EARLIEST
--    issued credential per (source_id, type) as canonical and detach the
--    later duplicates from the source (source_id -> NULL). The duplicates stay
--    valid + verifiable; they simply lose the source back-link (a replay
--    artifact), which exempts them from the partial index below.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY source_id, credential_type
      ORDER BY issued_at ASC, id ASC
    ) AS rn
  FROM public.vifm_credentials
  WHERE source_id IS NOT NULL
)
UPDATE public.vifm_credentials c
SET source_id = NULL
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- 2) The partial unique index. IF NOT EXISTS keeps the migration idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS vifm_credentials_source_type_uniq
  ON public.vifm_credentials (source_id, credential_type)
  WHERE source_id IS NOT NULL;
