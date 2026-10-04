/**
 * Display casing for a person's name as typed on a public redeem form.
 *
 * Delegates often type "ahmad rashid" or "AHMAD RASHID" on their phone; the
 * value then flows unchanged into greetings, result cards, certificates and
 * client reports. This normalises the common cases while never second-guessing
 * a name the person cased deliberately:
 *
 *   - trims and collapses internal whitespace;
 *   - a name that is ENTIRELY lower-case or ENTIRELY upper-case is re-cased so
 *     each word, and each part after a hyphen or apostrophe, starts with a
 *     capital ("ahmad al-rashid" -> "Ahmad Al-Rashid");
 *   - mixed case is kept as typed ("McDonald", "al-Rashid", "van der Berg");
 *   - scripts without case (Arabic) pass through untouched;
 *   - the retention sentinel "[purged]" is left alone so it still reads as one.
 */
import { PURGED } from "./purged";

// First character of each word, and of each part after a hyphen or apostrophe.
// (No Unicode property escapes: the project compiles with an ES5 target. Upper-
// casing a character that has no case, such as an Arabic letter, is a no-op.)
const WORD_START = /(^|[\s\-'’])(\S)/g;

export function formatPersonName(value: string | null | undefined): string {
  const name = (value ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.toLowerCase() === PURGED) return name;
  const lower = name.toLowerCase();
  const upper = name.toUpperCase();
  // No cased letters at all (Arabic, digits) or mixed case: keep as typed.
  if (lower === upper || (name !== lower && name !== upper)) return name;
  return lower.replace(WORD_START, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}
