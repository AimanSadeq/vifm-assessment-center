import "server-only";
import type { Browser } from "puppeteer-core";

/**
 * Shared headless-Chromium launcher for every server-side PDF in the app
 * (ARA reports, Reflect 360, Pre-Hire, technical programmes, the Arabic HTML
 * renderer - all the Puppeteer paths; React-PDF reports don't use this).
 *
 * WHY THIS EXISTS - the Render production bug:
 * Plain `puppeteer.launch()` relies on the Chromium that the `puppeteer`
 * package downloads at install time into the HOME cache (~/.cache/puppeteer).
 * Render persists `node_modules` between build and runtime but NOT the home
 * cache, so at runtime Chromium is missing and every PDF route 500s with
 * "Could not find Chrome (ver. 147.x) ... /opt/render/.cache/puppeteer".
 *
 * THE FIX: in production we launch via @sparticuz/chromium - a self-contained
 * Chromium binary shipped INSIDE node_modules (version-matched to puppeteer's
 * wanted Chrome 147), driven by puppeteer-core. Because it lives in
 * node_modules it survives Render's build->runtime hand-off with no install
 * step, env var, or dashboard change. In local dev we keep the bundled
 * `puppeteer` Chromium (already installed by `npm install`), so developers
 * need nothing extra and dev launches stay fast.
 *
 * Selection: @sparticuz is used when running on Render (RENDER env), in a
 * production build (NODE_ENV=production), or when USE_SPARTICUZ_CHROMIUM=1 is
 * set explicitly (handy for reproducing the prod path locally).
 *
 * Node runtime only (Puppeteer can't run on Edge) - callers set
 * `export const runtime = "nodejs"`.
 */

type Viewport = { width: number; height: number; deviceScaleFactor?: number };

const useSparticuz = (): boolean =>
  process.env.USE_SPARTICUZ_CHROMIUM === "1" ||
  process.env.NODE_ENV === "production" ||
  !!process.env.RENDER;

export async function launchPdfBrowser(opts?: { defaultViewport?: Viewport }): Promise<Browser> {
  const defaultViewport: Viewport = opts?.defaultViewport ?? { width: 1200, height: 900, deviceScaleFactor: 1 };

  if (useSparticuz()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport,
    }) as unknown as Browser;
  }

  // Local dev: bundled puppeteer Chromium (installed by `npm install`).
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport,
  }) as unknown as Browser;
}
