import { z } from "zod";

export const saveConsensusRatingSchema = z.object({
  engagementId: z.string().uuid(),
  candidateId: z.string().uuid(),
  competencyId: z.string().uuid(),
  finalScore: z.number().int().min(1).max(5),
  discussionNotes: z.string().optional(),
});

export type SaveConsensusRatingValues = z.infer<typeof saveConsensusRatingSchema>;

export const saveOarSchema = z.object({
  engagementId: z.string().uuid(),
  candidateId: z.string().uuid(),
  overallScore: z.number().int().min(1).max(5),
  recommendation: z.enum(["ready_now", "ready_with_development", "not_ready"]),
  summary: z.string().optional(),
});

export type SaveOarValues = z.infer<typeof saveOarSchema>;

export const OAR_RECOMMENDATION_LABELS: Record<string, string> = {
  ready_now: "Ready Now",
  ready_with_development: "Ready with Development",
  not_ready: "Not Ready",
};

export const OAR_RECOMMENDATION_COLORS: Record<string, string> = {
  ready_now: "text-green-700 bg-green-50 border-green-200",
  ready_with_development: "text-yellow-700 bg-yellow-50 border-yellow-200",
  not_ready: "text-red-700 bg-red-50 border-red-200",
};
