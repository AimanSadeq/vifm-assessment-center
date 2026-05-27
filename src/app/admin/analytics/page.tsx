import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { calculateICC, getICCInterpretation } from "@/lib/scoring/icc";
import { calculateBiasMetrics } from "@/lib/scoring/bias-detection";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const t = await getServerT();

  // Fetch all ratings with assessor and competency info
  const { data: ratings } = await supabase
    .from("ratings")
    .select(
      "score, competency_id, assessor_assignment_id, competencies(name), assessor_assignments(assessor_id, candidate_id, profiles(full_name))"
    );

  const { data: engagements } = await supabase
    .from("engagements")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, full_name, status, engagement_id, department, seniority_level");

  // Get OAR data for candidate comparisons
  const { data: oars } = await supabase
    .from("overall_assessment_ratings")
    .select("candidate_id, overall_score, recommendation");

  // Get consensus ratings for per-candidate competency breakdown
  const { data: consensusRatings } = await supabase
    .from("consensus_ratings")
    .select("candidate_id, competency_id, final_score, competencies(name)");

  // Build ICC matrix: each unique (candidate, competency) is a subject, each assessor is a rater
  const subjectKey = (candidateId: string, competencyId: string) =>
    `${candidateId}:${competencyId}`;

  const subjectRaterMap = new Map<string, Map<string, number>>();
  const assessorSet = new Set<string>();

  for (const r of ratings ?? []) {
    const assignment = r.assessor_assignments as unknown as {
      assessor_id: string;
      candidate_id: string;
    };
    if (!assignment) continue;

    const key = subjectKey(assignment.candidate_id, r.competency_id);
    if (!subjectRaterMap.has(key)) {
      subjectRaterMap.set(key, new Map());
    }
    subjectRaterMap.get(key)!.set(assignment.assessor_id, r.score);
    assessorSet.add(assignment.assessor_id);
  }

  // Build matrix for ICC (only subjects with multiple raters)
  // Build ICC matrix using only raters who actually rated each subject
  // (avoids zero-filter excluding most real-world data)
  const iccMatrix: number[][] = [];
  const activeRaterIds: string[] = [];
  // First pass: find raters who rated at least 2 subjects
  const raterSubjectCount = new Map<string, number>();
  for (const raters of Array.from(subjectRaterMap.values())) {
    for (const [aid] of Array.from(raters.entries())) {
      raterSubjectCount.set(aid, (raterSubjectCount.get(aid) ?? 0) + 1);
    }
  }
  for (const [aid, count] of Array.from(raterSubjectCount.entries())) {
    if (count >= 2) activeRaterIds.push(aid);
  }
  // Second pass: build matrix with only active raters
  if (activeRaterIds.length >= 2) {
    for (const raters of Array.from(subjectRaterMap.values())) {
      const row = activeRaterIds.map((aid) => raters.get(aid) ?? 0);
      const nonZero = row.filter((v) => v > 0);
      if (nonZero.length >= 2) {
        // Replace zeros with the mean of non-zero values for ICC calculation
        const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
        iccMatrix.push(row.map((v) => v === 0 ? mean : v));
      }
    }
  }

  const iccScore = iccMatrix.length >= 2 ? calculateICC(iccMatrix) : null;
  const iccInterpretation = iccScore !== null ? getICCInterpretation(iccScore) : null;

  // Build bias metrics per assessor
  const assessorRatingsMap = new Map<string, { name: string; ratings: number[] }>();
  for (const r of ratings ?? []) {
    const assignment = r.assessor_assignments as unknown as {
      assessor_id: string;
      profiles: { full_name: string };
    };
    if (!assignment) continue;

    if (!assessorRatingsMap.has(assignment.assessor_id)) {
      assessorRatingsMap.set(assignment.assessor_id, {
        name: assignment.profiles?.full_name ?? t("adminAnalytics.unknown"),
        ratings: [],
      });
    }
    assessorRatingsMap.get(assignment.assessor_id)!.ratings.push(r.score);
  }

  const biasMetrics = calculateBiasMetrics(
    Array.from(assessorRatingsMap.entries()).map(([id, data]) => ({
      assessorId: id,
      assessorName: data.name,
      ratings: data.ratings,
    }))
  );

  // Score distribution
  const scoreDistribution = [0, 0, 0, 0, 0]; // index 0 = score 1, etc.
  for (const r of ratings ?? []) {
    if (r.score >= 1 && r.score <= 5) {
      scoreDistribution[r.score - 1]++;
    }
  }

  // Competency averages
  const compScoreMap = new Map<string, { name: string; total: number; count: number }>();
  for (const r of ratings ?? []) {
    const comp = r.competencies as unknown as { name: string } | null;
    const name = comp?.name ?? t("adminAnalytics.unknown");
    if (!compScoreMap.has(r.competency_id)) {
      compScoreMap.set(r.competency_id, { name, total: 0, count: 0 });
    }
    const entry = compScoreMap.get(r.competency_id)!;
    entry.total += r.score;
    entry.count++;
  }

  const competencyAverages = Array.from(compScoreMap.values()).map((c) => ({
    name: c.name,
    average: Math.round((c.total / c.count) * 100) / 100,
    count: c.count,
  }));

  // Build candidate comparison data
  const candidateComparisons = (candidates ?? []).map((c) => {
    const oar = (oars ?? []).find((o) => o.candidate_id === c.id);
    const candConsensus = (consensusRatings ?? []).filter((cr) => cr.candidate_id === c.id);
    const avgConsensus = candConsensus.length > 0
      ? candConsensus.reduce((sum, cr) => sum + cr.final_score, 0) / candConsensus.length
      : null;
    return {
      id: c.id,
      name: c.full_name,
      department: c.department ?? t("adminAnalytics.unassigned"),
      seniority: c.seniority_level ?? t("adminAnalytics.unknown"),
      oarScore: oar?.overall_score ?? null,
      recommendation: oar?.recommendation ?? null,
      avgCompetencyScore: avgConsensus ? Math.round(avgConsensus * 100) / 100 : null,
    };
  });

  // Department aggregation
  const deptMap = new Map<string, { total: number; count: number }>();
  for (const cc of candidateComparisons) {
    if (cc.oarScore !== null) {
      const dept = cc.department;
      const existing = deptMap.get(dept);
      if (existing) {
        existing.total += cc.oarScore;
        existing.count++;
      } else {
        deptMap.set(dept, { total: cc.oarScore, count: 1 });
      }
    }
  }
  const departmentAverages = Array.from(deptMap.entries()).map(([dept, data]) => ({
    department: dept,
    averageOAR: Math.round((data.total / data.count) * 100) / 100,
    count: data.count,
  }));

  return (
    <AnalyticsDashboard
      engagementCount={engagements?.length ?? 0}
      candidateCount={candidates?.length ?? 0}
      totalRatings={ratings?.length ?? 0}
      iccScore={iccScore}
      iccInterpretation={iccInterpretation}
      biasMetrics={biasMetrics}
      scoreDistribution={scoreDistribution}
      competencyAverages={competencyAverages}
      candidateComparisons={candidateComparisons}
      departmentAverages={departmentAverages}
    />
  );
}
