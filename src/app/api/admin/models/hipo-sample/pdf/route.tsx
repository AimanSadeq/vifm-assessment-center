import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { HipoReportPdf } from "@/lib/reports/persona-hipo";
import { sampleHipoPdfData } from "@/lib/reports/persona-hipo-sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo VIFM High-Potential Profile with fictional data, so staff can show the
 * report from the platform without a completed bundle sitting. Staff-gated
 * (admin/consultant/assessor); client managers should see real candidate
 * reports, not the demo.
 */
export async function GET() {
  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    const caller = await getCurrentCaller();
    if (caller?.role !== "client_manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const display = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const data = sampleHipoPdfData(display, now.toISOString());
  const buffer = await renderToBuffer(<HipoReportPdf d={data} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="VIFM-High-Potential-Profile-SAMPLE.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
