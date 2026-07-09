import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { DareReportPdf } from "@/lib/reports/persona-dare";
import { buildDarePdfData } from "@/lib/reports/persona-dare-data";
import { personaBankProvisional } from "@/lib/persona/bank";

export const runtime = "nodejs";

// VIFM DARE Decision-Role Profile PDF for any behavioral session. Translates
// the 41-competency self-assessment into the four decision roles (Decide /
// Advise / Recommend / Execute). Admin / client-manager(own org) deliverable -
// never the candidate. Mirrors the Leadership Report route's gate.
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

    const built = await buildDarePdfData(params.sessionId);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    const isProvisional = (await personaBankProvisional()).provisional;
    const pdf = await renderToBuffer(<DareReportPdf data={built.data} provisional={isProvisional} />);
    const safe = (built.data.takerName || "Persona").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="VIFM_Persona_DARE_${safe}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Persona DARE PDF error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate DARE report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
