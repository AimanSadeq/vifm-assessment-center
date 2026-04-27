/**
 * AI Voice Observation Assistant
 *
 * Helps assessors convert free-form voice notes into structured
 * behavioral observations classified by competency.
 *
 * Flow:
 * 1. Assessor speaks or types raw observation notes
 * 2. AI classifies into competency, extracts behavior, determines +/-
 * 3. Returns structured observations ready to save
 */

import { getAIClient, AI_MODEL } from "./client";

export type RawObservation = {
  text: string;
  exerciseName: string;
  competencies: { id: string; name: string }[];
};

export type StructuredObservation = {
  competencyId: string;
  competencyName: string;
  behaviorObserved: string;
  isPositive: boolean | null;
  confidence: number;
};

export async function classifyObservation(
  input: RawObservation
): Promise<StructuredObservation[]> {
  const client = getAIClient();
  if (!client) {
    // Fallback: return raw text as a single unclassified observation
    return [
      {
        competencyId: input.competencies[0]?.id ?? "",
        competencyName: input.competencies[0]?.name ?? "Unknown",
        behaviorObserved: input.text,
        isPositive: null,
        confidence: 0,
      },
    ];
  }

  const competencyList = input.competencies
    .map((c) => `- ${c.name} (ID: ${c.id})`)
    .join("\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system: `You are an expert assessment center observation classifier for VIFM (Virginia Institute of Finance and Management). Your role is to take raw assessor notes and classify them into structured behavioral observations.

For each distinct behavior mentioned, output a JSON array of objects with:
- competencyId: the ID from the provided list
- competencyName: the name of the matched competency
- behaviorObserved: a clear, concise description of the observed behavior (1-2 sentences)
- isPositive: true if the behavior is a positive indicator, false if negative, null if neutral
- confidence: 0.0 to 1.0 indicating classification confidence

Rules:
- One raw note may contain multiple distinct behaviors
- Each behavior should map to exactly one competency
- Use precise behavioral language (what the person did, not interpretations)
- Output ONLY valid JSON array, no other text`,
    messages: [
      {
        role: "user",
        content: `Exercise: ${input.exerciseName}

Available competencies for this exercise:
${competencyList}

Raw observation notes:
${input.text}

Classify into structured observations (JSON array):`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== "text") return [];
    const parsed = JSON.parse(content.text) as StructuredObservation[];
    return parsed;
  } catch {
    // If parsing fails, return raw text
    return [
      {
        competencyId: input.competencies[0]?.id ?? "",
        competencyName: input.competencies[0]?.name ?? "Unknown",
        behaviorObserved: input.text,
        isPositive: null,
        confidence: 0,
      },
    ];
  }
}
