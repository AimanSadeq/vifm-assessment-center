import { getAIClient, AI_MODEL } from "./client";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";

/**
 * Extract structured regulatory requirements from a PDF document via
 * Claude. The model receives the PDF inline as a `document` content
 * block and is asked to enumerate the requirements that govern AI use,
 * with each requirement tagged to one of the eight ARA pillars.
 *
 * Returns null when the API key is missing or the call fails. Returns
 * an empty array when the call succeeds but the document has no
 * extractable requirements.
 */
export type ExtractedRequirement = {
  requirement_code: string;
  requirement_text_en: string;
  requirement_text_ar: string;
  requirement_category: string | null;
  pillar_id: string | null;
  // Must match the ara_severity enum (mandatory | recommended | advisory).
  // "informational" is NOT a valid enum value and would reject the whole
  // insert batch at the DB layer (admin-actions also clamps as a backstop).
  severity: "mandatory" | "recommended" | "advisory";
};

export async function extractRegulatoryRequirementsFromPdf(
  pdfBase64: string,
  frameworkCode: string,
  region: "uae" | "saudi"
): Promise<ExtractedRequirement[] | null> {
  const ai = getAIClient();
  if (!ai) return null;

  const pillarList = ARA_PILLARS.map((p) => `${p.id} (${p.name_en})`).join(", ");

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      system:
        `You extract regulatory requirements from ${region === "uae" ? "UAE" : "Saudi Arabia"} ` +
        `policy documents that govern AI deployment. For each distinct requirement (typically ` +
        `one per article, clause, or numbered section), output a JSON object. ` +
        `Skip preambles, definitions, and recitals. ` +
        `Each requirement must be classified to ONE of these eight ARA pillars: ${pillarList}. ` +
        `Pick the closest fit; if a requirement spans multiple, pick the one most directly addressed.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: pdfBase64,
              },
            },
            {
              type: "text" as const,
              text:
                `Extract the regulatory requirements from this document and return ONLY a JSON ` +
                `array (no markdown fences, no preamble). Each element matches:\n\n` +
                `{\n` +
                `  "requirement_code": "${frameworkCode}-A1.1",  // unique within the framework, like "${frameworkCode}-Art4.2"\n` +
                `  "requirement_text_en": "...",                // 1-2 sentences in formal English\n` +
                `  "requirement_text_ar": "...",                // formal Arabic translation, preserving numbers, dates, and proper nouns\n` +
                `  "requirement_category": "data_protection",   // free-form short tag like "transparency", "fairness", "incident_response"\n` +
                `  "pillar_id": "data",                         // one of: ${ARA_PILLARS.map(p => p.id).join(", ")}\n` +
                `  "severity": "mandatory"                      // mandatory | recommended | advisory\n` +
                `}\n\n` +
                `Limit to ~30 requirements maximum. Pick the most material ones if the document is large.`,
            },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (block?.type !== "text") return null;

    // The model may wrap the JSON in markdown fences despite our instruction.
    // Strip a leading ```json or ``` if present, then parse.
    const raw = block.text.trim();
    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText) as ExtractedRequirement[];
    if (!Array.isArray(parsed)) return [];

    // Validate each item against the expected shape; drop bad rows.
    const validPillarIds: Set<string> = new Set(ARA_PILLARS.map((p) => p.id));
    const validSeverities: Set<string> = new Set(["mandatory", "recommended", "advisory"]);
    return parsed
      .map((r) => ({
        ...r,
        // Coerce a legacy / off-spec value the model might still emit so it
        // never reaches the ara_severity enum cast (advisory is the safe
        // low-priority default that exists in the enum). Cast to string
        // because the model's raw output isn't constrained to the union.
        severity: (r?.severity as string) === "informational" ? "advisory" : r?.severity,
      }))
      .filter((r) => {
        if (typeof r?.requirement_code !== "string") return false;
        if (typeof r?.requirement_text_en !== "string") return false;
        if (typeof r?.requirement_text_ar !== "string") return false;
        if (r.pillar_id && !validPillarIds.has(r.pillar_id)) return false;
        if (!validSeverities.has(r.severity)) return false;
        return true;
      });
  } catch (err) {
    console.error("[ara reg-extract] Failed:", err);
    return null;
  }
}
