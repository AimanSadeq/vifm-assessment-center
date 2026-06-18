import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getServerLocale } from "@/lib/i18n/server";
import { getTechnicalProgram } from "@/lib/competencies/technical-program";
import { renderTechCohortHtml, renderTechFunctionCohortHtml } from "@/lib/reports/tech-cohort-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function launchBrowser(): Promise<Browser> {
  return launchPdfBrowser({ defaultViewport: { width: 1200, height: 1400, deviceScaleFactor: 1 } });
}

/**
 * GET /api/admin/tech-assessment/programs/[id]/pdf?lang=en|ar
 * Admin-only. Cohort report (per-domain pass rates + certified roster) for a
 * standalone technical certification program.
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

  const urlLang = new URL(req.url).searchParams.get("lang");
  const lang = urlLang === "ar" ? "ar" : urlLang === "en" ? "en" : await getServerLocale();

  const full = await getTechnicalProgram(params.id, lang);
  if (!full) {
    return NextResponse.json({ ok: false, error: "Program not found" }, { status: 404 });
  }

  // Function-scoped programs (current model) get the deep per-skill cohort
  // report; legacy domain-scoped programs keep the per-domain certification one.
  const html = full.functionView
    ? renderTechFunctionCohortHtml(
        {
          programName: full.meta.name,
          orgName: full.meta.organizationName,
          view: full.functionView,
          generatedAt: new Date(),
        },
        lang
      )
    : renderTechCohortHtml(
        {
          engagementName: full.meta.name,
          orgName: full.meta.organizationName,
          program: full.program,
          generatedAt: new Date(),
        },
        lang
      );

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const filename = `technical-program-${params.id.slice(0, 8)}-${lang}.pdf`;
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[tech-program pdf]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
