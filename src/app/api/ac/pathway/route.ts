/**
 * AI Upskilling Pathways — generation endpoint (AC candidate context).
 *
 * POST /api/ac/pathway  { candidateId, language }
 *   -> UpskillingPathway (AI-sequenced stages from the candidate's
 *      competency gaps + the VIFM course recommender).
 *
 * Reuses recommendCoursesForAcCandidate so the pathway is built from
 * the same gap → course ranking surfaced elsewhere; this route only
 * adds the sequencing/narration layer. Stateless (generate-on-demand).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recommendCoursesForAcCandidate } from "@/lib/recommender/courses";
import {
  generateUpskillingPathway,
  type PathwayLanguage,
  type PathwayCourseInput,
} from "@/lib/ai/upskilling-pathways";

export const dynamic = "force-dynamic";

type Body = { candidateId?: string; language?: PathwayLanguage };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const candidateId = body.candidateId;
  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }
  const language: PathwayLanguage = body.language === "ar" ? "ar" : "en";

  const sb = await createClient();
  const { data: candidate, error } = await sb
    .from("candidates")
    .select("id, full_name, engagement_id")
    .eq("id", candidateId)
    .single();
  if (error || !candidate) {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }

  // Role-profile target (tolerant of an absent migration/column — defaults to 3).
  let target = 3;
  try {
    const { data: rp } = await sb
      .from("candidates")
      .select("role_profiles(default_target_proficiency)")
      .eq("id", candidateId)
      .single();
    const tp = (rp?.role_profiles as unknown as { default_target_proficiency: number | null } | null)
      ?.default_target_proficiency;
    if (typeof tp === "number") target = tp;
  } catch {
    /* keep default */
  }

  const recs = await recommendCoursesForAcCandidate({
    engagementId: candidate.engagement_id,
    candidateId,
    target,
    limit: 8,
  });

  const courses: PathwayCourseInput[] = recs.map((r) => ({
    code: r.course_code,
    title_en: r.title_en,
    title_ar: r.title_ar,
    level: String(r.level),
    duration_days: r.default_duration_days,
    drivers: r.drivers.map((d) => ({ label: d.label, gap: d.gap, relevance: d.relevance })),
  }));

  const pathway = await generateUpskillingPathway({
    learnerName: candidate.full_name,
    language,
    source: "ac",
    courses,
  });

  // Also return a lightweight catalogue so the client can resolve each
  // stage's course_codes back to a title + a link to /courses/[code].
  return NextResponse.json({
    ...pathway,
    courses: recs.map((r) => ({
      code: r.course_code,
      title_en: r.title_en,
      title_ar: r.title_ar,
    })),
  });
}
