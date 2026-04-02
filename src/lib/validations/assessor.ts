import { z } from "zod";

export const addCandidateSchema = z.object({
  engagementId: z.string().uuid(),
  fullName: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
});

export type AddCandidateValues = z.infer<typeof addCandidateSchema>;

export const createAssignmentSchema = z.object({
  engagementId: z.string().uuid(),
  assessorId: z.string().uuid(),
  candidateId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>;

export const saveObservationSchema = z.object({
  assessorAssignmentId: z.string().uuid(),
  competencyId: z.string().uuid(),
  behaviorObserved: z.string().min(1, "Observation text is required"),
  isPositive: z.boolean().nullable(),
});

export type SaveObservationValues = z.infer<typeof saveObservationSchema>;

export const saveRatingSchema = z.object({
  assessorAssignmentId: z.string().uuid(),
  competencyId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  justification: z.string().optional(),
});

export type SaveRatingValues = z.infer<typeof saveRatingSchema>;

export const saveIntegrationSchema = z.object({
  engagementId: z.string().uuid(),
  assessorId: z.string().uuid(),
  candidateId: z.string().uuid(),
  competencyId: z.string().uuid(),
  preliminaryRating: z.number().int().min(1).max(5),
  notes: z.string().optional(),
});

export type SaveIntegrationValues = z.infer<typeof saveIntegrationSchema>;

export const BARS_LABELS: Record<number, string> = {
  1: "Significant Development Needed",
  2: "Development Needed",
  3: "Competent",
  4: "Strength",
  5: "Significant Strength",
};
