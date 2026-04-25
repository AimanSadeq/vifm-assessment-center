"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createEngagementSchema,
  type CreateEngagementPayload,
  newOrganizationSchema,
  type NewOrganizationValues,
  newExerciseSchema,
  type NewExerciseValues,
} from "@/lib/validations/engagement";

export async function createOrganizationAction(values: NewOrganizationValues) {
  const parsed = newOrganizationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: parsed.data.name,
      industry: parsed.data.industry || null,
      country: parsed.data.country || null,
      contact_name: parsed.data.contactName || null,
      contact_email: parsed.data.contactEmail || null,
    })
    .select("id, name")
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function createExerciseAction(values: NewExerciseValues) {
  const parsed = newExerciseSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: parsed.data.name,
      exercise_type: parsed.data.exerciseType,
      description: parsed.data.description || null,
      duration_minutes: parsed.data.durationMinutes || null,
      instructions: parsed.data.instructions || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

async function rollbackEngagement(supabase: Awaited<ReturnType<typeof createClient>>, engagementId: string) {
  // Delete in reverse dependency order - cascade should handle most of this
  // but be explicit to ensure clean rollback
  await supabase.from("exercise_competency_matrix").delete().eq("engagement_id", engagementId);
  await supabase.from("engagement_exercises").delete().eq("engagement_id", engagementId);
  await supabase.from("engagement_competencies").delete().eq("engagement_id", engagementId);
  await supabase.from("engagements").delete().eq("id", engagementId);
}

export async function createEngagementAction(payload: CreateEngagementPayload) {
  const parsed = createEngagementSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const data = parsed.data;

  // 1. Insert engagement
  const { data: engagement, error: engError } = await supabase
    .from("engagements")
    .insert({
      organization_id: data.organizationId,
      name: data.name,
      target_role: data.targetRole || null,
      status: "draft",
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      created_by: await supabase.auth.getUser().then(r => r.data.user?.id ?? null),
    })
    .select("id")
    .single();

  if (engError || !engagement) {
    return { error: engError?.message ?? "Failed to create engagement" };
  }

  const engagementId = engagement.id;

  // 2. Insert engagement_competencies
  const compRows = data.competencies.map((c) => ({
    engagement_id: engagementId,
    competency_id: c.competencyId,
    weight: c.weight,
  }));

  const { error: compError } = await supabase
    .from("engagement_competencies")
    .insert(compRows);

  if (compError) {
    await rollbackEngagement(supabase, engagementId);
    return { error: `Competencies: ${compError.message}` };
  }

  // 3. Insert engagement_exercises
  const exRows = data.exercises.map((exerciseId) => ({
    engagement_id: engagementId,
    exercise_id: exerciseId,
  }));

  const { error: exError } = await supabase
    .from("engagement_exercises")
    .insert(exRows);

  if (exError) {
    await rollbackEngagement(supabase, engagementId);
    return { error: `Exercises: ${exError.message}` };
  }

  // 4. Insert exercise_competency_matrix
  if (data.matrix.length > 0) {
    const matrixRows = data.matrix.map((m) => ({
      engagement_id: engagementId,
      exercise_id: m.exerciseId,
      competency_id: m.competencyId,
    }));

    const { error: matrixError } = await supabase
      .from("exercise_competency_matrix")
      .insert(matrixRows);

    if (matrixError) {
      await rollbackEngagement(supabase, engagementId);
      return { error: `Matrix: ${matrixError.message}` };
    }
  }

  return { data: { id: engagementId } };
}
