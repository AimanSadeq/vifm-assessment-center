// VIFM Psychometrics - test generation (Tier 1 indicative).
//   cognitive → Claude-generated MCQs when ANTHROPIC_API_KEY is set, else a
//               deterministic bilingual fallback deck. Items are server-held;
//               stripAnswerKey() removes the keys before anything reaches the client.

import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS } from "./framework";
import { assembleFromBank } from "./bank";
import { reorderOptions } from "@/lib/scoring/option-shuffle";
import type { PsyTest, PsyTestPublic, CognitiveItem } from "./scoring";

type Lang = "en" | "ar";

// ── Static cognitive fallback deck (3 per subtest, bilingual) ─────
type DeckItem = {
  scale: string; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[];
  correct: number; difficulty: "easy" | "medium" | "hard";
};
// Dev/anonymous fallback only (real sittings serve the reviewed bank). Kept
// construct-clean + domain-neutral: every item sits under its true subtest (the
// two former "verbal" syllogism/conditional items are DEDUCTIVE and live there now).
const COGNITIVE_DECK: DeckItem[] = [
  // Numerical - computation only, everyday-neutral content.
  { scale: "numerical", stem_en: "An item costs 80. After a 25% discount, what is the price?", stem_ar: "ثمن شيء 80. بعد خصم 25٪، كم يصبح الثمن؟", options_en: ["55", "60", "65", "70"], options_ar: ["55", "60", "65", "70"], correct: 1, difficulty: "easy" },
  { scale: "numerical", stem_en: "A reading rises from 200 to 250. What is the percentage increase?", stem_ar: "ترتفع قراءة من 200 إلى 250. ما نسبة الزيادة؟", options_en: ["20%", "25%", "30%", "50%"], options_ar: ["20%", "25%", "30%", "50%"], correct: 1, difficulty: "medium" },
  { scale: "numerical", stem_en: "If 3 people finish a task in 12 days, how many days do 6 people need at the same rate?", stem_ar: "إذا أنجز 3 أشخاص مهمة في 12 يومًا، فكم يومًا يحتاج 6 أشخاص بنفس المعدّل؟", options_en: ["6", "4", "8", "9"], options_ar: ["6", "4", "8", "9"], correct: 0, difficulty: "hard" },
  // Verbal - LANGUAGE only (analogy, comprehension, vocabulary).
  { scale: "verbal", stem_en: "Puppy is to dog as kitten is to:", stem_ar: "الجرو للكلب كما أن الهريرة لـ:", options_en: ["horse", "cat", "bird", "fish"], options_ar: ["حصان", "قط", "طائر", "سمكة"], correct: 1, difficulty: "easy" },
  { scale: "verbal", stem_en: "A garden has roses and tulips but no lilies. Which flower is NOT in the garden?", stem_ar: "حديقة فيها ورد وخزامى ولكن لا زنابق. أي زهرة ليست في الحديقة؟", options_en: ["Roses", "Tulips", "Lilies", "Daisies"], options_ar: ["الورد", "الخزامى", "الزنابق", "الأقحوان"], correct: 2, difficulty: "medium" },
  { scale: "verbal", stem_en: "Choose the word closest in meaning to \"mitigate\":", stem_ar: "اختر الكلمة الأقرب معنى إلى «mitigate» (يخفّف):", options_en: ["worsen", "reduce", "ignore", "delay"], options_ar: ["يزيد سوءًا", "يقلّل", "يتجاهل", "يؤجّل"], correct: 1, difficulty: "easy" },
  // Inductive - infer the underlying rule from a pattern / series.
  { scale: "inductive", stem_en: "What comes next? 2, 4, 8, 16, ?", stem_ar: "ما العدد التالي؟ 2، 4، 8، 16، ؟", options_en: ["24", "32", "20", "18"], options_ar: ["24", "32", "20", "18"], correct: 1, difficulty: "easy" },
  { scale: "inductive", stem_en: "What comes next? 1, 4, 9, 16, ?", stem_ar: "ما العدد التالي؟ 1، 4، 9، 16، ؟", options_en: ["20", "25", "24", "36"], options_ar: ["20", "25", "24", "36"], correct: 1, difficulty: "medium" },
  { scale: "inductive", stem_en: "Which number does NOT fit the pattern? 4, 9, 16, 20, 25", stem_ar: "أي رقم لا يتبع النمط؟ 4، 9، 16، 20، 25", options_en: ["9", "16", "20", "25"], options_ar: ["9", "16", "20", "25"], correct: 2, difficulty: "hard" },
  // Deductive - apply the given rules/premises to a necessarily valid conclusion.
  { scale: "deductive", stem_en: "All cats are mammals. No mammal is a fish. Therefore: no cat is a fish.", stem_ar: "كل القطط ثدييات. لا ثدييّ سمكة. إذن: لا قطة سمكة.", options_en: ["Valid", "Invalid", "Cannot say"], options_ar: ["صحيح", "غير صحيح", "لا يمكن تحديده"], correct: 0, difficulty: "medium" },
  { scale: "deductive", stem_en: "If it rains, the ground is wet. The ground is not wet. Therefore: it did not rain.", stem_ar: "إذا أمطرت، فالأرض مبتلّة. الأرض ليست مبتلّة. إذن: لم تمطر.", options_en: ["Valid", "Invalid", "Cannot say"], options_ar: ["صحيح", "غير صحيح", "لا يمكن تحديده"], correct: 0, difficulty: "hard" },
  { scale: "deductive", stem_en: "Three desks in a row: A is left of B; C is right of B. Who is in the middle?", stem_ar: "ثلاثة مكاتب في صف: A على يسار B؛ C على يمين B. من في الوسط؟", options_en: ["A", "B", "C", "Cannot say"], options_ar: ["A", "B", "C", "لا يمكن تحديده"], correct: 1, difficulty: "easy" },
];

function staticCognitive(lang: Lang, subtests: string[]): CognitiveItem[] {
  return COGNITIVE_DECK
    .filter((d) => subtests.includes(d.scale))
    .map((d, i) => ({
      id: `cog-${i + 1}`,
      scale: d.scale,
      stem: lang === "ar" ? d.stem_ar : d.stem_en,
      options: lang === "ar" ? d.options_ar : d.options_en,
      correct: d.correct,
      difficulty: d.difficulty,
    }));
}

const COG_SYSTEM =
  "You are a psychometric item writer for VIFM. You write clean cognitive-ability " +
  "multiple-choice items (numerical, verbal, inductive, and deductive reasoning) with exactly one " +
  "defensible correct answer. Items MUST be culture-fair and domain-neutral: use everyday-life or " +
  "abstract content, with NO finance, banking, accounting, treasury, investment or specialist " +
  "business framing or jargon - an educated non-specialist must be able to solve each with no " +
  "domain knowledge. No trick questions; each is solvable in under a minute.";

// Per-subtest item-writing guidance, keyed so we can prompt for only the
// selected subtests (SD-4). Verbal is LANGUAGE-only (no formal logic - that
// leaks into the deductive construct); deductive holds all formal logic.
const SUBTEST_GUIDANCE: Record<string, string> = {
  numerical: `numerical = ratio/proportion, percentage & change, or interpreting a small table/chart described in text (computation only - a number/letter series is inductive, not numerical);`,
  verbal: `verbal = LANGUAGE reasoning only: reading comprehension, verbal analogies, or vocabulary-in-context. NEVER a syllogism, if-then logic, "what necessarily follows", or an ordering puzzle - those are deductive;`,
  inductive: `inductive = infer the rule from examples: number/letter series, odd-one-out, or a text-described figural matrix (the rule is discovered, culture-fair);`,
  deductive: `deductive = apply given rules/premises to a necessarily valid conclusion: syllogisms, if-then (conditional) logic, or simple arrangements. All formal logic lives here.`,
};

/** Thrown when a bank-required sitting cannot be assembled from approved items -
 *  the runner turns this into a 503 and mints no session (never a live/short deck). */
export class BankUnavailableError extends Error {
  readonly kind = "bank_unavailable" as const;
  constructor(message = "The reviewed item bank cannot serve this request.") {
    super(message);
    this.name = "BankUnavailableError";
  }
}

function cognitivePrompt(lang: Lang, perSubtest: number, subtests: string[]): string {
  const langName = lang === "ar" ? "Arabic (Modern Standard Arabic)" : "English";
  const list = subtests.map((s) => `"${s}"`).join(", ");
  return [
    `Write cognitive-ability multiple-choice items in ${langName}.`,
    `Produce ${perSubtest} items for EACH of these subtests: ${list}.`,
    ...subtests.map((s) => SUBTEST_GUIDANCE[s]).filter(Boolean),
    `Return ONE JSON array (no markdown fences). Each element:`,
    `{ "scale": ${subtests.map((s) => `"${s}"`).join("|")}, "stem": "<text>", "options": ["a","b","c","d"],`,
    `  "correct": <0-based index>, "difficulty": "easy"|"medium"|"hard" }`,
    `Provide 3–4 options each, exactly one correct. Use ONLY the listed subtests for "scale".`,
  ].join("\n");
}

async function aiCognitive(lang: Lang, perSubtest: number, subtests: string[]): Promise<CognitiveItem[] | null> {
  const ai = getAIClient();
  if (!ai) return null;
  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: COG_SYSTEM,
      messages: [{ role: "user", content: cognitivePrompt(lang, perSubtest, subtests) }],
    });
    const block = res.content[0];
    if (block?.type !== "text") return null;
    const jsonText = block.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = new Set(subtests);
    const items: CognitiveItem[] = [];
    parsed.forEach((r, i) => {
      const q = r as Record<string, unknown>;
      if (typeof q.scale !== "string" || !valid.has(q.scale)) return;
      if (typeof q.stem !== "string" || !Array.isArray(q.options) || q.options.length < 2) return;
      if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.options.length) return;
      // A graded MCQ must have DISTINCT options - reject any item where the model
      // produced a duplicate choice (e.g. the correct answer repeated), which
      // would make scoring ambiguous. Compare trimmed + case-folded.
      const opts = (q.options as unknown[]).map((o) => String(o).trim());
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return;
      const difficulty = (["easy", "medium", "hard"] as const).includes(q.difficulty as never) ? (q.difficulty as CognitiveItem["difficulty"]) : "medium";
      items.push({ id: `cog-${i + 1}`, scale: q.scale, stem: q.stem, options: opts, correct: q.correct, difficulty });
    });
    // Require at least one item per requested subtest, and at least half the
    // requested volume overall (so a 10-item single-subtest request can't come
    // back as a 2-item test); else fall back to the static deck.
    const haveAll = subtests.every((s) => items.some((it) => it.scale === s));
    const floor = Math.max(subtests.length * 2, Math.ceil((perSubtest * subtests.length) / 2));
    return haveAll && items.length >= floor ? items : null;
  } catch {
    return null;
  }
}

/**
 * Build a full keyed test (held server-side). `subtests` restricts which of
 * numerical/verbal/inductive/deductive are generated (SD-4); omitted/empty
 * defaults to all four (back-compat for every existing caller).
 */
export async function generatePsyTest(
  kind: "cognitive",
  lang: Lang = "en",
  subtests?: string[],
  opts?: { requireBank?: boolean; exclusionIds?: string[] }
): Promise<PsyTest> {
  // Normalize: only cognitive honours subtests; default to all four.
  const cogSubtests =
    subtests && subtests.length > 0
      ? COGNITIVE_SUBTEST_KEYS.filter((k) => subtests.includes(k))
      : [...COGNITIVE_SUBTEST_KEYS];
  const effectiveCog = cogSubtests.length > 0 ? cogSubtests : [...COGNITIVE_SUBTEST_KEYS];

  // Serve from the SME-approved bank against the fixed per-facet blueprint (item
  // ids are real psy_items uuids → the response log is calibratable and exposure
  // is trackable). Retakers' previously-seen items are de-preferred.
  const exclusionIds = opts?.exclusionIds?.length ? new Set(opts.exclusionIds) : undefined;
  const fromBank = await assembleFromBank(kind, lang, effectiveCog, { exclusionIds });
  if (fromBank) {
    return { ...fromBank, items: shuffleCognitiveOptions(fromBank.items), served_source: "bank" };
  }

  // Fail safe: for a real/candidate/voucher-bound sitting we NEVER serve a live-AI
  // or short static deck (the "3-item Arabic deck" defect). Mint no session; the
  // route returns 503 so the taker retries when the bank can serve.
  if (opts?.requireBank) {
    throw new BankUnavailableError();
  }

  // Scale items-per-subtest to the selection so a scoped test is still a real
  // test: 1 subtest -> 10 items, 2 -> 6 each (12), 3 -> 5 each (15), 4 -> 4 (16).
  // (A flat 4/subtest made a single-subtest sitting just 4 questions.)
  const PER_SUBTEST: Record<number, number> = { 1: 10, 2: 6, 3: 5, 4: 4 };
  const perSubtest = PER_SUBTEST[effectiveCog.length] ?? 4;
  const ai = await aiCognitive(lang, perSubtest, effectiveCog);
  if (ai) return { kind: "cognitive", items: shuffleCognitiveOptions(ai), ai_generated: true, served_source: "ai" };
  return { kind: "cognitive", items: shuffleCognitiveOptions(staticCognitive(lang, effectiveCog)), ai_generated: false, served_source: "static" };
}

/**
 * Per-administration option reorder (integrity pass): numeric option sets are
 * sorted, judgement scales (True/False/Cannot say + Arabic forms) stay as
 * authored, everything else Fisher-Yates shuffles - see option-shuffle.ts.
 * Applied before the keyed test is stored on psy_sessions, so the server copy
 * and the stripped browser payload always agree. Note for calibration: the
 * psy_item_responses log keys on correctness (Rasch p-values), which is
 * computed against this same shuffled session copy, so shuffling does not
 * disturb the calibration substrate. Never shuffles Likert personality items.
 */
function shuffleCognitiveOptions(items: CognitiveItem[]): CognitiveItem[] {
  return items.map((it) => {
    const s = reorderOptions(it.options, it.correct);
    return { ...it, options: s.options, correct: s.correctIndex, orig: s.origIndex };
  });
}

/** Remove the answer key before the test reaches the browser. */
export function stripAnswerKey(test: PsyTest): PsyTestPublic {
  return {
    kind: "cognitive",
    items: test.items.map((i) => ({ id: i.id, scale: i.scale, stem: i.stem, options: i.options, difficulty: i.difficulty })),
  };
}
