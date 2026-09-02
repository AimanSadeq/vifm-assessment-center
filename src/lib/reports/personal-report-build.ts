import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { createServiceClient } from "@/lib/supabase/server";
import { loadRespondentByToken, loadQuestionsForRespondent } from "@/lib/ara/respondent-access";
import { araRespondentProvisional } from "@/lib/ara/provisional";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  validateTalentLens,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { recommendCoursesForIndividualSnapshot } from "@/lib/recommender/courses";
import { buildPersonalAnalysis, buildDevelopmentAnalysis } from "@/lib/ara/personal-analysis";
import {
  renderPersonalReportHtml,
  type PersonalReportData,
  type CohortComparison,
  type FactorSubScores,
  type Lang,
} from "@/lib/reports/personal-report-html";

const TARGET = 4;

/**
 * Builds the personal AI-readiness report PDF for one respondent.
 *
 * ONE code path for every caller - the token PDF route and the public sample
 * route both come through here, so what a prospect opens as a sample is
 * byte-for-byte what a real respondent's report looks like. Authorisation is
 * the CALLER's job (this module trusts the token it is given); it does the
 * eligibility and completion checks that apply regardless of who asks.
 */
export type BuildPersonalReportResult =
  | { ok: true; pdf: Buffer; filename: string }
  | { ok: false; status: number; error: string };

export async function buildPersonalReportPdf(opts: {
  token: string;
  lang?: string | null;
  /** View-only lens override (?present=), never changes the stored sitting. */
  present?: string | null;
}): Promise<BuildPersonalReportResult> {
  const ctx = await loadRespondentByToken(opts.token);
  if (!ctx) return { ok: false, status: 404, error: "Token not found" };

  const isPersonalEligible =
    ctx.assessment.engagement_stage === "individual" || !!ctx.assessment.include_individual_layer;
  if (!isPersonalEligible) {
    return { ok: false, status: 400, error: "This report is for personal-readiness sittings only." };
  }
  if (!ctx.respondent.completed_at) {
    return { ok: false, status: 400, error: "Snapshot is not complete yet - finish the assessment first." };
  }

  const sb = createServiceClient();
  const questions = await loadQuestionsForRespondent(ctx);
  const { data: answers } = await sb
    .from("ara_responses")
    .select("question_id, answer_value")
    .eq("respondent_id", ctx.respondent.id);
  const answerByQuestionId = new Map((answers ?? []).map((a) => [a.question_id as string, a.answer_value]));

  // Per factor, and per factor split by item kind: the self-rating (Likert)
  // items versus the scenario/knowledge items the deep-dive adds. That split
  // is the report's "sub-score" - a real, coded distinction, not an invented
  // sub-dimension.
  type Acc = { sum: number; n: number };
  const mk = (): Acc => ({ sum: 0, n: 0 });
  const total: Record<AraIndividualFactorId, Acc> = { thinking_sense_check: mk(), results_working_practice: mk(), people_collaboration: mk(), self_adaptive_mindset: mk() };
  const self: Record<AraIndividualFactorId, Acc> = { thinking_sense_check: mk(), results_working_practice: mk(), people_collaboration: mk(), self_adaptive_mindset: mk() };
  const demo: Record<AraIndividualFactorId, Acc> = { thinking_sense_check: mk(), results_working_practice: mk(), people_collaboration: mk(), self_adaptive_mindset: mk() };
  let selfSum = 0, selfCount = 0, objSum = 0, objCount = 0;
  for (const q of questions) {
    const factorId = q.individual_factor_id as AraIndividualFactorId | null;
    if (!factorId) continue;
    const numeric = calculateQuestionScore(q.question_type, answerByQuestionId.get(q.id) ?? null, q.score_map);
    if (numeric == null) continue;
    total[factorId].sum += numeric; total[factorId].n += 1;
    if (q.question_type === "rating") {
      self[factorId].sum += numeric; self[factorId].n += 1; selfSum += numeric; selfCount += 1;
    } else {
      demo[factorId].sum += numeric; demo[factorId].n += 1; objSum += numeric; objCount += 1;
    }
  }
  const mean = (a: Acc) => (a.n > 0 ? a.sum / a.n : null);
  const factorScores = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number>>((acc, id) => {
    acc[id] = mean(total[id]) ?? 0; return acc;
  }, {} as Record<AraIndividualFactorId, number>);
  const subScores = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, FactorSubScores>>((acc, id) => {
    acc[id] = { self: mean(self[id]), demonstrated: mean(demo[id]) }; return acc;
  }, {} as Record<AraIndividualFactorId, FactorSubScores>);
  const scored = ARA_INDIVIDUAL_FACTOR_IDS.map((id) => factorScores[id]).filter((v) => v > 0);
  const overallScore = scored.length ? scored.reduce((s, v) => s + v, 0) / scored.length : 0;

  const presentOverride = validateTalentLens(opts.present ?? null);
  const talentLens = presentOverride ?? validateTalentLens(ctx.assessment.talent_lens);
  const analysisArgs = {
    factorScores, overallScore,
    selfAvg: selfCount > 0 ? selfSum / selfCount : 0,
    objectiveAvg: objCount > 0 ? objSum / objCount : 0,
    objectiveCount: objCount,
  };
  const analysis = talentLens === "acquisition" ? buildPersonalAnalysis(analysisArgs) : null;
  const devAnalysis = talentLens !== "acquisition" ? buildDevelopmentAnalysis(analysisArgs) : null;

  const raw = talentLens === "acquisition"
    ? []
    : await recommendCoursesForIndividualSnapshot({ factorScores, target: TARGET, limit: 5 });
  const recommendedCourses = raw.map((c) => ({
    course_id: c.course_id, title_en: c.title_en, title_ar: c.title_ar, code: c.course_code,
    vertical: c.vertical, level: c.level,
    duration_label: c.min_duration_days === c.max_duration_days ? `${c.default_duration_days}d` : `${c.min_duration_days}-${c.max_duration_days}d`,
    total_score: c.total_score,
    drivers: c.drivers.map((d) => ({ label: d.label, label_ar: d.label_ar, gap: d.gap, relevance: d.relevance })),
  }));

  // Comparison. Only meaningful when the sitting was part of a departmental
  // engagement with the individual layer - a standalone snapshot has no cohort
  // and the report says so rather than inventing one.
  const isOrgSitting = ctx.assessment.engagement_stage !== "individual" && !!ctx.assessment.include_individual_layer;
  let unit: CohortComparison | null = null;
  let org: CohortComparison | null = null;
  if (isOrgSitting) {
    const wf = await computeWorkforceReadiness(ctx.assessment.id);
    if (wf && wf.completed_count >= 2) {
      unit = {
        label: ctx.assessment.scope_label?.trim() || "Your unit",
        overall: wf.cohort_overall,
        byFactor: Object.fromEntries(wf.factor_averages.map((f) => [f.factor_id, f.average])),
        respondents: wf.completed_count,
      };
    }
    org = ctx.assessment.organization_id
      ? await computeOrgComparison(ctx.assessment.organization_id, ctx.assessment.organization?.name ?? null)
      : null;
    // If the organisation has only this one unit, the two rows would be the
    // same number twice; keep the more specific one.
    if (org && unit && org.respondents === unit.respondents) org = null;
  }

  const lang: Lang = opts.lang === "ar" ? "ar" : opts.lang === "en" ? "en" : (ctx.respondent.language_preference === "ar" ? "ar" : "en");
  const generatedAt = new Date().toLocaleDateString(lang === "ar" ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const provisional = (await araRespondentProvisional(ctx.respondent.id)).provisional;

  const data: PersonalReportData = {
    lang,
    respondentName: ctx.respondent.name,
    respondentEmail: ctx.respondent.email,
    roleLabel: (ctx.respondent as { role_label_en?: string | null }).role_label_en ?? null,
    unitLabel: isOrgSitting ? (ctx.assessment.scope_label ?? null) : null,
    parentUnitLabel: isOrgSitting ? ((ctx.assessment as { parent_unit_label?: string | null }).parent_unit_label ?? null) : null,
    orgName: isOrgSitting ? (ctx.assessment.organization?.name ?? null) : null,
    isSample: !!ctx.assessment.is_sandbox,
    generatedAt,
    tier: ctx.assessment.assessment_tier === "deep_dive" ? "deep_dive" : "snapshot",
    overallScore, factorScores, subScores,
    unit, org, talentLens, analysis, devAnalysis, recommendedCourses, provisional,
  };

  const html = renderPersonalReportHtml(data);
  const pdf = await renderHtmlToPdfBuffer(html);
  const safeName = ctx.respondent.name.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") || "Report";
  return { ok: true, pdf, filename: `VIFM_AI_Readiness_Report_${safeName}_${lang}.pdf` };
}

/**
 * Organisation-wide individual-layer averages: every assessment in the org
 * that carried the personal factors, pooled and weighted by the number of
 * people who completed. Capped at the 25 most recent so a long-lived client
 * cannot make the report slow.
 */
async function computeOrgComparison(orgId: string, orgName: string | null): Promise<CohortComparison | null> {
  const sb = createServiceClient();
  const { data: rows } = await sb
    .from("ara_assessments")
    .select("id")
    .eq("organization_id", orgId)
    .neq("engagement_stage", "individual")
    .eq("include_individual_layer", true)
    .order("created_at", { ascending: false })
    .limit(25);
  if (!rows || rows.length === 0) return null;

  const rollups = await Promise.all(rows.map((r) => computeWorkforceReadiness(r.id)));
  const byFactor: Partial<Record<AraIndividualFactorId, { sum: number; n: number }>> = {};
  let overallSum = 0, overallN = 0;
  for (const wf of rollups) {
    if (!wf || wf.completed_count === 0) continue;
    if (wf.cohort_overall != null) { overallSum += wf.cohort_overall * wf.completed_count; overallN += wf.completed_count; }
    for (const f of wf.factor_averages) {
      const acc = byFactor[f.factor_id] ?? { sum: 0, n: 0 };
      acc.sum += f.average * f.respondent_count; acc.n += f.respondent_count;
      byFactor[f.factor_id] = acc;
    }
  }
  if (overallN === 0) return null;
  return {
    label: orgName?.trim() || "Organisation",
    overall: overallSum / overallN,
    byFactor: Object.fromEntries(
      Object.entries(byFactor).map(([k, v]) => [k, v!.n > 0 ? v!.sum / v!.n : 0])
    ) as Partial<Record<AraIndividualFactorId, number>>,
    respondents: overallN,
  };
}

/**
 * Render HTML to PDF through the shared Chromium launcher (bundled puppeteer
 * in dev, @sparticuz/chromium on Render, where puppeteer's HOME cache does not
 * survive the build). Waits for fonts so Arabic glyphs are shaped from the
 * loaded Noto face rather than whatever the Chromium build has on the system.
 */
async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  let browser: Browser;
  try {
    browser = await launchPdfBrowser({ defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 } });
  } catch (launchErr) {
    console.error("[personal report] browser launch failed", launchErr);
    throw new Error("PDF_RENDERER_UNAVAILABLE");
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.evaluate(async () => {
      const f = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (f?.ready) await f.ready;
    });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
