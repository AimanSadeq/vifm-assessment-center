-- ============================================================
-- 00235 - Logica: drawn figures for matrix items.
--
-- Ali (SDC pilot, 10 Oct 2026): the inductive "matrix" items described each
-- grid in words and stated the rule that solves it, so they measured reading
-- rather than reasoning and could be pasted into a chatbot whole.
--
--   psy_items.figure  optional jsonb spec of the grid and one drawing per
--                     option (see src/lib/psychometrics/figure.ts). Drawn
--                     client-side with plain SVG elements; never markup.
--                     NULL for every text item, which serve exactly as before.
--
-- The content itself (10 redrawn items) is loaded separately, after SME
-- review, by scripts/sdc-hipo/logica-figures-load.sql.
-- ADDITIVE. Idempotent / re-runnable.
-- ============================================================

ALTER TABLE psy_items ADD COLUMN IF NOT EXISTS figure jsonb;

COMMENT ON COLUMN psy_items.figure IS
  'Logica figure spec {cols, cells[], options[]} drawn as SVG by the client; options align with options_en/options_ar. NULL = text item.';
