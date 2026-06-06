-- ════════════════════════════════════════════════════════════════
-- Psychometrics Tier 2 — calibration substrate (norms + IRT)
--
-- Tier 1 (migrations 00065/00066) is INDICATIVE: classical % / Likert scoring,
-- raw-score bands, no local norms, no item calibration. This migration adds the
-- substrate that makes the SAME instrument norm-referenced and defensible once a
-- pilot/norm sample exists — without changing the Tier-1 path:
--
--   • psy_norms — the norm-group conversion per (kind, scale): n + mean + sd, so
--     a raw score becomes a z-score → percentile → sten relative to the reference
--     population (e.g. "GCC finance professionals"). Empty table ⇒ stays Tier 1.
--   • psy_items.irt_difficulty / irt_discrimination — per-item IRT (Rasch/2PL)
--     parameters, estimated from accumulated psy_item_responses (the runner
--     already logs them). Null until calibrated; enables adaptive testing later.
--
-- Reliability (Cronbach's α) is computed on demand from psy_item_responses — no
-- table needed. All admin-managed; additive + tolerant (Tier 1 unaffected).
-- ════════════════════════════════════════════════════════════════

-- ── Norm groups: raw → standardized conversion per scale ─────────
CREATE TABLE IF NOT EXISTS psy_norms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('cognitive','personality')),
  scale_key     text NOT NULL,            -- subtest key / 'g' / OCEAN trait (O/C/E/A/S)
  n             integer NOT NULL CHECK (n > 0),   -- norm sample size
  mean          numeric NOT NULL,         -- raw-score mean in the norm group
  sd            numeric NOT NULL CHECK (sd > 0),  -- raw-score SD (> 0)
  source        text,                     -- e.g. 'GCC finance professionals 2026 (pilot)'
  method        text NOT NULL DEFAULT 'parametric',
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, scale_key)
);

-- ── IRT calibration parameters on the forward item bank ──────────
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS irt_difficulty     numeric;  -- b (location)
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS irt_discrimination numeric;  -- a (slope; 1.0 ⇒ Rasch)
ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS calibrated_at      timestamptz;

-- ── RLS: framework metadata — admin manages, admin reads ─────────
ALTER TABLE psy_norms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psy_norms_admin ON psy_norms;
CREATE POLICY psy_norms_admin ON psy_norms
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
