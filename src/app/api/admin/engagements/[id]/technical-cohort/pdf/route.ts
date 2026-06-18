import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getEngagementTechProgram } from "@/lib/competencies/engagement-tech-program";
import { renderTechCohortHtml } from "@/lib/reports/tech-cohort-html";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared launcher (bundled puppeteer in dev, @sparticuz/chromium in prod).
async function launchBrowser(): Promise<Browser> {
  return launchPdfBrowser({ defaultViewport: { width: 1200, height: 1400, deviceScaleFactor: 1 } });
}

/**
 * GET /api/admin/engagements/[id]/technical-cohort/pdf?lang=en|ar
 * Admin-only. Renders the engagement's technical certification cohort report
 * (per-domain pass rates + certified roster) as a PDF.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (err) {
    if (isAuthorizationError(err)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";

  const sb = createServiceClient();
  const { data: eng } = await sb
    .from("engagements")
    .select("id, name, organizations(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!eng) {
    return NextResponse.json({ ok: false, error: "Engagement not found" }, { status: 404 });
  }
  const orgName = (eng.organizations as unknown as { name: string } | null)?.name ?? null;

  const program = await getEngagementTechProgram(params.id, lang);
  const html = renderTechCohortHtml(
    { engagementName: (eng.name as string) ?? "", orgName, program, generatedAt: new Date() },
    lang
  );

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });

    const filename = `technical-cohort-${params.id.slice(0, 8)}-${lang}.pdf`;
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[tech-cohort pdf]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
