/**
 * Per-administration MCQ option-order randomisation (integrity pass).
 *
 * Defeats two things: option-position memorisation between sittings, and the
 * LLM/authoring bias that over-places the correct answer at position A. Mirrors
 * the shuffle Techno has always applied, generalised for Fluent receptive items
 * and Logica cognitive items with two psychometric guardrails:
 *
 * - NUMERIC option sets are SORTED ascending, not shuffled - measurement
 *   convention keeps ordered quantities in order (shuffled numbers add
 *   construct-irrelevant scanning load), and the correct value's position then
 *   varies naturally item-to-item anyway.
 * - JUDGEMENT scales (True/False/Cannot say, Valid/Invalid, and their Arabic
 *   equivalents) are LEFT AS AUTHORED - their order is semantic, and "Cannot
 *   say" floating to the top reads as a broken item.
 *
 * Pure and side-effect free: returns new arrays, never mutates the input (the
 * static fallback decks are shared module constants).
 */

/** Option strings that mark a semantic judgement scale (EN + AR). */
const JUDGEMENT_TOKENS = new Set([
  "true",
  "false",
  "valid",
  "invalid",
  "cannot say",
  "yes",
  "no",
  "صحيح",
  "خطأ",
  "غير صحيح",
  "لا يمكن تحديده",
  "نعم",
  "لا",
]);

const asNumber = (s: string): number | null => {
  // "60", "25%", "1,500", "-3.5" all count as numeric options.
  const cleaned = s.trim().replace(/[%,\s]/g, "");
  if (cleaned === "" || !/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

function isJudgementScale(options: string[]): boolean {
  const known = options.filter((o) => JUDGEMENT_TOKENS.has(o.trim().toLowerCase()));
  return known.length >= 2; // e.g. True/False[/Cannot say], Valid/Invalid/...
}

function numericValues(options: string[]): number[] | null {
  const nums = options.map(asNumber);
  return nums.every((n): n is number => n !== null) ? (nums as number[]) : null;
}

/**
 * Reorder an MCQ's options per the guardrails above and return the new order,
 * the remapped index of the previously-correct option, and the permutation map
 * (`origIndex[i]` = the ORIGINAL index of the option now at position i) so a
 * response logged against the served order can be remapped back into the
 * authored frame for calibration/distractor analysis.
 */
export function reorderOptions(
  options: string[],
  correctIndex: number
): { options: string[]; correctIndex: number; origIndex: number[] } {
  const identity = options.map((_, i) => i);
  if (!Array.isArray(options) || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) {
    return { options: [...options], correctIndex, origIndex: identity };
  }
  if (isJudgementScale(options)) return { options: [...options], correctIndex, origIndex: identity };

  const indices = options.map((_, i) => i);
  const nums = numericValues(options);
  if (nums) {
    indices.sort((a, b) => nums[a] - nums[b]);
  } else {
    // Fisher-Yates on the index array.
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  }
  return {
    options: indices.map((i) => options[i]),
    correctIndex: indices.indexOf(correctIndex),
    origIndex: indices,
  };
}
