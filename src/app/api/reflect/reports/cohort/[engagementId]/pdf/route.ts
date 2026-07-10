import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser, selfOrigin, gotoInternalReportPage } from "@/lib/reports/pdf-browser";
import { createServiceClient } from "@/lib/supabase/server";
import { computeCohortScoring } from "@/lib/reflect/scoring";
import { guardReflectEngagementAccess } from "@/lib/reflect/report-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function launchBrowser(): Promise<Browser> {
  return launchPdfBrowser({ defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 1 } });
}

/**
 * GET /api/reflect/reports/cohort/[engagementId]/pdf?language=en|ar|bilingual
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const { engagementId } = await params;

  // Admin or the owning consultant only.
  const denied = await guardReflectEngagementAccess(engagementId);
  if (denied) return denied;

  const url = new URL(req.url);
  const langRaw = url.searchParams.get("language") ?? "en";
  const language: "en" | "ar" | "bilingual" =
    langRaw === "ar" ? "ar" : langRaw === "bilingual" ? "bilingual" : "en";
  const reportUrl = `${selfOrigin(req.url)}/reflect/consultant/engagements/${engagementId}/cohort-report?bare=1&lang=${language}`;

  const scoring = await computeCohortScoring(engagementId);
  if (!scoring) {
    return NextResponse.json({ ok: false, error: "Engagement not found" }, { status: 404 });
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
    // Report page is access-gated; the shared helper forwards cookie + secret
    // to same-origin requests and verifies the render landed on the report
    // page (not a middleware redirect to /portal or /login).
    const nav = await gotoInternalReportPage(page, reportUrl, {
      cookie: req.headers.get("cookie"),
      internalSecret: process.env.CRON_SECRET,
    });
    if (!nav.ok) {
      console.error(`[reflect cohort pdf] render failed for ${engagementId}: ${nav.reason} (status ${nav.status}, landed ${nav.landedPath})`);
      return NextResponse.json(
        { ok: false, error: "The report page could not be rendered. Please contact VIFM if this persists." },
        { status: 502 }
      );
    }

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    });

    const sb = createServiceClient();
    await sb.from("reflect_reports").insert({
      engagement_id: scoring.engagement_id,
      participant_id: null,
      report_kind: "cohort",
      language,
      file_url: null,
      scores_snapshot: scoring,
      version: 1,
    });

    const filename = `reflect-cohort-${scoring.engagement_name.replace(/[^a-zA-Z0-9]+/g, "_")}-${language}.pdf`;
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[reflect cohort pdf]", err);
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
