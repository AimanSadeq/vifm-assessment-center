import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import type { Browser } from "puppeteer";
import {
  loadRespondentByToken,
  loadQuestionsForRespondent,
} from "@/lib/ara/respondent-access";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { recommendCoursesForIndividualSnapshot } from "@/lib/recommender/courses";
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
// alone is not enough — it opts the route out of static rendering but
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
 * Personal AI Readiness Snapshot — bilingual mini-report PDF.
 *
 * Auth model: respondent's access token gates the PDF, same as the
 * /ara/respond/[token] page. No user account required.
 *
 * Refuses to generate when the assessment isn't in 'individual' stage
 * (org-side reports go through /api/ara/reports/[id]/pdf instead) or
 * when the respondent hasn't completed yet.
 */
export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const ctx = await loadRespondentByToken(params.token);
    if (!ctx) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    // Same eligibility rule as the results page — Mode A/B individual-stage
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
        { error: "Snapshot is not complete yet — finish the assessment first." },
        { status: 400 }
      );
    }

    const sb = createServiceClient();
    const questions = await loadQuestionsForRespondent(ctx);
    const { data: answers } = await sb
      .from("ara_responses")
      .select("question_id, answer_value")
      .eq("respondent_id", ctx.respondent.id);

    // Compute per-factor average — mirrors the results-page logic.
    const factorTotals: Record<AraIndividualFactorId, { sum: number; count: number }> = {
      thinking_sense_check: { sum: 0, count: 0 },
      results_working_practice: { sum: 0, count: 0 },
      people_collaboration: { sum: 0, count: 0 },
      self_adaptive_mindset: { sum: 0, count: 0 },
    };
    const answerByQuestionId = new Map(
      (answers ?? []).map((a) => [a.question_id as string, a.answer_value])
    );
    for (const q of questions) {
      const factorId = q.individual_factor_id as AraIndividualFactorId | null;
      if (!factorId) continue;
      const ans = answerByQuestionId.get(q.id);
      const numeric = calculateQuestionScore(q.question_type, ans ?? null, q.score_map);
      if (numeric != null) {
        factorTotals[factorId].sum += numeric;
        factorTotals[factorId].count += 1;
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
    const overallScore =
      Object.values(factorScores).reduce((s, v) => s + v, 0) /
      ARA_INDIVIDUAL_FACTOR_IDS.length;

    // Recommendations.
    const raw = await recommendCoursesForIndividualSnapshot({
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
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Launch Chromium, render the HTML to PDF, and clean up. Mirrors the
 * pattern in /api/ara/reports/[id]/pdf — bundled puppeteer Chromium
 * (not @sparticuz/chromium) because Render runs in full Linux
 * containers and the bundled build has the Arabic font fallbacks
 * the stripped Lambda build lacks. waitUntil:'networkidle0' lets
 * the Google Fonts stylesheet for Noto Naskh Arabic finish loading
 * before we capture; without that the Arabic falls back to a
 * generic sans-serif and the diacritics get clipped.
 */
async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const puppeteer = (await import("puppeteer")).default;
  const browser: Browser = (await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })) as unknown as Browser;
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

