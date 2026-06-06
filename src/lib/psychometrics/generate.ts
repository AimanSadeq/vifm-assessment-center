// VIFM Psychometrics — test generation (Tier 1 indicative).
//   personality → public-domain Mini-IPIP (always available, no AI/seed needed).
//   cognitive   → Claude-generated MCQs when ANTHROPIC_API_KEY is set, else a
//                 deterministic bilingual fallback deck. Items are server-held;
//                 stripAnswerKey() removes the keys before anything reaches the client.

import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import { MINI_IPIP, COGNITIVE_SUBTESTS, LIKERT_ANCHORS_EN, LIKERT_ANCHORS_AR } from "./framework";
import { assembleFromBank } from "./bank";
import type { PsyTest, PsyTestPublic, CognitiveItem, PersonalityItem } from "./scoring";

type Lang = "en" | "ar";

// ── Static cognitive fallback deck (3 per subtest, bilingual) ─────
type DeckItem = {
  scale: string; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[];
  correct: number; difficulty: "easy" | "medium" | "hard";
};
const COGNITIVE_DECK: DeckItem[] = [
  { scale: "numerical", stem_en: "A product costs 80. After a 25% discount, what is the price?", stem_ar: "يبلغ سعر منتج 80. بعد خصم 25٪، كم يصبح السعر؟", options_en: ["55", "60", "65", "70"], options_ar: ["55", "60", "65", "70"], correct: 1, difficulty: "easy" },
  { scale: "numerical", stem_en: "Revenue grew from 200 to 250. What is the percentage increase?", stem_ar: "ارتفعت الإيرادات من 200 إلى 250. ما نسبة الزيادة؟", options_en: ["20%", "25%", "30%", "50%"], options_ar: ["20%", "25%", "30%", "50%"], correct: 1, difficulty: "medium" },
  { scale: "numerical", stem_en: "If 3 workers finish a task in 12 days, how many days do 6 workers need at the same rate?", stem_ar: "إذا أنجز 3 عمّال مهمة في 12 يومًا، فكم يومًا يحتاج 6 عمّال بنفس المعدّل؟", options_en: ["6", "4", "8", "9"], options_ar: ["6", "4", "8", "9"], correct: 0, difficulty: "medium" },
  { scale: "verbal", stem_en: "All managers attended. Some managers are directors. Therefore: some directors attended.", stem_ar: "حضر جميع المديرين. بعض المديرين هم رؤساء أقسام. إذن: بعض رؤساء الأقسام حضروا.", options_en: ["True", "False", "Cannot say"], options_ar: ["صحيح", "خطأ", "لا يمكن تحديده"], correct: 0, difficulty: "medium" },
  { scale: "verbal", stem_en: "The policy applies only to full-time staff. Sara is part-time. Therefore the policy applies to Sara.", stem_ar: "تنطبق السياسة على الموظفين المتفرّغين فقط. سارة موظفة بدوام جزئي. إذن تنطبق عليها السياسة.", options_en: ["True", "False", "Cannot say"], options_ar: ["صحيح", "خطأ", "لا يمكن تحديده"], correct: 1, difficulty: "medium" },
  { scale: "verbal", stem_en: "Choose the word closest in meaning to \"mitigate\":", stem_ar: "اختر الكلمة الأقرب معنى إلى «mitigate» (يخفّف):", options_en: ["worsen", "reduce", "ignore", "delay"], options_ar: ["يزيد سوءًا", "يقلّل", "يتجاهل", "يؤجّل"], correct: 1, difficulty: "easy" },
  { scale: "abstract", stem_en: "What comes next? 2, 4, 8, 16, ?", stem_ar: "ما العدد التالي؟ 2، 4، 8، 16، ؟", options_en: ["24", "32", "20", "18"], options_ar: ["24", "32", "20", "18"], correct: 1, difficulty: "easy" },
  { scale: "abstract", stem_en: "What comes next? 1, 4, 9, 16, ?", stem_ar: "ما العدد التالي؟ 1، 4، 9، 16، ؟", options_en: ["20", "25", "24", "36"], options_ar: ["20", "25", "24", "36"], correct: 1, difficulty: "medium" },
  { scale: "abstract", stem_en: "What comes next? 2, 3, 5, 8, 12, ?", stem_ar: "ما العدد التالي؟ 2، 3، 5، 8، 12، ؟", options_en: ["16", "17", "18", "15"], options_ar: ["16", "17", "18", "15"], correct: 1, difficulty: "hard" },
];

function staticCognitive(lang: Lang): CognitiveItem[] {
  return COGNITIVE_DECK.map((d, i) => ({
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
  "multiple-choice items (numerical, verbal, and abstract reasoning) with exactly one " +
  "defensible correct answer, suitable for GCC banking and government professionals. " +
  "No trick questions; each is solvable in under a minute.";

function cognitivePrompt(lang: Lang, perSubtest: number): string {
  const langName = lang === "ar" ? "Arabic (Modern Standard Arabic)" : "English";
  return [
    `Write cognitive-ability multiple-choice items in ${langName}.`,
    `Produce ${perSubtest} items for EACH subtest: "numerical", "verbal", "abstract".`,
    `numerical = data/ratio/percentage reasoning; verbal = comprehension or true/false/cannot-say logic;`,
    `abstract = number or pattern series (culture-fair).`,
    `Return ONE JSON array (no markdown fences). Each element:`,
    `{ "scale": "numerical"|"verbal"|"abstract", "stem": "<text>", "options": ["a","b","c","d"],`,
    `  "correct": <0-based index>, "difficulty": "easy"|"medium"|"hard" }`,
    `Provide 3–4 options each, exactly one correct.`,
  ].join("\n");
}

async function aiCognitive(lang: Lang, perSubtest: number): Promise<CognitiveItem[] | null> {
  const ai = getAIClient();
  if (!ai) return null;
  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: COG_SYSTEM,
      messages: [{ role: "user", content: cognitivePrompt(lang, perSubtest) }],
    });
    const block = res.content[0];
    if (block?.type !== "text") return null;
    const jsonText = block.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = new Set(["numerical", "verbal", "abstract"]);
    const items: CognitiveItem[] = [];
    parsed.forEach((r, i) => {
      const q = r as Record<string, unknown>;
      if (typeof q.scale !== "string" || !valid.has(q.scale)) return;
      if (typeof q.stem !== "string" || !Array.isArray(q.options) || q.options.length < 2) return;
      if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.options.length) return;
      const difficulty = (["easy", "medium", "hard"] as const).includes(q.difficulty as never) ? (q.difficulty as CognitiveItem["difficulty"]) : "medium";
      items.push({ id: `cog-${i + 1}`, scale: q.scale, stem: q.stem, options: (q.options as unknown[]).map(String), correct: q.correct, difficulty });
    });
    // Require at least one item per subtest, else fall back.
    const haveAll = Array.from(valid).every((s) => items.some((it) => it.scale === s));
    return haveAll && items.length >= 6 ? items : null;
  } catch {
    return null;
  }
}

function personalityItems(lang: Lang): PersonalityItem[] {
  return MINI_IPIP.map((it, i) => ({
    id: `per-${i + 1}`,
    scale: it.scale,
    text: lang === "ar" ? it.text_ar : it.text_en,
    reverse: it.reverse,
  }));
}

/** Build a full keyed test (held server-side). */
export async function generatePsyTest(kind: "cognitive" | "personality", lang: Lang = "en"): Promise<PsyTest> {
  // Tier 2: assemble from the SME-approved bank when every scale is sufficiently
  // populated (item ids are real psy_items uuids → the response log is calibratable).
  // Otherwise fall back to the Tier-1 source (Mini-IPIP / AI / static deck).
  const fromBank = await assembleFromBank(kind, lang);
  if (fromBank) return fromBank;

  if (kind === "personality") {
    return { kind: "personality", items: personalityItems(lang) };
  }
  const ai = await aiCognitive(lang, 4);
  if (ai) return { kind: "cognitive", items: ai, ai_generated: true };
  return { kind: "cognitive", items: staticCognitive(lang), ai_generated: false };
}

/** Remove the answer key before the test reaches the browser. */
export function stripAnswerKey(test: PsyTest, lang: Lang = "en"): PsyTestPublic {
  if (test.kind === "cognitive") {
    return {
      kind: "cognitive",
      items: test.items.map((i) => ({ id: i.id, scale: i.scale, stem: i.stem, options: i.options, difficulty: i.difficulty })),
    };
  }
  return {
    kind: "personality",
    items: test.items.map((i) => ({ id: i.id, scale: i.scale, text: i.text })),
    anchors: lang === "ar" ? LIKERT_ANCHORS_AR : LIKERT_ANCHORS_EN,
  };
}
