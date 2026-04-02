import { renderToBuffer } from "@react-pdf/renderer";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { CandidateReport } from "@/lib/reports/candidate-report";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: { engagementId: string; candidateId: string } }
) {
  try {
    // Auth guard — verify user has access
    // TODO: When auth is enabled, verify the user is:
    // - An admin, OR
    // - A client user whose org owns this engagement, OR
    // - The candidate themselves (and report status is "released")
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // In dev mode (no auth), allow all access
    // In production, uncomment and implement role checks:
    // if (!user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const data = await fetchReportData(params.engagementId, params.candidateId);
    const buffer = await renderToBuffer(
      <CandidateReport data={data} />
    );

    const filename = `VIFM_Report_${data.candidateName.replace(/\s+/g, "_")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
