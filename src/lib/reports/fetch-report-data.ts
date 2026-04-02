import { createClient } from "@/lib/supabase/server";
import type { ReportData, ReportCompetencyData } from "./report-types";

export async function fetchReportData(
  engagementId: string,
  candidateId: string
): Promise<ReportData> {
  const supabase = await createClient();

  const [engResult, candResult, compResult, consensusResult, oarResult, obsResult, ratingsResult, devRecResult, assessorResult, exercisesResult, indicatorsResult] =
    await Promise.all([
      supabase.from("engagements").select("name, target_role, start_date, end_date, organizations(name)").eq("id", engagementId).single(),
      supabase.from("candidates").select("full_name, email").eq("id", candidateId).single(),
      supabase.from("engagement_competencies").select("competency_id, weight, competencies(id, name, competency_clusters(name, competency_domains(name)))").eq("engagement_id", engagementId),
      supabase.from("consensus_ratings").select("competency_id, final_score, discussion_notes").eq("engagement_id", engagementId).eq("candidate_id", candidateId),
      supabase.from("overall_assessment_ratings").select("overall_score, recommendation, summary").eq("engagement_id", engagementId).eq("candidate_id", candidateId).maybeSingle(),
      supabase.from("observations").select("competency_id, behavior_observed, is_positive, assessor_assignments!inner(engagement_id, candidate_id, exercises(name))").eq("assessor_assignments.engagement_id", engagementId).eq("assessor_assignments.candidate_id", candidateId),
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
    const allObs = (obsResult.data ?? []).filter((o) => o.competency_id === compId);
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

  const developmentRecommendations = (devRecResult.data ?? []).map((dr) => {
    const comp = dr.competencies as unknown as { name: string } | null;
    return { competencyName: comp?.name ?? "Unknown", recommendation: dr.recommendation, priority: dr.priority };
  });

  const formatDate = (d: string | null) => {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return d; }
  };
  const startDate = formatDate(eng.start_date);
  const endDate = formatDate(eng.end_date);

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
  };
}
