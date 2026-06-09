-- ============================================================
-- Reflect 360 — opt-in "gamified mode" toggle
-- Migration 00072
--
-- Adds a per-engagement boolean. When TRUE, raters get the gamified
-- (one-card-at-a-time) experience at /reflect/respond/[token]; when
-- FALSE (default) they get the existing standard 360 form. The
-- gamified flow writes the SAME reflect_responses rows via the SAME
-- server actions — scoring, reporting, and anonymity are unchanged.
--
-- Additive & safe: nullable-default boolean, no backfill needed.
-- ============================================================

ALTER TABLE reflect_engagements
  ADD COLUMN IF NOT EXISTS gamified_mode boolean NOT NULL DEFAULT false;
