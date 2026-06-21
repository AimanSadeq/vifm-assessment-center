"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import {
  saveConsensusRatingSchema,
  type SaveConsensusRatingValues,
  saveOarSchema,
  type SaveOarValues,
} from "@/lib/validations/washup";

// Wash-up writes go through the service client (consensus_ratings /
// overall_assessment_ratings RLS only permit the owning assessor); requireRole
// still gates the caller - synthetic admin in dev, real assessor/admin check
// under auth=on.
async function gateAssessor(): Promise<{ error: string } | null> {
  try {
    await requireRole(["lead_assessor", "associate_assessor", "admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

export async function saveConsensusRatingAction(values: SaveConsensusRatingValues) {
  const gate = await gateAssessor();
  if (gate) return gate;

  const parsed = saveConsensusRatingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();

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
  const gate = await gateAssessor();
  if (gate) return gate;

  const parsed = saveOarSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();

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
