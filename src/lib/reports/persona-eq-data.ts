// ─────────────────────────────────────────────────────────────
// VIFM EQ report data builder. A lean loader (no AI) that turns a behavioral
// session's per-competency self scores into the Goleman four-quadrant profile.
// Same scoring as the main Persona report (reverse-mapped 6 - raw, mean per
// competency). Development focus targets the PRIORITY (lowest) quadrant's
// lowest-rated competencies plus the runner-up quadrant's, with catalogue tips.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { selfScoreByCompetency, type PersonaScoreRow } from "@/lib/scoring/behavioral";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import {
  computeEqProfile,
  type EqProfile,
  type EqQuadrant,
} from "@/lib/reports/persona-eq-dimensions";

export type EqDevItem = {
  name: string;
  quadrant: EqQuadrant;
  score: number;
  tips: string[];
};

export type EqPdfData = {
  takerName: string | null;
  generatedAt: string;
  profile: EqProfile;
  /** In-scope competencies answered (of 22). */
  inScopeAnswered: number;
  /** Building the priority (lowest) quadrant: its 3 lowest-rated competencies. */
  priorityFocus: EqDevItem[];
  /** The runner-up quadrant's 2 lowest (when it has any rows). */
  runnerUpFocus: EqDevItem[];
};

export type EqBuildResult =
  | { ok: true; data: EqPdfData }
  | { ok: false; status: number; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildEqPdfData(sessionId: string): Promise<EqBuildResult> {
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

  // ── Names (static catalogue) + definitions (live) ──
  const nameById = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, c.nameEn]));
  const defById = new Map<string, string>();
  try {
    const { data: cat } = await sb.from("competencies").select("id, description");
    for (const c of cat ?? []) if (c.description) defById.set(c.id as string, String(c.description));
  } catch { /* tolerant */ }

  const profile = computeEqProfile(scoreById, nameById, defById);
  const inScopeAnswered = Object.values(profile.counts).reduce((a, b) => a + b, 0);
  if (inScopeAnswered === 0) {
    return { ok: false, status: 400, error: "This sitting answered none of the EI-domain competencies." };
  }

  // ── Development focus: priority quadrant's 3 lowest + runner-up's 2 lowest ──
  const lowest = (q: EqQuadrant, n: number) =>
    [...profile.rowsByQuadrant[q]].sort((a, b) => a.score - b.score).slice(0, n);
  const priorityRows = lowest(profile.priority, 3);
  const runnerUpRows = profile.runnerUp === profile.priority ? [] : lowest(profile.runnerUp, 2);

  const focusIds = [...priorityRows, ...runnerUpRows].map((r) => r.id);
  const tipsById = new Map<string, string[]>();
  if (focusIds.length) {
    try {
      const { data: tipRows } = await sb
        .from("behavioral_indicators")
        .select("competency_id, description, sort_order")
        .in("competency_id", focusIds)
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
  const toDev = (rows: typeof priorityRows): EqDevItem[] =>
    rows.map((r) => ({ name: r.name, quadrant: r.quadrant, score: r.score, tips: tipsById.get(r.id) ?? [] }));

  return {
    ok: true,
    data: {
      takerName,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      profile,
      inScopeAnswered,
      priorityFocus: toDev(priorityRows),
      runnerUpFocus: toDev(runnerUpRows),
    },
  };
}
