// Role Readiness combined sitting - server logic shared by the candidate API
// routes. Persona section reuses the behavioural engine (scoped anonymous
// session); technical section grades role-authored MCQs server-side. On each
// section completion the verdict is (re)finalized: READY iff both sides pass.

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import {
  createAnonymousBehavioralSession,
  saveBehavioralAnswers,
  submitAnonymousBehavioral,
  type BehavioralAnswer,
} from "@/lib/scoring/behavioral";
import { loadRoleConfig, type RoleReadinessConfig } from "./config";
import {
  scorePersonaSide,
  scoreTechnicalSide,
  type PersonaCompetencyInput,
  type TechnicalAreaInput,
  type Verdict,
} from "./scoring";

// ── Persona items scoped to the role's competencies ──
export type PersonaItemPublic = {
  itemKey: string;
  competencyId: string;
  textEn: string;
  textAr: string;
};

type PersonaItemMeta = { competencyId: string; reverse: boolean };

/** Served items for the role (answer-irrelevant fields only) + a server-side
 *  key→{competencyId,reverse} map (reverse is never trusted from the client). */
export function personaItemsForConfig(config: RoleReadinessConfig): {
  items: PersonaItemPublic[];
  meta: Map<string, PersonaItemMeta>;
} {
  const ids = new Set(config.competencies.map((c) => c.competency_id));
  const items: PersonaItemPublic[] = [];
  const meta = new Map<string, PersonaItemMeta>();
  for (const comp of BEHAVIORAL_COMPETENCIES) {
    if (!ids.has(comp.acCompetencyId)) continue;
    for (const it of comp.items) {
      items.push({ itemKey: it.itemKey, competencyId: comp.acCompetencyId, textEn: it.textEn, textAr: it.textAr });
      meta.set(it.itemKey, { competencyId: comp.acCompetencyId, reverse: it.reverse });
    }
  }
  return { items, meta };
}

/** Create (once) the scoped anonymous Persona session for this candidate and
 *  store it on rr_candidates. Returns the session id + the items to render. */
export async function startPersonaSection(candidate: {
  id: string;
  full_name: string;
  email: string;
  organization_id: string | null;
  persona_session_id: string | null;
}, config: RoleReadinessConfig): Promise<{ sessionId: string; items: PersonaItemPublic[] }> {
  const svc = createServiceClient();
  const { items } = personaItemsForConfig(config);

  if (candidate.persona_session_id) {
    return { sessionId: candidate.persona_session_id, items };
  }
  const session = await createAnonymousBehavioralSession(candidate.full_name, {
    takerEmail: candidate.email,
    organizationId: candidate.organization_id,
    scopedCompetencyIds: config.competencies.map((c) => c.competency_id),
    projectLabel: `Role Readiness: ${config.name_en}`,
  });
  await svc.from("rr_candidates").update({ persona_session_id: session.id, status: "in_progress" }).eq("id", candidate.id);
  return { sessionId: session.id, items };
}

/** Save + finalize the Persona section. Requires EVERY served item answered
 *  (no partial false verdict). Writes rr_section_results(persona) then refinalizes. */
export async function submitPersonaSection(
  candidateId: string,
  sessionId: string,
  config: RoleReadinessConfig,
  answers: Array<{ itemKey: string; rawScore: number }>,
): Promise<{ ok: boolean; error?: string }> {
  const { items, meta } = personaItemsForConfig(config);
  const byKey = new Map(answers.map((a) => [a.itemKey, a.rawScore]));
  // Completeness: every served item must be answered 1-5.
  for (const it of items) {
    const v = byKey.get(it.itemKey);
    if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 5) {
      return { ok: false, error: "Please answer every question before submitting." };
    }
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
  if (!fin.ok || !fin.profile) return { ok: false, error: fin.error ?? "Could not score." };

  const selfById = new Map(fin.profile.map((p) => [p.competencyId, p.selfScore]));
  const compInputs: PersonaCompetencyInput[] = config.competencies.map((c) => ({
    competency_id: c.competency_id,
    name: c.name,
    target_level: c.target_level,
    self_score: selfById.get(c.competency_id) ?? null,
  }));
  const { side, results } = scorePersonaSide(compInputs, config.persona_pass_pct);

  await writeSection(candidateId, "persona", side.score_pct, side.passed, results);
  await finalizeVerdict(candidateId, config);
  return { ok: true };
}

/** Technical items for the role, answer key STRIPPED, grouped by area. */
export function technicalForCandidate(config: RoleReadinessConfig) {
  return config.technicalAreas.map((a) => ({
    id: a.id,
    name_en: a.name_en,
    name_ar: a.name_ar,
    items: a.items.map((it) => ({
      id: it.id,
      stem_en: it.stem_en,
      stem_ar: it.stem_ar,
      options_en: it.options_en,
      options_ar: it.options_ar,
    })),
  }));
}

/** Grade the technical section server-side (answer key from config), write
 *  rr_section_results(technical), then refinalize. Unanswered item = incorrect. */
export async function submitTechnicalSection(
  candidateId: string,
  config: RoleReadinessConfig,
  answers: Record<string, number>, // itemId -> chosen option index
): Promise<{ ok: boolean; error?: string }> {
  const areaInputs: TechnicalAreaInput[] = config.technicalAreas.map((a) => {
    const total = a.items.length; // items SERVED; unanswered counts as wrong
    let correct = 0;
    for (const it of a.items) {
      if (answers[it.id] === it.correct_index) correct += 1;
    }
    return { area_id: a.id, name: a.name_en, target_pct: a.target_pct, correct, total };
  });
  const { side, results } = scoreTechnicalSide(areaInputs, config.technical_pass_pct);
  await writeSection(candidateId, "technical", side.score_pct, side.passed, results);
  await finalizeVerdict(candidateId, config);
  return { ok: true };
}

async function writeSection(
  candidateId: string,
  section: "persona" | "technical",
  scorePct: number | null,
  passed: boolean | null,
  breakdown: unknown,
): Promise<void> {
  const svc = createServiceClient();
  await svc.from("rr_section_results").upsert(
    {
      candidate_id: candidateId,
      section,
      score_pct: scorePct,
      passed,
      breakdown: breakdown as object,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "candidate_id,section" },
  );
}

/** Verdict = ready iff both sections present AND both passed; not_ready if both
 *  present and one failed; incomplete otherwise. */
export async function finalizeVerdict(candidateId: string, config: RoleReadinessConfig): Promise<Verdict> {
  const svc = createServiceClient();
  const { data: rows } = await svc
    .from("rr_section_results")
    .select("section, passed")
    .eq("candidate_id", candidateId);
  const bySection = new Map(((rows ?? []) as Array<{ section: string; passed: boolean | null }>).map((r) => [r.section, r.passed]));
  const personaPassed = bySection.has("persona") ? bySection.get("persona") : undefined;
  const techPassed = bySection.has("technical") ? bySection.get("technical") : undefined;

  let verdict: Verdict;
  if (personaPassed == null || techPassed == null) {
    verdict = "incomplete";
  } else if (personaPassed && techPassed) {
    verdict = "ready";
  } else {
    verdict = "not_ready";
  }
  const complete = verdict !== "incomplete";
  void config;
  await svc
    .from("rr_candidates")
    .update({
      verdict,
      status: complete ? "completed" : "in_progress",
      completed_at: complete ? new Date().toISOString() : null,
    })
    .eq("id", candidateId);
  return verdict;
}
