// ─────────────────────────────────────────────────────────────
// Persona Leadership Report data builder. A lean loader (no AI) that turns a
// behavioral session's per-competency self scores into the leadership/management
// profile. Same scoring as the main Persona report (reverse-mapped 6 - raw,
// mean per competency). Tolerant of missing columns.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { computeLeadershipProfile, type LeadershipProfile } from "@/lib/reports/persona-leadership-dimensions";

export type LeadershipPdfData = {
  takerName: string | null;
  generatedAt: string;
  overall: number; // mean across all answered competencies (1-5)
  profile: LeadershipProfile;
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

  // ── Responses → per-competency score ──
  let responses: { competency_id: string; raw_score: number; is_reverse: boolean }[] = [];
  {
    const { data } = await sb
      .from("behavioral_assessment_responses")
      .select("competency_id, raw_score, is_reverse")
      .eq("session_id", sessionId);
    responses = (data as typeof responses) ?? [];
  }
  if (responses.length === 0) return { ok: false, status: 400, error: "No answers recorded for this session yet" };

  const byComp = new Map<string, number[]>();
  for (const r of responses) {
    const raw = Number(r.raw_score);
    const v = r.is_reverse ? 6 - raw : raw;
    if (!byComp.has(r.competency_id)) byComp.set(r.competency_id, []);
    byComp.get(r.competency_id)!.push(v);
  }
  const scoreById = new Map<string, number>();
  for (const [cid, vals] of byComp) scoreById.set(cid, round2(vals.reduce((a, b) => a + b, 0) / vals.length));

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

  return {
    ok: true,
    data: {
      takerName,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      overall,
      profile,
    },
  };
}
