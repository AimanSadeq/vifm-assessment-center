"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server actions for the AI Conversational Assessor production path.
 *
 * persistCbiDraftAction  - save the transcript + AI draft as an audit row.
 * approveCbiToPipelineAction - THE HUMAN-REVIEW GATE. Takes the assessor's
 *   reviewed evidence + rating and writes them into the same observations
 *   + ratings tables the manual flow uses, then marks the session approved.
 * discardCbiSessionAction - mark a draft discarded.
 *
 * Uses the service client (bypasses RLS) - the same pattern other AI
 * write-paths use for their legitimate server-side writes.
 */

type TranscriptTurn = { role: "interviewer" | "candidate"; text: string };
type AiEvidence = { behavior: string; indicator_type: "positive" | "negative" | "neutral"; confidence: number };

export type PersistCbiDraftInput = {
  assessorAssignmentId: string | null;
  engagementId: string | null;
  candidateId: string | null;
  competencyId: string;
  language: "en" | "ar";
  transcript: TranscriptTurn[];
  aiRating: number | null;
  aiRationale: string;
  aiEvidence: AiEvidence[];
};

export async function persistCbiDraftAction(
  input: PersistCbiDraftInput
): Promise<{ id: string } | { error: string }> {
  if (!input.competencyId) return { error: "competencyId is required" };

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("cbi_sessions")
    .insert({
      assessor_assignment_id: input.assessorAssignmentId,
      engagement_id: input.engagementId,
      candidate_id: input.candidateId,
      competency_id: input.competencyId,
      language: input.language === "ar" ? "ar" : "en",
      transcript: input.transcript,
      ai_rating: input.aiRating,
      ai_rationale: input.aiRationale,
      ai_evidence: input.aiEvidence,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export type ApproveCbiInput = {
  sessionId: string;
  assessorAssignmentId: string;
  competencyId: string;
  reviewedRating: number;
  reviewerNotes: string;
  /** Only the evidence items the assessor chose to keep. */
  evidence: { behavior: string; is_positive: boolean | null }[];
  /** For revalidating the assessor's observation view. */
  engagementId?: string | null;
};

export async function approveCbiToPipelineAction(
  input: ApproveCbiInput
): Promise<{ observationsWritten: number; rating: number } | { error: string }> {
  // ── Gate validation ──
  if (!input.assessorAssignmentId) {
    return { error: "An assessor assignment is required to write to the pipeline." };
  }
  if (!input.competencyId) return { error: "competencyId is required" };
  const rating = Math.round(Number(input.reviewedRating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { error: "Reviewed rating must be between 1 and 5." };
  }

  const sb = createServiceClient();

  // 1. Write each kept evidence item as an observation (mirrors the
  //    manual saveObservationAction shape exactly).
  const rows = input.evidence
    .filter((e) => e.behavior && e.behavior.trim())
    .map((e) => ({
      assessor_assignment_id: input.assessorAssignmentId,
      competency_id: input.competencyId,
      behavior_observed: e.behavior.trim(),
      is_positive: e.is_positive,
    }));

  if (rows.length > 0) {
    const { error: obsErr } = await sb.from("observations").insert(rows);
    if (obsErr) return { error: `Observations: ${obsErr.message}` };
  }

  // 2. Upsert the reviewed rating (mirrors saveRatingAction).
  const { error: ratingErr } = await sb
    .from("ratings")
    .upsert(
      {
        assessor_assignment_id: input.assessorAssignmentId,
        competency_id: input.competencyId,
        score: rating,
        justification: input.reviewerNotes?.trim() || null,
      },
      { onConflict: "assessor_assignment_id,competency_id" }
    );
  if (ratingErr) return { error: `Rating: ${ratingErr.message}` };

  // 3. Mark the session approved (audit record of human sign-off).
  const { error: sessErr } = await sb
    .from("cbi_sessions")
    .update({
      status: "approved",
      reviewed_rating: rating,
      reviewer_notes: input.reviewerNotes?.trim() || null,
      approved_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId);
  if (sessErr) return { error: `Session: ${sessErr.message}` };

  // Refresh the assessor's observation page if it's open.
  if (input.engagementId) {
    revalidatePath(`/assessor/observation`, "page");
  }

  return { observationsWritten: rows.length, rating };
}

export async function discardCbiSessionAction(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  if (!sessionId) return { error: "sessionId is required" };
  const sb = createServiceClient();
  const { error } = await sb
    .from("cbi_sessions")
    .update({ status: "discarded" })
    .eq("id", sessionId);
  if (error) return { error: error.message };
  return { success: true };
}
