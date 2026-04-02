"use server";

import { createClient } from "@/lib/supabase/server";
import {
  saveIntegrationSchema,
  type SaveIntegrationValues,
} from "@/lib/validations/assessor";

export async function saveIntegrationAction(values: SaveIntegrationValues) {
  const parsed = saveIntegrationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  // Delete existing entry if present, then insert fresh (avoids TOCTOU race)
  await supabase
    .from("integration_worksheets")
    .delete()
    .eq("engagement_id", parsed.data.engagementId)
    .eq("assessor_id", parsed.data.assessorId)
    .eq("candidate_id", parsed.data.candidateId)
    .eq("competency_id", parsed.data.competencyId);

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
