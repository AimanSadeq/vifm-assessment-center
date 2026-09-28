import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser, selfOrigin, gotoInternalReportPage } from "@/lib/reports/pdf-browser";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Launch Chromium via the shared launcher (see src/lib/reports/pdf-browser.ts):
 * bundled puppeteer Chromium in dev, @sparticuz/chromium in production. Render
 * does not persist puppeteer's HOME Chromium cache between build and runtime,
 * so the bundled binary is missing in prod and every PDF route 500s with
 * "Could not find Chrome"; @sparticuz ships its Chromium inside node_modules.
 * Arabic shaping is unaffected - the HTML loads the Noto Naskh webfont and
 * waits for fonts.ready, so HarfBuzz shapes from the loaded font, not system
 * fonts.
 */
async function launchBrowser(): Promise<Browser> {
  return launchPdfBrowser({ defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 } });
}

/**
 * GET /api/ara/reports/[assessmentId]/pdf?language=en|ar|bilingual
 *
 * Renders the SSR report page at /ara/consultant/assessments/[id]/report?bare=1&lang=<language>
 * in headless Chromium, outputs PDF, and persists a row in ara_reports.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { assessmentId: string } }
) {
  // Authorize: admin or the assessment's owning consultant can generate.
  // Prevents a consultant from guessing another consultant's assessment
  // UUID and generating a PDF of it.
  let caller: Awaited<ReturnType<typeof requireAssessmentOwner>>;
  try {
    caller = await requireAssessmentOwner(params.assessmentId);
  } catch (err) {
    if (isAuthorizationError(err)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const langRaw = url.searchParams.get("language") ?? "en";
  const language: "en" | "ar" | "bilingual" =
    langRaw === "ar" ? "ar" : langRaw === "bilingual" ? "bilingual" : "en";
  const reportUrl =
    `${selfOrigin(req.url)}/ara/consultant/assessments/${params.assessmentId}/report?bare=1&lang=${language}`;

  let browser: Browser | null = null;
  try {
    try {
      browser = await launchBrowser();
    } catch (launchErr) {
      // Chromium launch failure (e.g. @sparticuz/chromium missing or
      // version-mismatched in production) is a transient/infra problem, not a
      // bad request. Return 503 with a clear retry message so the consultant
      // knows the renderer is down - not that the assessment is broken.
      console.error("[ara pdf] browser launch failed", launchErr);
      return NextResponse.json(
        { ok: false, error: "The PDF renderer is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    // The report page sits under the access-gated /ara/consultant layout; forward
    // the (already-authorised) requester's session cookies so the SSR render
    // authorises as the owner. Additionally send the server-only x-ara-internal
    // header: this route has ALREADY authorized the caller via
    // requireAssessmentOwner - which also admits a portal client_manager for
    // their own org's assessment - but the consultant layout 404s that role,
    // so the delivered "PDF" was a print of the 404 page.
    // The shared helper forwards the requester's cookie + the server-only
    // x-ara-internal secret to same-origin requests (so a cross-origin asset
    // can never receive the secret - exact-origin match, not a prefix), and
    // verifies the render landed on the report page rather than a middleware
    // redirect to /portal or /login (a 302 chain resolves to a 200 on the
    // wrong page, so a plain status check would ship the wrong document).
    const nav = await gotoInternalReportPage(page, reportUrl, {
      cookie: req.headers.get("cookie"),
      internalSecret: process.env.CRON_SECRET,
    });
    if (!nav.ok) {
      console.error(`[ara pdf] render failed for ${params.assessmentId}: ${nav.reason} (status ${nav.status}, landed ${nav.landedPath})`);
      return NextResponse.json(
        { ok: false, error: "The report page could not be rendered for this assessment. Please contact VIFM if this persists." },
        { status: 502 }
      );
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    // PDF-07/43: keep what was delivered. Each generation gets the next
    // version number for its assessment + language, the exact PDF is stored
    // in the private ara-reports bucket (file_url = storage path, signed at
    // download), and the scores it printed are snapshotted, so VIFM can show
    // later precisely which report a client received. Best-effort: a storage
    // failure still streams the PDF and logs the row with file_url null.
    // Reports are business records retained after an assessment is purged
    // (migration 00010), so the files are not removed by the retention sweep.
    const sb = createServiceClient();
    const { data: assessment } = await sb
      .from("ara_assessments")
      .select("id")
      .eq("id", params.assessmentId)
      .maybeSingle<{ id: string }>();
    if (assessment) {
      await recordReportVersion(sb, assessment.id, language, pdf, caller.isDev ? null : caller.uid);
    }

    const filename = `ara-report-${params.assessmentId.slice(0, 8)}-${language}.pdf`;
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[ara pdf]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

const REPORTS_BUCKET = "ara-reports";

async function recordReportVersion(
  sb: ReturnType<typeof createServiceClient>,
  assessmentId: string,
  language: "en" | "ar" | "bilingual",
  pdf: Uint8Array,
  generatedBy: string | null,
): Promise<void> {
  try {
    const [{ data: prev }, { data: overall }, { data: pillars }] = await Promise.all([
      sb.from("ara_reports").select("version").eq("assessment_id", assessmentId).eq("language", language)
        .order("version", { ascending: false }).limit(1),
      sb.from("ara_assessment_scores").select("overall_score, overall_label_en, calculated_at")
        .eq("assessment_id", assessmentId).maybeSingle(),
      sb.from("ara_pillar_scores").select("pillar_id, raw_score, maturity_level, pillar_weight")
        .eq("assessment_id", assessmentId),
    ]);
    const version = ((prev?.[0] as { version?: number } | undefined)?.version ?? 0) + 1;
    const path = `${assessmentId}/${language}/v${version}-${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage
      .from(REPORTS_BUCKET)
      .upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (upErr) console.error("[ara pdf] storing the report failed:", upErr.message);
    const row = {
      assessment_id: assessmentId,
      language,
      file_url: upErr ? null : path,
      version,
      scores_snapshot: { overall, pillars: pillars ?? [] },
    };
    const { error } = await sb.from("ara_reports").insert({ ...row, generated_by: generatedBy });
    // generated_by references auth.users; retry without it rather than lose the record.
    if (error) await sb.from("ara_reports").insert(row);
  } catch (e) {
    console.error("[ara pdf] report version record failed:", e);
  }
}
