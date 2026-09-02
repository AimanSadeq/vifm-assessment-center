import type { Browser } from "puppeteer-core";
import { createServiceClient } from "@/lib/supabase/server";
import { launchPdfBrowser, gotoInternalReportPage } from "@/lib/reports/pdf-browser";

/**
 * Public ARC samples that are REAL renders of one sandbox fixture.
 *
 * Decision (2026-09-02): sell what we ship. The public samples are the three
 * deliverables a client actually receives - the department report, the
 * division consolidation, and the individual report - each generated through
 * the same code path as a paying client's, for a fictional organisation
 * ("Ufuq Digital Authority", sandbox-flagged, Corporate Services division
 * over Human Resources and Finance). Hand-authored sample pages were retired
 * because one of them described an instrument the product never measured.
 *
 * The org-level reports live behind the consultant login, so this renders
 * them the way the PDF routes do: Chromium loads the report page with the
 * server-only internal header (CRON_SECRET) that marks the render as
 * already-authorised. The secret never leaves the server; the only thing a
 * public caller can obtain is the fixture, resolved by fixed labels.
 */

export const SAMPLE_ORG_NAME = "Ufuq Digital Authority";
export const SAMPLE_DIVISION_LABEL = "Corporate Services";
export const SAMPLE_DEPARTMENT_LABEL = "Human Resources";

export type SampleKind = "department" | "division";

export type SampleRenderResult =
  | { ok: true; pdf: Buffer; filename: string }
  | { ok: false; status: number; error: string };

async function findFixtureAssessment(kind: SampleKind): Promise<string | null> {
  const sb = createServiceClient();
  const { data: org } = await sb
    .from("ara_organizations")
    .select("id")
    .eq("name", SAMPLE_ORG_NAME)
    .maybeSingle<{ id: string }>();
  if (!org) return null;
  const { data } = await sb
    .from("ara_assessments")
    .select("id")
    .eq("organization_id", org.id)
    .eq("is_sandbox", true)
    .eq("engagement_stage", kind)
    .eq("scope_label", kind === "division" ? SAMPLE_DIVISION_LABEL : SAMPLE_DEPARTMENT_LABEL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function renderSampleReport(opts: {
  kind: SampleKind;
  lang: "en" | "ar";
  origin: string;
}): Promise<SampleRenderResult> {
  const id = await findFixtureAssessment(opts.kind);
  if (!id) {
    return { ok: false, status: 404, error: "The sample fixture is not provisioned on this environment." };
  }
  if (!process.env.CRON_SECRET) {
    // Without the internal secret the report page would bounce Chromium to
    // /login and we would ship a print of the login page. Fail loudly instead.
    return { ok: false, status: 503, error: "Sample rendering is not configured on this environment." };
  }

  const path = opts.kind === "division"
    ? `/ara/consultant/assessments/${id}/rollup?bare=1`
    : `/ara/consultant/assessments/${id}/report?bare=1&lang=${opts.lang}`;
  const url = `${opts.origin}${path}`;

  let browser: Browser;
  try {
    browser = await launchPdfBrowser({ defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 } });
  } catch (e) {
    console.error("[sample fixture] browser launch failed", e);
    return { ok: false, status: 503, error: "The PDF renderer is temporarily unavailable." };
  }
  try {
    const page = await browser.newPage();
    const nav = await gotoInternalReportPage(page, url, {
      cookie: null,
      internalSecret: process.env.CRON_SECRET,
    });
    if (!nav.ok) {
      console.error(`[sample fixture] render failed for ${opts.kind}: ${nav.reason} (status ${nav.status}, landed ${nav.landedPath})`);
      return { ok: false, status: 502, error: "The sample could not be rendered." };
    }
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const filename = opts.kind === "division"
      ? "ARC-Division-Consolidation-Sample.pdf"
      : `ARC-Department-Report-Sample-${opts.lang}.pdf`;
    return { ok: true, pdf: Buffer.from(pdf), filename };
  } finally {
    await browser.close().catch(() => {});
  }
}
