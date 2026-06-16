import { renderToBuffer } from "@react-pdf/renderer";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { LearningPlan } from "@/lib/reports/learning-plan";
import { renderLearningPlanHtmlAr } from "@/lib/reports/learning-plan-ar-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { getServerLocale } from "@/lib/i18n/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guardCandidateReportAccess } from "@/lib/auth/report-access";

// The Arabic path renders RTL HTML through Puppeteer (React-PDF can't
// shape Arabic glyphs), and Puppeteer can't run on the Edge runtime.
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { engagementId: string; candidateId: string } }
) {
  try {
    const denied = await guardCandidateReportAccess(params.engagementId, params.candidateId);
    if (denied) return denied;
    const supabase = await createClient();

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

    // Language: explicit ?lang= wins, else the viewer's locale cookie.
    const lang =
      ((new URL(req.url).searchParams.get("lang") ?? (await getServerLocale())) === "ar")
        ? "ar"
        : "en";

    const data = await fetchReportData(params.engagementId, params.candidateId);
    const safeName = data.candidateName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");

    // ── Arabic path: Puppeteer renders RTL HTML so Chromium can shape
    //    the Arabic glyphs React-PDF cannot. Same data shape; layout
    //    mirrors the EN four-page template.
    if (lang === "ar") {
      data.generatedAt = new Date().toLocaleDateString("ar-AE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const html = renderLearningPlanHtmlAr(data);
      const buffer = await renderHtmlToPdfBuffer(html);
      const filename = `VIFM_Learning_Plan_${safeName}_ar.pdf`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── English path: existing React-PDF renderer. Unchanged.
    const buffer = await renderToBuffer(<LearningPlan data={data} />);
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
