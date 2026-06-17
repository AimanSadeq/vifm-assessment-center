// ─────────────────────────────────────────────────────────────
// Admin "completed Persona results" loader (server, service-role read).
//
// Lists submitted standalone Persona sittings (voucher / self-served, i.e.
// candidate_id IS NULL) with the data a recruiter needs for the hiring pilot:
// purpose, the target role, the computed FIT % + band (for hiring), the overall
// self-rating, and a link target for the report PDF. Reuses the same fit math
// as the report route (computeFit over the role competencies actually served).
// Tolerant of migrations 00110 / 00106 not being applied.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { computeFit, type FitBandKey } from "./persona-fit";
import { loadPersonaRoleOptions } from "./persona-roles";

export type PersonaResultRow = {
  id: string;
  takerName: string | null;
  orgName: string | null;
  purpose: "development" | "hiring";
  roleName: string | null;
  fitPct: number | null;
  fitBand: FitBandKey | null;
  overall: number | null;
  itemCount: number;
  submittedAt: string;
};

type SessionRow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  taker_name: string | null;
  purpose?: string | null;
  target_role_profile_id?: string | null;
  organization?: { name: string } | { name: string }[] | null;
};

function orgNameOf(r: SessionRow): string | null {
  const o = r.organization;
  if (!o) return null;
  return Array.isArray(o) ? o[0]?.name ?? null : o.name ?? null;
}

export async function listPersonaResults(limit = 500): Promise<PersonaResultRow[] | null> {
  try {
    const sb = createServiceClient();
    const wide = "id, created_at, submitted_at, taker_name, purpose, target_role_profile_id";
    const basic = "id, created_at, submitted_at, taker_name";
    const run = (cols: string) =>
      sb
        .from("behavioral_assessment_sessions")
        .select(cols)
        .eq("status", "submitted")
        .is("candidate_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);

    // Prefer the wide select + org join; degrade gracefully (00110 / 00106 absent).
    let res = (await run(`${wide}, organization:organizations(name)`)) as { data: SessionRow[] | null; error: unknown };
    if (res.error) res = (await run(wide)) as typeof res;
    if (res.error) res = (await run(`${basic}, organization:organizations(name)`)) as typeof res;
    if (res.error) res = (await run(basic)) as typeof res;
    if (res.error) return null;
    const sessions = res.data ?? [];
    if (sessions.length === 0) return [];

    const ids = sessions.map((s) => s.id);
    const { data: responses } = await sb
      .from("behavioral_assessment_responses")
      .select("session_id, competency_id, raw_score, is_reverse")
      .in("session_id", ids);

    // Per-session: per-competency reverse-mapped values + the flat list (overall).
    const bySession = new Map<string, Map<string, number[]>>();
    for (const r of responses ?? []) {
      const sid = r.session_id as string;
      if (!bySession.has(sid)) bySession.set(sid, new Map());
      const m = bySession.get(sid)!;
      const cid = r.competency_id as string;
      const v = r.is_reverse ? 6 - Number(r.raw_score) : Number(r.raw_score);
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid)!.push(v);
    }

    const roles = await loadPersonaRoleOptions();
    const roleById = new Map(roles.map((r) => [r.id, r]));

    return sessions.map((s): PersonaResultRow => {
      const m = bySession.get(s.id) ?? new Map<string, number[]>();
      const scoreById = new Map<string, number>();
      const allVals: number[] = [];
      for (const [cid, vals] of m) {
        scoreById.set(cid, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100);
        allVals.push(...vals);
      }
      const overall = allVals.length
        ? Math.round((allVals.reduce((a, b) => a + b, 0) / allVals.length) * 100) / 100
        : null;

      const purpose: "development" | "hiring" = s.purpose === "hiring" ? "hiring" : "development";
      let roleName: string | null = null;
      let fitPct: number | null = null;
      let fitBand: FitBandKey | null = null;
      if (purpose === "hiring" && s.target_role_profile_id) {
        const role = roleById.get(s.target_role_profile_id);
        if (role) {
          roleName = role.name;
          // Fit over the role competencies actually served (mirrors the report route).
          const measured = role.comps.filter((c) => scoreById.has(c.competencyId));
          const f = computeFit(scoreById, measured);
          if (f) {
            fitPct = f.fitPct;
            fitBand = f.band;
          }
        }
      }

      return {
        id: s.id,
        takerName: s.taker_name,
        orgName: orgNameOf(s),
        purpose,
        roleName,
        fitPct,
        fitBand,
        overall,
        itemCount: allVals.length,
        submittedAt: s.submitted_at ?? s.created_at,
      };
    });
  } catch {
    return null;
  }
}
