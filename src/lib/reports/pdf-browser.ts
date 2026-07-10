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
 * step, env var, or dashboard change. In local dev we use the bundled
 * `puppeteer` Chromium (already installed by `npm install`).
 *
 * SELF-HEALING: we prefer @sparticuz on a server (RENDER / NODE_ENV=production
 * / USE_SPARTICUZ_CHROMIUM=1) and bundled puppeteer otherwise, but if the
 * preferred engine fails to launch we transparently fall back to the other.
 * This means it works even if env detection is wrong on the host (e.g. Render
 * not exposing RENDER to the process) - the bundled "Could not find Chrome"
 * failure is caught and @sparticuz is tried, and vice-versa in dev.
 *
 * Node runtime only (Puppeteer can't run on Edge) - callers set
 * `export const runtime = "nodejs"`.
 */

type Viewport = { width: number; height: number; deviceScaleFactor?: number };

const preferSparticuz = (): boolean =>
  process.env.USE_SPARTICUZ_CHROMIUM === "1" ||
  process.env.NODE_ENV === "production" ||
  !!process.env.RENDER;

async function launchSparticuz(defaultViewport: Viewport): Promise<Browser> {
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = (await import("puppeteer-core")).default;
  return puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport,
  }) as unknown as Browser;
}

async function launchBundled(defaultViewport: Viewport): Promise<Browser> {
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport,
  }) as unknown as Browser;
}

export async function launchPdfBrowser(opts?: { defaultViewport?: Viewport }): Promise<Browser> {
  const defaultViewport: Viewport = opts?.defaultViewport ?? { width: 1200, height: 900, deviceScaleFactor: 1 };
  const sparticuzFirst = preferSparticuz();
  const primary = sparticuzFirst ? launchSparticuz : launchBundled;
  const secondary = sparticuzFirst ? launchBundled : launchSparticuz;

  try {
    return await primary(defaultViewport);
  } catch (err) {
    console.warn(
      `[pdf-browser] primary Chromium launch (${sparticuzFirst ? "@sparticuz" : "bundled"}) failed, falling back to ${sparticuzFirst ? "bundled" : "@sparticuz"}:`,
      err instanceof Error ? err.message : err,
    );
    return await secondary(defaultViewport);
  }
}

/**
 * The origin Puppeteer should use to navigate back to THIS server to render a
 * report page (`page.goto(...)`).
 *
 * WHY: on Render, TLS terminates at the edge and the app speaks plain HTTP on
 * $PORT. A server route's `new URL(req.url).origin` therefore comes back as
 * `https://localhost:<port>` (https scheme from x-forwarded-proto + the internal
 * loopback host). Pointing Puppeteer at that HTTPS URL hits an HTTP port and
 * fails with `net::ERR_SSL_PROTOCOL_ERROR`, 500-ing every Puppeteer PDF route.
 *
 * FIX: downgrade the scheme to http for loopback hosts only. Public hosts
 * (a real domain) and local dev (already http://localhost:3000) are unchanged,
 * so this is safe everywhere and only rewrites the broken internal case.
 */
export function selfOrigin(reqUrl: string): string {
  const origin = new URL(reqUrl).origin;
  return origin.replace(/^https:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/i, "http://$1");
}

// Minimal Puppeteer surface we touch, so callers don't need the puppeteer types.
type PdfPage = {
  setRequestInterception: (v: boolean) => Promise<void>;
  on: (evt: "request", cb: (r: {
    url: () => string;
    headers: () => Record<string, string>;
    continue: (o?: { headers?: Record<string, string> }) => Promise<void>;
  }) => void) => void;
  goto: (url: string, opts?: Record<string, unknown>) => Promise<{ status: () => number } | null>;
  url: () => string;
};

/**
 * Navigate a Puppeteer page to an access-gated internal report URL and verify
 * the render actually landed on the intended page.
 *
 * Centralises the security-sensitive bits every PDF route needs, so they can't
 * drift apart (the ARC + Reflect routes previously each hand-rolled this and
 * two flaws crept in):
 *   - Auth headers (the requester's session cookie + the server-only
 *     x-ara-internal=CRON_SECRET that lets the middleware internal-render
 *     allow-list pass a client_manager) are attached to SAME-ORIGIN requests
 *     ONLY, matched by exact URL origin (not a bare prefix, which also matched
 *     `https://good.example.evil.example/...` and would leak the secret).
 *   - After navigation we assert the FINAL landed path equals the expected
 *     report path. `nav.status()` reflects the last response AFTER redirects,
 *     so a middleware 302 to /portal (or /login on an expired cookie) lands as
 *     200 and would otherwise ship a print of the wrong page as the "report".
 *
 * Returns { ok: true } on a clean render, or { ok: false, status } describing
 * the failure so the route can return a 502 instead of a bogus PDF.
 */
export async function gotoInternalReportPage(
  page: PdfPage,
  reportUrl: string,
  opts: { cookie?: string | null; internalSecret?: string | null },
): Promise<{ ok: true } | { ok: false; reason: "http_error" | "wrong_page"; status: number; landedPath: string }> {
  const origin = new URL(reportUrl).origin;
  const expectedPath = new URL(reportUrl).pathname;

  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const headers = { ...r.headers() };
    let sameOrigin = false;
    try { sameOrigin = new URL(r.url()).origin === origin; } catch { sameOrigin = false; }
    if (sameOrigin) {
      if (opts.cookie) headers.cookie = opts.cookie;
      if (opts.internalSecret) headers["x-ara-internal"] = opts.internalSecret;
    }
    void r.continue({ headers });
  });

  const nav = await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 60_000 });
  const status = nav?.status() ?? 0;
  if (status >= 400) {
    return { ok: false, reason: "http_error", status, landedPath: expectedPath };
  }
  // Redirect trap: a 302 chain (client_manager -> /portal, expired cookie ->
  // /login) resolves to a 200 on the WRONG page. Verify the landed path.
  let landedPath = "";
  try { landedPath = new URL(page.url()).pathname; } catch { landedPath = ""; }
  if (landedPath !== expectedPath) {
    return { ok: false, reason: "wrong_page", status, landedPath };
  }
  return { ok: true };
}
