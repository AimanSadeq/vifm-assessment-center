/**
 * Pick the locale-appropriate text for a DB row that carries an English column
 * plus an optional Arabic one — e.g. competencies.name / name_ar and
 * competencies.description / description_ar. Falls back to the English value
 * when the Arabic is missing, so partially-translated data still renders.
 *
 * `rtl` is `getServerDir(locale) === "rtl"` in server components, or the
 * client RTL flag — same one used by the Reflect bilingual display.
 */

export function localizedName(
  row: { name?: string | null; name_ar?: string | null } | null | undefined,
  rtl: boolean,
): string {
  if (!row) return "";
  return (rtl ? row.name_ar : null) || row.name || "";
}

export function localizedDescription(
  row: { description?: string | null; description_ar?: string | null } | null | undefined,
  rtl: boolean,
): string {
  if (!row) return "";
  return (rtl ? row.description_ar : null) || row.description || "";
}
