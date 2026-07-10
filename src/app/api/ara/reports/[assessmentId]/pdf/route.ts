import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser, selfOrigin, gotoInternalReportPage } from "@/lib/reports/pdf-browser";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Launch Chromium via the shared launcher (see src/lib/reports/pdf-browser.ts):
 * bundled puppeteer Chromium in dev, @sparticuz/chromium in production. Render
 * does not persist puppeteer's HOME Chromium cache between build and runtime,
 * so the bundled binary is missing in prod and every PDF route 500s with
 * "Could not find Chrome"; @sparticuz ships its Chromium inside node_modules.
 * Arabic shaping is unaffected - the HTML loads the Noto Naskh webfont and
 * waits for fonts.ready, so HarfBuzz shapes from the loaded font, not system
 * fonts.
 */
async function launchBrowser(): Promise<Browser> {
  return launchPdfBrowser({ defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 } });
}

/**
 * GET /api/ara/reports/[assessmentId]/pdf?language=en|ar|bilingual
 *
 * Renders the SSR report page at /ara/consultant/assessments/[id]/report?bare=1&lang=<language>
 * in headless Chromium, outputs PDF, and persists a row in ara_reports.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { assessmentId: string } }
) {
  // Authorize: admin or the assessment's owning consultant can generate.
  // Prevents a consultant from guessing another consultant's assessment
  // UUID and generating a PDF of it.
  try {
    await requireAssessmentOwner(params.assessmentId);
  } catch (err) {
    if (isAuthorizationError(err)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const langRaw = url.searchParams.get("language") ?? "en";
  const language: "en" | "ar" | "bilingual" =
    langRaw === "ar" ? "ar" : langRaw === "bilingual" ? "bilingual" : "en";
  const reportUrl =
    `${selfOrigin(req.url)}/ara/consultant/assessments/${params.assessmentId}/report?bare=1&lang=${language}`;

  let browser: Browser | null = null;
  try {
    try {
      browser = await launchBrowser();
    } catch (launchErr) {
      // Chromium launch failure (e.g. @sparticuz/chromium missing or
      // version-mismatched in production) is a transient/infra problem, not a
      // bad request. Return 503 with a clear retry message so the consultant
      // knows the renderer is down - not that the assessment is broken.
      console.error("[ara pdf] browser launch failed", launchErr);
      return NextResponse.json(
        { ok: false, error: "The PDF renderer is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    // The report page sits under the access-gated /ara/consultant layout; forward
    // the (already-authorised) requester's session cookies so the SSR render
    // authorises as the owner. Additionally send the server-only x-ara-internal
    // header: this route has ALREADY authorized the caller via
    // requireAssessmentOwner - which also admits a portal client_manager for
    // their own org's assessment - but the consultant layout 404s that role,
    // so the delivered "PDF" was a print of the 404 page.
    // The shared helper forwards the requester's cookie + the server-only
    // x-ara-internal secret to same-origin requests (so a cross-origin asset
    // can never receive the secret - exact-origin match, not a prefix), and
    // verifies the render landed on the report page rather than a middleware
    // redirect to /portal or /login (a 302 chain resolves to a 200 on the
    // wrong page, so a plain status check would ship the wrong document).
    const nav = await gotoInternalReportPage(page, reportUrl, {
      cookie: req.headers.get("cookie"),
      internalSecret: process.env.CRON_SECRET,
    });
    if (!nav.ok) {
      console.error(`[ara pdf] render failed for ${params.assessmentId}: ${nav.reason} (status ${nav.status}, landed ${nav.landedPath})`);
      return NextResponse.json(
        { ok: false, error: "The report page could not be rendered for this assessment. Please contact VIFM if this persists." },
        { status: 502 }
      );
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    // Log the generation in ara_reports. file_url stays null - we stream
    // the bytes directly rather than writing to storage. Storage-backed
    // durable URLs are a future enhancement.
    const sb = createServiceClient();
    const { data: assessment } = await sb
      .from("ara_assessments")
      .select("id")
      .eq("id", params.assessmentId)
      .maybeSingle<{ id: string }>();
    if (assessment) {
      await sb.from("ara_reports").insert({
        assessment_id: assessment.id,
        language,
        file_url: null,
        version: 1,
      });
    }

    const filename = `ara-report-${params.assessmentId.slice(0, 8)}-${language}.pdf`;
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[ara pdf]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
