// Which text of a Phase 2 consultant note to print in which language.
//
// Storage contract (NOTES-07): `note_text` is ALWAYS the English text and
// `note_text_ar` the Arabic, whichever language the consultant wrote in
// (`note_language` records the original). A note written in Arabic is
// translated to English on save; if that translation failed, `note_text` still
// holds the Arabic original.
//
// NOTES-15: when a note has no Arabic yet, the Arabic side must not silently
// repeat the English as if it were a translation. In a bilingual (side-by-side)
// page the English column already carries it, so the Arabic column shows only a
// "translation pending" line; in an Arabic-only report the English is shown
// under that label so the finding is not lost.

export type NoteTextFields = {
  note_text: string;
  note_text_ar?: string | null;
};

export const NOTE_AR_PENDING = "الترجمة العربية لهذه الملاحظة قيد الإعداد.";
const NOTE_AR_PENDING_WITH_ORIGINAL = "الترجمة العربية قيد الإعداد - النص الأصلي بالإنجليزية:";

export function noteTextFor(
  n: NoteTextFields,
  lang: "en" | "ar",
  opts: { bilingual?: boolean } = {},
): string {
  if (lang === "en") return n.note_text;
  const ar = n.note_text_ar?.trim();
  if (ar) return ar;
  return opts.bilingual ? NOTE_AR_PENDING : `${NOTE_AR_PENDING_WITH_ORIGINAL}\n${n.note_text}`;
}
