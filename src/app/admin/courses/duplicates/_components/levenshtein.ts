/**
 * Iterative Levenshtein distance with O(min(a,b)) memory.
 *
 * Used by the duplicate-finder to detect near-match course titles
 * the AI extractor produced from variant filenames (e.g. "Cyber-
 * Enabled Crime" vs "Cyber Enabled Crime"). Replace-on-re-import
 * matches by exact title (case-insensitive) only — anything with
 * even a hyphen difference becomes a new row, and that's what we
 * want to surface here.
 *
 * Returns the edit distance — number of single-character inserts /
 * deletes / substitutions to turn a into b. Case-insensitive
 * comparison; both strings are lower-cased + whitespace-collapsed
 * before measurement so "AI - Strategy" and "ai-strategy" come out
 * close.
 */
export function levenshtein(a: string, b: string): number {
  const sa = normalise(a);
  const sb = normalise(b);
  if (sa === sb) return 0;
  if (sa.length === 0) return sb.length;
  if (sb.length === 0) return sa.length;

  // Ensure shorter is on the column axis so we keep O(min) memory.
  const [shorter, longer] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  const m = shorter.length;
  const n = longer.length;

  let prev: number[] = new Array(m + 1);
  let curr: number[] = new Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insert
        prev[i] + 1,     // delete
        prev[i - 1] + cost // substitute
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/**
 * Similarity in [0, 1]. 1.0 = identical, 0.0 = entirely different.
 * Computed as 1 - distance / max-length so it normalises across
 * title lengths (a 2-char diff in a 10-char title is more
 * significant than the same diff in a 60-char title).
 */
export function similarity(a: string, b: string): number {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(normalise(a).length, normalise(b).length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
