import { NextResponse } from "next/server";
import type { Browser } from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import { methodologyBriefHtml } from "@/lib/reports/methodology-brief";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Launch bundled Chromium (Render runs full Linux containers). Mirrors the
 * report PDF route - same engine, same Arabic-capable font set.
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
 * GET /api/ara/methodology/pdf
 *
 * Public, no-account download of the ARC Methodology Brief as a branded PDF.
 * Replaces the old "view on GitHub" links on the report + cohort surfaces.
 * Reads the markdown doc at request time so it stays the single source of truth.
 */
export async function GET() {
  let md: string;
  try {
    md = await fs.readFile(path.join(process.cwd(), "docs", "ARA-Methodology-Brief.md"), "utf8");
  } catch {
    // Tolerant fallback - never 500 a public download.
    md =
      "# VIFM AI Readiness Compass - Methodology Brief\n\nThe methodology brief is temporarily unavailable. " +
      "For methodology questions, contact the VIFM consulting team: `contact@viftraining.com`.";
  }

  const html = methodologyBriefHtml(md);

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="VIFM-AI-Readiness-Compass-Methodology-Brief.pdf"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[methodology/pdf] generation failed:", err);
    return NextResponse.json({ error: "Could not generate the methodology PDF." }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
