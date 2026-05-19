import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer";
import { createServiceClient } from "@/lib/supabase/server";
import { computeParticipantScoring } from "@/lib/reflect/scoring";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Browser;
}

/**
 * GET /api/reflect/reports/[participantId]/pdf?language=en|ar|bilingual
 *
 * Renders the SSR report page at /reflect/consultant/participants/[id]/report?bare=1&lang=<language>
 * in headless Chromium, outputs PDF, and persists a row in reflect_reports.
 *
 * No auth guard yet — for M4 we keep this endpoint open to whoever has
 * the link. When AUTH_ENABLED flips on, this should require the
 * engagement consultant or admin (mirrors the ARA PDF route).
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
  const reportUrl = `${url.origin}/reflect/consultant/participants/${participantId}/report?bare=1&lang=${language}`;

  // Compute scoring first so we can persist the snapshot alongside the file.
  const scoring = await computeParticipantScoring(participantId);
  if (!scoring) {
    return NextResponse.json({ ok: false, error: "Participant not found" }, { status: 404 });
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
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
