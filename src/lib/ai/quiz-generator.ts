import { getAIClient, AI_MODEL } from "./client";
import type { Competency, QuizQuestion, BehavioralIndicator } from "@/types/database";

/**
 * Generates a 7-question self-serve quiz on a single competency.
 *
 * The deck is a deliberate mix:
 *   - 5 knowledge / scenario questions (true/false + multiple choice)
 *     grounded in the competency's behavioural indicators and dev tips.
 *   - 1 pattern-recognition / cognitive item that targets the same broad
 *     ability the competency assesses - anchors the deck in a way that
 *     matches the cognitive-insert pattern seen in industry assessments.
 *   - 1 application MCQ tied to the candidate's gap level - harder when
 *     the gap is significant, easier when they're already on target.
 *
 * Difficulty distribution: roughly 2 easy / 3 medium / 2 hard. The
 * exact counts are guidance, not enforced - Claude can rebalance if
 * the source material doesn't support a hard question.
 */

export type QuizGeneratorInput = {
  competency: Pick<Competency, "id" | "name" | "description">;
  /** Behavioural indicators (positive + negative) for grounding */
  indicators: Pick<BehavioralIndicator, "indicator_type" | "description">[];
  /** Three development tips for this competency */
  developmentTips?: string[];
  /** Candidate's current BARS score (1–5) - drives difficulty bias */
  currentScore: number | null;
  /** Target proficiency for this candidate's role */
  targetScore: number;
  /** Output language (Arabic optional alongside English) */
  bilingual?: boolean;
  /** How many questions to generate. Defaults to 7 (the full self-serve deck).
   *  Callers that only keep a few (Pre-Hire samples 1-2 per competency across
   *  several competencies) pass a small count so the model generates only what
   *  is actually used - dramatically faster per call. */
  count?: number;
};

const SYSTEM_PROMPT = (
  `You are a learning-and-development question author for VIFM. ` +
  `You write short, sharp quizzes that probe whether a learner UNDERSTANDS ` +
  `a behavioural competency well enough to apply it on the job - not just ` +
  `whether they can recall a definition. You write in clear professional English. ` +
  `When asked to provide Arabic, you use Modern Standard Arabic suitable for ` +
  `GCC banking and government professionals - never machine-translation tone.`
);

function buildInstructions(input: QuizGeneratorInput) {
  const n = Math.max(1, Math.round(input.count ?? 7));
  const richMix = n >= 6;
  const positives = input.indicators
    .filter((i) => i.indicator_type === "positive")
    .map((i) => `+ ${i.description}`)
    .slice(0, 8)
    .join("\n");
  const negatives = input.indicators
    .filter((i) => i.indicator_type === "negative")
    .map((i) => `- ${i.description}`)
    .slice(0, 8)
    .join("\n");
  const tips = (input.developmentTips ?? [])
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  const gap =
    input.currentScore == null
      ? "(unknown - bias toward medium difficulty)"
      : (() => {
          const g = input.targetScore - input.currentScore;
          if (g >= 3) return "significant gap - bias toward easy/medium";
          if (g === 2) return "moderate gap - balanced mix";
          if (g === 1) return "minor gap - balanced mix, lean medium";
          if (g === 0) return "on target - lean medium/hard";
          return "above target - lean hard";
        })();

  return [
    `Competency: ${input.competency.name}`,
    input.competency.description ? `Definition: ${input.competency.description}` : "",
    `Candidate's current level: ${input.currentScore ?? "not yet assessed"} of 5`,
    `Target level: ${input.targetScore} of 5`,
    `Gap context: ${gap}`,
    "",
    positives ? `POSITIVE BEHAVIOURAL INDICATORS:\n${positives}` : "",
    negatives ? `NEGATIVE INDICATORS (anti-patterns):\n${negatives}` : "",
    tips ? `DEVELOPMENT TIPS:\n${tips}` : "",
    "",
    `TASK: Write exactly ${n} quiz question${n === 1 ? "" : "s"}.`,
    richMix
      ? `Mix: 4 multiple_choice (4 options each, exactly one correct), 2 true_false, and 1 pattern_recognition (a numeric or logical sequence with one placeholder cell shown as "?" - 4 options for what fills the "?"). Difficulty ~2 easy, ~3 medium, ~2 hard.`
      : `Use multiple_choice (4 options each, exactly one correct); at most one true_false; do NOT use pattern_recognition. Mix difficulty sensibly.`,
    `Points by difficulty: easy=10, medium=15, hard=20.`,
    "",
    `For pattern_recognition the sequence MUST be 4–6 cells, with exactly one`,
    `cell as null (= the "?") and the others as numbers or short strings.`,
    `Pick a pattern (arithmetic, geometric, alternating, doubling) that a`,
    `professional could solve in under 30 seconds.`,
    "",
    `Every question must include an Explanation that a learner can read AFTER`,
    `submitting an answer to understand the right answer - 2–3 sentences,`,
    `concrete, references the competency by name when natural.`,
    "",
    `Return ONE JSON array with exactly ${n} element${n === 1 ? "" : "s"}. No markdown`,
    `fences. Each element matches:`,
    `{`,
    `  "id": "q-1" through "q-${n}",`,
    `  "type": "true_false" | "multiple_choice" | "pattern_recognition",`,
    `  "prompt_en": "<question text>",`,
    `  "prompt_ar": ${input.bilingual ? '"<Arabic translation>"' : "null"},`,
    `  "options_en": ["<opt1>", "<opt2>", ...],`,
    `  "options_ar": ${input.bilingual ? '["<arabic>", ...]' : "null"},`,
    `  "correct_index": <0-based int>,`,
    `  "points": 10 | 15 | 20,`,
    `  "difficulty": "easy" | "medium" | "hard",`,
    `  "explanation_en": "<2-3 sentences>",`,
    `  "explanation_ar": ${input.bilingual ? '"<Arabic translation>"' : "null"},`,
    `  "sequence": <null OR (number|string|null)[] for pattern_recognition>`,
    `}`,
    "",
    `For true_false: options_en MUST be ["True", "False"] and correct_index 0 or 1.`,
  ]
    .filter(Boolean)
    .join("\n");
}

const VALID_TYPES = new Set<string>([
  "true_false",
  "multiple_choice",
  "pattern_recognition",
]);
const VALID_DIFFICULTIES = new Set<string>(["easy", "medium", "hard"]);

export async function generateQuizQuestions(
  input: QuizGeneratorInput
): Promise<QuizQuestion[] | null> {
  const ai = getAIClient();
  if (!ai) return null;

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildInstructions(input) }],
    });

    const block = response.content[0];
    if (block?.type !== "text") return null;

    const raw = block.text.trim();
    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return null;

    const questions: QuizQuestion[] = [];
    for (const raw of parsed) {
      const q = raw as Record<string, unknown>;
      if (typeof q.id !== "string") continue;
      if (typeof q.type !== "string" || !VALID_TYPES.has(q.type)) continue;
      if (typeof q.prompt_en !== "string" || !q.prompt_en.trim()) continue;
      if (!Array.isArray(q.options_en) || q.options_en.length < 2) continue;
      if (typeof q.correct_index !== "number") continue;
      if (q.correct_index < 0 || q.correct_index >= q.options_en.length) continue;
      if (typeof q.points !== "number") continue;
      if (typeof q.difficulty !== "string" || !VALID_DIFFICULTIES.has(q.difficulty)) continue;
      if (typeof q.explanation_en !== "string" || !q.explanation_en.trim()) continue;

      // Reject sequences that don't have exactly one null
      if (q.type === "pattern_recognition") {
        if (!Array.isArray(q.sequence)) continue;
        const nullCount = q.sequence.filter((c) => c === null).length;
        if (nullCount !== 1) continue;
        if (q.sequence.length < 4 || q.sequence.length > 6) continue;
      }

      questions.push({
        id: q.id,
        type: q.type as QuizQuestion["type"],
        prompt_en: q.prompt_en.trim(),
        prompt_ar:
          typeof q.prompt_ar === "string" && q.prompt_ar.trim() ? q.prompt_ar.trim() : null,
        options_en: (q.options_en as unknown[]).map((o) => String(o)),
        options_ar:
          Array.isArray(q.options_ar) && q.options_ar.length === (q.options_en as unknown[]).length
            ? (q.options_ar as unknown[]).map((o) => String(o))
            : null,
        correct_index: q.correct_index,
        points: q.points,
        difficulty: q.difficulty as QuizQuestion["difficulty"],
        explanation_en: q.explanation_en.trim(),
        explanation_ar:
          typeof q.explanation_ar === "string" && q.explanation_ar.trim()
            ? q.explanation_ar.trim()
            : null,
        sequence:
          q.type === "pattern_recognition" && Array.isArray(q.sequence)
            ? (q.sequence as (string | number | null)[])
            : undefined,
      });
    }

    if (questions.length === 0) return null;
    return questions;
  } catch (err) {
    console.error("[quiz-generator] Failed:", err);
    return null;
  }
}

// ── Deterministic fallback ────────────────────────────────────────────────
// When the AI is unavailable (no key, quota, overload, timeout) generateQuiz
// questions returns null. For a screening that must never dead-end on
// "Couldn't generate the assessment", build a usable deck WITHOUT the AI:
// grounded True/False items from the competency's own behavioural indicators
// when we have them, padded with role-agnostic professional items.

function tf(prompt: string, isTrue: boolean, explanation: string): QuizQuestion {
  return {
    id: "q",
    type: "true_false",
    prompt_en: prompt,
    prompt_ar: null,
    options_en: ["True", "False"],
    options_ar: null,
    correct_index: isTrue ? 0 : 1,
    points: 10,
    difficulty: "medium",
    explanation_en: explanation,
    explanation_ar: null,
    sequence: undefined,
  };
}

function mcq(
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string
): QuizQuestion {
  return {
    id: "q",
    type: "multiple_choice",
    prompt_en: prompt,
    prompt_ar: null,
    options_en: options,
    options_ar: null,
    correct_index: correctIndex,
    points: 15,
    difficulty: "medium",
    explanation_en: explanation,
    explanation_ar: null,
    sequence: undefined,
  };
}

// Role-agnostic professional items - valid for any competency; used to pad the
// fallback deck (and as the whole deck when no indicators are available).
const GENERIC_FALLBACK_ITEMS: QuizQuestion[] = [
  tf(
    "Clarifying the goal and success criteria before starting work reduces rework later.",
    true,
    "Confirming expectations up front prevents wasted effort and misaligned delivery."
  ),
  tf(
    "Once a decision has been made, the professional approach is to commit to it while raising any concerns through the right channel.",
    true,
    "Disagreeing respectfully and then committing keeps the team moving without suppressing valid concerns."
  ),
  tf(
    "Withholding relevant information from a teammate is an effective way to get ahead at work.",
    false,
    "Withholding information undermines trust and collaboration - the opposite of effective teamwork."
  ),
  mcq(
    "You receive conflicting instructions from two managers. What is the best first step?",
    [
      "Pick the one you prefer and proceed quietly",
      "Do nothing until someone notices",
      "Surface the conflict to both and align on priorities",
      "Escalate to HR immediately",
    ],
    2,
    "Surfacing the conflict early and aligning on priorities resolves it without guesswork or unnecessary escalation."
  ),
  mcq(
    "A stakeholder gives vague requirements. The most effective response is to:",
    [
      "Guess and build something",
      "Ask focused questions to clarify scope and intent",
      "Delay the work indefinitely",
      "Build the largest possible version to be safe",
    ],
    1,
    "Asking targeted clarifying questions defines the real need before effort is spent."
  ),
  mcq(
    "Which response best demonstrates accountability for a missed deadline?",
    [
      "Blame the tools or process",
      "Acknowledge it, explain the cause, and propose a recovery plan",
      "Avoid mentioning it",
      "Wait until someone asks about it",
    ],
    1,
    "Owning the miss and proposing a concrete recovery plan is the hallmark of accountability."
  ),
  tf(
    "Listening to understand before responding improves collaboration and decision quality.",
    true,
    "Understanding others' input first leads to better-informed responses and stronger working relationships."
  ),
];

export function buildFallbackQuizDeck(input: {
  competencies?: { name: string; positives: string[]; negatives: string[] }[];
  count?: number;
}): QuizQuestion[] {
  const count = Math.max(1, Math.round(input.count ?? 7));
  const items: QuizQuestion[] = [];

  // Grounded items from real behavioural indicators (positive => True,
  // negative => False), spread across the supplied competencies.
  for (const c of input.competencies ?? []) {
    for (const pos of c.positives.slice(0, 2)) {
      items.push(
        tf(
          `In the context of "${c.name}", is the following an effective professional behaviour?\n\n"${pos}"`,
          true,
          `This is a positive indicator of ${c.name} - it reflects the competency well.`
        )
      );
    }
    for (const neg of c.negatives.slice(0, 1)) {
      items.push(
        tf(
          `In the context of "${c.name}", is the following an effective professional behaviour?\n\n"${neg}"`,
          false,
          `This is a negative indicator (anti-pattern) of ${c.name} - it works against the competency.`
        )
      );
    }
  }

  // Pad to the target with role-agnostic items (and use them wholesale when no
  // indicators were available).
  for (const g of GENERIC_FALLBACK_ITEMS) {
    if (items.length >= count) break;
    items.push(g);
  }

  // Re-id sequentially + cap.
  return items.slice(0, count).map((q, i) => ({ ...q, id: `q-${i + 1}` }));
}
