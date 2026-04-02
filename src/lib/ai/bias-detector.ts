/**
 * AI-Enhanced Bias Detection
 *
 * Uses AI to analyze patterns in assessor ratings and observations
 * that may indicate systematic biases beyond simple statistical measures.
 */

import { getAIClient, AI_MODEL } from "./client";

export type BiasAnalysisInput = {
  assessorName: string;
  ratings: {
    candidateName: string;
    competencyName: string;
    score: number;
    exerciseName: string;
  }[];
  observations: {
    candidateName: string;
    competencyName: string;
    text: string;
    isPositive: boolean | null;
    exerciseName: string;
  }[];
  statisticalMetrics: {
    meanRating: number;
    standardDeviation: number;
    leniencyBias: number;
    centralTendencyBias: number;
    haloEffect: number;
  };
};

export type BiasAnalysisResult = {
  overallRisk: "low" | "moderate" | "high";
  findings: {
    biasType: string;
    severity: "low" | "moderate" | "high";
    description: string;
    evidence: string;
    recommendation: string;
  }[];
  summary: string;
};

export async function analyzeAssessorBias(
  input: BiasAnalysisInput
): Promise<BiasAnalysisResult | null> {
  const client = getAIClient();
  if (!client) return null;

  const ratingsText = input.ratings
    .map(
      (r) =>
        `${r.candidateName} | ${r.competencyName} | ${r.exerciseName} | ${r.score}/5`
    )
    .join("\n");

  const obsText = input.observations
    .slice(0, 30) // Limit to avoid token overflow
    .map(
      (o) =>
        `${o.candidateName} | ${o.competencyName} | ${o.isPositive === true ? "+" : o.isPositive === false ? "-" : "•"} | ${o.text.slice(0, 150)}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 2048,
    system: `You are an industrial-organizational psychologist specializing in assessment center quality assurance for VIFM. Analyze assessor rating patterns to detect potential biases.

Common rater biases to check:
- Leniency/Severity: consistently rating higher/lower than peers
- Central tendency: avoiding extreme ratings (all 3s)
- Halo effect: same score across all competencies for a candidate
- Horn effect: one negative observation tainting all ratings
- Similar-to-me bias: pattern of higher ratings for certain candidates
- Contrast effect: ratings influenced by previous candidate performance
- First impression: ratings anchored to early observations

Be balanced — not all patterns indicate bias. Consider the evidence carefully.
Output ONLY valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Analyze bias for assessor: ${input.assessorName}

Statistical Metrics:
- Mean Rating: ${input.statisticalMetrics.meanRating}
- Standard Deviation: ${input.statisticalMetrics.standardDeviation}
- Leniency Bias: ${input.statisticalMetrics.leniencyBias}
- Central Tendency: ${(input.statisticalMetrics.centralTendencyBias * 100).toFixed(0)}%
- Halo Effect: ${(input.statisticalMetrics.haloEffect * 100).toFixed(0)}%

Ratings (Candidate | Competency | Exercise | Score):
${ratingsText}

Sample Observations (Candidate | Competency | +/- | Text):
${obsText}

Output JSON:
{
  "overallRisk": "low|moderate|high",
  "findings": [{"biasType": "...", "severity": "...", "description": "...", "evidence": "...", "recommendation": "..."}],
  "summary": "Brief overall assessment"
}`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== "text") return null;
    return JSON.parse(content.text) as BiasAnalysisResult;
  } catch {
    return null;
  }
}
