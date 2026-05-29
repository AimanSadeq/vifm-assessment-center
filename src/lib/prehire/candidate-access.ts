// Token-based access for the Pre-Hire candidate flow. Identity is always
// derived server-side from prehire_candidates.access_token (the candidate has
// no account). All reads/writes use the service-role client - mirrors the ARA
// respondent model.

import { createServiceClient } from "@/lib/supabase/server";
import { computeComposite } from "./scoring";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

export type PrehireStageView = {
  kind: PrehireStageKind;
  status: string;
  normalized_score: number | null;
};

export type PrehireCandidateContext = {
  candidate: {
    id: string;
    full_name: string;
    email: string;
    status: string;
    consent_at: string | null;
  };
  requisition: {
    id: string;
    title: string;
    english_required: boolean;
    stage_config: PrehireStagePlanEntry[];
    clientName: string | null;
  };
  stages: PrehireStageView[];
};

export async function findCandidateByToken(
  token: string
): Promise<PrehireCandidateContext | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const svc = createServiceClient();

  const { data: cand } = await svc
    .from("prehire_candidates")
    .select(
      "id, full_name, email, status, consent_at, requisition_id, prehire_stage_results(kind, status, normalized_score)"
    )
    .eq("access_token", token)
    .maybeSingle();
  if (!cand) return null;

  const { data: req } = await svc
    .from("prehire_requisitions")
    .select("id, title, english_required, stage_config, organizations(name)")
    .eq("id", cand.requisition_id)
    .maybeSingle();
  if (!req) return null;

  return {
    candidate: {
      id: cand.id as string,
      full_name: cand.full_name as string,
      email: cand.email as string,
      status: cand.status as string,
      consent_at: cand.consent_at as string | null,
    },
    requisition: {
      id: req.id as string,
      title: req.title as string,
      english_required: !!req.english_required,
      stage_config: (req.stage_config ?? []) as PrehireStagePlanEntry[],
      clientName: (req.organizations as unknown as { name: string } | null)?.name ?? null,
    },
    stages: (cand.prehire_stage_results ?? []) as PrehireStageView[],
  };
}

/**
 * Recompute a candidate's composite from their current stage results and
 * persist it (+ recommendation + status). Called after any stage completes.
 */
export async function rescoreCandidate(candidateId: string): Promise<void> {
  const svc = createServiceClient();
  const { data: cand } = await svc
    .from("prehire_candidates")
    .select("id, requisition_id, prehire_stage_results(kind, normalized_score)")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return;

  const { data: req } = await svc
    .from("prehire_requisitions")
    .select("stage_config")
    .eq("id", cand.requisition_id)
    .maybeSingle();

  const plan = (req?.stage_config ?? []) as PrehireStagePlanEntry[];
  const results = (cand.prehire_stage_results ?? []) as {
    kind: PrehireStageKind;
    normalized_score: number | null;
  }[];
  const result = computeComposite(plan, results);

  const complete = result.recommendation !== "incomplete";
  await svc
    .from("prehire_candidates")
    .update({
      composite_score: result.composite,
      recommendation: result.recommendation,
      status: complete ? "scored" : "in_progress",
      completed_at: complete ? new Date().toISOString() : null,
    })
    .eq("id", candidateId);
}
