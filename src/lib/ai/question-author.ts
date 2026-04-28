import { getAIClient, isAIConfigured } from "./client";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

/**
 * AI-assisted question authoring for the ARA Compass question bank.
 *
 * Same value proposition as the AI-author features shipped by industry
 * assessment vendors: take a natural-language brief from the admin
 * ("a question about model retirement discipline") and generate one or
 * more well-formed, framework-anchored Layer-1 or Layer-2 questions
 * ready to be saved into the question bank.
 *
 * The LLM is instructed to return strict JSON. We validate the shape
 * before inserting; malformed responses surface as a clear error so
 * the admin can retry with a different brief instead of corrupting
 * the bank.
 */

export type AraGeneratedQuestion = {
  layer: 1 | 2;
  type: "rating" | "yes_no" | "multiple_choice" | "open_text";
  en: string;
  ar: string;
  /** Framework / standard reference - stored in help_text_en for audit. */
  ref: string;
  /** Only present for multi-choice / yes-no - matches our score-map format. */
  options_en?: string[];
  options_ar?: string[];
  score_map?: Record<string, number>;
  /** Concise rationale shown to the admin so they can sanity-check. */
  rationale: string;
};

const STANDARD_LIKERT_NOTE = `
Standard scale used elsewhere in the bank (use this unless the question type is yes_no or open_text):
  options_en: ["1 - Not at all","2 - Early exploration","3 - In progress","4 - Mostly in place","5 - Comprehensive"]
  options_ar: ["١ - ليس بعد","٢ - استكشاف مبكر","٣ - قيد التقدم","٤ - قائم غالباً","٥ - شامل"]
  score_map:  {"1 - Not at all":1,"2 - Early exploration":2,"3 - In progress":3,"4 - Mostly in place":4,"5 - Comprehensive":5}
`.trim();

const FRAMEWORK_LIST = [
  "UAE Personal Data Protection Law (Federal Decree-Law 45 of 2021)",
  "UAE National AI Strategy 2031",
  "UAE Charter for AI Development (June 2024, 12 Principles)",
  "UAE AI Ethics Guide (2022)",
  "TDRA Digital Government Regulations",
  "Dubai Centre for AI (DCAI) Guidelines",
  "Abu Dhabi Digital Authority (ADDA) Standards",
  "Saudi Personal Data Protection Law (Royal Decree M/19, M/148)",
  "SDAIA National Data Governance Framework",
  "SDAIA AI Ethics Principles (2023, 12 Principles)",
  "SDAIA AI Adoption Framework (September 2024)",
  "SDAIA Generative AI Guidelines (January 2024)",
  "NCA Essential Cybersecurity Controls (ECC-2:2024)",
  "NCA Cloud Cybersecurity Controls (CCC-2:2024)",
  "Saudi Vision 2030",
  "ISO/IEC 42001 - AI Management Systems",
  "ISO/IEC 23894 - AI Risk Management",
  "NIST AI Risk Management Framework",
  "OECD AI Principles (revised 2024)",
];

function buildSystemPrompt(): string {
  return `You are an expert AI-readiness assessor authoring questions for the VIFM AI Readiness Compass, a Big-4-calibre diagnostic used with GCC banking and government clients in UAE and Saudi Arabia.

Your job: given a natural-language brief from an admin, produce ONE concrete assessment question that:
  1. Is directly about AI readiness, not generic IT or operations.
  2. Is anchored to a specific named framework or standard (cite section / article when possible).
  3. Is behaviourally observable - a respondent can actually answer it from evidence, not aspirational rhetoric.
  4. Is bilingual: idiomatic English plus Gulf-standard Modern Standard Arabic.
  5. Is appropriate for the requested layer (1 = self-assessment by client respondents, 2 = consultant deeper probe used in Phase 2 workshop).

Question types (pick the best fit, do NOT default to rating):
  - "rating"          5-point Likert ("1 - Not at all" ... "5 - Comprehensive"). Best for maturity-style questions.
  - "yes_no"          Binary policy gate. Best for "is this in place?" questions.
  - "multiple_choice" 5 typed maturity stages with custom labels and bespoke score map. Best when the answer is a discrete state, not a sliding scale.
  - "open_text"       Layer 2 ONLY. Used for evidence narratives the consultant evaluates by hand. Score map MUST be omitted.

Bilingual requirement: the Arabic text must read naturally in MSA, not be a word-for-word translation. Acronyms like SDAIA, TDRA, MLOps may stay Latin; institutional names should appear in Arabic where commonly known (e.g. "هيئة البيانات والذكاء الاصطناعي" for SDAIA).

Frameworks you may cite (use real section numbers - do not invent):
${FRAMEWORK_LIST.map((f) => `  - ${f}`).join("\n")}

${STANDARD_LIKERT_NOTE}

Return STRICT JSON matching this exact schema (no markdown fences, no commentary, no leading whitespace):
{
  "layer": 1 | 2,
  "type": "rating" | "yes_no" | "multiple_choice" | "open_text",
  "en": "<English question text>",
  "ar": "<Arabic question text>",
  "ref": "<Framework reference, e.g. 'ISO 42001 §8.5; NIST AI RMF MANAGE-2.4'>",
  "options_en": ["..."]   // omit for rating + open_text
  "options_ar": ["..."]   // omit for rating + open_text
  "score_map": {"label":1, ...}  // omit for rating + open_text
  "rationale": "<one or two sentences explaining why this question matters and which standard clause it audits>"
}

If the user's brief is too vague to write a meaningful question, return:
{"error":"<short explanation of what they need to clarify>"}`;
}

function buildUserPrompt(p: {
  brief: string;
  pillar: AraPillarId;
  layer: 1 | 2;
  similarTo?: string;
}): string {
  const pillar = ARA_PILLARS.find((x) => x.id === p.pillar);
  const lines = [
    `Pillar: ${pillar?.name_en ?? p.pillar} (id: ${p.pillar})`,
    `Layer: ${p.layer} (${p.layer === 1 ? "client self-assessment" : "consultant Phase 2 probe"})`,
    `Brief: ${p.brief}`,
  ];
  if (p.similarTo) lines.push(`Tone-of-voice reference (similar style): "${p.similarTo}"`);
  lines.push("", "Produce the JSON now.");
  return lines.join("\n");
}

/**
 * Generate one question via the Anthropic API.
 *
 * Returns:
 *   { ok: true, question }   on success
 *   { ok: false, error }     on validation / API / parsing failure
 */
export async function generateAraQuestion(p: {
  brief: string;
  pillar: AraPillarId;
  layer: 1 | 2;
  similarTo?: string;
}): Promise<
  | { ok: true; question: AraGeneratedQuestion }
  | { ok: false; error: string }
> {
  if (!isAIConfigured()) {
    return { ok: false, error: "AI is not configured. Set ANTHROPIC_API_KEY in the environment to enable question authoring." };
  }
  const client = getAIClient();
  if (!client) return { ok: false, error: "AI client unavailable" };

  if (!p.brief || p.brief.trim().length < 5) {
    return { ok: false, error: "Brief must be at least 5 characters." };
  }

  let raw: string;
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(p) }],
    });
    const block = resp.content.find((c) => c.type === "text");
    if (!block || block.type !== "text") {
      return { ok: false, error: "AI returned no text content." };
    }
    raw = block.text.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown AI error";
    return { ok: false, error: `AI request failed: ${msg}` };
  }

  // The model is instructed to return raw JSON, but defensively strip
  // any accidental markdown fences if it wraps the output.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); }
  catch { return { ok: false, error: `AI returned non-JSON output. First 200 chars: ${cleaned.slice(0, 200)}` }; }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "AI returned an invalid response shape." };
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.error === "string") {
    return { ok: false, error: `AI declined to answer: ${obj.error}` };
  }

  const layer = obj.layer === 1 || obj.layer === 2 ? (obj.layer as 1 | 2) : null;
  const type = ["rating", "yes_no", "multiple_choice", "open_text"].includes(obj.type as string)
    ? (obj.type as AraGeneratedQuestion["type"])
    : null;
  if (!layer || !type || typeof obj.en !== "string" || typeof obj.ar !== "string" || typeof obj.ref !== "string") {
    return {
      ok: false,
      error: "AI response missing required fields (layer / type / en / ar / ref).",
    };
  }

  const question: AraGeneratedQuestion = {
    layer,
    type,
    en: obj.en.trim(),
    ar: obj.ar.trim(),
    ref: obj.ref.trim(),
    rationale: typeof obj.rationale === "string" ? obj.rationale.trim() : "",
  };

  if (type === "multiple_choice" || type === "yes_no") {
    if (Array.isArray(obj.options_en) && Array.isArray(obj.options_ar) &&
        obj.score_map && typeof obj.score_map === "object") {
      question.options_en = obj.options_en as string[];
      question.options_ar = obj.options_ar as string[];
      question.score_map = obj.score_map as Record<string, number>;
    } else if (type === "yes_no") {
      // Provide the standard yes/no scaffold if the model omitted it.
      question.options_en = ["Yes", "No", "Not sure"];
      question.options_ar = ["نعم", "لا", "غير متأكد"];
      question.score_map = { Yes: 5, No: 1, "Not sure": 2.5 };
    } else {
      return { ok: false, error: "Multiple-choice question is missing options or score map." };
    }
  }

  return { ok: true, question };
}
