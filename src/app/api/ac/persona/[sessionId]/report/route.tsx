import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { PersonaProfilePdf, type PersonaPdfData, type PersonaPdfCluster } from "@/lib/reports/persona-profile";

export const runtime = "nodejs";

// Persona self-profile PDF for any behavioral session (anonymous or candidate-bound).
export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const sb = createServiceClient();
    const { data: session } = await sb
      .from("behavioral_assessment_sessions")
      .select("id, taker_name")
      .eq("id", params.sessionId)
      .maybeSingle();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

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

    // Group by competency cluster from the bank.
    const byCluster = new Map<number, PersonaPdfCluster>();
    for (const comp of BEHAVIORAL_COMPETENCIES) {
      const score = scoreById.get(comp.acCompetencyId);
      if (score == null) continue;
      if (!byCluster.has(comp.clusterOrder)) byCluster.set(comp.clusterOrder, { name: comp.clusterNameEn, avg: 0, rows: [] });
      byCluster.get(comp.clusterOrder)!.rows.push({ name: comp.nameEn, score });
    }
    const clusters = [...byCluster.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, cl]) => ({ ...cl, avg: cl.rows.reduce((a, r) => a + r.score, 0) / cl.rows.length }));

    const all = [...scoreById.values()];
    const overall = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100 : 0;

    const data: PersonaPdfData = {
      takerName: (session.taker_name as string | null) ?? null,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      overall,
      clusters,
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
