import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import {
  loadRespondentByToken,
  loadQuestionsForRespondent,
} from "@/lib/ara/respondent-access";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import { timingSafeStrEqual } from "@/lib/utils/secret";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  validateTalentLens,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { recommendCoursesForIndividualSnapshot } from "@/lib/recommender/courses";
import { buildPersonalAnalysis, buildDevelopmentAnalysis } from "@/lib/ara/personal-analysis";
import {
  PersonalSnapshot,
  type PersonalSnapshotData,
} from "@/lib/reports/personal-snapshot";
import {
  renderPersonalSnapshotHtmlAr,
  type PersonalSnapshotArData,
} from "@/lib/reports/personal-snapshot-ar-html";

// Puppeteer is required for the Arabic path (React-PDF cannot shape
// Arabic glyphs). The Node runtime is required because Puppeteer
// can't run on the Edge runtime.
export const runtime = "nodejs";

// Without these, Next.js production builds cache fetches inside route
// handlers and reuse the stale "not complete yet" 400 from a request
// that hit the endpoint before the respondent finished. `force-dynamic`
// alone is not enough - it opts the route out of static rendering but
// doesn't disable fetch-level caching for libraries (the Supabase client
// here) that go through Next.js's patched global fetch. `fetchCache =
// "force-no-store"` plugs that hole, and `revalidate = 0` is explicit
// belt-and-suspenders so future Next.js versions don't introduce a
// default revalidation window.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const TARGET = 4;

/**
 * Personal AI Readiness Snapshot - bilingual mini-report PDF.
 *
 * Auth model: respondent's access token gates the PDF, same as the
 * /ara/respond/[token] page. No user account required.
 *
 * Refuses to generate when the assessment isn't in 'individual' stage
 * (org-side reports go through /api/ara/reports/[id]/pdf instead) or
 * when the respondent hasn't completed yet.
 */
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const ctx = await loadRespondentByToken(params.token);
    if (!ctx) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // XP-13: the taker never downloads their own PDF. Allow the internal
    // client-delivery path (server-only CRON_SECRET header, used by the
    // collect-and-send-to-client flow) OR an authenticated VIFM staff member;
    // deny token-only (taker) access.
    const internalKey = request.headers.get("x-ara-internal");
    const isInternal = timingSafeStrEqual(internalKey, process.env.CRON_SECRET);
    const staff = await isStaffCaller();
    if (!isInternal && !staff) {
      return NextResponse.json(
        { error: "Results are not available to the respondent for this assessment." },
        { status: 403 }
      );
    }
    // Same eligibility rule as the results page - Mode A/B individual-stage
    // OR Mode C org-stage with include_individual_layer=true.
    const isPersonalEligible =
      ctx.assessment.engagement_stage === "individual" ||
      !!ctx.assessment.include_individual_layer;
    if (!isPersonalEligible) {
      return NextResponse.json(
        { error: "This endpoint is for personal-readiness snapshots only." },
        { status: 400 }
      );
    }
    if (!ctx.respondent.completed_at) {
      return NextResponse.json(
        { error: "Snapshot is not complete yet - finish the assessment first." },
        { status: 400 }
      );
    }

    const sb = createServiceClient();
    const questions = await loadQuestionsForRespondent(ctx);
    const { data: answers } = await sb
      .from("ara_responses")
      .select("question_id, answer_value")
      .eq("respondent_id", ctx.respondent.id);

    // Compute per-factor average - mirrors the results-page logic.
    const factorTotals: Record<AraIndividualFactorId, { sum: number; count: number }> = {
      thinking_sense_check: { sum: 0, count: 0 },
      results_working_practice: { sum: 0, count: 0 },
      people_collaboration: { sum: 0, count: 0 },
      self_adaptive_mindset: { sum: 0, count: 0 },
    };
    const answerByQuestionId = new Map(
      (answers ?? []).map((a) => [a.question_id as string, a.answer_value])
    );
    // Self-rating vs objective split feeds the selection-analysis calibration
    // read - identical to the results page.
    let selfSum = 0, selfCount = 0, objSum = 0, objCount = 0;
    for (const q of questions) {
      const factorId = q.individual_factor_id as AraIndividualFactorId | null;
      if (!factorId) continue;
      const ans = answerByQuestionId.get(q.id);
      const numeric = calculateQuestionScore(q.question_type, ans ?? null, q.score_map);
      if (numeric != null) {
        factorTotals[factorId].sum += numeric;
        factorTotals[factorId].count += 1;
        if (q.question_type === "rating") { selfSum += numeric; selfCount += 1; }
        else { objSum += numeric; objCount += 1; }
      }
    }
    const factorScores = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number>>(
      (acc, id) => {
        const t = factorTotals[id];
        acc[id] = t.count > 0 ? t.sum / t.count : 0;
        return acc;
      },
      {} as Record<AraIndividualFactorId, number>
    );
    // Overall = mean of factors that actually have answers (exclude unanswered
    // factors, which score 0 and would otherwise drag the overall down).
    const scoredFactors = ARA_INDIVIDUAL_FACTOR_IDS.map((id) => factorScores[id]).filter((v) => v > 0);
    const overallScore =
      scoredFactors.length > 0
        ? scoredFactors.reduce((s, v) => s + v, 0) / scoredFactors.length
        : 0;

    // Talent lens (migration 00134). Drives R4-R7 in both renderers. NULL =
    // generic framing (legacy / anonymous / deep-linked), no regression.
    const talentLens = validateTalentLens(ctx.assessment.talent_lens);

    // Selection-lens analysis - the same deterministic, evidence-grounded read
    // shown on the results page, so the downloaded PDF matches the screen.
    // Acquisition only (mirrors the page); null otherwise so EN/AR renderers
    // simply omit the section.
    const analysis =
      talentLens === "acquisition"
        ? buildPersonalAnalysis({
            factorScores,
            overallScore,
            selfAvg: selfCount > 0 ? selfSum / selfCount : 0,
            objectiveAvg: objCount > 0 ? objSum / objCount : 0,
            objectiveCount: objCount,
          })
        : null;

    // Development (growth) analysis - the development / generic report. Built
    // for any non-acquisition lens so the PDF matches the on-screen report.
    const devAnalysis =
      talentLens !== "acquisition"
        ? buildDevelopmentAnalysis({
            factorScores,
            overallScore,
            selfAvg: selfCount > 0 ? selfSum / selfCount : 0,
            objectiveAvg: objCount > 0 ? objSum / objCount : 0,
            objectiveCount: objCount,
          })
        : null;

    // Recommendations (R5: development-context info). Skip the compute under
    // the acquisition lens; the renderers also omit the course block.
    const raw =
      talentLens === "acquisition"
        ? []
        : await recommendCoursesForIndividualSnapshot({
            factorScores,
            target: TARGET,
            limit: 5,
          });

    // Format-shared course shape (same fields for both renderers).
    const recommendedCourses = raw.map((c) => ({
      course_id: c.course_id,
      title_en: c.title_en,
      title_ar: c.title_ar,
      code: c.course_code,
      vertical: c.vertical,
      level: c.level,
      duration_label:
        c.min_duration_days === c.max_duration_days
          ? `${c.default_duration_days}d`
          : `${c.min_duration_days}–${c.max_duration_days}d`,
      total_score: c.total_score,
      drivers: c.drivers.map((d) => ({
        label: d.label,
        label_ar: d.label_ar,
        gap: d.gap,
        relevance: d.relevance,
      })),
    }));

    const language = ctx.respondent.language_preference ?? "en";
    const safeName = ctx.respondent.name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_") || "Snapshot";
    const filename = `VIFM_Personal_AI_Snapshot_${safeName}_${language}.pdf`;

    // ── Arabic path: Puppeteer renders HTML so Chromium can shape
    //    the Arabic glyphs that React-PDF cannot. The HTML is built
    //    from the same data shape; layout mirrors the EN three-page
    //    template so the two versions feel like the same report.
    if (language === "ar") {
      const generatedAt = new Date().toLocaleDateString("ar-AE", {
        day: "numeric", month: "long", year: "numeric",
      });
      const arData: PersonalSnapshotArData = {
        respondentName: ctx.respondent.name,
        respondentEmail: ctx.respondent.email,
        generatedAt,
        overallScore,
        factorScores,
        recommendedCourses,
        talentLens,
        analysis,
        devAnalysis,
      };
      const html = renderPersonalSnapshotHtmlAr(arData);
      const buffer = await renderHtmlToPdfBuffer(html);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── English path: existing React-PDF renderer. Unchanged.
    const generatedAt = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const data: PersonalSnapshotData = {
      respondentName: ctx.respondent.name,
      respondentEmail: ctx.respondent.email,
      language: "en",
      generatedAt,
      overallScore,
      factorScores,
      recommendedCourses,
      talentLens,
      analysis,
      devAnalysis,
    };
    const buffer = await renderToBuffer(<PersonalSnapshot data={data} />);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Personal snapshot PDF error:", error);
    if (error instanceof Error && error.message === "PDF_RENDERER_UNAVAILABLE") {
      return NextResponse.json(
        { error: "The PDF renderer is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Launch Chromium, render the HTML to PDF, and clean up. Uses the shared
 * launcher (src/lib/reports/pdf-browser.ts): bundled puppeteer Chromium in
 * dev, @sparticuz/chromium in production (Render doesn't persist puppeteer's
 * HOME Chromium cache, so the bundled binary is missing at runtime). Arabic
 * shaping is unaffected: waitUntil:'networkidle0' + fonts.ready below let the
 * Noto Naskh Arabic webfont load before capture, so HarfBuzz shapes from the
 * loaded font rather than relying on the Chromium build's system font set.
 */
async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  let browser: Browser;
  try {
    browser = await launchPdfBrowser({
      defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
    });
  } catch (launchErr) {
    // Surface a Chromium launch failure as a distinct, friendly 503 upstream
    // (see the GET catch) rather than a raw 500. @sparticuz/chromium missing or
    // version-mismatched in production is transient/infra, not a bad request.
    console.error("[ara personal pdf] browser launch failed", launchErr);
    throw new Error("PDF_RENDERER_UNAVAILABLE");
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    // Belt-and-suspenders: explicitly wait for the fonts to be ready
    // so the first paint includes shaped Arabic glyphs. Cheap (a few
    // ms when fonts are already cached) and prevents a class of
    // intermittent "tofu rectangles in the PDF" bugs that only show
    // up under cold-start latency.
    await page.evaluate(async () => {
      const f = (document as any).fonts;
      if (f && typeof f.ready?.then === "function") await f.ready;
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}

