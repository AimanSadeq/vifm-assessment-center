import { NextResponse } from "next/server";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { timingSafeStrEqual } from "@/lib/utils/secret";
import { buildPersonalReportPdf } from "@/lib/reports/personal-report-build";

// Puppeteer needs the Node runtime, and the report must never be served from a
// cache that predates the respondent finishing (see the fetchCache note in the
// git history of this file).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * GET /api/ara/personal/[token]/pdf?language=en|ar&present=<lens>
 *
 * The personal AI-readiness report. Rendering lives in
 * src/lib/reports/personal-report-build.ts, shared with the public sample route
 * so a prospect's sample is the same document a real respondent receives.
 *
 * Access (XP-13): the taker never downloads their own report. Allowed callers
 * are the internal client-delivery path (server-only CRON_SECRET header) and a
 * signed-in VIFM staff member. A token-only caller is refused.
 */
export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const internalKey = request.headers.get("x-ara-internal");
    const isInternal = timingSafeStrEqual(internalKey, process.env.CRON_SECRET);
    const staff = await isStaffCaller();
    if (!isInternal && !staff) {
      return NextResponse.json(
        { error: "Results are not available to the respondent for this assessment." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const result = await buildPersonalReportPdf({
      token: params.token,
      lang: url.searchParams.get("language"),
      present: url.searchParams.get("present"),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    console.error("Personal report PDF error:", error);
    if (error instanceof Error && error.message === "PDF_RENDERER_UNAVAILABLE") {
      return NextResponse.json(
        { error: "The PDF renderer is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
