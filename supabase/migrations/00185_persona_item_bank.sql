-- ════════════════════════════════════════════════════════════════
-- Persona managed item bank.
--
-- Persona's 164 behavioural self-report items lived only in code
-- (src/lib/scoring/behavioral-items.ts) - so they had no DB-backed review
-- lifecycle or SME console, unlike every other assessment portal. This promotes
-- them into a managed bank: one row per item, a pending -> approved SME review
-- gate, and a console at /admin/persona-bank. The runner reads the DB bank
-- (falling back to the code constant when the table is empty/unapplied), and a
-- Persona result is flagged "provisional" until its items are SME-approved.
--
-- 41 competencies x 4 first-person Likert items. Seeded 'pending' - the honest
-- reset: none of the items have been human-reviewed yet.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS persona_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ac_competency_id  uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  item_key          text NOT NULL UNIQUE,   -- stable code key, e.g. "01-1"
  ord               smallint NOT NULL DEFAULT 1,
  reverse           boolean NOT NULL DEFAULT false,
  text_en           text NOT NULL,
  text_ar           text,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','retired')),
  source            text NOT NULL DEFAULT 'seed_v1',
  ar_reviewed       boolean NOT NULL DEFAULT false,
  sme_reviewed_by   uuid,
  sme_reviewed_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_items_competency_status
  ON persona_items(ac_competency_id, status);

ALTER TABLE persona_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS persona_items_admin ON persona_items;
CREATE POLICY persona_items_admin ON persona_items
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
