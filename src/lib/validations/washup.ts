import { z } from "zod";
import { uuidish } from "@/lib/validations/ids";

// competencyId is a seed id (synthetic UUID, version nibble 0) that Zod 4's
// strict .uuid() rejects - so use uuidish here. engagementId/candidateId are
// app-generated but uuidish is a safe superset. See lib/validations/ids.
export const saveConsensusRatingSchema = z.object({
  engagementId: uuidish(),
  candidateId: uuidish(),
  competencyId: uuidish(),
  finalScore: z.number().int().min(1).max(5),
  discussionNotes: z.string().optional(),
});

export type SaveConsensusRatingValues = z.infer<typeof saveConsensusRatingSchema>;

export const saveOarSchema = z.object({
  engagementId: uuidish(),
  candidateId: uuidish(),
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
