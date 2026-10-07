// Bespoke bundle candidates - token access + stage bookkeeping for the
// one-sitting delegate flow (mirrors role-readiness/candidate-access).
// Server-only (service role); the token is the sole credential. Stage
// completion derives from the NATIVE records: Persona = a submitted
// behavioral_assessment_session, Logica = a persisted psy_results id.

import { createServiceClient } from "@/lib/supabase/server";
import { COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import { ACTIVE_BEHAVIORAL_COMPETENCIES, translateCompetencyIds } from "@/lib/scoring/behavioral-framework";
import { loadBespokeServices, type BespokeServiceRow } from "./services";
import { loadBundleSettings, type BundleSettings } from "./bundle-settings";
import { rosterEntryForCandidate, type RosterRow } from "./roster";
import { loadSjtResult } from "./sjt";

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

/** The services a bundle can run inside ONE sitting, in service_keys order. */
export const RUNNABLE_BUNDLE_STAGES = ["persona", "logica"] as const;
/** Every stage a sitting can contain: the scenario stage (00234) is switched on
 *  per bundle in bundle_settings, not composed into service_keys. */
export const ALL_BUNDLE_STAGES = ["sjt", ...RUNNABLE_BUNDLE_STAGES] as const;
export type BundleStage = (typeof ALL_BUNDLE_STAGES)[number];

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
  demographics: Record<string, string> | null;
  cognitive_session_id: string | null;
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
  /** Delivery settings (00233); defaults when the bundle has none. */
  settings: BundleSettings;
  /** The candidate's approved-list entry on a roster bundle. */
  rosterEntry: RosterRow | null;
  /** Bundle is on hold and this candidate is not a pilot tester: no stage may run. */
  held: boolean;
};

export async function findBundleCandidateByToken(token: string): Promise<BundleCandidateContext | null> {
  if (!TOKEN_RE.test(token)) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from("bundle_candidates")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<BundleCandidateRow>();
  if (!data) return null;
  // Tolerate 00233 not applied yet (the columns are then absent).
  data.demographics = data.demographics ?? null;
  data.cognitive_session_id = data.cognitive_session_id ?? null;

  // The bundle must still be active (archived bundles stop accepting sittings).
  const bundle = (await loadBespokeServices()).find((s) => s.id === data.bespoke_service_id && s.kind === "bundle");
  if (!bundle) return null;

  const composed = bundle.service_keys.filter((k): k is BundleStage =>
    (RUNNABLE_BUNDLE_STAGES as readonly string[]).includes(k)
  );
  const cfg = bundle.service_config as { logica?: { subtests?: string[] }; persona?: { competencyIds?: string[] } };
  const scoped = COGNITIVE_SUBTEST_KEYS.filter((k) => cfg.logica?.subtests?.includes(k));
  const logicaSubtests = scoped.length > 0 && scoped.length < COGNITIVE_SUBTEST_KEYS.length ? scoped : null;

  // Active framework (00225); a bundle scope stored before a framework change
  // is translated onto the competencies that absorbed it.
  const known = ACTIVE_BEHAVIORAL_COMPETENCIES.map((c) => c.acCompetencyId);
  const wanted = new Set(translateCompetencyIds(cfg.persona?.competencyIds ?? []));
  const scopedPersona = known.filter((id) => wanted.has(id));
  const personaCompetencyIds = scopedPersona.length > 0 && scopedPersona.length < known.length ? scopedPersona : null;

  const [settings, rosterEntry] = await Promise.all([loadBundleSettings(bundle.id), rosterEntryForCandidate(data.id)]);
  const held = settings.held && !rosterEntry?.is_tester;
  // Scenario questions are Part 1, before the composed instruments.
  const stages: BundleStage[] = settings.sjtEnabled ? ["sjt", ...composed] : composed;

  return { candidate: data, bundle, stages, logicaSubtests, personaCompetencyIds, settings, rosterEntry, held };
}

/** Stage completion from the native records (survives reloads). */
export async function bundleStageState(ctx: BundleCandidateContext): Promise<{ personaDone: boolean; cognitiveDone: boolean; sjtDone: boolean }> {
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
  const sjtDone = ctx.stages.includes("sjt") ? !!(await loadSjtResult(ctx.candidate.id))?.submitted_at : false;
  return { personaDone, cognitiveDone: !!ctx.candidate.cognitive_result_id, sjtDone };
}

/** API guard: the bundle is on hold for this candidate. */
export const HELD_MESSAGE = "This assessment is not open yet. Your organisation will let you know when it opens.";

/** Validate demographic answers against the bundle's field definitions. */
export function validateDemographics(
  fields: BundleSettings["demographicFields"],
  raw: unknown,
): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = String(src[f.key] ?? "").trim().slice(0, 200);
    if (!v) {
      if (f.required) return { ok: false, error: `Please answer: ${f.label}` };
      continue;
    }
    if (f.type === "select" && !(f.options ?? []).includes(v)) return { ok: false, error: `Please choose an option for: ${f.label}` };
    values[f.key] = v;
  }
  return { ok: true, values };
}

export async function setBundleConsent(candidateId: string, demographics?: Record<string, string> | null): Promise<void> {
  const svc = createServiceClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { consent_at: now, status: "in_progress" };
  if (demographics && Object.keys(demographics).length > 0) {
    patch.demographics = demographics;
    patch.demographics_at = now;
  }
  await svc.from("bundle_candidates").update(patch).eq("id", candidateId).is("consent_at", null);
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
  just: { personaDone?: boolean; cognitiveResultId?: string; sjtDone?: boolean },
): Promise<void> {
  const svc = createServiceClient();
  const state = await bundleStageState(ctx);
  const personaDone = just.personaDone ?? state.personaDone;
  const cognitiveDone = !!(just.cognitiveResultId ?? ctx.candidate.cognitive_result_id);

  const sjtDone = just.sjtDone ?? state.sjtDone;
  const allDone = ctx.stages.every((s) => (s === "persona" ? personaDone : s === "logica" ? cognitiveDone : s === "sjt" ? sjtDone : true));
  const patch: Record<string, unknown> = { status: allDone ? "completed" : "in_progress" };
  if (just.cognitiveResultId) patch.cognitive_result_id = just.cognitiveResultId;
  if (allDone) patch.completed_at = new Date().toISOString();
  await svc.from("bundle_candidates").update(patch).eq("id", ctx.candidate.id);
}
