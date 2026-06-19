/**
 * Adaptive (CAT) technical assessment - turn-based flow.
 *
 * POST { action: "start", functionKey, language, … }
 *   -> { session_id, item, progress }      (one item; answer key held server-side)
 * POST { action: "answer", sessionId, answer }
 *   -> { done: false, item, progress }     (next most-informative item)
 *    | { done: true, result }              (stopped: SE target | min/max items)
 *
 * Maximum-information selection over a calibrated APPROVED pool (irt_b set):
 * serve the item whose Rasch difficulty is most informative at the running
 * ability estimate, re-estimate θ after each answer, and stop once the standard
 * error drops to the target - a shorter, ability-matched sitting than the fixed
 * form. INDICATIVE (no credential): the certified credential stays on the
 * coverage-guaranteed fixed-form path. Integrity mirrors the fixed flow - the
 * key never leaves the server; the session is consumed only when the run ends.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getTechnicalFunctionByRef } from "@/lib/competencies/technical-function";
import { buildAdaptivePool, type AdaptivePoolItem } from "@/lib/competencies/technical-function-bank";
import { recordItemAdministration } from "@/lib/competencies/technical-item-bank";
import { selectNextItem, estimateThetaRasch, thetaStandardError } from "@/lib/scoring/irt";
import { thetaToProficiency, thetaToNormalized } from "@/lib/scoring/tech-cat";
import { TECH_LEVELS } from "@/lib/competencies/technical-framework";
import type { TechResult } from "@/lib/ai/technical-assessment";

export const dynamic = "force-dynamic";

const MIN_ITEMS = 6;
const MAX_ITEMS = 20;
const TARGET_SE = 0.45;
const SESSION_TTL_MS = 1000 * 60 * 60 * 3;

type Administered = { id: string; b: number; correct: boolean; skill: string };
type AdaptiveState = {
  mode: "adaptive";
  functionKey: string;
  functionName: string;
  function_id: string | null;
  language: "en" | "ar";
  pool: AdaptivePoolItem[];
  administered: Administered[];
  currentItemId: string | null;
  minItems: number;
  maxItems: number;
  targetSe: number;
  candidate_id: string | null;
  engagement_id: string | null;
  program_id: string | null;
  participant_id: string | null;
  taker_name: string | null;
  taker_email: string | null;
};

type PublicItem = {
  id: string;
  skill: string;
  type: "single";
  question: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
};

type Body = {
  action?: "start" | "answer";
  functionKey?: string;
  language?: "en" | "ar";
  sessionId?: string;
  answer?: number;
  candidateId?: string | null;
  engagementId?: string | null;
  programId?: string | null;
  participantId?: string | null;
  takerName?: string | null;
  takerEmail?: string | null;
};

const calItems = (pool: AdaptivePoolItem[]) => pool.map((p) => ({ id: p.id, irt_b: p.b }));

function strip(item: AdaptivePoolItem, language: "en" | "ar"): PublicItem {
  const useAr = language === "ar" && !!item.question_ar && Array.isArray(item.options_ar) && item.options_ar.length === 4;
  return {
    id: item.id,
    skill: item.skill,
    type: "single",
    question: useAr ? (item.question_ar as string) : item.question_en,
    options: useAr ? (item.options_ar as string[]) : item.options_en,
    difficulty: item.difficulty,
  };
}

async function createSession(state: AdaptiveState): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("tech_assessment_sessions")
      .insert({
        domain_key: null,
        function_key: state.functionKey,
        function_id: state.function_id,
        ui_language: state.language,
        test: state,
        candidate_id: state.candidate_id,
        engagement_id: state.engagement_id,
        program_id: state.program_id,
        participant_id: state.participant_id,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

/** Load the adaptive state WITHOUT consuming the session (mutated each turn). */
async function loadState(id: string): Promise<AdaptiveState | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_sessions")
      .select("test, expires_at, consumed_at")
      .eq("id", id)
      .single();
    if (!data || !data.test) return null;
    if (data.consumed_at) return null;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
    const test = data.test as AdaptiveState;
    return test.mode === "adaptive" ? test : null;
  } catch {
    return null;
  }
}

async function saveState(id: string, state: AdaptiveState): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from("tech_assessment_sessions").update({ test: state }).eq("id", id);
  } catch {
    /* best-effort */
  }
}

async function consume(id: string): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from("tech_assessment_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", id);
  } catch {
    /* ignore */
  }
}

function buildResult(state: AdaptiveState, theta: number, se: number): TechResult {
  const correct = state.administered.filter((a) => a.correct).length;
  const total = state.administered.length;
  const pct = total > 0 ? Math.round((100 * correct) / total) : 0;

  const bySkill = new Map<string, { correct: number; total: number }>();
  for (const a of state.administered) {
    const e = bySkill.get(a.skill) ?? { correct: 0, total: 0 };
    e.total += 1;
    if (a.correct) e.correct += 1;
    bySkill.set(a.skill, e);
  }

  const ability = thetaToProficiency(theta, se);
  const pctLow = thetaToNormalized(theta - 1.96 * se);
  const pctHigh = thetaToNormalized(theta + 1.96 * se);
  return {
    domain_key: state.functionKey,
    domain_name: state.functionName,
    correct,
    total,
    pct,
    proficiency: { level: ability.level, label: ability.label, normalized: ability.normalized },
    band: {
      levelLow: ability.lowLevel,
      levelHigh: ability.highLevel,
      labelLow: TECH_LEVELS[ability.lowLevel - 1],
      labelHigh: TECH_LEVELS[ability.highLevel - 1],
      pctLow,
      pctHigh,
      halfWidthPct: Math.round((pctHigh - pctLow) / 2),
      underpowered: total < 10,
    },
    perSkill: Array.from(bySkill.entries()).map(([skill, v]) => ({ skill, correct: v.correct, total: v.total })),
    ai_generated: false,
    certified: false,
  };
}

async function persistResult(state: AdaptiveState, result: TechResult): Promise<void> {
  try {
    const sb = createServiceClient();
    const row = {
      taker_name: state.taker_name,
      taker_email: state.taker_email,
      domain_key: null,
      function_key: state.functionKey,
      function_id: state.function_id,
      ui_language: state.language,
      score_correct: result.correct,
      score_total: result.total,
      score_pct: result.pct,
      level: result.proficiency.level,
      level_label: result.proficiency.label,
      result,
      ai_generated: false,
      certified: false,
      candidate_id: state.candidate_id,
      engagement_id: state.engagement_id,
      program_id: state.program_id,
      participant_id: state.participant_id,
    };
    const full = await sb.from("tech_assessment_results").insert(row);
    if (full.error) {
      // Older schema without function/program columns - drop them and retry.
      const { function_key, function_id, program_id, participant_id, ...legacy } = row;
      void function_key; void function_id; void program_id; void participant_id;
      await sb.from("tech_assessment_results").insert(legacy);
    }
  } catch {
    /* result table absent - still return the result to the client */
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const language: "en" | "ar" = body.language === "ar" ? "ar" : "en";

  // ── start ──
  if (body.action === "start") {
    const functionRef = body.functionKey?.trim() || null;
    if (!functionRef) return NextResponse.json({ error: "functionKey required" }, { status: 400 });
    const fn = await getTechnicalFunctionByRef(functionRef, language);
    if (!fn) return NextResponse.json({ error: "valid functionKey required" }, { status: 400 });

    const pool = await buildAdaptivePool({ skillsEn: fn.skillsEn, functionId: fn.id });
    if (!pool) return NextResponse.json({ error: "not_adaptive_ready" }, { status: 409 });

    const maxItems = Math.min(MAX_ITEMS, pool.length);
    const first = selectNextItem(0, new Set(), calItems(pool));
    if (!first) return NextResponse.json({ error: "empty pool" }, { status: 409 });

    const state: AdaptiveState = {
      mode: "adaptive",
      functionKey: fn.ref,
      functionName: fn.name,
      function_id: fn.id,
      language,
      pool,
      administered: [],
      currentItemId: first.id,
      minItems: Math.min(MIN_ITEMS, pool.length),
      maxItems,
      targetSe: TARGET_SE,
      candidate_id: body.candidateId?.trim() || null,
      engagement_id: body.engagementId?.trim() || null,
      program_id: body.programId?.trim() || null,
      participant_id: body.participantId?.trim() || null,
      taker_name: body.takerName?.trim() || null,
      taker_email: body.takerEmail?.trim() || null,
    };
    const session_id = await createSession(state);
    if (!session_id) return NextResponse.json({ error: "session_unavailable" }, { status: 503 });

    const firstItem = pool.find((p) => p.id === first.id)!;
    return NextResponse.json({
      session_id,
      item: strip(firstItem, language),
      progress: { answered: 0, max: maxItems, se: null, theta: 0 },
    });
  }

  // ── answer ──
  if (body.action === "answer") {
    if (!body.sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    const state = await loadState(body.sessionId);
    if (!state) return NextResponse.json({ error: "invalid or expired session" }, { status: 400 });

    const cur = state.pool.find((p) => p.id === state.currentItemId);
    if (!cur) return NextResponse.json({ error: "no current item" }, { status: 400 });

    // Grade the current item server-side and append to the response log.
    const correct = typeof body.answer === "number" && body.answer === cur.correct_index;
    state.administered.push({ id: cur.id, b: cur.b, correct, skill: cur.skill });

    const responses = state.administered.map((a) => ({ b: a.b, correct: a.correct }));
    const theta = estimateThetaRasch(responses);
    const se = thetaStandardError(theta, state.administered.map((a) => a.b));
    const answered = state.administered.length;

    const usedIds = new Set(state.administered.map((a) => a.id));
    const next = answered >= state.maxItems ? null : selectNextItem(theta, usedIds, calItems(state.pool));
    const stop = (answered >= state.minItems && se <= state.targetSe) || answered >= state.maxItems || !next;

    if (stop) {
      const result = buildResult(state, theta, se);
      await persistResult(state, result);
      // Feed administration stats back to the bank for ongoing calibration.
      const correctById: Record<string, boolean> = {};
      for (const a of state.administered) correctById[a.id] = a.correct;
      await recordItemAdministration(
        state.administered.map((a) => a.id),
        correctById
      ).catch(() => {});
      await consume(body.sessionId);
      return NextResponse.json({
        done: true,
        result,
        theta: Math.round(theta * 100) / 100,
        se: Math.round(se * 1000) / 1000,
        itemsUsed: answered,
      });
    }

    state.currentItemId = next!.id;
    await saveState(body.sessionId, state);
    const nextItem = state.pool.find((p) => p.id === next!.id)!;
    return NextResponse.json({
      done: false,
      item: strip(nextItem, state.language),
      progress: { answered, max: state.maxItems, se: Math.round(se * 100) / 100, theta: Math.round(theta * 100) / 100 },
    });
  }

  return NextResponse.json({ error: "action must be 'start' or 'answer'" }, { status: 400 });
}
