import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { computeCompanyCohortInsight } from "@/lib/ara/company-cohort";
import { recommendCoursesForIndividualSnapshot } from "@/lib/recommender/courses";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { buildArcCohortReportHtml, cohortReportFilename } from "@/lib/reports/arc-cohort-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * GET /api/ara/admin/vouchers/cohort-pdf?company=<label>
 *
 * The client-facing cohort report for one voucher company: organizational
 * level only (no delegate names). Admin only.
 */
export async function GET(request: Request) {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = (new URL(request.url).searchParams.get("company") ?? "").trim();
  if (!company) return NextResponse.json({ error: "Choose a company." }, { status: 400 });

  try {
    const insight = await computeCompanyCohortInsight(company);
    if (!insight) return NextResponse.json({ error: "No cohort data for this company yet." }, { status: 404 });

    const courses =
      insight.cohort_overall != null
        ? await recommendCoursesForIndividualSnapshot({ factorScores: insight.factor_scores_for_recommender, limit: 5 })
        : [];
    const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const html = buildArcCohortReportHtml({ insight, courses, generatedAt });
    const pdf = await renderHtmlToPdfBuffer(html, {
      pageFooter: { left: `AI Readiness Compass  |  ${insight.company_label}  |  Cohort report  |  VIFM, confidential` },
    });

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
