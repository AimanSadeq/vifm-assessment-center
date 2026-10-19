import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { computeCompanyCohortDetail } from "@/lib/ara/company-cohort-detail";
import { recommendCoursesForIndividualSnapshot, recommendCoursesForPillarScores } from "@/lib/recommender/courses";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { buildArcCohortReportHtml, cohortReportFilename } from "@/lib/reports/arc-cohort-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 120;

/**
 * GET /api/ara/admin/vouchers/cohort-pdf?company=<label>
 *
 * The client-facing cohort dashboard for one voucher company: the
 * organizational pillars (when the vouchers carried them) and the workforce
 * readiness factors, organizational level only (no delegate names or scores).
 * Admin only.
 */
export async function GET(request: Request) {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = (new URL(request.url).searchParams.get("company") ?? "").trim();
  if (!company) return NextResponse.json({ error: "Choose a company." }, { status: 400 });

  try {
    const detail = await computeCompanyCohortDetail(company);
    if (!detail) return NextResponse.json({ error: "No cohort data for this company yet." }, { status: 404 });
    const { insight, org } = detail;

    const sb = createServiceClient();
    const [personalCourses, pillarCourses] = await Promise.all([
      insight.cohort_overall != null
        ? recommendCoursesForIndividualSnapshot({ factorScores: insight.factor_scores_for_recommender, limit: 5 })
        : Promise.resolve([]),
      org && org.pillars.length > 0
        ? recommendCoursesForPillarScores({
            pillarScores: Object.fromEntries(org.pillars.map((p) => [p.pillar_id, p.mean])),
            limit: 5,
            client: sb,
          })
        : Promise.resolve([]),
    ]);

    const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const html = buildArcCohortReportHtml({ detail, personalCourses, pillarCourses, generatedAt });
    const pdf = await renderHtmlToPdfBuffer(html);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${cohortReportFilename(insight.company_label)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ARC cohort PDF error:", error);
    if (error instanceof Error && error.message === "PDF_RENDERER_UNAVAILABLE") {
      return NextResponse.json(
        { error: "The PDF renderer is temporarily unavailable. Please try again in a moment." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate PDF" }, { status: 500 });
  }
}
