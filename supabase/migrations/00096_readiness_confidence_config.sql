-- ============================================================
-- 00096 - Readiness engine v2: advisory-confidence config
--
-- Two tunables the v2 engine reads (readiness.ts): the borderline band (how
-- close to a tier cutoff counts as a "near-call") and the rater-agreement
-- spread max (Others spread at/above this flags low agreement on a competency).
-- Both are ADVISORY - they never change the tier.
--
-- (Delivered as handover "00085"; renumbered to 00096 - readiness landed at
-- 00087-00095.) Defaults mirror DEFAULT_READINESS_CONFIG. Idempotent.
-- ============================================================

ALTER TABLE readiness_index_config
  ADD COLUMN IF NOT EXISTS borderline_band numeric(3,2) NOT NULL DEFAULT 0.10
    CHECK (borderline_band >= 0),
  ADD COLUMN IF NOT EXISTS rater_agreement_spread_max numeric(3,2) NOT NULL DEFAULT 3.00
    CHECK (rater_agreement_spread_max >= 0);
