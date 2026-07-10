"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizationError, AuthorizationError } from "@/lib/ara/auth-guards";
import { requireAssignmentOwner, assertEngagementUnlocked } from "@/lib/ac/assessor-guards";
import {
  saveObservationSchema,
  type SaveObservationValues,
  saveRatingSchema,
  type SaveRatingValues,
} from "@/lib/validations/assessor";

// Assessor writes go through the service client, which BYPASSES RLS - so the
// "observations/ratings RLS only permit the owning assessor" comment was inert
// on this path. Authorization is enforced here: the caller must be an admin or
// the OWNER of the target assignment (requireAssignmentOwner), and the assignment's
// engagement must not be finalised (assertEngagementUnlocked). Without these, any
// authenticated assessor could inject/overwrite/delete observations + BARS ratings
// on any assignment in any client's engagement.

/** Gate an assignment-scoped write: owner-or-admin + not-finalised. Returns the
 *  resolved engagement id on success, or an {error} to return to the caller. */
async function gateAssignmentWrite(
  assignmentId: string,
  sv: ReturnType<typeof createServiceClient>,
): Promise<{ error: string } | { engagementId: string }> {
  try {
    const { engagementId } = await requireAssignmentOwner(assignmentId);
    await assertEngagementUnlocked(engagementId, sv);
    return { engagementId };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

export async function saveObservationAction(values: SaveObservationValues) {
  const parsed = saveObservationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();
  const gate = await gateAssignmentWrite(parsed.data.assessorAssignmentId, supabase);
  if ("error" in gate) return gate;

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

  // Resolve the observation's assignment first, then gate on it (delete by id
  // alone would let any assessor remove another assessor's evidence).
  try {
    const { data: obs } = await supabase
      .from("observations")
      .select("assessor_assignment_id")
      .eq("id", observationId)
      .maybeSingle<{ assessor_assignment_id: string }>();
    if (!obs) throw new AuthorizationError("Observation not found.");
    const gate = await gateAssignmentWrite(obs.assessor_assignment_id, supabase);
    if ("error" in gate) return gate;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const { error } = await supabase.from("observations").delete().eq("id", observationId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function saveRatingAction(values: SaveRatingValues) {
  const parsed = saveRatingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();
  const gate = await gateAssignmentWrite(parsed.data.assessorAssignmentId, supabase);
  if ("error" in gate) return gate;

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
  const gate = await gateAssignmentWrite(assignmentId, supabase);
  if ("error" in gate) return gate;

  const { error } = await supabase
    .from("ratings")
    .delete()
    .eq("assessor_assignment_id", assignmentId)
    .eq("competency_id", competencyId);

  if (error) return { error: error.message };
  return { success: true };
}
