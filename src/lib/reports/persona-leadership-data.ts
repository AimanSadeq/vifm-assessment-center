// ─────────────────────────────────────────────────────────────
// Persona Leadership Report data builder. A lean loader (no AI) that turns a
// behavioral session's per-competency self scores into the leadership/management
// profile. Same scoring as the main Persona report (reverse-mapped 6 - raw,
// mean per competency). Tolerant of missing columns.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { selfScoreByCompetency, type PersonaScoreRow } from "@/lib/scoring/behavioral";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import {
  computeLeadershipProfile,
  type LeadershipProfile,
  type LeadershipDimension,
} from "@/lib/reports/persona-leadership-dimensions";

export type DevelopmentPlanItem = {
  name: string;
  dimension: LeadershipDimension;
  score: number;
  tips: string[];
};

export type LeadershipPdfData = {
  takerName: string | null;
  generatedAt: string;
  overall: number; // mean across all answered competencies (1-5)
  overallCount: number; // number of competencies actually measured (may be < 41 when scoped)
  profile: LeadershipProfile;
  developmentPlan: DevelopmentPlanItem[]; // tips/activities for the lowest-rated competencies
};

export type LeadershipBuildResult =
  | { ok: true; data: LeadershipPdfData }
  | { ok: false; status: number; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildLeadershipPdfData(sessionId: string): Promise<LeadershipBuildResult> {
  const sb = createServiceClient();

  // ── Session (taker name) ──
  let takerName: string | null = null;
  {
    const { data, error } = await sb
      .from("behavioral_assessment_sessions")
      .select("id, taker_name")
      .eq("id", sessionId)
      .maybeSingle<{ id: string; taker_name: string | null }>();
    if (error || !data) return { ok: false, status: 404, error: "Session not found" };
    takerName = data.taker_name ?? null;
  }

  // ── Responses → per-competency score (ipsative-aware) ──
  let responses: PersonaScoreRow[] = [];
  {
    const { data } = await sb
      .from("behavioral_assessment_responses")
      .select("competency_id, raw_score, is_reverse, item_type, answer_data")
      .eq("session_id", sessionId);
    responses = (data as PersonaScoreRow[]) ?? [];
  }
  if (responses.length === 0) return { ok: false, status: 400, error: "No answers recorded for this session yet" };

  // Forced-choice rows collapse to one value per competency (3 + #most - #least),
  // matching the canonical scorer instead of averaging raw 5/1/3 as Likert.
  const scoreById = selfScoreByCompetency(responses);

  // ── Names (from the static catalogue) + definitions (live) ──
  const nameById = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, c.nameEn]));
  const defById = new Map<string, string>();
  try {
    const { data: cat } = await sb.from("competencies").select("id, description");
    for (const c of cat ?? []) if (c.description) defById.set(c.id as string, String(c.description));
  } catch { /* tolerant */ }

  const profile = computeLeadershipProfile(scoreById, nameById, defById);
  const all = [...scoreById.values()];
  const overall = all.length ? round2(all.reduce((a, b) => a + b, 0) / all.length) : 0;

  // ── Development tips/activities for the lowest-rated competencies ──
  // Tips are seeded into behavioral_indicators tagged "[DEV TIP] ..." (00004).
  const devIds = profile.topDevelopment.map((r) => r.id);
  const tipsById = new Map<string, string[]>();
  if (devIds.length) {
    try {
      const { data: tipRows } = await sb
        .from("behavioral_indicators")
        .select("competency_id, description, sort_order")
        .in("competency_id", devIds)
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
  const developmentPlan: DevelopmentPlanItem[] = profile.topDevelopment.map((r) => ({
    name: r.name,
    dimension: r.dimension,
    score: r.score,
    tips: tipsById.get(r.id) ?? [],
  }));

  return {
    ok: true,
    data: {
      takerName,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      overall,
      overallCount: all.length,
      profile,
      developmentPlan,
    },
  };
}
