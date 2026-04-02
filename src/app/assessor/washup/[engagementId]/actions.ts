"use server";

import { createServiceClient } from "@/lib/supabase/server";
import {
  saveConsensusRatingSchema,
  type SaveConsensusRatingValues,
  saveOarSchema,
  type SaveOarValues,
} from "@/lib/validations/washup";

export async function saveConsensusRatingAction(values: SaveConsensusRatingValues) {
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
  const parsed = saveOarSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createServiceClient();

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
