import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel: default serverless timeout is 10s. PDF gen takes ~7–10s for
// a 29-page report - bump to 60s. Hobby tier caps at 60; Pro goes higher.
export const maxDuration = 60;

/**
 * Launch Chromium, detecting runtime:
 *   - Vercel / production: puppeteer-core + @sparticuz/chromium
 *     (small, serverless-compatible, under the 50 MB function bundle)
 *   - Local dev: full puppeteer package (bundled Chromium)
 *
 * The "full" puppeteer package is only required in dev, so we import it
 * lazily. In production the bundler dead-code-eliminates it.
 */
async function launchBrowser(): Promise<Browser> {
  const isProduction = !!process.env.VERCEL || process.env.NODE_ENV === "production";

  if (isProduction) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Browser;
  }

  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Browser;
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
    `${url.origin}/ara/consultant/assessments/${params.assessmentId}/report?bare=1&lang=${language}`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 60_000 });

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
