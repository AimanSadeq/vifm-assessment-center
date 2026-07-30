import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { LeadershipReportPdf } from "@/lib/reports/persona-leadership";
import { DareReportPdf } from "@/lib/reports/persona-dare";
import { EqReportPdf } from "@/lib/reports/persona-eq";
import { sampleLeadershipData, sampleDareData, sampleEqData } from "@/lib/reports/persona-model-samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo Persona-derived model report (Leadership / DARE / EQ) with fictional
 * data, so staff can show the report from the platform without a completed
 * sitting. Staff-gated (admin/consultant/assessor). HiPo has its own route.
 */
const BUILDERS: Record<string, (generatedAt: string) => ReactElement<DocumentProps>> = {
  "persona-leadership": (g) => <LeadershipReportPdf data={sampleLeadershipData(g)} />,
  "persona-dare": (g) => <DareReportPdf data={sampleDareData(g)} />,
  "persona-eq": (g) => <EqReportPdf data={sampleEqData(g)} />,
};

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const build = BUILDERS[params.slug];
  if (!build) return NextResponse.json({ error: "No sample for this model." }, { status: 404 });

  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    await getCurrentCaller();
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const buffer = await renderToBuffer(build(generatedAt));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="VIFM-${params.slug}-SAMPLE.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
