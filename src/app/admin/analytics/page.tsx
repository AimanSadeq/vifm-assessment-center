import { createClient } from "@/lib/supabase/server";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";
import { localizedName } from "@/lib/i18n/localized";
import { getICCInterpretation, bestPairMatrix, pooledICC } from "@/lib/scoring/icc";
import { calculateBiasMetrics } from "@/lib/scoring/bias-detection";
import { fetchAllPages } from "@/lib/ara/paginate";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";

import { BackLink } from "@/components/shared/back-link";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const t = await getServerT();
  const rtl = getServerDir(await getServerLocale()) === "rtl";

  // Every cohort-scaled read is paginated: a single PostgREST select silently
  // caps at 1000 rows, which on any real multi-engagement install would truncate
  // ratings/candidates/OARs/consensus and corrupt the ICC, bias, and comparison
  // tables. Dashboards degrade (catch -> []) rather than abort.
  type RatingRow = {
    score: number;
    competency_id: string;
    competencies: { name: string; name_ar: string | null } | null;
    assessor_assignments: {
      assessor_id: string;
      candidate_id: string;
      engagement_id: string;
      profiles: { full_name: string } | null;
    } | null;
  };
  const ratings = await fetchAllPages<RatingRow>((from, to) =>
    supabase
      .from("ratings")
      .select(
        "id, score, competency_id, competencies(name, name_ar), assessor_assignments(assessor_id, candidate_id, engagement_id, profiles(full_name))"
      )
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: RatingRow[] | null; error: { message: string } | null }>
  ).catch(() => [] as RatingRow[]);

  const { data: engagements } = await supabase
    .from("engagements")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  type CandRow = {
    id: string;
    full_name: string;
    status: string;
    engagement_id: string;
    department: string | null;
    seniority_level: string | null;
  };
  const candidates = await fetchAllPages<CandRow>((from, to) =>
    supabase
      .from("candidates")
      .select("id, full_name, status, engagement_id, department, seniority_level")
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: CandRow[] | null; error: { message: string } | null }>
  ).catch(() => [] as CandRow[]);

  type OarRow = { candidate_id: string; overall_score: number; recommendation: string };
  const oars = await fetchAllPages<OarRow>((from, to) =>
    supabase
      .from("overall_assessment_ratings")
      .select("id, candidate_id, overall_score, recommendation")
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: OarRow[] | null; error: { message: string } | null }>
  ).catch(() => [] as OarRow[]);

  // Only candidate_id + final_score are consumed here (the per-competency
  // breakdown is built from `ratings`), so skip the competencies embed.
  type ConsRow = { candidate_id: string; competency_id: string; final_score: number };
  const consensusRatings = await fetchAllPages<ConsRow>((from, to) =>
    supabase
      .from("consensus_ratings")
      .select("id, candidate_id, competency_id, final_score")
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: ConsRow[] | null; error: { message: string } | null }>
  ).catch(() => [] as ConsRow[]);

  const subjectKey = (candidateId: string, competencyId: string) =>
    `${candidateId}:${competencyId}`;

  // ICC per engagement, complete-case. Ratings are grouped by engagement (no
  // cross-engagement pooling - assessors on different engagements never co-rate,
  // so comparing them is meaningless), and each engagement contributes its
  // largest genuinely-crossed rater-pair block with NO missing-cell imputation
  // (the old mean-imputation manufactured agreement and inflated the ICC).
  const ratingsByEngagement = new Map<string, RatingRow[]>();
  for (const r of ratings) {
    const eid = r.assessor_assignments?.engagement_id;
    if (!eid) continue;
    const list = ratingsByEngagement.get(eid);
    if (list) list.push(r);
    else ratingsByEngagement.set(eid, [r]);
  }
  const iccMatrices: number[][][] = [];
  for (const engRatings of Array.from(ratingsByEngagement.values())) {
    const subjectRaters = new Map<string, Map<string, number>>();
    for (const r of engRatings) {
      const a = r.assessor_assignments;
      if (!a) continue;
      const key = subjectKey(a.candidate_id, r.competency_id);
      let raters = subjectRaters.get(key);
      if (!raters) {
        raters = new Map();
        subjectRaters.set(key, raters);
      }
      raters.set(a.assessor_id, r.score);
    }
    const matrix = bestPairMatrix(subjectRaters);
    if (matrix) iccMatrices.push(matrix);
  }
  const iccScore = pooledICC(iccMatrices);
  const iccInterpretation = iccScore !== null ? getICCInterpretation(iccScore) : null;

  // Build bias metrics per assessor: flat ratings (mean/leniency/central-tendency)
  // plus per-candidate vectors (so haloEffect measures real within-candidate,
  // cross-competency agreement rather than pooled modal concentration).
  const assessorRatingsMap = new Map<
    string,
    { name: string; ratings: number[]; byCandidate: Map<string, number[]> }
  >();
  for (const r of ratings) {
    const a = r.assessor_assignments;
    if (!a) continue;
    let entry = assessorRatingsMap.get(a.assessor_id);
    if (!entry) {
      entry = {
        name: a.profiles?.full_name ?? t("adminAnalytics.unknown"),
        ratings: [],
        byCandidate: new Map(),
      };
      assessorRatingsMap.set(a.assessor_id, entry);
    }
    entry.ratings.push(r.score);
    const cand = entry.byCandidate.get(a.candidate_id);
    if (cand) cand.push(r.score);
    else entry.byCandidate.set(a.candidate_id, [r.score]);
  }

  const biasMetrics = calculateBiasMetrics(
    Array.from(assessorRatingsMap.entries()).map(([id, data]) => ({
      assessorId: id,
      assessorName: data.name,
      ratings: data.ratings,
      ratingsByCandidate: Array.from(data.byCandidate.values()),
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
    const comp = r.competencies as unknown as { name: string; name_ar: string | null } | null;
    const name = (comp ? localizedName(comp, rtl) : "") || t("adminAnalytics.unknown");
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
    <>
      <BackLink href="/admin" label="Back" history />
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
    </>
  );
}
