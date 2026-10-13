import "server-only";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";

/**
 * Prints an SDC report page (html.ts) to an A4 PDF with the shared Chromium
 * launcher (bundled puppeteer in dev, @sparticuz/chromium in production), the
 * same way as the technical cohort PDF route. Node runtime only.
 */
export async function renderSdcPdf(html: string): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await launchPdfBrowser({ defaultViewport: { width: 1200, height: 1400, deviceScaleFactor: 1 } });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    // networkidle0 settles the stylesheet request but not the font files;
    // wait for fonts.ready so Open Sans is applied (and measured) before print.
    await page.evaluate(async () => {
      const f = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (f && typeof f.ready?.then === "function") await f.ready;
    });
    // The group report splits its ranking table over pages by measuring rows.
    await page.evaluate(() => {
      const w = window as unknown as { __sdcLayout?: () => number };
      if (typeof w.__sdcLayout === "function") w.__sdcLayout();
    });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** ASCII file-name part, e.g. "Huda_Al-Zahrani". */
export function safeFilePart(name: string | null | undefined, fallback: string): string {
  return (name || "").replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_") || fallback;
}
