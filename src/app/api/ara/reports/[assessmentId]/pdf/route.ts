import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { createServiceClient } from "@/lib/supabase/server";

// Dynamic + force-node: Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ara/reports/[assessmentId]/pdf
 *
 * Renders the SSR report page at /ara/consultant/assessments/[id]/report?bare=1
 * in a headless Chromium, outputs an A4 PDF, and persists a row in ara_reports.
 *
 * Intentionally simple: we boot a full browser on every request. For
 * production we would switch to @sparticuz/chromium + puppeteer-core on
 * Vercel, or keep a warm browser pool.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { assessmentId: string } }
) {
  const url = new URL(req.url);
  const langRaw = url.searchParams.get("language") ?? "en";
  const language: "en" | "ar" | "bilingual" =
    langRaw === "ar" ? "ar" : langRaw === "bilingual" ? "bilingual" : "en";
  const reportUrl =
    `${url.origin}/ara/consultant/assessments/${params.assessmentId}/report?bare=1&lang=${language}`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 60_000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    // Log the generation in ara_reports. file_url stays null — we stream
    // the bytes directly rather than writing to storage. A future pass
    // can switch to storage-backed durable URLs.
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
