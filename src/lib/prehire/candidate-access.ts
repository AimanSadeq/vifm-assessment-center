// Token-based access for the Pre-Hire candidate flow. Identity is always
// derived server-side from prehire_candidates.access_token (the candidate has
// no account). All reads/writes use the service-role client - mirrors the ARA
// respondent model.

import { createServiceClient } from "@/lib/supabase/server";
import { computeComposite } from "./scoring";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

// Title of the self-serve DEMO requisition (created by startPrehireDemoAction).
// Only a candidate sitting under this requisition may pull their own results +
// report on-screen - real screenings keep the "results go to the hiring team,
// not the candidate" guardrail.
export const DEMO_REQ_TITLE = "Demo Screening (self-serve)";

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
    /** When the candidate completed (or explicitly skipped) voluntary self-ID; null = not yet asked. */
    demographics_submitted_at: string | null;
  };
  requisition: {
    id: string;
    title: string;
    english_required: boolean;
    stage_config: PrehireStagePlanEntry[];
    /** CAL-PRE-502: explicit quiz competency set (competencies.id[]). null = legacy
     *  fallback (resolve from the role profile, then the synthetic competency). */
    competency_ids: string[] | null;
    /** Drives the role-profile fallback path + the quiz target proficiency. */
    role_profile_id: string | null;
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
    .select("id, title, english_required, stage_config, role_profile_id, organizations(name)")
    .eq("id", cand.requisition_id)
    .maybeSingle();
  if (!req) return null;

  // Tolerant: competency_ids exists only after migration 00138. Query it on its
  // own so a pre-migration DB doesn't error the main select (mirrors the
  // demographics handling below). Missing column => null => legacy fallback.
  let competencyIds: string[] | null = null;
  const { data: compRow } = await svc
    .from("prehire_requisitions")
    .select("competency_ids")
    .eq("id", req.id)
    .maybeSingle();
  if (compRow && "competency_ids" in compRow) {
    const raw = (compRow as { competency_ids: unknown }).competency_ids;
    competencyIds = Array.isArray(raw) ? (raw as string[]).filter((x) => typeof x === "string") : null;
  }

  // Tolerant: the demographics column exists only after migration 00051. Query
  // it separately so a pre-migration DB doesn't break the whole apply flow
  // (a missing column would error the main select and make valid links look dead).
  let demographicsSubmittedAt: string | null = null;
  const { data: demo } = await svc
    .from("prehire_candidates")
    .select("demographics_submitted_at")
    .eq("id", cand.id)
    .maybeSingle();
  if (demo && "demographics_submitted_at" in demo) {
    demographicsSubmittedAt = (demo.demographics_submitted_at as string | null) ?? null;
  }

  return {
    candidate: {
      id: cand.id as string,
      full_name: cand.full_name as string,
      email: cand.email as string,
      status: cand.status as string,
      consent_at: cand.consent_at as string | null,
      demographics_submitted_at: demographicsSubmittedAt,
    },
    requisition: {
      id: req.id as string,
      title: req.title as string,
      english_required: !!req.english_required,
      stage_config: (req.stage_config ?? []) as PrehireStagePlanEntry[],
      competency_ids: competencyIds && competencyIds.length > 0 ? competencyIds : null,
      role_profile_id: (req.role_profile_id as string | null) ?? null,
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
