import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { recommendCoursesForAcCandidate } from "@/lib/recommender/courses";
import { VIFM_VERTICAL_LABELS } from "@/types/database";
import type {
  ReportData,
  ReportCompetencyData,
  ReportRecommendedCourse,
  TechnicalCertLine,
} from "./report-types";
import type { VifmVertical } from "@/types/database";

export async function fetchReportData(
  engagementId: string,
  candidateId: string
): Promise<ReportData> {
  const supabase = await createClient();

  // Kick off the paginated observations read concurrently with the parallel
  // batch below (it depends on none of them). A heavily-observed candidate (many
  // exercises x assessors x behaviours) can exceed the 1000-row cap, which would
  // silently drop recorded evidence from the report.
  type ObsRow = {
    competency_id: string;
    behavior_observed: string;
    is_positive: boolean | null;
    assessor_assignments: { exercises: { name: string } | null } | null;
  };
  const observationsPromise = fetchAllPages<ObsRow>((from, to) =>
    supabase
      .from("observations")
      .select("id, competency_id, behavior_observed, is_positive, assessor_assignments!inner(engagement_id, candidate_id, exercises(name))")
      .eq("assessor_assignments.engagement_id", engagementId)
      .eq("assessor_assignments.candidate_id", candidateId)
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: ObsRow[] | null; error: { message: string } | null }>
  ).catch(() => [] as ObsRow[]);

  const [engResult, candResult, compResult, consensusResult, oarResult, ratingsResult, devRecResult, assessorResult, exercisesResult, indicatorsResult] =
    await Promise.all([
      supabase.from("engagements").select("name, target_role, start_date, end_date, organizations(name)").eq("id", engagementId).single(),
      supabase.from("candidates").select("full_name, email").eq("id", candidateId).single(),
      supabase.from("engagement_competencies").select("competency_id, weight, competencies(id, name, competency_clusters(name, competency_domains(name)))").eq("engagement_id", engagementId),
      supabase.from("consensus_ratings").select("competency_id, final_score, discussion_notes").eq("engagement_id", engagementId).eq("candidate_id", candidateId),
      supabase.from("overall_assessment_ratings").select("overall_score, recommendation, summary").eq("engagement_id", engagementId).eq("candidate_id", candidateId).maybeSingle(),
      supabase.from("ratings").select("competency_id, score, assessor_assignments!inner(engagement_id, candidate_id, exercises(name))").eq("assessor_assignments.engagement_id", engagementId).eq("assessor_assignments.candidate_id", candidateId),
      supabase.from("development_recommendations").select("competency_id, recommendation, priority, competencies(name)").eq("engagement_id", engagementId).eq("candidate_id", candidateId),
      supabase.from("assessor_assignments").select("profiles(full_name)").eq("engagement_id", engagementId).eq("candidate_id", candidateId),
      supabase.from("engagement_exercises").select("exercises(name, exercise_type, duration_minutes)").eq("engagement_id", engagementId),
      supabase.from("behavioral_indicators").select("competency_id, indicator_type, description"),
    ]);

  if (engResult.error || !engResult.data) {
    throw new Error(`Engagement not found: ${engagementId}`);
  }
  if (candResult.error || !candResult.data) {
    throw new Error(`Candidate not found: ${candidateId}`);
  }

  const observations = await observationsPromise;
  const eng = engResult.data;
  const cand = candResult.data;
  const orgName = eng.organizations && typeof eng.organizations === "object" && "name" in eng.organizations
    ? (eng.organizations as { name: string }).name : "Unknown";

  // Exercises used
  const exercisesUsed = (exercisesResult.data ?? []).map((ee) => {
    const ex = ee.exercises as unknown as { name: string; exercise_type: string; duration_minutes: number | null };
    return { name: ex?.name ?? "", type: ex?.exercise_type ?? "", durationMinutes: ex?.duration_minutes ?? null };
  }).filter((e) => e.name);

  // Build development tips lookup from behavioral indicators
  // Tips are tagged with [DEV TIP] prefix; fall back to negative indicators
  const devTipsMap = new Map<string, string[]>();
  for (const ind of indicatorsResult.data ?? []) {
    const desc = ind.description as string;
    if (desc.startsWith("[DEV TIP] ")) {
      if (!devTipsMap.has(ind.competency_id)) devTipsMap.set(ind.competency_id, []);
      devTipsMap.get(ind.competency_id)!.push(desc.replace("[DEV TIP] ", ""));
    }
  }
  // For competencies without [DEV TIP] entries, reframe negative indicators as constructive development areas
  const compsWithTips = new Set(devTipsMap.keys());
  for (const ind of indicatorsResult.data ?? []) {
    if (ind.indicator_type === "negative" && !compsWithTips.has(ind.competency_id)) {
      if (!devTipsMap.has(ind.competency_id)) devTipsMap.set(ind.competency_id, []);
      const desc = ind.description as string;
      const reframed = desc.startsWith("Fails to") || desc.startsWith("Does not") || desc.startsWith("Ignores")
        ? `Focus on: ${desc.charAt(0).toLowerCase()}${desc.slice(1)}`
        : `Development area: ${desc}`;
      devTipsMap.get(ind.competency_id)!.push(reframed);
    }
  }

  // Build competency details
  const competencies: ReportCompetencyData[] = (compResult.data ?? []).map((ec) => {
    const comp = ec.competencies as unknown as {
      id: string; name: string;
      competency_clusters: { name: string; competency_domains: { name: string } };
    };
    const compId = ec.competency_id;

    const consensus = (consensusResult.data ?? []).find((c) => c.competency_id === compId);

    // Split observations into strengths and development areas
    const allObs = observations.filter((o) => o.competency_id === compId);
    const strengths = allObs
      .filter((o) => o.is_positive === true)
      .map((o) => {
        const a = o.assessor_assignments as unknown as { exercises: { name: string } };
        return { exerciseName: a?.exercises?.name ?? "Exercise", text: o.behavior_observed };
      });
    const developmentAreas = allObs
      .filter((o) => o.is_positive === false)
      .map((o) => {
        const a = o.assessor_assignments as unknown as { exercises: { name: string } };
        return { exerciseName: a?.exercises?.name ?? "Exercise", text: o.behavior_observed };
      });

    const exerciseRatings = (ratingsResult.data ?? [])
      .filter((r) => r.competency_id === compId)
      .map((r) => {
        const a = r.assessor_assignments as unknown as { exercises: { name: string } };
        return { exerciseName: a?.exercises?.name ?? "Exercise", score: r.score };
      });

    return {
      competencyName: comp?.name ?? "Unknown",
      clusterName: comp?.competency_clusters?.name ?? "",
      domainName: comp?.competency_clusters?.competency_domains?.name ?? "",
      weight: ec.weight,
      consensusScore: consensus?.final_score ?? null,
      strengths,
      developmentAreas,
      exerciseRatings,
      developmentTips: devTipsMap.get(compId) ?? [],
    };
  });

  // Sort competencies by domain → cluster name for professional grouping
  competencies.sort((a, b) => {
    if (a.domainName !== b.domainName) return a.domainName.localeCompare(b.domainName);
    if (a.clusterName !== b.clusterName) return a.clusterName.localeCompare(b.clusterName);
    return a.competencyName.localeCompare(b.competencyName);
  });

  // Top strengths and development areas (by score)
  const sorted = [...competencies].sort((a, b) => (b.consensusScore ?? 0) - (a.consensusScore ?? 0));
  const topStrengths = sorted.filter((c) => (c.consensusScore ?? 0) >= 4).slice(0, 3).map((c) => c.competencyName);
  const topDevelopmentAreas = sorted.filter((c) => (c.consensusScore ?? 0) > 0 && (c.consensusScore ?? 0) <= 2)
    .map((c) => c.competencyName);
  // If no low scores, take bottom 2
  if (topDevelopmentAreas.length === 0) {
    const bottom = [...sorted].reverse().slice(0, 2);
    topDevelopmentAreas.push(...bottom.map((c) => c.competencyName));
  }

  // Assessor names
  const assessorNameSet = new Set<string>();
  for (const a of assessorResult.data ?? []) {
    const p = a.profiles as unknown as { full_name: string } | null;
    if (p?.full_name) assessorNameSet.add(p.full_name);
  }

  let developmentRecommendations = (devRecResult.data ?? []).map((dr) => {
    const comp = dr.competencies as unknown as { name: string } | null;
    return { competencyName: comp?.name ?? "Unknown", recommendation: dr.recommendation, priority: dr.priority as string };
  });

  // No formal recommendations recorded for this candidate? Derive a development
  // plan from the below-target competencies (consensus below Strength) + their
  // development tips, so the report always offers concrete next steps. Fully
  // deterministic - needs no AI key, works on every environment.
  if (developmentRecommendations.length === 0) {
    developmentRecommendations = competencies
      .filter((c) => c.consensusScore != null && c.consensusScore < 4)
      .sort((a, b) => (a.consensusScore ?? 0) - (b.consensusScore ?? 0))
      .slice(0, 6)
      .map((c) => {
        const score = c.consensusScore ?? 0;
        const priority = score <= 2 ? "high" : score <= 3 ? "medium" : "low";
        const tip = c.developmentTips[0];
        const recommendation = tip
          ? `Strengthen ${c.competencyName} (currently ${score}/5, target 4): ${tip}`
          : `Strengthen ${c.competencyName} (currently ${score}/5, target 4) through coaching, targeted learning, and an on-the-job stretch assignment (70-20-10).`;
        return { competencyName: c.competencyName, recommendation, priority };
      });
  }

  const formatDate = (d: string | null) => {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return d; }
  };
  const startDate = formatDate(eng.start_date);
  const endDate = formatDate(eng.end_date);

  // Day 3f - VIFM training-course recommendations. Catches and swallows
  // errors so the rest of the report still generates if the recommender
  // tables don't exist on a given env or if the catalogue is empty.
  let recommendedCourses: ReportRecommendedCourse[] = [];
  try {
    const raw = await recommendCoursesForAcCandidate({
      engagementId,
      candidateId,
      limit: 5, // top 5 fits cleanly on one PDF page
    });
    recommendedCourses = raw.map((c) => ({
      course_id: c.course_id,
      code: c.course_code,
      title_en: c.title_en,
      title_ar: c.title_ar,
      vertical: VIFM_VERTICAL_LABELS[c.vertical as VifmVertical] ?? c.vertical,
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
        rationale: d.rationale,
      })),
    }));
  } catch (e) {
    console.error("[fetch-report-data] recommender failed (non-fatal):", e);
  }

  // Certified technical domains for this candidate on the engagement. Admin-only
  // data → service client. Non-fatal: the rest of the report still renders.
  let technicalCertifications: TechnicalCertLine[] = [];
  try {
    const svc = createServiceClient();
    const { data: techRows } = await svc
      .from("tech_assessment_results")
      .select("domain_key, level, credential_code, created_at")
      .eq("engagement_id", engagementId)
      .eq("candidate_id", candidateId)
      .eq("certified", true)
      .eq("passed_cut", true)
      .order("created_at", { ascending: false });
    const rows = (techRows ?? []) as {
      domain_key: string;
      level: number | null;
      credential_code: string | null;
    }[];
    if (rows.length > 0) {
      const { data: domRows } = await svc.from("technical_domains").select("key, name_en, name_ar");
      const nameByKey = new Map(
        ((domRows ?? []) as { key: string; name_en: string; name_ar: string | null }[]).map((d) => [
          d.key,
          { en: d.name_en, ar: d.name_ar },
        ])
      );
      const seen = new Set<string>();
      for (const r of rows) {
        if (seen.has(r.domain_key)) continue; // latest per domain (rows are newest-first)
        seen.add(r.domain_key);
        const nm = nameByKey.get(r.domain_key);
        technicalCertifications.push({
          domainNameEn: nm?.en ?? r.domain_key,
          domainNameAr: nm?.ar ?? null,
          level: r.level,
          credentialCode: r.credential_code,
        });
      }
    }
  } catch (e) {
    console.error("[fetch-report-data] tech certs failed (non-fatal):", e);
  }

  return {
    engagementName: eng.name,
    organizationName: orgName,
    targetRole: eng.target_role,
    assessmentDates: startDate && endDate ? `${startDate} to ${endDate}` : startDate || endDate || "",
    exercisesUsed,
    candidateName: cand.full_name,
    candidateEmail: cand.email,
    competencies,
    topStrengths,
    topDevelopmentAreas,
    overallScore: oarResult.data?.overall_score ?? null,
    recommendation: oarResult.data?.recommendation ?? null,
    executiveSummary: oarResult.data?.summary ?? null,
    developmentRecommendations,
    generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    assessorNames: Array.from(assessorNameSet),
    // Data-quality signals (drive the report caveat banner). hasAssessorData is
    // false when no observations/ratings back the scores; raterCount is the
    // number of distinct assessors on this candidate (1 = single-rater).
    hasAssessorData: observations.length > 0 || (ratingsResult.data ?? []).length > 0,
    raterCount: assessorNameSet.size,
    recommendedCourses,
    technicalCertifications,
  };
}
