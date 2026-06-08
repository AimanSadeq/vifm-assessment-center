import { createClient } from "@/lib/supabase/server";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/back-link";
import { EngagementDetail } from "./_components/engagement-detail";
import { RecommendedCoursesPanel } from "@/components/shared/recommended-courses-panel";
import {
  recommendCoursesForAcCohort,
  recommendCoursesForAcCandidate,
} from "@/lib/recommender/courses";
import { getEngagementTechProgram } from "@/lib/competencies/engagement-tech-program";
import { TechnicalCertPanel } from "./_components/technical-cert-panel";
import { CandidateFilterBar } from "./_components/candidate-filter-bar";

type Props = {
  params: { id: string };
  searchParams: { candidate?: string };
};

export default async function EngagementDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const t = await getServerT();
  const { id } = params;
  const focusedCandidateId = searchParams.candidate ?? null;

  const [engResult, candsResult, exercisesResult, assignmentsResult, assessorsResult, matrixResult, wsResult, profilesResult] =
    await Promise.all([
      supabase
        .from("engagements")
        .select("*, organizations(name)")
        .eq("id", id)
        .single(),
      supabase
        .from("candidates")
        .select("*, role_profiles(id, name_en, name_ar)")
        .eq("engagement_id", id)
        .order("full_name"),
      supabase
        .from("engagement_exercises")
        .select("exercise_id, exercises(id, name, exercise_type, duration_minutes)")
        .eq("engagement_id", id),
      supabase
        .from("assessor_assignments")
        .select("*, profiles(id, full_name, email), candidates(id, full_name), exercises(id, name)")
        .eq("engagement_id", id),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["lead_assessor", "associate_assessor"]),
      supabase
        .from("exercise_competency_matrix")
        .select("exercise_id, competency_id, competencies(name, name_ar)")
        .eq("engagement_id", id),
      supabase
        .from("integration_worksheets")
        .select("*, competencies(name, name_ar), profiles:assessor_id(full_name)")
        .eq("engagement_id", id),
      supabase
        .from("role_profiles")
        .select("id, name_en, name_ar, target_role")
        .order("name_en"),
    ]);

  if (engResult.error || !engResult.data) return notFound();

  const engagement = engResult.data;
  const candidates = candsResult.data ?? [];
  const engExercises = exercisesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const assessors = assessorsResult.data ?? [];
  const matrix = matrixResult.data ?? [];
  const integrationWorksheets = wsResult.data ?? [];
  const roleProfiles = profilesResult.data ?? [];

  // G7 - re-engagement deltas: when this engagement was seeded from a
  // prior one, fetch the prior OAR for each carried-over candidate so
  // the candidate row can show "↑1 vs prior" or "↓1" once the new run
  // produces its own OAR. Skipped (and the map stays empty) when this
  // is a fresh engagement, which keeps the cost zero on the common path.
  const priorCandidateIds = candidates
    .map((c) => c.prior_candidate_id as string | null)
    .filter((x): x is string => !!x);
  const priorOarMap: Record<string, number> = {};
  const currentOarMap: Record<string, number> = {};
  if (priorCandidateIds.length > 0) {
    const [{ data: priorOars }, { data: currOars }] = await Promise.all([
      supabase
        .from("overall_assessment_ratings")
        .select("candidate_id, overall_score")
        .in("candidate_id", priorCandidateIds),
      supabase
        .from("overall_assessment_ratings")
        .select("candidate_id, overall_score")
        .eq("engagement_id", id),
    ]);
    for (const row of priorOars ?? []) {
      priorOarMap[row.candidate_id as string] = row.overall_score as number;
    }
    for (const row of currOars ?? []) {
      currentOarMap[row.candidate_id as string] = row.overall_score as number;
    }
  }

  // Extract exercises from junction table
  const exercises = engExercises
    .map((ee: Record<string, unknown>) => ee.exercises)
    .filter(Boolean) as Record<string, unknown>[];

  // Day 3 - VIFM training-course recommendations. Cohort-aggregated
  // by default; if the URL carries ?candidate=<id>, focus on just
  // that candidate's gaps so the consultant can use the panel as a
  // 1:1 development plan instead of a group plan.
  let recommendedCourses: Awaited<ReturnType<typeof recommendCoursesForAcCohort>> = [];
  try {
    recommendedCourses = focusedCandidateId
      ? await recommendCoursesForAcCandidate({
          engagementId: id,
          candidateId: focusedCandidateId,
        })
      : await recommendCoursesForAcCohort({ engagementId: id });
  } catch (e) {
    console.error("[ac-engagement-detail] recommender failed:", e);
  }
  const focusedCandidate = focusedCandidateId
    ? candidates.find((c) => c.id === focusedCandidateId)
    : null;

  // Technical certification program for this engagement (paid org layer).
  const techProgram = await getEngagementTechProgram(id, await getServerLocale());

  return (
    <div className="space-y-6">
      <BackLink href="/admin/engagements" label={t("adminEngagements.detail.backToProjects")} />
      <EngagementDetail
        engagement={engagement}
        candidates={candidates}
        exercises={exercises}
        assignments={assignments}
        assessors={assessors}
        matrix={matrix}
        integrationWorksheets={integrationWorksheets}
        roleProfiles={roleProfiles}
        priorOarMap={priorOarMap}
        currentOarMap={currentOarMap}
      />
      <CandidateFilterBar
        engagementId={id}
        candidates={candidates.map((c) => ({
          id: c.id as string,
          full_name: c.full_name as string,
        }))}
        focused={focusedCandidateId}
      />
      <RecommendedCoursesPanel
        title={
          focusedCandidate
            ? t("adminEngagements.detail.coursesTitleCandidate", { name: focusedCandidate.full_name as string })
            : t("adminEngagements.detail.coursesTitleCohort")
        }
        description={
          focusedCandidate
            ? t("adminEngagements.detail.coursesDescCandidate")
            : t("adminEngagements.detail.coursesDescCohort")
        }
        emptyMessage={
          focusedCandidate
            ? t("adminEngagements.detail.coursesEmptyCandidate", { name: focusedCandidate.full_name as string })
            : t("adminEngagements.detail.coursesEmptyCohort")
        }
        courses={recommendedCourses}
        context="ac"
      />
      <TechnicalCertPanel engagementId={id} program={techProgram} />
    </div>
  );
}
