import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { loadPersonaRoleById } from "@/lib/scoring/persona-roles";
import { computeFit, competencyNarrative, FIT_BAND_HEX } from "@/lib/scoring/persona-fit";
import { generatePersonaInsights, buildInsightCompetencies } from "@/lib/ai/persona-insights";
import { PersonaProfilePdf, type PersonaPdfData, type PersonaPdfCluster } from "@/lib/reports/persona-profile";

export const runtime = "nodejs";

type SessionRow = {
  id: string;
  taker_name: string | null;
  purpose?: string | null;
  target_role_profile_id?: string | null;
};

// Persona self-profile PDF for any behavioral session (anonymous or candidate-bound).
export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const sb = createServiceClient();

    // Session: try the 00110 columns, fall back to the original shape (tolerant).
    let session: SessionRow | null = null;
    {
      const { data, error } = await sb
        .from("behavioral_assessment_sessions")
        .select("id, taker_name, purpose, target_role_profile_id")
        .eq("id", params.sessionId)
        .maybeSingle();
      if (error && /column .*(purpose|target_role_profile_id)/i.test(error.message)) {
        const { data: basic } = await sb
          .from("behavioral_assessment_sessions")
          .select("id, taker_name")
          .eq("id", params.sessionId)
          .maybeSingle();
        session = (basic as SessionRow) ?? null;
      } else {
        session = (data as SessionRow) ?? null;
      }
    }
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // A HIRING report is a client/admin deliverable - require admin auth so a
    // candidate (voucher delegate, no account) can't pull their own fit PDF even
    // if they know the session id. Development self-reads stay open (the taker's
    // own growth report). Tolerant: a pre-00110 session has no purpose -> open.
    if (session.purpose === "hiring") {
      const caller = await getCurrentCaller();
      if (!caller || caller.role !== "admin") {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    }

    const { data: responses } = await sb
      .from("behavioral_assessment_responses")
      .select("competency_id, raw_score, is_reverse")
      .eq("session_id", params.sessionId);
    if (!responses || responses.length === 0) {
      return NextResponse.json({ error: "No answers recorded for this session yet" }, { status: 400 });
    }

    // Per-competency self score (reverse mapped 6 - raw), read-only.
    const byComp = new Map<string, number[]>();
    for (const r of responses) {
      const raw = Number(r.raw_score);
      const v = r.is_reverse ? 6 - raw : raw;
      const cid = r.competency_id as string;
      if (!byComp.has(cid)) byComp.set(cid, []);
      byComp.get(cid)!.push(v);
    }
    const scoreById = new Map<string, number>();
    for (const [cid, vals] of byComp) {
      scoreById.set(cid, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100);
    }

    // Competency definitions (descriptions) + one development tip each.
    const definitionById = new Map<string, string>();
    const tipById = new Map<string, string>();
    try {
      const { data: cat } = await sb.from("competencies").select("id, description");
      for (const c of cat ?? []) {
        if (c.description) definitionById.set(c.id as string, String(c.description));
      }
    } catch { /* tolerant */ }
    try {
      const { data: tips } = await sb
        .from("behavioral_indicators")
        .select("competency_id, description, sort_order")
        .like("description", "[DEV TIP]%")
        .order("sort_order", { ascending: true });
      for (const t of tips ?? []) {
        const cid = t.competency_id as string;
        if (!tipById.has(cid)) tipById.set(cid, String(t.description).replace(/^\[DEV TIP\]\s*/, ""));
      }
    } catch { /* tolerant */ }

    const purpose: "development" | "hiring" = session.purpose === "hiring" ? "hiring" : "development";

    // For a hiring report, load the role once so per-competency targets feed both
    // the cluster-row narratives and the fit computation.
    const role = purpose === "hiring" && session.target_role_profile_id
      ? await loadPersonaRoleById(session.target_role_profile_id)
      : null;
    const targetById = new Map((role?.comps ?? []).map((c) => [c.competencyId, c.target]));

    // Stored AI insights (00125), generated at submit and grounded in the
    // candidate's answers. Read tolerantly; fall back to a deterministic narrative.
    let insightsById: Record<string, string> = {};
    try {
      const { data: ci } = await sb
        .from("behavioral_assessment_sessions")
        .select("competency_insights")
        .eq("id", params.sessionId)
        .maybeSingle<{ competency_insights: Record<string, string> | null }>();
      if (ci?.competency_insights && typeof ci.competency_insights === "object") insightsById = ci.competency_insights;
    } catch {
      /* migration 00125 not applied */
    }

    // Lazy generation: a hiring report with no stored insights yet (legacy
    // session, or submit-time generation failed) generates them now from the
    // candidate's answers and caches them, so the report is always insight-rich.
    if (Object.keys(insightsById).length === 0 && role) {
      try {
        const competencies = await buildInsightCompetencies({
          sessionId: params.sessionId,
          roleComps: role.comps,
          selfById: scoreById,
        });
        if (competencies.length > 0) {
          insightsById = await generatePersonaInsights({ roleName: role.name, competencies });
          try {
            await sb
              .from("behavioral_assessment_sessions")
              .update({ competency_insights: insightsById })
              .eq("id", params.sessionId);
          } catch {
            /* migration 00125 not applied - still used for this render */
          }
        }
      } catch {
        /* fall back to the deterministic narrative */
      }
    }

    // Group by competency cluster from the bank, enriched with definition,
    // a score-interpretation narrative, and (development) a suggestion.
    const byCluster = new Map<number, PersonaPdfCluster>();
    for (const comp of BEHAVIORAL_COMPETENCIES) {
      const score = scoreById.get(comp.acCompetencyId);
      if (score == null) continue;
      if (!byCluster.has(comp.clusterOrder)) byCluster.set(comp.clusterOrder, { name: comp.clusterNameEn, avg: 0, rows: [] });
      byCluster.get(comp.clusterOrder)!.rows.push({
        name: comp.nameEn,
        score,
        definition: definitionById.get(comp.acCompetencyId),
        narrative: insightsById[comp.acCompetencyId] ?? competencyNarrative(score, purpose === "hiring" ? targetById.get(comp.acCompetencyId) ?? null : null),
        // Development reports carry a suggestion on the rows that need it most.
        tip: purpose === "development" && score < 3.5 ? tipById.get(comp.acCompetencyId) : undefined,
      });
    }
    const clusters = [...byCluster.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, cl]) => ({ ...cl, avg: cl.rows.reduce((a, r) => a + r.score, 0) / cl.rows.length }));

    const all = [...scoreById.values()];
    const overall = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100 : 0;

    // Hiring fit (recomputed from the role profile + the self scores).
    let fit: PersonaPdfData["fit"] = null;
    if (purpose === "hiring" && role) {
        // Compute fit only over the role competencies that were actually served
        // (a scoped sitting may omit some); unmeasured ones would otherwise count
        // as a zero and understate fit. computeFit returns null if none overlap.
        const measuredComps = role.comps.filter((c) => scoreById.has(c.competencyId));
        const f = computeFit(scoreById, measuredComps);
        if (f) {
          const nameById = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, c.nameEn]));
          fit = {
            roleName: role.name,
            fitPct: f.fitPct,
            bandLabel: f.bandLabel,
            bandHex: FIT_BAND_HEX[f.band],
            gaps: f.gaps
              .filter((g) => g.self != null && g.gap > 0)
              .slice(0, 6)
              .map((g) => ({ name: nameById.get(g.competencyId) ?? g.name, self: g.self ?? 0, target: g.target, gap: g.gap })),
            strengths: f.gaps
              .filter((g) => g.self != null && (g.self as number) >= g.target)
              .sort((a, b) => ((b.self as number) - b.target) - ((a.self as number) - a.target))
              .slice(0, 6)
              .map((g) => ({ name: nameById.get(g.competencyId) ?? g.name, self: g.self ?? 0, target: g.target })),
          };
        }
    }

    const data: PersonaPdfData = {
      takerName: (session.taker_name as string | null) ?? null,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      overall,
      clusters,
      purpose,
      fit,
    };

    const buffer = await renderToBuffer(<PersonaProfilePdf data={data} />);
    const safe = (data.takerName || "Persona").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="VIFM_Persona_${safe}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Persona PDF generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate Persona report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
