import { getAIClient, AI_MODEL } from "./client";

export type ExtractedBehaviorProposal = {
  competency_name_en: string;
  competency_name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  behaviors: Array<{
    text_en: string;
    text_ar: string | null;
    rationale: string;
  }>;
};

const SYSTEM_PROMPT =
  `You are an assessment designer for Reflect 360, a leadership feedback platform calibrated for the GCC. ` +
  `Given a client's Corporate Values and/or Leadership Competencies in English or Arabic, you decompose each into ` +
  `3 to 5 observable behaviours that raters can score on a 5-point frequency scale ` +
  `(Almost never → Almost always). ` +
  `Every behaviour must be: specific, observable, framed positively (no negations), and start with a verb in the present tense. ` +
  `Output is BILINGUAL: every behaviour rendered in both English and Modern Standard Arabic suitable for Gulf readers.`;

type Input = {
  sourceText: string;
  // Optional hint to constrain the AI's interpretation when the consultant
  // already knows the working language of the client.
  defaultLanguage?: "en" | "ar";
};

function buildPrompt(input: Input) {
  return (
    `Source content from the client (may be EN, AR, or mixed):\n` +
    `"""\n${input.sourceText.trim()}\n"""\n\n` +
    `Identify the competencies and/or values mentioned in the source. Treat each value or competency as a top-level item. ` +
    `For each top-level item, produce 3-5 observable behaviours.\n\n` +
    `Return ONLY a JSON array (no markdown fences, no preamble). Each element matches:\n` +
    `{\n` +
    `  "competency_name_en": "<title-case English name>",\n` +
    `  "competency_name_ar": "<Arabic name, or null if not derivable>",\n` +
    `  "description_en": "<1 sentence in English>",\n` +
    `  "description_ar": "<1 sentence in Arabic>",\n` +
    `  "behaviors": [\n` +
    `    {\n` +
    `      "text_en": "<observable behaviour, English>",\n` +
    `      "text_ar": "<same behaviour, Modern Standard Arabic>",\n` +
    `      "rationale": "<1 short sentence on why this behaviour ladders to the competency>"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Hard constraints: 3-5 behaviours per item; 3-8 items total. Behaviours must be 8-25 words. ` +
    `If the source is sparse, infer reasonable behaviours; if the source is rich, stay faithful to the client's own phrasing.`
  );
}

export async function extractBehaviorsFromValues(
  input: Input
): Promise<ExtractedBehaviorProposal[] | null> {
  const ai = getAIClient();
  if (!ai) return null;

  if (!input.sourceText.trim()) return [];

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildPrompt(input) },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];

    const raw = textBlock.text.trim();
    // Tolerate accidental code fences.
    const stripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      console.warn("reflect-behavior-extractor: JSON parse failed");
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is ExtractedBehaviorProposal => {
        if (!item || typeof item !== "object") return false;
        const it = item as Record<string, unknown>;
        return (
          typeof it.competency_name_en === "string" &&
          Array.isArray(it.behaviors)
        );
      })
      .map((item) => ({
        competency_name_en: String(item.competency_name_en).trim(),
        competency_name_ar:
          typeof item.competency_name_ar === "string" ? item.competency_name_ar.trim() : null,
        description_en:
          typeof item.description_en === "string" ? item.description_en.trim() : null,
        description_ar:
          typeof item.description_ar === "string" ? item.description_ar.trim() : null,
        behaviors: (item.behaviors as Array<Record<string, unknown>>)
          .filter(
            (b) =>
              b && typeof b === "object" && typeof b.text_en === "string" && (b.text_en as string).trim().length > 0
          )
          .map((b) => ({
            text_en: String(b.text_en).trim(),
            text_ar: typeof b.text_ar === "string" ? b.text_ar.trim() : null,
            rationale: typeof b.rationale === "string" ? b.rationale.trim() : "",
          })),
      }));
  } catch (err) {
    console.error("reflect-behavior-extractor: AI call failed", err);
    return null;
  }
}
