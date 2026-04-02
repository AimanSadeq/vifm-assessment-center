/**
 * AI Development Recommender
 *
 * Generates personalized development recommendations for candidates
 * based on their assessment results, targeting the specific role level.
 */

import { getAIClient, AI_MODEL } from "./client";

export type RecommenderInput = {
  candidateName: string;
  targetRole: string;
  competencyResults: {
    name: string;
    score: number;
    description: string | null;
  }[];
  overallScore: number;
  recommendation: string;
};

export type DevelopmentPlan = {
  summary: string;
  recommendations: {
    competencyName: string;
    currentLevel: string;
    targetLevel: string;
    actions: string[];
    resources: string[];
    timeframe: string;
    priority: "high" | "medium" | "low";
  }[];
};

export async function generateDevelopmentPlan(
  input: RecommenderInput
): Promise<DevelopmentPlan | null> {
  const client = getAIClient();
  if (!client) return null;

  const compResults = input.competencyResults
    .map((c) => `- ${c.name}: ${c.score}/5 (${c.description ?? "No description"})`)
    .join("\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: `You are an expert leadership development consultant for VIFM (Virginia Institute of Finance and Management). Generate personalized development plans for assessment center candidates in the GCC/MENA region (banking, government, corporate sectors).

Guidelines:
- Focus on competencies scoring below 4 (Strength level)
- Prioritize competencies critical for the target role
- Recommend specific, actionable development activities
- Include both formal and informal development methods (70-20-10 model)
- Consider cultural context of GCC/MENA region
- Timeframes should be realistic (3-12 months)
- Resources should include specific types of learning (coaching, courses, stretch assignments)

Output ONLY valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Generate a development plan for:

Candidate: ${input.candidateName}
Target Role: ${input.targetRole}
Overall Score: ${input.overallScore}/5
Recommendation: ${input.recommendation}

Competency Results:
${compResults}

Output JSON format:
{
  "summary": "1-2 paragraph development plan overview",
  "recommendations": [{
    "competencyName": "...",
    "currentLevel": "e.g., Competent",
    "targetLevel": "e.g., Strength",
    "actions": ["specific action 1", "specific action 2"],
    "resources": ["resource type 1", "resource type 2"],
    "timeframe": "e.g., 3-6 months",
    "priority": "high|medium|low"
  }]
}`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== "text") return null;
    return JSON.parse(content.text) as DevelopmentPlan;
  } catch {
    return null;
  }
}
