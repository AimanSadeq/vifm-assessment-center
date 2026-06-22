import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { PersonaProfilePdf } from "@/lib/reports/persona-profile";
import { buildPersonaPdfData, peekPersonaPurpose } from "@/lib/reports/persona-report-data";
import { renderPersonaProfileHtmlAr } from "@/lib/reports/persona-profile-ar-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

export const runtime = "nodejs";

// Persona self-profile PDF for any behavioral session (anonymous or candidate-bound).
// EN renders via React-PDF; AR (?lang=ar) renders via Chromium/HTML (React-PDF
// cannot shape Arabic). Hiring stays admin-gated in BOTH languages.
export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";

    // Auth gate BEFORE the heavy assembly: BOTH the hiring and development
    // reports are admin/client deliverables, so a candidate (voucher delegate,
    // no account) cannot pull their own report PDF even with the session id.
    const purpose = await peekPersonaPurpose(params.sessionId);
    if (purpose === "missing") return NextResponse.json({ error: "Session not found" }, { status: 404 });
    {
      const caller = await getCurrentCaller();
      if (!caller) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (caller.role !== "admin") {
        // Additive: a client_manager may pull a report for a session in their own org.
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
    }

    const built = await buildPersonaPdfData(params.sessionId, lang);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    const pdf =
      lang === "ar"
        ? await renderHtmlToPdfBuffer(renderPersonaProfileHtmlAr(built.data))
        : await renderToBuffer(<PersonaProfilePdf data={built.data} />);

    const safe = (built.data.takerName || "Persona").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="VIFM_Persona_${safe}${lang === "ar" ? "_AR" : ""}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Persona PDF generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate Persona report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
