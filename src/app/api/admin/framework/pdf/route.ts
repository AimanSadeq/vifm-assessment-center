import { NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadFrameworkTree } from "@/lib/competencies/framework-tree";
import { renderFrameworkHtml } from "@/lib/reports/framework-html";

/**
 * GET /api/admin/framework/pdf - the VIFM competency framework as a PDF
 * (domains -> clusters -> competencies + per-competency positive/negative
 * behavioural indicators). Admin-gated; Puppeteer via the shared launcher.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const { domains, counts } = await loadFrameworkTree();
  const html = renderFrameworkHtml(domains, counts);

  let browser: Browser | null = null;
  try {
    browser = await launchPdfBrowser({ defaultViewport: { width: 1200, height: 1500, deviceScaleFactor: 1 } });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const out = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="VIFM-Competency-Framework.pdf"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 },
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
