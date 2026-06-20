import { z } from "zod";

// Permissive UUID-shape check. Zod's .uuid() enforces RFC 4122 (version 1-5,
// variant 8/9/a/b). The role-profile seed migration uses synthetic UUIDs
// like "00000001-aaaa-0000-0000-000000000005" which are valid Postgres uuid
// values but fail the strict check. We trust Postgres to do the real validation.
const uuidShape = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID");

export const addCandidateSchema = z.object({
  engagementId: uuidShape,
  fullName: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  roleProfileId: uuidShape.optional().nullable(),
});

export type AddCandidateValues = z.infer<typeof addCandidateSchema>;

export const setCandidateRoleProfileSchema = z.object({
  candidateId: uuidShape,
  roleProfileId: uuidShape.nullable(),
});

export type SetCandidateRoleProfileValues = z.infer<typeof setCandidateRoleProfileSchema>;

export const createAssignmentSchema = z.object({
  engagementId: uuidShape,
  assessorId: uuidShape,
  candidateId: uuidShape,
  exerciseId: uuidShape,
});

export type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>;

export const saveObservationSchema = z.object({
  assessorAssignmentId: uuidShape,
  competencyId: uuidShape,
  behaviorObserved: z.string().min(1, "Observation text is required"),
  isPositive: z.boolean().nullable(),
});

export type SaveObservationValues = z.infer<typeof saveObservationSchema>;

export const saveRatingSchema = z.object({
  assessorAssignmentId: uuidShape,
  competencyId: uuidShape,
  score: z.number().int().min(1).max(5),
  justification: z.string().optional(),
});

export type SaveRatingValues = z.infer<typeof saveRatingSchema>;

export const saveIntegrationSchema = z.object({
  engagementId: uuidShape,
  assessorId: uuidShape,
  candidateId: uuidShape,
  competencyId: uuidShape,
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

export const startQuizSchema = z.object({
  candidateId: uuidShape,
  competencyId: uuidShape,
});
export type StartQuizValues = z.infer<typeof startQuizSchema>;

export const saveQuizAnswerSchema = z.object({
  attemptId: uuidShape,
  questionIndex: z.number().int().min(0).max(20),
  pickedIndex: z.number().int().min(0).max(20).nullable(),
});
export type SaveQuizAnswerValues = z.infer<typeof saveQuizAnswerSchema>;

export const completeQuizSchema = z.object({
  attemptId: uuidShape,
});
export type CompleteQuizValues = z.infer<typeof completeQuizSchema>;
