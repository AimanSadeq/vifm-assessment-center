import { renderToBuffer } from "@react-pdf/renderer";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { LearningPlan } from "@/lib/reports/learning-plan";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: { engagementId: string; candidateId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: oar } = await supabase
      .from("overall_assessment_ratings")
      .select("id")
      .eq("engagement_id", params.engagementId)
      .eq("candidate_id", params.candidateId)
      .maybeSingle();

    if (!oar) {
      return NextResponse.json(
        { error: "Learning Plan cannot be generated until the Overall Assessment Rating (OAR) is finalized." },
        { status: 400 }
      );
    }

    const data = await fetchReportData(params.engagementId, params.candidateId);
    const buffer = await renderToBuffer(<LearningPlan data={data} />);

    const safeName = data.candidateName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    const filename = `VIFM_Learning_Plan_${safeName}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Learning Plan generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate learning plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
