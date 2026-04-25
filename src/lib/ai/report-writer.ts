/**
 * AI Report Writer
 *
 * Generates narrative sections for candidate assessment reports
 * based on observation data, ratings, and consensus scores.
 */

import { getAIClient, AI_MODEL } from "./client";

export type ReportWriterInput = {
  candidateName: string;
  targetRole: string;
  engagementName: string;
  competencies: {
    name: string;
    consensusScore: number | null;
    observations: { text: string; isPositive: boolean | null }[];
    exerciseRatings: { exerciseName: string; score: number }[];
  }[];
  overallScore: number | null;
  recommendation: string | null;
};

export type GeneratedReport = {
  executiveSummary: string;
  competencyNarratives: { competencyName: string; narrative: string }[];
  developmentRecommendations: {
    competencyName: string;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }[];
};

export async function generateReportNarrative(
  input: ReportWriterInput
): Promise<GeneratedReport | null> {
  const client = getAIClient();
  if (!client) return null;

  const compDetails = input.competencies
    .map((c) => {
      const obsText = c.observations
        .map((o) => `${o.isPositive === true ? "[+]" : o.isPositive === false ? "[-]" : "[•]"} ${o.text}`)
        .join("\n    ");
      const ratingsText = c.exerciseRatings
        .map((r) => `${r.exerciseName}: ${r.score}/5`)
        .join(", ");
      return `Competency: ${c.name}
  Consensus Score: ${c.consensusScore ?? "Pending"}/5
  Exercise Ratings: ${ratingsText || "None"}
  Observations:
    ${obsText || "None recorded"}`;
    })
    .join("\n\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: `You are an expert assessment center report writer for VIFM (Virginia Institute of Finance and Management). Generate professional, evidence-based narrative content for candidate assessment reports.

Guidelines:
- Use formal, professional language appropriate for executive-level reports
- Ground all statements in observed behavioral evidence
- Be balanced - highlight strengths and development areas
- Use specific examples from observations
- Keep narratives concise but substantive (3-5 sentences per competency)
- Development recommendations should be actionable and specific

Output ONLY valid JSON matching the required format.`,
    messages: [
      {
        role: "user",
        content: `Generate report narratives for:

Candidate: ${input.candidateName}
Target Role: ${input.targetRole}
Assessment: ${input.engagementName}
Overall Score: ${input.overallScore ?? "Pending"}/5
Recommendation: ${input.recommendation ?? "Pending"}

Competency Data:
${compDetails}

Output JSON format:
{
  "executiveSummary": "2-3 paragraph executive summary",
  "competencyNarratives": [{ "competencyName": "...", "narrative": "..." }],
  "developmentRecommendations": [{ "competencyName": "...", "recommendation": "...", "priority": "high|medium|low" }]
}`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== "text") return null;
    return JSON.parse(content.text) as GeneratedReport;
  } catch {
    return null;
  }
}
