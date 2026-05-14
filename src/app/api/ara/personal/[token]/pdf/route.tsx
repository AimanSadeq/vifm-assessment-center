import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
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

    const data: PersonalSnapshotData = {
      respondentName: ctx.respondent.name,
      respondentEmail: ctx.respondent.email,
      language: ctx.respondent.language_preference ?? "en",
      generatedAt: new Date().toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      }),
      overallScore,
      factorScores,
      recommendedCourses: raw.map((c) => ({
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
      })),
    };

    const buffer = await renderToBuffer(<PersonalSnapshot data={data} />);

    const safeName = ctx.respondent.name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");
    const filename = `VIFM_Personal_AI_Snapshot_${safeName}.pdf`;

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

