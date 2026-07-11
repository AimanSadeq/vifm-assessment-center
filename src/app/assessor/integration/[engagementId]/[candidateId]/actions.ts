"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizationError } from "@/lib/ara/auth-guards";
import {
  requireAssessorForEngagement,
  assertCandidateInEngagement,
  assertEngagementUnlocked,
} from "@/lib/ac/assessor-guards";
import {
  saveIntegrationSchema,
  type SaveIntegrationValues,
} from "@/lib/validations/assessor";

// Writes go through the service client, which BYPASSES RLS, so ownership is
// enforced here: the caller must be an admin or an assessor assigned to the
// engagement, the candidate must belong to it, and it must not be finalised.
// Authorship (assessor_id) is DERIVED FROM THE SESSION for a real assessor - the
// client-supplied assessorId is ignored - so an assessor can no longer spoof a
// colleague's authorship or delete a colleague's worksheet row.
export async function saveIntegrationAction(values: SaveIntegrationValues) {
  const parsed = saveIntegrationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();

  let assessorId: string;
  try {
    const caller = await requireAssessorForEngagement(parsed.data.engagementId);
    await assertCandidateInEngagement(parsed.data.candidateId, parsed.data.engagementId, supabase);
    await assertEngagementUnlocked(parsed.data.engagementId, supabase);
    // Real assessor -> force their own uid (closes the spoof). Admin keeps the
    // client value, which the page derives from the session, so admin oversight
    // still works. (The dev synthetic admin also lands here, but the integration
    // page requires a live session and 404s under AUTH_ENABLED=false, so the dev
    // UI never reaches this action.)
    assessorId = caller.role === "admin" ? parsed.data.assessorId : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  // Atomic upsert on the natural key (migration 00189 unique index). Replaces the
  // old delete-then-insert, whose failed-insert-after-successful-delete window
  // could destroy the assessor's saved rating. assessor_id is the DERIVED id, so
  // the upsert can only ever touch the caller's own row.
  const { data, error } = await supabase
    .from("integration_worksheets")
    .upsert(
      {
        engagement_id: parsed.data.engagementId,
        assessor_id: assessorId,
        candidate_id: parsed.data.candidateId,
        competency_id: parsed.data.competencyId,
        preliminary_rating: parsed.data.preliminaryRating,
        notes: parsed.data.notes || null,
      },
      { onConflict: "engagement_id,assessor_id,candidate_id,competency_id" }
    )
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}
