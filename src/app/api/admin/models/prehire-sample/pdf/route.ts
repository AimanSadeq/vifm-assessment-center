import "server-only";
import { NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { renderPrehireCandidateHtml } from "@/lib/reports/prehire-candidate-html";
import { samplePrehireReportData } from "@/lib/reports/prehire-sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo Pre-Hire® screening report with fictional data, so staff can show the
 * report from the Scientific Models hub without a completed sitting. Puppeteer
 * (the same engine as the real Pre-Hire report). Staff-gated.
 * ?lang=en|ar.
 */
export async function GET(req: Request) {
  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    await getCurrentCaller();
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  const data = samplePrehireReportData(new Date(), lang);
  const html = renderPrehireCandidateHtml(data, lang);

  let browser: Browser | null = null;
  try {
    browser = await launchPdfBrowser({ defaultViewport: { width: 1200, height: 1400, deviceScaleFactor: 1 } });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const out = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new NextResponse(new Uint8Array(Buffer.from(out)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="VIFM-Pre-Hire-SAMPLE-${lang}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[prehire sample report]", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
