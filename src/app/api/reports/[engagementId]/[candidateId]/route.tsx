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
    // Auth guard - verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if OAR exists (report should only be generated after wash-up is complete)
    const { data: oar } = await supabase
      .from("overall_assessment_ratings")
      .select("id")
      .eq("engagement_id", params.engagementId)
      .eq("candidate_id", params.candidateId)
      .maybeSingle();

    if (!oar) {
      return NextResponse.json(
        { error: "Report cannot be generated until the Overall Assessment Rating (OAR) is finalized." },
        { status: 400 }
      );
    }

    const data = await fetchReportData(params.engagementId, params.candidateId);
    const buffer = await renderToBuffer(
      <CandidateReport data={data} />
    );

    // Sanitize filename: strip non-alphanumeric characters except underscores
    const safeName = data.candidateName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    const filename = `VIFM_Report_${safeName}.pdf`;

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
