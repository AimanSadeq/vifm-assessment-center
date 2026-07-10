"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizationError } from "@/lib/ara/auth-guards";
import {
  requireAssessorForEngagement,
  assertCandidateInEngagement,
  assertCompetencyInEngagement,
  assertEngagementUnlocked,
} from "@/lib/ac/assessor-guards";
import {
  saveConsensusRatingSchema,
  type SaveConsensusRatingValues,
  saveOarSchema,
  type SaveOarValues,
} from "@/lib/validations/washup";

// Wash-up writes go through the service client, which BYPASSES RLS - so the
// header comment that once claimed "RLS only permits the owning assessor" was
// inert on this path. Authorization is enforced here instead: the caller must be
// an admin or an assessor ASSIGNED to this engagement (requireAssessorForEngagement),
// the candidate must belong to the engagement (assertCandidateInEngagement), and
// the engagement must not be finalised (assertEngagementUnlocked). Without these,
// any authenticated assessor could clobber the consensus + final OAR (which feeds
// client reports + ac_ready_now credentials) of any candidate in any client's
// engagement.
async function gateWashupWrite(
  engagementId: string,
  candidateId: string,
  sv: ReturnType<typeof createServiceClient>,
  competencyId?: string,
): Promise<{ error: string } | null> {
  try {
    await requireAssessorForEngagement(engagementId);
    await assertCandidateInEngagement(candidateId, engagementId, sv);
    await assertEngagementUnlocked(engagementId, sv);
    // Consensus writes carry a competency; the OAR (no competencyId) skips this.
    if (competencyId) await assertCompetencyInEngagement(competencyId, engagementId, sv);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

export async function saveConsensusRatingAction(values: SaveConsensusRatingValues) {
  const parsed = saveConsensusRatingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();
  const gate = await gateWashupWrite(
    parsed.data.engagementId,
    parsed.data.candidateId,
    supabase,
    parsed.data.competencyId,
  );
  if (gate) return gate;

  // Upsert: one consensus rating per (engagement, candidate, competency)
  const { data, error } = await supabase
    .from("consensus_ratings")
    .upsert(
      {
        engagement_id: parsed.data.engagementId,
        candidate_id: parsed.data.candidateId,
        competency_id: parsed.data.competencyId,
        final_score: parsed.data.finalScore,
        discussion_notes: parsed.data.discussionNotes || null,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "engagement_id,candidate_id,competency_id" }
    )
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function saveOarAction(values: SaveOarValues) {
  const parsed = saveOarSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();
  const gate = await gateWashupWrite(parsed.data.engagementId, parsed.data.candidateId, supabase);
  if (gate) return gate;

  // Guard: the OAR is the synthesis of the per-competency consensus ratings, so
  // it is meaningless with none. Refuse to finalise the overall rating until at
  // least one consensus rating exists for this candidate - which also blocks the
  // degenerate "engagement with zero competencies -> zero consensus -> OAR
  // anyway" path the audit flagged.
  const { count: consensusCount } = await supabase
    .from("consensus_ratings")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", parsed.data.engagementId)
    .eq("candidate_id", parsed.data.candidateId);
  if (!consensusCount || consensusCount === 0) {
    return { error: "Record at least one competency consensus rating before saving the overall rating." };
  }

  // Upsert: one OAR per (engagement, candidate)
  const { data, error } = await supabase
    .from("overall_assessment_ratings")
    .upsert(
      {
        engagement_id: parsed.data.engagementId,
        candidate_id: parsed.data.candidateId,
        overall_score: parsed.data.overallScore,
        recommendation: parsed.data.recommendation,
        summary: parsed.data.summary || null,
      },
      { onConflict: "engagement_id,candidate_id" }
    )
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}
