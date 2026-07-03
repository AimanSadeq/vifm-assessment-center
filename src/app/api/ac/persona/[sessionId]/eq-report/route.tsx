import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { EqReportPdf } from "@/lib/reports/persona-eq";
import { buildEqPdfData } from "@/lib/reports/persona-eq-data";

export const runtime = "nodejs";

// VIFM Emotional Intelligence Profile PDF for any behavioral session. Re-reads
// the 22 EI-domain competencies through Goleman's four quadrants. Admin /
// client-manager(own org) deliverable - never the candidate. Mirrors the
// Leadership + DARE report routes' gate.
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    if (!UUID_RE.test(params.sessionId)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const caller = await getCurrentCaller();
    if (!caller) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    if (caller.role !== "admin") {
      if (caller.role === "client_manager") {
        const orgId = await getClientOrgId();
        const { data: sess } = await createServiceClient()
          .from("behavioral_assessment_sessions")
          .select("organization_id")
          .eq("id", params.sessionId)
          .maybeSingle<{ organization_id: string | null }>();
        if (!orgId || !sess || sess.organization_id !== orgId) {
          return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    }

    const built = await buildEqPdfData(params.sessionId);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    const pdf = await renderToBuffer(<EqReportPdf data={built.data} />);
    const safe = (built.data.takerName || "Persona").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="VIFM_Persona_EQ_${safe}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Persona EQ PDF error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate EQ report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
