import { VIFM_VERTICAL_LABELS } from "@/types/database";

/**
 * Resolve a course vertical key to a localized label using the provided
 * translator. Accepts either the server `getServerT` result or react-i18next's
 * `t` (both satisfy `(key: string) => string`). Falls back to the English
 * `VIFM_VERTICAL_LABELS` const, then the raw key, if the `verticals.*` namespace
 * is missing - so it never renders a bare i18n key.
 *
 * Machine-facing surfaces (CSV/JSON export, the English PDF report) should keep
 * using `VIFM_VERTICAL_LABELS` directly; this helper is for locale-aware UI.
 */
export function verticalLabel(t: (key: string) => string, vertical: string): string {
  const translated = t(`verticals.${vertical}`);
  if (!translated.startsWith("verticals.")) return translated;
  return VIFM_VERTICAL_LABELS[vertical as keyof typeof VIFM_VERTICAL_LABELS] ?? vertical;
}
