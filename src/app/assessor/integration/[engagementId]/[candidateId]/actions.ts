"use server";

import { createServiceClient } from "@/lib/supabase/server";
import {
  saveIntegrationSchema,
  type SaveIntegrationValues,
} from "@/lib/validations/assessor";

export async function saveIntegrationAction(values: SaveIntegrationValues) {
  const parsed = saveIntegrationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();

  // Check if entry exists
  const { data: existing } = await supabase
    .from("integration_worksheets")
    .select("id")
    .eq("engagement_id", parsed.data.engagementId)
    .eq("assessor_id", parsed.data.assessorId)
    .eq("candidate_id", parsed.data.candidateId)
    .eq("competency_id", parsed.data.competencyId)
    .maybeSingle();

  if (existing) {
    // Update
    const { data, error } = await supabase
      .from("integration_worksheets")
      .update({
        preliminary_rating: parsed.data.preliminaryRating,
        notes: parsed.data.notes || null,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return { error: error.message };
    return { data };
  } else {
    // Insert
    const { data, error } = await supabase
      .from("integration_worksheets")
      .insert({
        engagement_id: parsed.data.engagementId,
        assessor_id: parsed.data.assessorId,
        candidate_id: parsed.data.candidateId,
        competency_id: parsed.data.competencyId,
        preliminary_rating: parsed.data.preliminaryRating,
        notes: parsed.data.notes || null,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    return { data };
  }
}
