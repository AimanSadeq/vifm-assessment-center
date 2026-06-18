/**
 * Shared Arabic-PDF rendering helper.
 *
 * React-PDF cannot shape Arabic glyphs (no harfbuzz, no font fallback),
 * so every Arabic PDF in the app is produced by rendering well-formed
 * RTL HTML through Chromium (which has full bidi + Arabic shaping). This
 * is the same approach the ARA report + personal-snapshot PDFs use; this
 * module factors out the two reusable pieces so the per-report routes
 * don't each copy the Puppeteer boilerplate:
 *
 *   renderHtmlToPdfBuffer(html)  - launch Chromium, load the HTML, wait
 *                                  for fonts, return a PDF Buffer.
 *   AR_FONT_HREF                 - the Noto Naskh Arabic stylesheet.
 *   escapeHtml(s)                - escape interpolated user/DB strings.
 *
 * Node runtime only (Puppeteer can't run on Edge). Callers must set
 * `export const runtime = "nodejs"`.
 */
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "./pdf-browser";

export const AR_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap";

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render a full HTML document string to a PDF Buffer via bundled-Chromium
 * Puppeteer. `landscape` matches the certificate layout; reports stay
 * portrait. waitUntil:'networkidle0' + fonts.ready guarantees the Arabic
 * webfont is shaped before capture (otherwise glyphs fall back to tofu).
 */
export async function renderHtmlToPdfBuffer(
  html: string,
  opts?: { landscape?: boolean }
): Promise<Buffer> {
  const browser: Browser = await launchPdfBrowser({
    defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.evaluate(async () => {
      const f = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (f && typeof f.ready?.then === "function") await f.ready;
    });
    const pdf = await page.pdf({
      format: "A4",
      landscape: opts?.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
