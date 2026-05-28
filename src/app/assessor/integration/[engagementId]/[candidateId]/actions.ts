"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import {
  saveIntegrationSchema,
  type SaveIntegrationValues,
} from "@/lib/validations/assessor";

// Writes go through the service client (integration_worksheets RLS only permits
// the owning assessor); requireRole still gates the caller - synthetic admin in
// dev, real assessor/admin check under auth=on.
async function gateAssessor(): Promise<{ error: string } | null> {
  try {
    await requireRole(["lead_assessor", "associate_assessor", "admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

export async function saveIntegrationAction(values: SaveIntegrationValues) {
  const gate = await gateAssessor();
  if (gate) return gate;

  const parsed = saveIntegrationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();

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
