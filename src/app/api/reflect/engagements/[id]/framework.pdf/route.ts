import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer";
import { guardReflectEngagementAccess } from "@/lib/reflect/report-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Browser;
}

/**
 * GET /api/reflect/engagements/[id]/framework.pdf?language=en|ar|bilingual
 *
 * Renders the framework-preview SSR page with ?bare=1 and pipes it through
 * Chromium for a printable client-ready review document. Used from Step 5
 * of the engagement wizard so the consultant can hand the framework to the
 * CHRO office for sign-off before the rater invitations go out.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Admin or the owning consultant only.
  const denied = await guardReflectEngagementAccess(id);
  if (denied) return denied;

  const url = new URL(req.url);
  const langRaw = url.searchParams.get("language") ?? "en";
  const language: "en" | "ar" | "bilingual" =
    langRaw === "ar" ? "ar" : langRaw === "bilingual" ? "bilingual" : "en";
  const previewUrl = `${url.origin}/reflect/consultant/engagements/${id}/framework-preview?bare=1&lang=${language}`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    // Preview page is access-gated; forward the requester's session cookies.
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    await page.goto(previewUrl, { waitUntil: "networkidle0", timeout: 60_000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    const filename = `reflect-framework-${id.slice(0, 8)}-${language}.pdf`;
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[reflect framework pdf]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
