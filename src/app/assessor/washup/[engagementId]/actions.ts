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
import {
  canComputeOverallRating,
  computeOverallRating,
  integrationMethodFor,
} from "@/lib/scoring/overall-rating";

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

  // How this centre reaches its overall rating was fixed when it was designed.
  // A selection centre computes it (BPS 7.4); the figure the browser sends is
  // ignored, so the rule cannot be talked around in the room. A development
  // centre keeps the panel's number.
  const { data: eng } = await supabase
    .from("engagements")
    .select("purpose, integration_method, weights_confirmed_at")
    .eq("id", parsed.data.engagementId)
    .maybeSingle();
  const engagement = (eng ?? {}) as {
    purpose?: string | null;
    integration_method?: string | null;
    weights_confirmed_at?: string | null;
  };

  let overallScore = parsed.data.overallScore ?? null;
  let computedScore: number | null = null;
  let computation: unknown = null;
  const method = integrationMethodFor(engagement);

  if (method === "weighted_average") {
    const gateComputed = canComputeOverallRating(engagement);
    if (!gateComputed.allowed) return { error: gateComputed.reason ?? "Cannot compute the overall rating." };

    const [{ data: weights }, { data: agreed }] = await Promise.all([
      supabase
        .from("engagement_competencies")
        .select("competency_id, weight, competencies(name)")
        .eq("engagement_id", parsed.data.engagementId),
      supabase
        .from("consensus_ratings")
        .select("competency_id, final_score")
        .eq("engagement_id", parsed.data.engagementId)
        .eq("candidate_id", parsed.data.candidateId),
    ]);
    const scoreOf = new Map((agreed ?? []).map((r) => [r.competency_id as string, r.final_score as number]));
    const result = computeOverallRating(
      (weights ?? []).map((w) => {
        const comp = w.competencies as { name?: string } | { name?: string }[] | null;
        return {
          competencyId: w.competency_id as string,
          name: Array.isArray(comp) ? comp[0]?.name : comp?.name,
          weight: w.weight as number | null,
          score: scoreOf.get(w.competency_id as string) ?? null,
        };
      })
    );
    if (result.score == null || result.band == null) {
      return { error: result.problems[0] ?? "There is nothing to compute an overall rating from yet." };
    }
    computedScore = result.score;
    overallScore = result.band;
    computation = { method, computedAt: new Date().toISOString(), ...result };
  }

  if (overallScore == null) {
    return { error: "An overall rating is required." };
  }

  // Who chaired, and whether every assessor was heard (BPS 7.10, 7.11).
  //
  // The list of assessors is rebuilt HERE from the worksheets rather than
  // trusted from the browser: a client that quietly omitted an assessor would
  // otherwise produce a clean "everyone was heard" record with that assessor
  // missing from it, which is precisely the failure 7.11 is about.
  const { data: wsRows } = await supabase
    .from("integration_worksheets")
    .select("assessor_id, profiles:assessor_id(full_name, email)")
    .eq("engagement_id", parsed.data.engagementId)
    .eq("candidate_id", parsed.data.candidateId);
  const assessorIds = Array.from(new Set((wsRows ?? []).map((w) => w.assessor_id as string)));
  const nameById = new Map<string, string>();
  for (const w of wsRows ?? []) {
    const p = w.profiles as unknown as { full_name?: string | null; email?: string | null } | null;
    nameById.set(w.assessor_id as string, p?.full_name ?? p?.email ?? "Assessor");
  }

  if (assessorIds.length > 0) {
    if (!parsed.data.chairId) {
      return { error: "Name who chaired this discussion before the overall rating is set." };
    }
    const heardBy = new Map((parsed.data.evidenceHeard ?? []).map((e) => [e.assessorId, e.heard]));
    const notHeard = assessorIds.filter((id) => heardBy.get(id) !== true);
    if (notHeard.length > 0) {
      return {
        error:
          "Evidence has not been heard from every assessor: "
          + notHeard.map((id) => nameById.get(id) ?? "an assessor").join(", ")
          + ". The chair confirms each one before the rating is set.",
      };
    }
  }

  // Evidence from outside the centre (BPS 7.14, 7.17). Whether it may be used
  // at all was decided when the centre was designed, so the room cannot decide
  // it now.
  if (parsed.data.externalEvidenceUsed) {
    const { data: extRow } = await supabase
      .from("engagements")
      .select("external_evidence_rule")
      .eq("id", parsed.data.engagementId)
      .maybeSingle();
    const rule = (extRow as { external_evidence_rule?: string | null } | null)?.external_evidence_rule ?? null;
    if (rule !== "permitted") {
      return {
        error:
          rule === "not_permitted"
            ? "This centre's design does not permit evidence from outside the centre to count towards a rating."
            : "This centre has not decided whether evidence from outside the centre may be used. That is a design decision, not one for the wash-up.",
      };
    }
    if ((parsed.data.externalEvidenceNote ?? "").trim().length < 10) {
      return { error: "Record what external evidence was presented and why it is relevant." };
    }
  }

  const chairName = parsed.data.chairId
    ? await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", parsed.data.chairId)
        .maybeSingle()
        .then((r) => (r.data?.full_name as string | null) ?? (r.data?.email as string | null) ?? null)
    : null;
  const evidenceHeard = assessorIds.map((id) => ({
    assessor_id: id,
    name: nameById.get(id) ?? "Assessor",
    heard: true,
  }));

  // Upsert: one OAR per (engagement, candidate)
  const { data, error } = await supabase
    .from("overall_assessment_ratings")
    .upsert(
      {
        engagement_id: parsed.data.engagementId,
        candidate_id: parsed.data.candidateId,
        overall_score: overallScore,
        computed_score: computedScore,
        method,
        computation,
        panel_disagrees: parsed.data.panelDisagrees ?? false,
        panel_comment: parsed.data.panelComment || null,
        chair_id: parsed.data.chairId ?? null,
        chair_name: chairName,
        evidence_heard: evidenceHeard.length > 0 ? evidenceHeard : null,
        evidence_heard_at: evidenceHeard.length > 0 ? new Date().toISOString() : null,
        external_evidence_used: parsed.data.externalEvidenceUsed ?? false,
        external_evidence_note: (parsed.data.externalEvidenceNote ?? "").trim() || null,
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
