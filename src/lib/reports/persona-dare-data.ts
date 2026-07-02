// ─────────────────────────────────────────────────────────────
// VIFM DARE report data builder. A lean loader (no AI) that turns a behavioral
// session's per-competency self scores into the four-role decision profile.
// Same scoring as the main Persona report (reverse-mapped 6 - raw, mean per
// competency). Development focus targets the PRIMARY role's lowest-rated
// competencies plus the WEAKEST role's, with catalogue tips.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import {
  computeDareProfile,
  DARE_ROLES,
  type DareProfile,
  type DareRole,
} from "@/lib/reports/persona-dare-dimensions";

export type DareDevItem = {
  name: string;
  role: DareRole;
  score: number;
  tips: string[];
};

export type DarePdfData = {
  takerName: string | null;
  generatedAt: string;
  overall: number; // mean across all answered competencies (1-5)
  profile: DareProfile;
  /** Sharpening the primary role: its 3 lowest-rated competencies. */
  primaryFocus: DareDevItem[];
  /** Building the weakest role (when different from primary): its 3 lowest. */
  weakestRole: DareRole;
  weakestFocus: DareDevItem[];
};

export type DareBuildResult =
  | { ok: true; data: DarePdfData }
  | { ok: false; status: number; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildDarePdfData(sessionId: string): Promise<DareBuildResult> {
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

  // ── Names (static catalogue) + definitions (live) ──
  const nameById = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, c.nameEn]));
  const defById = new Map<string, string>();
  try {
    const { data: cat } = await sb.from("competencies").select("id, description");
    for (const c of cat ?? []) if (c.description) defById.set(c.id as string, String(c.description));
  } catch { /* tolerant */ }

  const profile = computeDareProfile(scoreById, nameById, defById);
  const all = [...scoreById.values()];
  const overall = all.length ? round2(all.reduce((a, b) => a + b, 0) / all.length) : 0;

  // ── Development focus: primary role's 3 lowest + weakest role's 3 lowest ──
  const weakestRole = [...DARE_ROLES].sort((a, b) => profile.scores[a] - profile.scores[b])[0];
  const lowest = (role: DareRole) => [...profile.rowsByRole[role]].sort((a, b) => a.score - b.score).slice(0, 3);
  const primaryRows = lowest(profile.primary);
  const weakestRows = weakestRole === profile.primary ? [] : lowest(weakestRole);

  const focusIds = [...primaryRows, ...weakestRows].map((r) => r.id);
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
  const toDev = (rows: typeof primaryRows): DareDevItem[] =>
    rows.map((r) => ({ name: r.name, role: r.role, score: r.score, tips: tipsById.get(r.id) ?? [] }));

  return {
    ok: true,
    data: {
      takerName,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      overall,
      profile,
      primaryFocus: toDev(primaryRows),
      weakestRole,
      weakestFocus: toDev(weakestRows),
    },
  };
}
