// Bespoke bundle sitting - server logic for the chained one-sitting flow.
// Persona stage reuses the behavioural engine with the FULL instrument
// (a standard Persona sitting, org-tagged, so it surfaces in Persona
// results/reports). Logica stage reuses the psychometrics engine with the
// bundle's subtest scope; the keyed test is held in psy_sessions, graded
// server-side, single-use, and the result lands in psy_results org-tagged.

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { ACTIVE_BEHAVIORAL_COMPETENCIES, translateCompetencyIds } from "@/lib/scoring/behavioral-framework";
import {
  createAnonymousBehavioralSession,
  loadServedItemKeys,
  saveBehavioralAnswers,
  submitAnonymousBehavioral,
  type BehavioralAnswer,
} from "@/lib/scoring/behavioral";
import { generatePsyTest, stripAnswerKey, BankUnavailableError } from "@/lib/psychometrics/generate";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";
import { computePsyResult, type PsyTest, type PsyTestPublic, type CognitiveItem } from "@/lib/psychometrics/scoring";
import { applyNorms, type ScaleNorm } from "@/lib/psychometrics/calibration";
import {
  type BundleCandidateContext,
  setBundlePersonaSession,
  rollBundleStatus,
} from "./candidates";

// ── Persona stage (full instrument) ─────────────────────────────

export type BundlePersonaItem = { itemKey: string; competencyId: string; textEn: string; textAr: string };

/** Persona items for this bundle - the full instrument, or the composed
 *  competency scope when the bundle pins one (service_config.persona). */
function personaItemsForBundle(
  ctx: BundleCandidateContext,
  served: Set<string> | null = null,
): {
  items: BundlePersonaItem[];
  meta: Map<string, { competencyId: string; reverse: boolean }>;
} {
  // An open sitting keeps exactly the statements it was served (00225), even
  // across a framework change; a new one serves the active framework.
  const scope = ctx.personaCompetencyIds ? new Set(translateCompetencyIds(ctx.personaCompetencyIds)) : null;
  const items: BundlePersonaItem[] = [];
  const meta = new Map<string, { competencyId: string; reverse: boolean }>();
  for (const comp of served ? BEHAVIORAL_COMPETENCIES : ACTIVE_BEHAVIORAL_COMPETENCIES) {
    if (served) {
      for (const it of comp.items) {
        if (!served.has(it.itemKey)) continue;
        items.push({ itemKey: it.itemKey, competencyId: comp.acCompetencyId, textEn: it.textEn, textAr: it.textAr });
        meta.set(it.itemKey, { competencyId: comp.acCompetencyId, reverse: it.reverse });
      }
      continue;
    }
    if (scope && !scope.has(comp.acCompetencyId)) continue;
    for (const it of comp.items) {
      items.push({ itemKey: it.itemKey, competencyId: comp.acCompetencyId, textEn: it.textEn, textAr: it.textAr });
      meta.set(it.itemKey, { competencyId: comp.acCompetencyId, reverse: it.reverse });
    }
  }
  return { items, meta };
}

export async function startBundlePersona(ctx: BundleCandidateContext): Promise<{ sessionId: string; items: BundlePersonaItem[] }> {
  if (ctx.candidate.persona_session_id) {
    const served = await loadServedItemKeys(ctx.candidate.persona_session_id);
    const { items } = personaItemsForBundle(ctx, served ? new Set(served) : null);
    return { sessionId: ctx.candidate.persona_session_id, items };
  }
  const { items } = personaItemsForBundle(ctx);
  const session = await createAnonymousBehavioralSession(ctx.candidate.full_name, {
    takerEmail: ctx.candidate.email,
    organizationId: ctx.candidate.organization_id,
    projectLabel: `Bundle: ${ctx.bundle.name_en}`,
    // Pin the composed competency scope on the session (00123) so the standard
    // Persona report renders it as a scoped sitting.
    scopedCompetencyIds: ctx.personaCompetencyIds ? translateCompetencyIds(ctx.personaCompetencyIds) : null,
    servedItemKeys: items.map((it) => it.itemKey),
  });
  await setBundlePersonaSession(ctx.candidate.id, session.id);
  return { sessionId: session.id, items };
}

export async function submitBundlePersona(
  ctx: BundleCandidateContext,
  answers: Array<{ itemKey: string; rawScore: number }>,
): Promise<{ ok: boolean; error?: string }> {
  const served = await loadServedItemKeys(ctx.candidate.persona_session_id);
  const { items, meta } = personaItemsForBundle(ctx, served ? new Set(served) : null);
  const byKey = new Map(answers.map((a) => [a.itemKey, a.rawScore]));
  for (const it of items) {
    const v = byKey.get(it.itemKey);
    if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 5) {
      return { ok: false, error: "Please answer every statement before submitting." };
    }
  }
  let sessionId = ctx.candidate.persona_session_id;
  if (!sessionId) {
    const started = await startBundlePersona(ctx);
    sessionId = started.sessionId;
  }
  const ba: BehavioralAnswer[] = answers
    .filter((a) => meta.has(a.itemKey))
    .map((a) => {
      const m = meta.get(a.itemKey)!;
      return { itemKey: a.itemKey, competencyId: m.competencyId, rawScore: a.rawScore, isReverse: m.reverse };
    });
  const saved = await saveBehavioralAnswers(sessionId, ba);
  if (!saved.ok) return { ok: false, error: saved.error ?? "Could not save answers." };
  const fin = await submitAnonymousBehavioral(sessionId);
  if (!fin.ok) return { ok: false, error: fin.error ?? "Could not score." };

  await rollBundleStatus(ctx, { personaDone: true });
  return { ok: true };
}

// ── Logica stage (scoped cognitive) ─────────────────────────────

/** Reasoning time limit for this bundle: its own setting, else the global Logica timer. */
export async function bundleLogicaMinutes(ctx: BundleCandidateContext): Promise<number | null> {
  return ctx.settings.logicaMinutes ?? (await getTimerMinutes("cognitive", TIMER_DEFAULTS.cognitive));
}

/** Seconds allowed after the deadline for the auto-submit to arrive. */
const SUBMIT_GRACE_SECONDS = 120;

type CogStart =
  | { ok: true; sessionId: string; test: PsyTestPublic; remainingSeconds: number | null }
  | { ok: false; error: string; status: number };

export async function startBundleCognitive(ctx: BundleCandidateContext, lang: "en" | "ar"): Promise<CogStart> {
  // One attempt only: a submitted section can never be started again.
  if (ctx.candidate.cognitive_result_id) {
    return { ok: false, error: "You have already submitted the reasoning section.", status: 409 };
  }
  const svc = createServiceClient();
  const minutes = await bundleLogicaMinutes(ctx);

  // Resume the open session (same items, same clock) instead of minting a new one.
  if (ctx.candidate.cognitive_session_id) {
    const resumed = await resumeCognitive(ctx.candidate.cognitive_session_id, minutes);
    if (resumed) return resumed;
  }

  let test: PsyTest;
  try {
    // A candidate-bound sitting is always served from the reviewed bank.
    test = await generatePsyTest("cognitive", lang, ctx.logicaSubtests ?? undefined, { requireBank: true });
  } catch (e) {
    if (e instanceof BankUnavailableError) {
      return { ok: false, error: "The reasoning section is not available right now. Please try again in a few minutes.", status: 503 };
    }
    return { ok: false, error: "Could not start the reasoning section.", status: 500 };
  }
  const { data, error } = await svc
    .from("psy_sessions")
    .insert({ kind: "cognitive", test, taker_email: ctx.candidate.email })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not start the reasoning section.", status: 500 };

  // Bind the session to the candidate, only if none is bound (two tabs racing).
  const { data: bound, error: bindErr } = await svc
    .from("bundle_candidates")
    .update({ cognitive_session_id: data.id, status: "in_progress" })
    .eq("id", ctx.candidate.id)
    .is("cognitive_session_id", null)
    .select("cognitive_session_id");
  if (!bindErr && (!bound || bound.length === 0)) {
    // The other tab won: discard ours and resume theirs.
    await svc.from("psy_sessions").delete().eq("id", data.id);
    const { data: row } = await svc.from("bundle_candidates").select("cognitive_session_id").eq("id", ctx.candidate.id).maybeSingle<{ cognitive_session_id: string | null }>();
    const resumed = row?.cognitive_session_id ? await resumeCognitive(row.cognitive_session_id, minutes) : null;
    return resumed ?? { ok: false, error: "Could not start the reasoning section.", status: 500 };
  }
  return { ok: true, sessionId: data.id as string, test: stripAnswerKey(test), remainingSeconds: minutes ? minutes * 60 : null };
}

async function resumeCognitive(sessionId: string, minutes: number | null): Promise<CogStart | null> {
  const svc = createServiceClient();
  const { data: s } = await svc
    .from("psy_sessions")
    .select("id, test, consumed, created_at")
    .eq("id", sessionId)
    .maybeSingle<{ id: string; test: PsyTest; consumed: boolean; created_at: string }>();
  if (!s) return null;
  if (s.consumed) {
    return { ok: false, error: "Your reasoning section was submitted but not recorded. Please contact VIFM support.", status: 409 };
  }
  if (minutes) {
    const left = Math.floor((new Date(s.created_at).getTime() + minutes * 60_000 - Date.now()) / 1000);
    if (left + SUBMIT_GRACE_SECONDS < 0) {
      return { ok: false, error: "The time for the reasoning section has ended without a submission. Please contact VIFM support.", status: 409 };
    }
    return { ok: true, sessionId: s.id, test: stripAnswerKey(s.test), remainingSeconds: Math.max(0, left) };
  }
  return { ok: true, sessionId: s.id, test: stripAnswerKey(s.test), remainingSeconds: null };
}

export async function scoreBundleCognitive(
  ctx: BundleCandidateContext,
  sessionId: string,
  answers: Record<string, number>,
  lang: "en" | "ar",
): Promise<{ ok: boolean; error?: string }> {
  const svc = createServiceClient();
  if (ctx.candidate.cognitive_result_id) return { ok: false, error: "This section has already been submitted." };
  // The session must be this candidate's own.
  if (ctx.candidate.cognitive_session_id && ctx.candidate.cognitive_session_id !== sessionId) {
    return { ok: false, error: "Session not found." };
  }
  const { data: session } = await svc.from("psy_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session || (session.taker_email && session.taker_email !== ctx.candidate.email)) return { ok: false, error: "Session not found." };
  if (session.expires_at && new Date(session.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "This session has expired. Please contact VIFM support." };
  }
  // Server-side time limit (the on-screen countdown auto-submits at zero).
  const minutes = await bundleLogicaMinutes(ctx);
  if (minutes && Date.now() > new Date(session.created_at as string).getTime() + (minutes * 60 + SUBMIT_GRACE_SECONDS) * 1000) {
    return { ok: false, error: "The time for this section has ended. Please contact VIFM support." };
  }
  // Atomic single-use claim before scoring (no replay / double submit).
  const { data: claimed } = await svc
    .from("psy_sessions")
    .update({ consumed: true })
    .eq("id", sessionId)
    .eq("consumed", false)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, error: "This section has already been submitted." };

  const test = session.test as PsyTest;
  const result = computePsyResult(test, answers ?? {}, lang);

  // Tier 2 norms when available (tolerant - stays indicative otherwise).
  let finalResult = result;
  try {
    const { data: norms } = await svc.from("psy_norms").select("scale_key, n, mean, sd").eq("kind", test.kind);
    if (norms && norms.length) {
      const map: Record<string, ScaleNorm> = {};
      for (const nm of norms as Array<{ scale_key: string; n: number; mean: number; sd: number }>) {
        map[nm.scale_key] = { mean: Number(nm.mean), sd: Number(nm.sd), n: Number(nm.n) };
      }
      finalResult = applyNorms(result, map);
    }
  } catch { /* psy_norms not migrated */ }

  const { data: resRow, error: insErr } = await svc
    .from("psy_results")
    .insert({
      instrument_id: null,
      kind: test.kind,
      candidate_id: null,
      engagement_id: null,
      taker_name: ctx.candidate.full_name,
      taker_email: ctx.candidate.email,
      organization_id: ctx.candidate.organization_id,
      scales: finalResult.scales,
      overall: finalResult.overall ?? null,
      validity: null,
      result: finalResult,
    })
    .select("id")
    .single();
  if (insErr || !resRow) return { ok: false, error: "Could not record the result." };

  // Per-item response log (best-effort). Shuffled cognitive items carry an
  // `orig` permutation map; remap the chosen index into the AUTHORED frame so
  // the log stays coherent with the bank row across shuffled sittings.
  try {
    const rows = test.items.map((it) => {
      const raw = typeof answers[it.id] === "number" ? answers[it.id] : null;
      const orig = (it as CognitiveItem).orig;
      const response =
        raw !== null && Array.isArray(orig) && typeof orig[raw] === "number" ? orig[raw] : raw;
      return {
        result_id: resRow.id,
        item_ref: it.id,
        scale_key: it.scale,
        response,
        correct: test.kind === "cognitive" ? answers[it.id] === (it as CognitiveItem).correct : null,
      };
    });
    await svc.from("psy_item_responses").insert(rows);
  } catch { /* best-effort */ }

  await rollBundleStatus(ctx, { cognitiveResultId: resRow.id as string });
  return { ok: true };
}
