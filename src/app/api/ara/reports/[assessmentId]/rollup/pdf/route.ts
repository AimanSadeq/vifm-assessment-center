import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser, selfOrigin, gotoInternalReportPage } from "@/lib/reports/pdf-browser";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ara/reports/[assessmentId]/rollup/pdf?weight=respondents|equal&language=en|ar
 *
 * The Division / Enterprise cross-unit comparison PDF. Renders
 * /ara/consultant/assessments/[id]/rollup?bare=1 in headless Chromium.
 *
 * Same shape as the unit-report route: authorize the caller here, then mark
 * the render internal so the SSR page trusts it. Chromium comes from the
 * shared launcher (bundled in dev, @sparticuz in production) because Render
 * does not persist puppeteer's Chromium cache from build to runtime.
 *
 * Not logged to ara_reports: that table records the deliverable issued FOR an
 * assessment, and a rollup is a view over its children rather than a new
 * report of the parent's own responses. Logging it there would double-count
 * the parent's report history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { assessmentId: string } }
) {
  try {
    await requireAssessmentOwner(params.assessmentId);
  } catch (err) {
    if (isAuthorizationError(err)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const weight = url.searchParams.get("weight") === "equal" ? "equal" : "respondents";
  const language = url.searchParams.get("language") === "ar" ? "ar" : "en";
  const reportUrl =
    `${selfOrigin(req.url)}/ara/consultant/assessments/${params.assessmentId}/rollup?bare=1&weight=${weight}&lang=${language}`;

  let browser: Browser | null = null;
  try {
    try {
      browser = await launchPdfBrowser({
        defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
      });
    } catch (launchErr) {
      console.error("[ara rollup pdf] browser launch failed", launchErr);
      return NextResponse.json(
        { ok: false, error: "The PDF renderer is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });

    const nav = await gotoInternalReportPage(page, reportUrl, {
      cookie: req.headers.get("cookie"),
      internalSecret: process.env.CRON_SECRET,
    });
    if (!nav.ok) {
      console.error(
        `[ara rollup pdf] render failed for ${params.assessmentId}: ${nav.reason} (status ${nav.status}, landed ${nav.landedPath})`
      );
      return NextResponse.json(
        { ok: false, error: "The rollup could not be rendered for this engagement. Please contact VIFM if this persists." },
        { status: 502 }
      );
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    const filename = `arc-rollup-${params.assessmentId.slice(0, 8)}-${language}.pdf`;
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[ara rollup pdf]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
