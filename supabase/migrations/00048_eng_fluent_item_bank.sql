-- ============================================================
-- VIFM Fluent — item bank + response log (CAT groundwork)
--
-- The "path to near-certification": a calibrated item bank with IRT/Rasch
-- difficulty parameters, so a future computer-adaptive flow can serve items
-- by ability and report a true standard error (tightening the Phase-1c band).
--
-- Built as SUBSTRATE now — it starts accumulating data immediately:
--   eng_fluent_items          : one row per distinct receptive item, keyed by
--                               a content_hash so identical generated items
--                               merge and accumulate responses across sessions.
--   eng_fluent_item_responses : one row per answered receptive item (which
--                               option, right/wrong) — the data the calibration
--                               script (scripts/fluent-calibrate-items.ts) turns
--                               into a Rasch difficulty (irt_b) once enough
--                               responses exist.
--
-- Adaptive item SELECTION (src/lib/scoring/irt.ts selectNextItem) ships but
-- stays dark until items reach status='live'. Writes are best-effort from the
-- scoring route, so a DB without this migration keeps working unchanged.
-- ============================================================

CREATE TABLE IF NOT EXISTS eng_fluent_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill         text NOT NULL CHECK (skill IN ('reading', 'listening')),
  content_hash  text NOT NULL UNIQUE,        -- sha256 of the item content (stable identity)
  stem          jsonb NOT NULL,              -- passage/script + question + options + correct_index + cefr
  cefr_label    text,                        -- LLM-assigned difficulty band
  irt_b         double precision,            -- Rasch difficulty (null until calibrated)
  irt_se        double precision,            -- standard error of irt_b
  n_responses   int NOT NULL DEFAULT 0,      -- denormalised by the calibration script
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calibrating', 'live')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eng_fluent_item_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES eng_fluent_items(id) ON DELETE CASCADE,
  session_id    uuid,
  chosen_index  int,
  correct       boolean NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eng_fluent_item_responses_item_idx ON eng_fluent_item_responses (item_id);

ALTER TABLE eng_fluent_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE eng_fluent_item_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eng_fluent_items_admin ON eng_fluent_items;
CREATE POLICY eng_fluent_items_admin ON eng_fluent_items
  FOR SELECT USING (auth_role() = 'admin');

DROP POLICY IF EXISTS eng_fluent_item_responses_admin ON eng_fluent_item_responses;
CREATE POLICY eng_fluent_item_responses_admin ON eng_fluent_item_responses
  FOR SELECT USING (auth_role() = 'admin');
