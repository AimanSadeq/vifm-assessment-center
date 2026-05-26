/**
 * AI Upskilling Pathways - generation endpoint (ARA assessment context).
 *
 * POST /api/ara/pathway  { assessmentId, language }
 *   -> UpskillingPathway (AI-sequenced stages from the assessment's pillar
 *      maturity gaps + the VIFM course recommender) + course catalogue.
 *
 * Reuses recommendCoursesForAraAssessment so the pathway is built from the
 * same pillar-gap → course ranking surfaced on the Phase 2 tab; this route
 * only adds the sequencing/narration layer. Runs under the consultant
 * session (RLS-scoped). Stateless (generate-on-demand).
 */

import { NextResponse } from "next/server";
import { recommendCoursesForAraAssessment } from "@/lib/recommender/courses";
import {
  generateUpskillingPathway,
  type PathwayLanguage,
  type PathwayCourseInput,
} from "@/lib/ai/upskilling-pathways";

export const dynamic = "force-dynamic";

type Body = { assessmentId?: string; language?: PathwayLanguage };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const assessmentId = body.assessmentId;
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }
  const language: PathwayLanguage = body.language === "ar" ? "ar" : "en";

  const recs = await recommendCoursesForAraAssessment({ assessmentId, limit: 8 });

  const courses: PathwayCourseInput[] = recs.map((r) => ({
    code: r.course_code,
    title_en: r.title_en,
    title_ar: r.title_ar,
    level: String(r.level),
    duration_days: r.default_duration_days,
    drivers: r.drivers.map((d) => ({ label: d.label, gap: d.gap, relevance: d.relevance })),
  }));

  const pathway = await generateUpskillingPathway({ language, source: "ara", courses });

  return NextResponse.json({
    ...pathway,
    courses: recs.map((r) => ({ code: r.course_code, title_en: r.title_en, title_ar: r.title_ar })),
  });
}
