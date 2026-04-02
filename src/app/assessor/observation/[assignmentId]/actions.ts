"use server";

import { createServiceClient } from "@/lib/supabase/server";
import {
  saveObservationSchema,
  type SaveObservationValues,
  saveRatingSchema,
  type SaveRatingValues,
} from "@/lib/validations/assessor";

export async function saveObservationAction(values: SaveObservationValues) {
  const parsed = saveObservationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("observations")
    .insert({
      assessor_assignment_id: parsed.data.assessorAssignmentId,
      competency_id: parsed.data.competencyId,
      behavior_observed: parsed.data.behaviorObserved,
      is_positive: parsed.data.isPositive,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function deleteObservationAction(observationId: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("observations")
    .delete()
    .eq("id", observationId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function saveRatingAction(values: SaveRatingValues) {
  const parsed = saveRatingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();

  // Upsert: insert or update if already exists
  const { data, error } = await supabase
    .from("ratings")
    .upsert(
      {
        assessor_assignment_id: parsed.data.assessorAssignmentId,
        competency_id: parsed.data.competencyId,
        score: parsed.data.score,
        justification: parsed.data.justification || null,
      },
      { onConflict: "assessor_assignment_id,competency_id" }
    )
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function deleteRatingAction(assignmentId: string, competencyId: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("ratings")
    .delete()
    .eq("assessor_assignment_id", assignmentId)
    .eq("competency_id", competencyId);

  if (error) return { error: error.message };
  return { success: true };
}
