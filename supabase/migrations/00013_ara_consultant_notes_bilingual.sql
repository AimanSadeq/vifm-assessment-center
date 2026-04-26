-- Bilingual consultant notes
-- =================================================================
-- Adds a paired Arabic translation column to ara_consultant_notes so
-- the bilingual report can show real Arabic content under "Key
-- findings" instead of repeating the original English text on the
-- right column.
--
-- The column is nullable. When NULL, the bilingual report should fall
-- back to a translation-pending placeholder (rendered in the original
-- language with a small caption) rather than show duplicate content.
-- The translation is filled either by the consultant manually editing
-- the AR field, or auto-generated via Claude when the consultant
-- saves the EN note (see src/lib/ai/translate.ts).
--
-- This migration overrides the §5.4 handover note that open-text
-- content is never translated. The product owner reviewed the
-- bilingual report and asked for translated finding bodies.

ALTER TABLE ara_consultant_notes
  ADD COLUMN IF NOT EXISTS note_text_ar text;

COMMENT ON COLUMN ara_consultant_notes.note_text_ar IS
  'Optional Arabic translation of note_text. Auto-generated via Claude on save when ANTHROPIC_API_KEY is configured; can be hand-edited.';
