import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Launch Chromium via standard puppeteer for both dev and prod.
 *
 * Render runs Node web services in full Linux containers, so we use the
 * bundled Chromium that puppeteer ships with rather than the stripped
 * @sparticuz/chromium build. Sparticuz is meant for AWS Lambda's /tmp
 * size + cold-start constraints, has a thinner font set (Arabic in
 * particular can fall through to tofu), and offers no advantage here.
 */
async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
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
