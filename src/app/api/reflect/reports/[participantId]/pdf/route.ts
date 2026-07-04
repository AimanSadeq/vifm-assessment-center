import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser, selfOrigin } from "@/lib/reports/pdf-browser";
import { createServiceClient } from "@/lib/supabase/server";
import { computeParticipantScoring } from "@/lib/reflect/scoring";
import { guardReflectEngagementAccess } from "@/lib/reflect/report-access";
import { issueReflect360Credential } from "@/lib/reflect/credential";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function launchBrowser(): Promise<Browser> {
  return launchPdfBrowser({ defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 } });
}

/**
 * GET /api/reflect/reports/[participantId]/pdf?language=en|ar|bilingual
 *
 * Renders the SSR report page at /reflect/consultant/participants/[id]/report?bare=1&lang=<language>
 * in headless Chromium, outputs PDF, and persists a row in reflect_reports.
 *
 * Auth: admin or the owning consultant only (guardReflectEngagementAccess),
 * resolved from the participant's engagement. Mirrors the ARA PDF route.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await params;

  const url = new URL(req.url);
  const langRaw = url.searchParams.get("language") ?? "en";
  const language: "en" | "ar" | "bilingual" =
    langRaw === "ar" ? "ar" : langRaw === "bilingual" ? "bilingual" : "en";
  const reportUrl = `${selfOrigin(req.url)}/reflect/consultant/participants/${participantId}/report?bare=1&lang=${language}`;

  // Authorise BEFORE any scoring work: resolve the participant's engagement
  // cheaply and gate on it, so a non-owner can't use the 404-vs-403 ordering (or
  // the scoring compute) as an existence oracle. A missing participant and an
  // unauthorised one both resolve to the guard's uniform 403.
  const sbGuard = createServiceClient();
  const { data: part } = await sbGuard
    .from("reflect_participants")
    .select("engagement_id")
    .eq("id", participantId)
    .maybeSingle<{ engagement_id: string | null }>();
  const denied = await guardReflectEngagementAccess(part?.engagement_id ?? "");
  if (denied) return denied;

  // Owner-authorised past this point; now compute + persist the snapshot.
  const scoring = await computeParticipantScoring(participantId);
  if (!scoring) {
    return NextResponse.json({ ok: false, error: "Participant not found" }, { status: 404 });
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    // The report page is now access-gated; forward the (already-authorised)
    // requester's session cookies so the SSR render authorises as the owner.
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 60_000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    const sb = createServiceClient();
    await sb.from("reflect_reports").insert({
      engagement_id: scoring.engagement_id,
      participant_id: scoring.participant_id,
      report_kind: "participant",
      language,
      file_url: null,
      scores_snapshot: scoring,
      version: 1,
    });

    // Issue the verifiable Reflect 360 completion credential (best-effort,
    // idempotent; no-ops until migration 00107 is applied).
    await issueReflect360Credential(scoring.participant_id);

    const filename = `reflect-${scoring.participant_name.replace(/[^a-zA-Z0-9]+/g, "_")}-${language}.pdf`;
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[reflect pdf]", err);
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
