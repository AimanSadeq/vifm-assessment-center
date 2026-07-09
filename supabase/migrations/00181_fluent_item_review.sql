-- ════════════════════════════════════════════════════════════════
-- VIFM Fluent - review gate on the receptive item bank.
--
-- eng_fluent_items (00048) accumulates unreviewed AI items from sittings (status
-- draft, for calibration). To let Fluent SERVE a vetted bank instead of minting
-- live-AI per sitting, we add a review lifecycle: a curated item is seeded
-- 'in_review', an SME promotes it to 'live', and the runner assembles a CEFR-
-- ramped receptive test from the 'live' pool (falling back to live-AI when thin).
--
-- Additive + idempotent. 'live' stays the served state (irt.ts selectNextItem +
-- the assembler both key on it), so accumulated draft items are unaffected.
-- ════════════════════════════════════════════════════════════════

-- Widen the status CHECK to add the review states (the 00048 inline check is
-- auto-named eng_fluent_items_status_check).
ALTER TABLE eng_fluent_items DROP CONSTRAINT IF EXISTS eng_fluent_items_status_check;
ALTER TABLE eng_fluent_items ADD CONSTRAINT eng_fluent_items_status_check
  CHECK (status IN ('draft', 'calibrating', 'live', 'in_review', 'rejected', 'retired'));

-- Provenance + review columns (existing accumulated rows: source stays null).
ALTER TABLE eng_fluent_items ADD COLUMN IF NOT EXISTS source          text;
ALTER TABLE eng_fluent_items ADD COLUMN IF NOT EXISTS reviewed_by     uuid;
ALTER TABLE eng_fluent_items ADD COLUMN IF NOT EXISTS reviewed_at     timestamptz;
ALTER TABLE eng_fluent_items ADD COLUMN IF NOT EXISTS rejected_reason text;

-- The assembler draws live items per skill x CEFR label, least-served first.
CREATE INDEX IF NOT EXISTS eng_fluent_items_skill_status_idx
  ON eng_fluent_items(skill, status, cefr_label, n_responses);

-- Admin manages the bank (SELECT policy exists from 00048; widen to full manage
-- so the review console can update status via the service role anyway, but an
-- admin session can also read/write directly).
DROP POLICY IF EXISTS eng_fluent_items_admin_all ON eng_fluent_items;
CREATE POLICY eng_fluent_items_admin_all ON eng_fluent_items
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
