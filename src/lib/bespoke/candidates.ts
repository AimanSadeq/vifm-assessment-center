// Bespoke bundle candidates - token access + stage bookkeeping for the
// one-sitting delegate flow (mirrors role-readiness/candidate-access).
// Server-only (service role); the token is the sole credential. Stage
// completion derives from the NATIVE records: Persona = a submitted
// behavioral_assessment_session, Logica = a persisted psy_results id.

import { createServiceClient } from "@/lib/supabase/server";
import { COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { loadBespokeServices, type BespokeServiceRow } from "./services";

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

/** The services a bundle can run inside ONE sitting, in service_keys order. */
export const RUNNABLE_BUNDLE_STAGES = ["persona", "logica"] as const;
export type BundleStage = (typeof RUNNABLE_BUNDLE_STAGES)[number];

export type BundleCandidateRow = {
  id: string;
  bespoke_service_id: string;
  organization_id: string | null;
  full_name: string;
  email: string;
  access_token: string;
  status: string;
  consent_at: string | null;
  persona_session_id: string | null;
  cognitive_result_id: string | null;
  completed_at: string | null;
};

export type BundleCandidateContext = {
  candidate: BundleCandidateRow;
  bundle: BespokeServiceRow;
  /** Runnable stages for this bundle, in composed order. */
  stages: BundleStage[];
  /** Logica subtest scope from service_config; null = full battery. */
  logicaSubtests: string[] | null;
  /** Persona competency scope from service_config; null = full instrument. */
  personaCompetencyIds: string[] | null;
};

export async function findBundleCandidateByToken(token: string): Promise<BundleCandidateContext | null> {
  if (!TOKEN_RE.test(token)) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from("bundle_candidates")
    .select("id, bespoke_service_id, organization_id, full_name, email, access_token, status, consent_at, persona_session_id, cognitive_result_id, completed_at")
    .eq("access_token", token)
    .maybeSingle<BundleCandidateRow>();
  if (!data) return null;

  // The bundle must still be active (archived bundles stop accepting sittings).
  const bundle = (await loadBespokeServices()).find((s) => s.id === data.bespoke_service_id && s.kind === "bundle");
  if (!bundle) return null;

  const stages = bundle.service_keys.filter((k): k is BundleStage =>
    (RUNNABLE_BUNDLE_STAGES as readonly string[]).includes(k)
  );
  const cfg = bundle.service_config as { logica?: { subtests?: string[] }; persona?: { competencyIds?: string[] } };
  const scoped = COGNITIVE_SUBTEST_KEYS.filter((k) => cfg.logica?.subtests?.includes(k));
  const logicaSubtests = scoped.length > 0 && scoped.length < COGNITIVE_SUBTEST_KEYS.length ? scoped : null;

  const known = BEHAVIORAL_COMPETENCIES.map((c) => c.acCompetencyId);
  const scopedPersona = known.filter((id) => cfg.persona?.competencyIds?.includes(id));
  const personaCompetencyIds = scopedPersona.length > 0 && scopedPersona.length < known.length ? scopedPersona : null;

  return { candidate: data, bundle, stages, logicaSubtests, personaCompetencyIds };
}

/** Stage completion from the native records (survives reloads). */
export async function bundleStageState(ctx: BundleCandidateContext): Promise<{ personaDone: boolean; cognitiveDone: boolean }> {
  const svc = createServiceClient();
  let personaDone = false;
  if (ctx.candidate.persona_session_id) {
    const { data } = await svc
      .from("behavioral_assessment_sessions")
      .select("status")
      .eq("id", ctx.candidate.persona_session_id)
      .maybeSingle<{ status: string }>();
    personaDone = data?.status === "submitted";
  }
  return { personaDone, cognitiveDone: !!ctx.candidate.cognitive_result_id };
}

export async function setBundleConsent(candidateId: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("bundle_candidates")
    .update({ consent_at: new Date().toISOString(), status: "in_progress" })
    .eq("id", candidateId)
    .is("consent_at", null);
}

/** Store the (started) Persona session on the chain. */
export async function setBundlePersonaSession(candidateId: string, sessionId: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from("bundle_candidates").update({ persona_session_id: sessionId, status: "in_progress" }).eq("id", candidateId);
}

/** After a stage completes, roll the chain status (completed when every
 *  runnable stage has its record). */
export async function rollBundleStatus(
  ctx: BundleCandidateContext,
  just: { personaDone?: boolean; cognitiveResultId?: string },
): Promise<void> {
  const svc = createServiceClient();
  const state = await bundleStageState(ctx);
  const personaDone = just.personaDone ?? state.personaDone;
  const cognitiveDone = !!(just.cognitiveResultId ?? ctx.candidate.cognitive_result_id);

  const allDone = ctx.stages.every((s) => (s === "persona" ? personaDone : s === "logica" ? cognitiveDone : true));
  const patch: Record<string, unknown> = { status: allDone ? "completed" : "in_progress" };
  if (just.cognitiveResultId) patch.cognitive_result_id = just.cognitiveResultId;
  if (allDone) patch.completed_at = new Date().toISOString();
  await svc.from("bundle_candidates").update(patch).eq("id", ctx.candidate.id);
}
