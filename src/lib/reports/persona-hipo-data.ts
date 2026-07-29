// ─────────────────────────────────────────────────────────────
// VIFM High-Potential Profile - data builder.
//
// Joins a Persona sitting (behavioural self-scores) with a Logica result
// (cognitive reasoning) into the two HiPo pillars, the nine-grid placement,
// and a development plan (competency tips from the seeded tip bank +
// cognitive activities for weak subtests). Tweaked from the Leadership
// Report loader - same scoring path, same tolerance posture.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { selfScoreByCompetency, type PersonaScoreRow } from "@/lib/scoring/behavioral";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { COGNITIVE_SUBTESTS } from "@/lib/psychometrics/framework";
import type { PsyResult } from "@/lib/psychometrics/scoring";
import {
  HIPO_ASPIRATION_IDS,
  HIPO_ABILITY_WEIGHTS,
  HIPO_CUTS,
  hipoBand,
  hipoCell,
  cognitiveTo5,
  COGNITIVE_DEV_ACTIVITIES,
  HIPO_BAND_LABEL,
  engagementOverlay,
  type HipoCell,
  type HipoBand,
} from "@/lib/reports/persona-hipo-model";
import { latestEngagementForCandidate, type EngagementResult } from "@/lib/hipo/engagement";

export type HipoMarker = { name: string; score: number };
export type HipoSubtest = { key: string; name: string; pct: number; on5: number; band: string };
export type HipoDevItem = { name: string; score: number; tips: string[] };

export type HipoPdfData = {
  takerName: string | null;
  orgName: string | null;
  generatedAt: string;
  // Pillars (1-5)
  aspiration: number;
  aspirationBand: HipoBand;
  aspirationMarkers: HipoMarker[];
  behavioural: number;
  behaviouralCount: number;
  cognitive: number | null; // null when no Logica result attached
  cognitiveSubtests: HipoSubtest[];
  ability: number;
  abilityBand: HipoBand;
  cell: HipoCell;
  bandLabel: (b: HipoBand) => string;
  cuts: typeof HIPO_CUTS;
  weights: typeof HIPO_ABILITY_WEIGHTS;
  // Development plan
  behaviouralDev: HipoDevItem[];
  cognitiveDev: { name: string; activities: string[] }[];
  // Third pillar (manager-rated) - null when no completed survey exists.
  engagement: (EngagementResult & { overlay: string | null }) | null;
};

export type HipoBuildResult =
  | { ok: true; data: HipoPdfData; organizationId: string | null }
  | { ok: false; status: number; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function buildHipoPdfData(input: {
  personaSessionId: string;
  cognitiveResultId: string | null;
  orgName?: string | null;
  organizationId?: string | null;
  /** When set, the latest completed manager engagement survey is loaded. */
  bundleCandidateId?: string | null;
}): Promise<HipoBuildResult> {
  const sb = createServiceClient();

  // ── Persona session + responses ──
  let takerName: string | null = null;
  {
    const { data, error } = await sb
      .from("behavioral_assessment_sessions")
      .select("id, taker_name")
      .eq("id", input.personaSessionId)
      .maybeSingle<{ id: string; taker_name: string | null }>();
    if (error || !data) return { ok: false, status: 404, error: "Persona session not found" };
    takerName = data.taker_name ?? null;
  }
  let responses: PersonaScoreRow[] = [];
  {
    const { data } = await sb
      .from("behavioral_assessment_responses")
      .select("competency_id, raw_score, is_reverse, item_type, answer_data")
      .eq("session_id", input.personaSessionId);
    responses = (data as PersonaScoreRow[]) ?? [];
  }
  if (responses.length === 0) return { ok: false, status: 400, error: "No Persona answers recorded yet" };
  const scoreById = selfScoreByCompetency(responses);
  const nameById = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, c.nameEn]));

  // ── Pillar 1: Aspiration (the eight drive/growth markers) ──
  const aspirationSet = new Set(HIPO_ASPIRATION_IDS);
  const aspirationMarkers: HipoMarker[] = HIPO_ASPIRATION_IDS
    .filter((cid) => scoreById.has(cid))
    .map((cid) => ({ name: nameById.get(cid) ?? "(competency)", score: round2(scoreById.get(cid)!) }))
    .sort((a, b) => b.score - a.score);
  if (aspirationMarkers.length < 4) {
    return { ok: false, status: 400, error: "The sitting did not cover enough aspiration markers - use the full Persona battery, or a scope that includes the drive/growth competencies (Proactive Initiative, Outcome Ownership, Accountability, Learning by Doing, Mobilising Around Purpose, Principled Courage, Adaptive Learning Capacity, Continuous Self-Development)" };
  }
  const aspiration = round2(mean(aspirationMarkers.map((m) => m.score)));

  // ── Ability: behavioural (all remaining competencies) ──
  const behaviouralEntries = [...scoreById.entries()].filter(([cid]) => !aspirationSet.has(cid));
  // Fail closed: a scope covering only the aspiration set would leave this pillar
  // empty and mean([]) = 0 would fabricate an "Early Journey" placement.
  if (behaviouralEntries.length < 4) {
    return { ok: false, status: 400, error: "The sitting did not cover enough leadership competencies outside the aspiration set to compute the Ability pillar - use the full Persona battery, or a scope that also includes broader leadership competencies" };
  }
  const behavioural = round2(mean(behaviouralEntries.map(([, s]) => s)));

  // ── Ability: cognitive (Logica subtests → shared 1-5 scale) ──
  let cognitive: number | null = null;
  const cognitiveSubtests: HipoSubtest[] = [];
  if (input.cognitiveResultId) {
    const { data: psy } = await sb
      .from("psy_results")
      .select("result")
      .eq("id", input.cognitiveResultId)
      .maybeSingle<{ result: PsyResult | null }>();
    const scales = psy?.result?.scales ?? [];
    for (const sc of scales) {
      const meta = COGNITIVE_SUBTESTS.find((x) => x.key === sc.key);
      cognitiveSubtests.push({
        key: sc.key,
        name: meta?.name_en ?? sc.key,
        pct: Math.round(sc.raw),
        on5: round2(cognitiveTo5(sc.raw)),
        band: sc.bandLabel ?? "",
      });
    }
    if (cognitiveSubtests.length > 0) {
      cognitive = round2(mean(cognitiveSubtests.map((s) => s.on5)));
    }
  }

  // ── Ability blend (behavioural-only fallback when no Logica attached) ──
  const ability =
    cognitive == null
      ? behavioural
      : round2(HIPO_ABILITY_WEIGHTS.behavioural * behavioural + HIPO_ABILITY_WEIGHTS.cognitive * cognitive);

  const cell = hipoCell(aspiration, ability);

  // ── Development plan: three lowest markers across BOTH pillars' behaviours ──
  const lowest = [...scoreById.entries()]
    .map(([cid, s]) => ({ cid, name: nameById.get(cid) ?? "(competency)", score: round2(s) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const tipsById = new Map<string, string[]>();
  if (lowest.length) {
    try {
      const { data: tipRows } = await sb
        .from("behavioral_indicators")
        .select("competency_id, description, sort_order")
        .in("competency_id", lowest.map((l) => l.cid))
        .like("description", "[DEV TIP]%")
        .order("sort_order");
      for (const t of tipRows ?? []) {
        const txt = String(t.description).replace(/^\[DEV TIP\]\s*/, "").trim();
        if (!txt) continue;
        const cid = t.competency_id as string;
        if (!tipsById.has(cid)) tipsById.set(cid, []);
        tipsById.get(cid)!.push(txt);
      }
    } catch { /* tolerant */ }
  }
  const behaviouralDev: HipoDevItem[] = lowest.map((l) => ({
    name: l.name,
    score: l.score,
    tips: (tipsById.get(l.cid) ?? []).slice(0, 3),
  }));

  // Cognitive activities for subtests below the Solid cut.
  const cognitiveDev = cognitiveSubtests
    .filter((s) => s.on5 < HIPO_CUTS.solidAt)
    .map((s) => ({ name: s.name, activities: COGNITIVE_DEV_ACTIVITIES[s.key] ?? [] }))
    .filter((s) => s.activities.length > 0);

  // ── Third pillar: manager-rated engagement (tolerant - absent survey or an
  //    un-applied migration 00196 simply renders the two-pillar report). ──
  let engagement: HipoPdfData["engagement"] = null;
  if (input.bundleCandidateId) {
    try {
      const eng = await latestEngagementForCandidate(input.bundleCandidateId);
      if (eng) engagement = { ...eng, overlay: engagementOverlay(cell, eng.band) };
    } catch { /* tolerant */ }
  }

  return {
    ok: true,
    organizationId: input.organizationId ?? null,
    data: {
      takerName,
      orgName: input.orgName ?? null,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      aspiration,
      aspirationBand: hipoBand(aspiration),
      aspirationMarkers,
      behavioural,
      behaviouralCount: behaviouralEntries.length,
      cognitive,
      cognitiveSubtests,
      ability,
      abilityBand: hipoBand(ability),
      cell,
      bandLabel: (b) => HIPO_BAND_LABEL[b],
      cuts: HIPO_CUTS,
      weights: HIPO_ABILITY_WEIGHTS,
      behaviouralDev,
      cognitiveDev,
      engagement,
    },
  };
}
