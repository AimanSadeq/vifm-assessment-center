// Bespoke bundle sitting - server logic for the chained one-sitting flow.
// Persona stage reuses the behavioural engine with the FULL instrument
// (a standard Persona sitting, org-tagged, so it surfaces in Persona
// results/reports). Logica stage reuses the psychometrics engine with the
// bundle's subtest scope; the keyed test is held in psy_sessions, graded
// server-side, single-use, and the result lands in psy_results org-tagged.

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import {
  createAnonymousBehavioralSession,
  saveBehavioralAnswers,
  submitAnonymousBehavioral,
  type BehavioralAnswer,
} from "@/lib/scoring/behavioral";
import { generatePsyTest, stripAnswerKey } from "@/lib/psychometrics/generate";
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
function personaItemsForBundle(ctx: BundleCandidateContext): {
  items: BundlePersonaItem[];
  meta: Map<string, { competencyId: string; reverse: boolean }>;
} {
  const scope = ctx.personaCompetencyIds ? new Set(ctx.personaCompetencyIds) : null;
  const items: BundlePersonaItem[] = [];
  const meta = new Map<string, { competencyId: string; reverse: boolean }>();
  for (const comp of BEHAVIORAL_COMPETENCIES) {
    if (scope && !scope.has(comp.acCompetencyId)) continue;
    for (const it of comp.items) {
      items.push({ itemKey: it.itemKey, competencyId: comp.acCompetencyId, textEn: it.textEn, textAr: it.textAr });
      meta.set(it.itemKey, { competencyId: comp.acCompetencyId, reverse: it.reverse });
    }
  }
  return { items, meta };
}

export async function startBundlePersona(ctx: BundleCandidateContext): Promise<{ sessionId: string; items: BundlePersonaItem[] }> {
  const { items } = personaItemsForBundle(ctx);
  if (ctx.candidate.persona_session_id) {
    return { sessionId: ctx.candidate.persona_session_id, items };
  }
  const session = await createAnonymousBehavioralSession(ctx.candidate.full_name, {
    takerEmail: ctx.candidate.email,
    organizationId: ctx.candidate.organization_id,
    projectLabel: `Bundle: ${ctx.bundle.name_en}`,
    // Pin the composed competency scope on the session (00123) so the standard
    // Persona report renders it as a scoped sitting.
    scopedCompetencyIds: ctx.personaCompetencyIds,
  });
  await setBundlePersonaSession(ctx.candidate.id, session.id);
  return { sessionId: session.id, items };
}

export async function submitBundlePersona(
  ctx: BundleCandidateContext,
  answers: Array<{ itemKey: string; rawScore: number }>,
): Promise<{ ok: boolean; error?: string }> {
  const { items, meta } = personaItemsForBundle(ctx);
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

export async function startBundleCognitive(
  ctx: BundleCandidateContext,
  lang: "en" | "ar",
): Promise<{ ok: true; sessionId: string; test: PsyTestPublic } | { ok: false; error: string }> {
  const svc = createServiceClient();
  const test = await generatePsyTest("cognitive", lang, ctx.logicaSubtests ?? undefined);
  const { data, error } = await svc
    .from("psy_sessions")
    .insert({ kind: "cognitive", test, taker_email: ctx.candidate.email })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not start the reasoning section." };
  return { ok: true, sessionId: data.id as string, test: stripAnswerKey(test, lang) };
}

export async function scoreBundleCognitive(
  ctx: BundleCandidateContext,
  sessionId: string,
  answers: Record<string, number>,
  lang: "en" | "ar",
): Promise<{ ok: boolean; error?: string }> {
  const svc = createServiceClient();
  const { data: session } = await svc.from("psy_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) return { ok: false, error: "Session not found." };
  if (session.expires_at && new Date(session.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "This session has expired. Reload the page to start again." };
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
      validity: finalResult.validity ?? null,
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
