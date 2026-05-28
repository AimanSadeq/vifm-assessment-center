import { renderToBuffer } from "@react-pdf/renderer";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { CandidateReport } from "@/lib/reports/candidate-report";
import { renderCandidateReportHtmlAr } from "@/lib/reports/candidate-report-ar-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { getServerLocale } from "@/lib/i18n/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ReportData } from "@/lib/reports/report-types";

// Node runtime is required for the Arabic path: React-PDF cannot shape
// Arabic glyphs, so Arabic reports render RTL HTML through Puppeteer /
// bundled Chromium, which can't run on the Edge runtime.
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { engagementId: string; candidateId: string } }
) {
  try {
    // Auth guard - verify user is authenticated. Applies to both
    // languages; the language only changes how we render, never whether.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if OAR exists (report should only be generated after wash-up is
    // complete). Same gate for EN + AR.
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

    // Language precedence: ?lang= query param, then the `vifm-locale`
    // cookie, then "en". Only "ar" diverges; anything else is "en".
    const requested = new URL(request.url).searchParams.get("lang");
    const lang = (requested ?? (await getServerLocale())) === "ar" ? "ar" : "en";

    // Sanitize filename: strip non-alphanumeric characters except underscores.
    // (Arabic names collapse to "" here, so they get the generic stem.)
    const safeName =
      data.candidateName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") || "Candidate";

    // ── Arabic path: Puppeteer renders RTL HTML so Chromium can shape
    //    the glyphs React-PDF cannot. Same ReportData shape; only the
    //    date strings are re-localised to Arabic before rendering.
    if (lang === "ar") {
      const arData: ReportData = {
        ...data,
        generatedAt: new Date().toLocaleDateString("ar-AE", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        // The fetcher pre-formats the date range with en-GB month names
        // and an English "to" connector (raw dates aren't exposed). Swap
        // the connector and digits so it reads naturally in the RTL doc.
        assessmentDates: localiseDateRangeAr(data.assessmentDates),
      };
      const html = renderCandidateReportHtmlAr(arData);
      const buffer = await renderHtmlToPdfBuffer(html);
      const filename = `VIFM_Report_${safeName}_ar.pdf`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── English path: existing React-PDF renderer. Unchanged.
    const buffer = await renderToBuffer(<CandidateReport data={data} />);
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

/**
 * The report data fetcher formats the assessment date range as
 * "1 January 2026 to 5 January 2026" (en-GB) and does not expose the
 * raw dates. For the Arabic report we keep the fetcher untouched and
 * apply a light cosmetic pass: swap the English " to " connector for
 * "إلى" and convert ASCII digits to Arabic-Indic numerals so the range
 * sits correctly in the RTL document. Month names stay English (the
 * raw dates needed to re-localise them aren't available here).
 */
function localiseDateRangeAr(formatted: string): string {
  if (!formatted) return formatted;
  const withConnector = formatted.replace(/\bto\b/g, "إلى");
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  return withConnector.replace(/[0-9]/g, (digit) => arabicIndic[Number(digit)]);
}
