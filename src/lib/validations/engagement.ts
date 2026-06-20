import { z } from "zod";
import { uuidish } from "@/lib/validations/ids";

// organizationId / competencyId / exerciseId use uuidish (permissive UUID-shape),
// NOT z.string().uuid(): the seed competencies + role profiles + (some) orgs carry
// synthetic UUIDs whose version nibble is 0, which Zod 4's strict .uuid() rejects.
// Validating them strictly silently failed engagement creation. See lib/validations/ids.
export const basicInfoSchema = z.object({
  organizationId: uuidish("Organization is required"),
  name: z.string().min(1, "Engagement name is required").max(200),
  targetRole: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) return data.endDate >= data.startDate;
  return true;
}, { message: "End date must be after start date", path: ["endDate"] });

export type BasicInfoValues = z.infer<typeof basicInfoSchema>;

export const newOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  industry: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
});

export type NewOrganizationValues = z.infer<typeof newOrganizationSchema>;

export const newExerciseSchema = z.object({
  name: z.string().min(1, "Exercise name is required"),
  exerciseType: z.string().min(1, "Exercise type is required"),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  instructions: z.string().optional(),
});

export type NewExerciseValues = z.infer<typeof newExerciseSchema>;

export const createEngagementSchema = z.object({
  organizationId: uuidish(),
  name: z.string().min(1),
  targetRole: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  competencies: z
    .array(
      z.object({
        competencyId: uuidish(),
        weight: z.number().nullable(),
      })
    )
    .min(4, "Select at least 4 competencies")
    .max(15, "Maximum 15 competencies per engagement"),
  exercises: z.array(uuidish()).min(1, "Select at least 1 exercise"),
  matrix: z.array(
    z.object({
      exerciseId: uuidish(),
      competencyId: uuidish(),
    })
  ),
}).refine((data) => {
  // Each selected competency must appear in at least 2 exercises in the matrix
  const compExerciseCount = new Map<string, number>();
  for (const m of data.matrix) {
    compExerciseCount.set(m.competencyId, (compExerciseCount.get(m.competencyId) ?? 0) + 1);
  }
  return data.competencies.every((c) => (compExerciseCount.get(c.competencyId) ?? 0) >= 2);
}, { message: "Each competency must be mapped to at least 2 exercises in the matrix" });

export type CreateEngagementPayload = z.infer<typeof createEngagementSchema>;
