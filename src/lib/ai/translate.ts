import { getAIClient, AI_MODEL } from "./client";

/**
 * Translate consultant note text between English and Gulf Arabic for
 * the bilingual ARA report. Returns null when:
 *   - the API key is not configured (caller should treat as "skip")
 *   - the API call fails (logged, caller should keep the original)
 *
 * The model is instructed to preserve numbers, dates, currency tags,
 * proper nouns, and product names verbatim - those should look
 * identical in both languages so the consultant can audit the
 * translation without losing factual anchors.
 */
export async function translateConsultantNote(
  text: string,
  from: "en" | "ar",
  to: "en" | "ar"
): Promise<string | null> {
  if (!text || from === to) return null;

  const ai = getAIClient();
  if (!ai) return null;

  const fromLanguage = from === "en" ? "English" : "Gulf Arabic";
  const toLanguage = to === "en" ? "English" : "Gulf Arabic";

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      system:
        `You translate VIFM consultant notes between English and Gulf Arabic for ` +
        `bilingual AI Readiness assessment reports. ` +
        `Preserve verbatim: numbers, dates, currency tags (AED, SAR), proper ` +
        `nouns, product names, framework names (e.g. "UAE National AI Strategy 2031"), ` +
        `version tags (e.g. "v2.1"), and acronyms (KPI, AI, DPIA, AC). ` +
        `Use formal business register, not colloquial Arabic. Output only the ` +
        `translation - no preamble, no quotes, no explanations.`,
      messages: [
        {
          role: "user",
          content: `Translate this ${fromLanguage} consultant note into ${toLanguage}:\n\n${text}`,
        },
      ],
    });

    const block = response.content[0];
    if (block?.type !== "text") return null;
    const translated = block.text.trim();
    return translated.length > 0 ? translated : null;
  } catch (err) {
    console.error("[ara translate] Failed:", err);
    return null;
  }
}
