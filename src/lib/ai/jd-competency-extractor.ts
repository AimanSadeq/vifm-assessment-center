import type Anthropic from "@anthropic-ai/sdk";
import { getAIClient, AI_MODEL } from "./client";
import type { Competency } from "@/types/database";

export type ExtractedCompetencyRecommendation = {
  competencyId: string;
  competencyName: string;
  weight: number;
  priority: "high" | "medium" | "low";
  reasoning: string;
};

type TextInput = {
  jobDescription: string;
  targetRole?: string;
  competencies: Competency[];
};

type PdfInput = {
  pdfBase64: string;
  targetRole?: string;
  competencies: Competency[];
};

const VALID_PRIORITIES = new Set(["high", "medium", "low"]);

const SYSTEM_PROMPT =
  `You are an assessment center designer for VIFM (Virginia Institute of Finance and Management). ` +
  `Given a job description, you select which competencies from VIFM's framework should be assessed. ` +
  `You ONLY pick from the supplied list - do not invent competencies. ` +
  `You may receive English or Arabic job descriptions; respond in English regardless. ` +
  `Aim for 6 to 10 competencies - never fewer than 4, never more than 12. ` +
  `Prioritise behaviours genuinely critical to success in the role over generic ones.`;

function buildInstructions(
  competencies: Competency[],
  targetRole: string | undefined,
  jdInline: string | null
) {
  const competencyMenu = competencies
    .map((c) => `- ${c.name} [${c.id}]${c.description ? `: ${c.description}` : ""}`)
    .join("\n");

  return (
    `Target role: ${targetRole?.trim() || "(not specified - infer from JD)"}\n\n` +
    (jdInline
      ? `Job description:\n"""\n${jdInline.trim()}\n"""\n\n`
      : `The job description is provided as the attached PDF document. Read it in full before deciding.\n\n`) +
    `VIFM competencies you may pick from:\n${competencyMenu}\n\n` +
    `Return ONLY a JSON array (no markdown fences, no preamble). Each element matches:\n` +
    `{\n` +
    `  "competencyId": "<id from list above>",\n` +
    `  "competencyName": "<exact name from list>",\n` +
    `  "weight": <number 1.0–10.0, higher = more important to this role>,\n` +
    `  "priority": "high" | "medium" | "low",\n` +
    `  "reasoning": "<1 sentence: which JD requirement maps to this competency>"\n` +
    `}\n\n` +
    `Distribute weights so total roughly sums to 30 across all picks (not enforced - guideline). ` +
    `Use "high" priority for 2-4 mission-critical competencies, "medium" for the rest, "low" sparingly.`
  );
}

export async function extractCompetenciesFromJobDescription(
  input: TextInput
): Promise<ExtractedCompetencyRecommendation[] | null> {
  const ai = getAIClient();
  if (!ai) return null;

  const { jobDescription, targetRole, competencies } = input;
  if (!jobDescription.trim() || competencies.length === 0) return [];

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildInstructions(competencies, targetRole, jobDescription),
        },
      ],
    });

    return parseRecommendations(response, competencies);
  } catch (err) {
    console.error("[ac jd-extract] Failed:", err);
    return null;
  }
}

export async function extractCompetenciesFromJdPdf(
  input: PdfInput
): Promise<ExtractedCompetencyRecommendation[] | null> {
  const ai = getAIClient();
  if (!ai) return null;

  const { pdfBase64, targetRole, competencies } = input;
  if (!pdfBase64 || competencies.length === 0) return [];

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
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
              text: buildInstructions(competencies, targetRole, null),
            },
          ],
        },
      ],
    });

    return parseRecommendations(response, competencies);
  } catch (err) {
    console.error("[ac jd-extract:pdf] Failed:", err);
    return null;
  }
}

function parseRecommendations(
  response: Anthropic.Messages.Message,
  competencies: Competency[]
): ExtractedCompetencyRecommendation[] | null {
  try {
    const block = response.content[0];
    if (block?.type !== "text") return null;

    const raw = block.text.trim();
    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText) as ExtractedCompetencyRecommendation[];
    if (!Array.isArray(parsed)) return [];

    const validIds = new Set(competencies.map((c) => c.id));
    const idToName = new Map(competencies.map((c) => [c.id, c.name]));

    return parsed
      .filter((r) => {
        if (typeof r?.competencyId !== "string") return false;
        if (!validIds.has(r.competencyId)) return false;
        if (typeof r.weight !== "number" || r.weight < 0.5 || r.weight > 10) return false;
        if (!VALID_PRIORITIES.has(r.priority)) return false;
        return true;
      })
      .map((r) => ({
        ...r,
        competencyName: idToName.get(r.competencyId) ?? r.competencyName,
        weight: Math.round(r.weight * 2) / 2,
        reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
      }));
  } catch (err) {
    console.error("[ac jd-extract] Failed:", err);
    return null;
  }
}
