-- ============================================================
-- Logica voucher subtest scope
-- Lets an admin issue a voucher for a specific subtest selection
-- (e.g. Inductive Reasoning only). NULL = full battery (all four),
-- which is also the meaning for every pre-existing voucher.
-- The take page + start API read this to lock the delegate's set.
-- ============================================================

ALTER TABLE cognitive_vouchers
  ADD COLUMN IF NOT EXISTS subtests text[] NULL
  CHECK (
    subtests IS NULL
    OR (
      array_length(subtests, 1) >= 1
      AND subtests <@ ARRAY['numerical', 'verbal', 'inductive', 'deductive']::text[]
    )
  );

COMMENT ON COLUMN cognitive_vouchers.subtests IS
  'Logica subtest scope for this voucher (subset of numerical/verbal/inductive/deductive). NULL = full battery.';
