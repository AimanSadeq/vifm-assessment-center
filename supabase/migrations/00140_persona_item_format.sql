-- ════════════════════════════════════════════════════════════════
-- 00140 - Persona item-format option (SD-9)
--
-- Persona already collects BOTH a normative (agree/disagree Likert) and an
-- ipsative (most/least forced-choice) section in every sitting. This adds an
-- admin/voucher-pinnable CHOICE of which format(s) to serve:
--   'normative' - Likert only
--   'ipsative'  - forced-choice only
--   'both'      - current behaviour (default; nothing changes for legacy rows)
--
-- This is a PRESENTATION choice only. Scoring is unchanged: ipsative picks
-- continue to map to a pseudo-Likert (most=5 / least=1) pooled into the
-- per-competency mean, and forced-choice picks remain the advisory consistency
-- signal. True ipsative (rank-based / Thurstonian) scoring is NOT implemented -
-- the methodology brief documents this as forced-choice presentation, not
-- ipsative measurement.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS, safe DEFAULT). Tolerant:
-- the session insert peels this column on a missing-column error.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS item_format text NOT NULL DEFAULT 'both'
    CHECK (item_format IN ('normative', 'ipsative', 'both'));

ALTER TABLE persona_vouchers
  ADD COLUMN IF NOT EXISTS item_format text NOT NULL DEFAULT 'both'
    CHECK (item_format IN ('normative', 'ipsative', 'both'));
